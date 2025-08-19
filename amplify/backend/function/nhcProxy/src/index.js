const axios = require('axios');
const yauzl = require('yauzl');
const xml2js = require('xml2js');
const zlib = require('zlib');

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov';
const NHC_ATCF_ADECK = 'https://ftp.nhc.noaa.gov/atcf/aid_public';
const NHC_ATCF_ADECK_SOURCES = [
  'https://ftp.nhc.noaa.gov/atcf/aid_public',
  'https://www.nhc.noaa.gov/atcf/aid_public',
  'https://www.nhc.noaa.gov/data/atcf/aid_public'
];
// Also try HTTP mirrors and NRL as a last resort for discovery only
const NHC_ATCF_ADECK_SOURCES_EXTRA = [
  'http://ftp.nhc.noaa.gov/atcf/aid_public',
  'https://www.nrlmry.navy.mil/atcf_web/data/aid_public'
];

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

// Utility: list S3 (public) using XML API
async function listS3Public(bucketHost, params) {
  const url = `${bucketHost}?${new URLSearchParams(params).toString()}`;
  const resp = await axios.get(url, { timeout: REQUEST_TIMEOUT, responseType: 'text' });
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(resp.data);
  return result?.ListBucketResult || {};
}

async function listAllCommonPrefixes(bucketHost, prefix) {
  let prefixes = [];
  let continuationToken = undefined;
  do {
    const params = { 'list-type': '2', prefix, delimiter: '/' };
    if (continuationToken) params['continuation-token'] = continuationToken;
    const res = await listS3Public(bucketHost, params);
    const pagePrefixes = res.CommonPrefixes ? (Array.isArray(res.CommonPrefixes) ? res.CommonPrefixes : [res.CommonPrefixes]) : [];
    prefixes = prefixes.concat(pagePrefixes);
    continuationToken = res.IsTruncated === 'true' || res.IsTruncated === true ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return prefixes;
}

async function getLatestGEFSPDSAvailability() {
  const bucket = 'https://noaa-gefs-pds.s3.amazonaws.com';
  // 1) List all dates: prefixes under 'gefs.' with pagination
  const prefixes = await listAllCommonPrefixes(bucket, 'gefs.');
  const dates = prefixes
    .map(p => (p.Prefix || '').match(/^gefs\.(\d{8})\/$/))
    .filter(Boolean)
    .map(m => m[1])
    .sort((a, b) => a.localeCompare(b));
  const latestDate = dates[dates.length - 1];
  if (!latestDate) return { date: null, cycle: null, members: [], resolutions: [] };
  // 2) List all cycles under date
  const cyclePrefixes = await listAllCommonPrefixes(bucket, `gefs.${latestDate}/`);
  const cycles = cyclePrefixes
    .map(p => (p.Prefix || '').match(/^gefs\.\d{8}\/(\d{2})\//))
    .filter(Boolean)
    .map(m => m[1])
    .sort((a, b) => a.localeCompare(b));
  const latestCycle = cycles[cycles.length - 1] || null;
  if (!latestCycle) return { date: latestDate, cycle: null, members: [], resolutions: [] };
  // 3) List atmos pgrb2a paths (0p50 and/or 0p25)
  // Try 0p25 first, then 0p50
  const bases = [
    `gefs.${latestDate}/${latestCycle}/atmos/pgrb2ap25/`,
    `gefs.${latestDate}/${latestCycle}/atmos/pgrb2ap5/`
  ];
  const membersSet = new Set();
  const resolutions = [];
  for (const base of bases) {
    try {
      const listFiles = await listS3Public(bucket, { 'list-type': '2', prefix: base });
      const files = listFiles.Contents ? (Array.isArray(listFiles.Contents) ? listFiles.Contents : [listFiles.Contents]) : [];
      if (files.length === 0) continue;
      const res = base.includes('p25') ? '0p25' : '0p50';
      resolutions.push(res);
      files.forEach(obj => {
        const key = obj.Key || '';
        const m = key.match(/\/(ge[cp]\d{2})\.t(\d{2})z\.pgrb2a\.0p(25|50)\./);
        if (m) membersSet.add(m[1]);
      });
    } catch (e) {
      // ignore missing resolution path
    }
  }
  const members = Array.from(membersSet).sort();
  return { date: latestDate, cycle: latestCycle, members, resolutions };
}

// Utility: parse lat/lon like 25.2N / 072.5W into signed decimals
function parseAtcfCoord(coordStr) {
  if (!coordStr || typeof coordStr !== 'string') return null;
  const s = coordStr.trim().toUpperCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([NSEW])$/);
  if (!m) return null;
  let val = parseFloat(m[1]);
  // ATCF A-deck commonly encodes coords as tenths of a degree without a decimal (e.g., 252N => 25.2, 0723W => 72.3)
  // If there's no explicit decimal point in the numeric portion, interpret it as tenths
  if (!m[1].includes('.')) {
    val = val / 10.0;
  }
  const hemi = m[2];
  if (hemi === 'S' || hemi === 'W') return -val;
  return val;
}

// Fetch and parse A-deck for GEFS-like models (AEM*, AE*)
async function fetchGEFSAdeckTracks(stormId) {
  const id = (stormId || '').toLowerCase();
  if (!/^([aezlp][a-z])\d{2}\d{4}$/i.test(id)) {
    throw new Error('Invalid stormId format');
  }
  // Try common A-deck filename patterns: 'aal' + id and plain id
  const adeck = await fetchAdeckText(id);
  const lines = adeck.text.split(/\r?\n/).filter(Boolean);
  const byModel = new Map();
  const modelsPresent = new Set();
  let latestCycle = null;
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 10) continue;
    // ATCF A-deck fields: basin(0), num(1), ymdh(2), technum/min(3), tech(4), tau(5), lat(6), lon(7), vmax(8), mslp(9), ...
    const ymdh = parts[2];
    const tech = parts[4];
    const tauStr = parts[5];
    const latStr = parts[6];
    const lonStr = parts[7];
    const vmaxStr = parts[8];
    if (!tech || !tauStr || !latStr || !lonStr) continue;
  // Filter GEFS-related techs:
  // - AE* (ensemble mean/controls from various centers)
  // - AP01..AP30 (GEFS individual perturbed members)
  if (!/^AE/i.test(tech) && !/^AP\d{2}$/i.test(tech)) continue;
    const tau = parseInt(tauStr, 10);
    const lat = parseAtcfCoord(latStr);
    const lon = parseAtcfCoord(lonStr);
    const vmax = parseInt(vmaxStr, 10) || null;
    if (!isFinite(tau) || lat === null || lon === null) continue;
    modelsPresent.add(tech);
    if (!byModel.has(tech)) byModel.set(tech, []);
  // lon string already encodes hemisphere (E/W) and parseAtcfCoord returns signed value
  // Do NOT invert again; just use the signed lon directly
  byModel.get(tech).push({ tau, lat, lon, vmax, ymdh });
    // Track latest cycle (ymdh max)
    if (ymdh && /\d{10}/.test(ymdh)) {
      if (!latestCycle || ymdh > latestCycle) latestCycle = ymdh;
    }
  }
  // Sort each model by tau and optionally only keep latest cycle entries if multiple cycles exist
  const tracks = [];
  for (const [model, pts] of byModel.entries()) {
    // If multiple cycles present, filter to latest ymdh
    let filtered = pts;
    const cycles = Array.from(new Set(pts.map(p => p.ymdh).filter(Boolean))).sort();
    if (cycles.length > 1) {
      const last = cycles[cycles.length - 1];
      filtered = pts.filter(p => p.ymdh === last);
    }
    filtered.sort((a, b) => a.tau - b.tau);
    tracks.push({ modelId: model, points: filtered.map(({ tau, lat, lon, vmax }) => ({ tau, lat, lon, vmax })) });
  }
  return {
  filename: adeck.filename || `${id}.dat`,
    modelsPresent: Array.from(modelsPresent).sort(),
    tracks
  };
}

// Utility: list unique tech codes present in an A-deck for debugging/inspection
async function listAdeckTechs(stormId) {
  const id = (stormId || '').toLowerCase();
  if (!/^([aezlp][a-z])\d{2}\d{4}$/i.test(id)) {
    throw new Error('Invalid stormId format');
  }
  const adeck = await fetchAdeckText(id);
  const lines = adeck.text.split(/\r?\n/).filter(Boolean);
  const techs = new Set();
  lines.forEach(line => {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length >= 5) {
      const tech = parts[4];
      if (tech) techs.add(tech);
    }
  });
  return { filename: adeck.filename || `${id}.dat`, techs: Array.from(techs).sort(), count: techs.size };
}

// Helper: fetch A-deck text trying multiple filename patterns
async function fetchAdeckText(id) {
  const attempted = [];
  const candidates = [];
  for (const base of NHC_ATCF_ADECK_SOURCES) {
    // Plain .dat
    candidates.push(`${base}/a${id}.dat`); // e.g., aal052025.dat
    candidates.push(`${base}/${id}.dat`);  // e.g., al052025.dat
    // Gzip .dat.gz
    candidates.push(`${base}/a${id}.dat.gz`);
    candidates.push(`${base}/${id}.dat.gz`);
  }
  let lastErr;
  for (const url of candidates) {
    attempted.push(url);
    try {
      // Use arraybuffer to support raw gzip payloads as well as plain text
      const resp = await axios.get(url, { timeout: 20000, responseType: 'arraybuffer' });
      let buf = Buffer.from(resp.data);
      if (!buf || buf.length === 0) continue;
      const isGzip = url.toLowerCase().endsWith('.gz') || (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b);
      let text;
      if (isGzip) {
        try {
          const unzipped = zlib.gunzipSync(buf);
          text = unzipped.toString('utf8');
        } catch (unzErr) {
          lastErr = unzErr;
          continue;
        }
      } else {
        text = buf.toString('utf8');
      }
      if (typeof text === 'string' && text.trim().length > 0) {
        const filename = url.substring(url.lastIndexOf('/') + 1);
        return { text, filename };
      }
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  // As a fallback, try to discover the exact filename by scraping directory listings
  try {
    const discovered = await discoverAdeckFilename(id);
    if (discovered && discovered.url) {
      attempted.push(discovered.url);
      const resp = await axios.get(discovered.url, { timeout: 20000, responseType: 'text' });
      if (typeof resp.data === 'string' && resp.data.trim().length > 0) {
        return { text: resp.data, filename: discovered.filename };
      }
    }
  } catch (e) {
    lastErr = e;
  }
  const err = new Error(`A-deck file not found for ${id}. Attempted: ${attempted.join(', ')}`);
  err.attempted = attempted;
  throw err;
}

// Discover A-deck filename by listing directory index pages across sources
async function discoverAdeckFilename(id) {
  const patterns = [
  new RegExp(`a${id}\.dat(\.gz)?`, 'i'), // aal052025.dat or .dat.gz
  new RegExp(`${id}\.dat(\.gz)?`, 'i')   // al052025.dat or .dat.gz
  ];
  const sources = [...NHC_ATCF_ADECK_SOURCES, ...NHC_ATCF_ADECK_SOURCES_EXTRA];
  for (const base of sources) {
    try {
      const indexUrl = `${base}/`;
      const resp = await axios.get(indexUrl, { timeout: 20000, responseType: 'text' });
      const html = String(resp.data || '');
      for (const pat of patterns) {
    const m = html.match(new RegExp(`href=["']([^"'>]*${pat.source})["']`, 'i')) || html.match(pat);
        if (m) {
          const filename = (m[1] || m[0]).split('/').pop();
          const url = `${base}/${filename}`;
          return { filename, url };
        }
      }
    } catch (e) {
      // ignore and try next base
    }
  }
  return null;
}

/**
 * Parse KMZ file and extract track data as GeoJSON
 */
async function parseKmzToTrackGeoJSON(kmzBuffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Error opening KMZ file:', err);
        return reject(err);
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.toLowerCase().endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error reading KML from KMZ:', err);
              return reject(err);
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!kmlContent) {
          return reject(new Error('No KML file found in KMZ'));
        }

        // Parse KML and extract track data
        extractTrackFromKML(kmlContent)
          .then(resolve)
          .catch(reject);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract track data from KML content
 */
async function extractTrackFromKML(kmlContent) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(kmlContent);

    // Find track placemarks in KML
    const features = [];
    
    function findPlacemarks(obj) {
      if (!obj) return;
      
      if (obj.Placemark) {
        const placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        
        placemarks.forEach(placemark => {
          if (placemark.LineString && placemark.LineString.coordinates) {
            // Track line
            const coordString = placemark.LineString.coordinates.trim();
            const coords = coordString.split(/\s+/).map(coord => {
              const [lon, lat, alt] = coord.split(',').map(Number);
              return [lon, lat];
            });

            features.push({
              type: 'Feature',
              properties: {
                name: placemark.name || 'Track',
                description: placemark.description || ''
              },
              geometry: {
                type: 'LineString',
                coordinates: coords
              }
            });
          } else if (placemark.Point && placemark.Point.coordinates) {
            // Track point
            const coordString = placemark.Point.coordinates.trim();
            const [lon, lat] = coordString.split(',').map(Number);

            // Extract intensity information
            const description = placemark.description || '';
            const properties = {
              name: placemark.name || 'Forecast Position',
              description: description,
              datetime: placemark.dtg || placemark.name || '',
              stormType: placemark.stormType || '',
              intensity: placemark.intensity ? parseInt(placemark.intensity) : null,
              intensityMPH: placemark.intensityMPH ? parseInt(placemark.intensityMPH) : null,
              minSeaLevelPres: placemark.minSeaLevelPres ? parseInt(placemark.minSeaLevelPres) : null,
              stormName: placemark.stormName || '',
              basin: placemark.basin || ''
            };

            // Parse wind speed and other data from description if available
            if (description) {
              // Extract wind speed in knots
              const windMatch = description.match(/Maximum Wind:\s*(\d+)\s*knots/);
              if (windMatch) {
                properties.intensity = parseInt(windMatch[1]);
              }
              
              // Extract wind speed in mph
              const windMphMatch = description.match(/Maximum Wind:\s*\d+\s*knots\s*\((\d+)\s*mph\)/);
              if (windMphMatch) {
                properties.intensityMPH = parseInt(windMphMatch[1]);
              }
              
              // Extract pressure
              const pressureMatch = description.match(/Minimum Pressure:\s*(\d+)\s*mb/);
              if (pressureMatch) {
                properties.minSeaLevelPres = parseInt(pressureMatch[1]);
              }
              
              // Extract valid time/forecast hour
              const timeMatch = description.match(/Valid at:\s*([^<]+)/);
              if (timeMatch) {
                properties.datetime = timeMatch[1].trim();
              }
              
              // Extract forecast hour
              const forecastMatch = description.match(/(\d+)\s*hr\s*Forecast/);
              if (forecastMatch) {
                properties.forecastHour = parseInt(forecastMatch[1]);
              }
            }

            // Determine intensity category and display text
            if (placemark.styleUrl) {
              const style = placemark.styleUrl.replace('#', '');
              properties.styleCategory = style;
              
              // Map style to display category based on NHC KMZ style patterns
              switch (style) {
                case 'initial_point':
                  properties.category = 'NOW';
                  break;
                case 'xd_point':
                case 'd_point':
                  properties.category = 'TD';
                  break;
                case 'xs_point':
                case 's_point':
                  properties.category = 'TS';
                  break;
                case 'xh_point':
                case 'h_point':
                  properties.category = '1-2';
                  break;
                case 'xm_point':
                case 'm_point':
                  properties.category = '3-5';
                  break;
                case 'td':
                  properties.category = 'TD';
                  break;
                case 'ts':
                  properties.category = 'TS';
                  break;
                case 'cat1':
                  properties.category = '1';
                  break;
                case 'cat2':
                  properties.category = '2';
                  break;
                case 'cat3':
                  properties.category = '3';
                  break;
                case 'cat4':
                  properties.category = '4';
                  break;
                case 'cat5':
                  properties.category = '5';
                  break;
                case 'ex':
                  properties.category = 'EX';
                  break;
                default:
                  properties.category = style.toUpperCase();
              }
            }
            
            // Refine intensity category based on actual wind speed if available
            if (properties.intensity) {
              const windKnots = properties.intensity;
              if (windKnots < 34) {
                properties.category = 'TD';
              } else if (windKnots < 64) {
                properties.category = 'TS';
              } else if (windKnots < 83) {
                properties.category = '1';
              } else if (windKnots < 96) {
                properties.category = '2';
              } else if (windKnots < 113) {
                properties.category = '3';
              } else if (windKnots < 137) {
                properties.category = '4';
              } else {
                properties.category = '5';
              }
            }

            features.push({
              type: 'Feature',
              properties: properties,
              geometry: {
                type: 'Point',
                coordinates: [lon, lat]
              }
            });
          }
        });
      }

      // Recursively search in folders
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(findPlacemarks);
      }
      
      if (obj.Document) {
        findPlacemarks(obj.Document);
      }
    }

    if (result.kml) {
      findPlacemarks(result.kml);
    }

    return {
      type: 'FeatureCollection',
      features: features,
      source: 'kmz'
    };

  } catch (error) {
    console.error('Error parsing KML for track:', error);
    throw error;
  }
}

/**
 * Parse KMZ file and extract cone data as GeoJSON
 */
async function parseKmzToConeGeoJSON(kmzBuffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Error opening KMZ file for cone:', err);
        return reject(err);
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.toLowerCase().endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error reading KML from cone KMZ:', err);
              return reject(err);
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!kmlContent) {
          return reject(new Error('No KML file found in cone KMZ'));
        }

        // Parse KML and extract cone data
        extractConeFromKML(kmlContent)
          .then(resolve)
          .catch(reject);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract cone data from KML content
 */
async function extractConeFromKML(kmlContent) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(kmlContent);

    // Find cone polygons in KML
    const features = [];
    
    function findConePolygons(obj) {
      if (!obj) return;
      
      if (obj.Placemark) {
        const placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        
        placemarks.forEach(placemark => {
          if (placemark.Polygon && placemark.Polygon.outerBoundaryIs) {
            // Extract polygon coordinates
            const outerRing = placemark.Polygon.outerBoundaryIs.LinearRing;
            if (outerRing && outerRing.coordinates) {
              const coordString = outerRing.coordinates.trim();
              const coords = coordString.split(/\s+/).map(coord => {
                const [lon, lat, alt] = coord.split(',').map(Number);
                return [lon, lat];
              });

              features.push({
                type: 'Feature',
                properties: {
                  name: placemark.name || 'Forecast Cone',
                  description: placemark.description || ''
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [coords]
                }
              });
            }
          }
        });
      }

      // Recursively search in folders
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(findConePolygons);
      }
      
      if (obj.Document) {
        findConePolygons(obj.Document);
      }
    }

    if (result.kml) {
      findConePolygons(result.kml);
    }

    return {
      type: 'FeatureCollection',
      features: features,
      source: 'kmz'
    };

  } catch (error) {
    console.error('Error parsing KML for cone:', error);
    throw error;
  }
}

/**
 * Parse KMZ file and extract storm surge data as GeoJSON
 */
async function parseKmzToSurgeGeoJSON(kmzBuffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Error opening KMZ file for storm surge:', err);
        return reject(err);
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.toLowerCase().endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error reading KML from storm surge KMZ:', err);
              return reject(err);
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!kmlContent) {
          return reject(new Error('No KML file found in storm surge KMZ'));
        }

        // Parse KML and extract storm surge data
        extractSurgeFromKML(kmlContent)
          .then(resolve)
          .catch(reject);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract storm surge data from KML content
 */
async function extractSurgeFromKML(kmlContent) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(kmlContent);

    // Find storm surge polygons in KML
    const features = [];
    
    function findSurgePolygons(obj) {
      if (!obj) return;
      
      if (obj.Placemark) {
        const placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        
        placemarks.forEach(placemark => {
          if (placemark.Polygon && placemark.Polygon.outerBoundaryIs) {
            // Extract polygon coordinates
            const outerRing = placemark.Polygon.outerBoundaryIs.LinearRing;
            if (outerRing && outerRing.coordinates) {
              const coordString = outerRing.coordinates.trim();
              const coords = coordString.split(/\s+/).map(coord => {
                const [lon, lat, alt] = coord.split(',').map(Number);
                return [lon, lat];
              });

              // Extract storm surge height from placemark name or description
              let surgeHeight = 0;
              const name = placemark.name || '';
              const description = placemark.description || '';
              
              // Try to extract surge height from name (e.g., "3-6 ft", "6-9 ft")
              const heightMatch = name.match(/(\d+)-(\d+)\s*ft/i) || description.match(/(\d+)-(\d+)\s*ft/i);
              if (heightMatch) {
                surgeHeight = parseInt(heightMatch[2]); // Use upper bound
              }

              features.push({
                type: 'Feature',
                properties: {
                  name: placemark.name || 'Storm Surge Area',
                  description: placemark.description || '',
                  SURGE_FT: surgeHeight,
                  height: surgeHeight
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [coords]
                }
              });
            }
          }
        });
      }

      // Recursively search in folders
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(findSurgePolygons);
      }
      
      if (obj.Document) {
        findSurgePolygons(obj.Document);
      }
    }

    if (result.kml) {
      findSurgePolygons(result.kml);
    }

    return {
      type: 'FeatureCollection',
      features: features,
      source: 'kmz'
    };

  } catch (error) {
    console.error('Error parsing KML for storm surge:', error);
    throw error;
  }
}

/**
 * Parse KMZ file and extract wind speed probability data as GeoJSON
 */
async function parseKmzToWindProbGeoJSON(kmzBuffer, windSpeed = '34kt') {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Error opening KMZ file for wind probability:', err);
        return reject(err);
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.toLowerCase().endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error reading KML from wind probability KMZ:', err);
              return reject(err);
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!kmlContent) {
          return reject(new Error('No KML file found in wind probability KMZ'));
        }

        // Parse KML and extract wind probability data
        extractWindProbFromKML(kmlContent, windSpeed)
          .then(resolve)
          .catch(reject);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract wind speed probability data from KML content
 */
async function extractWindProbFromKML(kmlContent, windSpeed = '34kt') {
  try {
    const parser = new xml2js.Parser({ 
      explicitArray: false, 
      ignoreAttrs: false,
      mergeAttrs: true 
    });
    const result = await parser.parseStringPromise(kmlContent);
    
    const features = [];

    function findWindProbPolygons(obj) {
      if (!obj) return;

      // Look for placemarks with polygon data in folders
      if (obj.Folder && obj.Folder.Placemark) {
        const placemarks = Array.isArray(obj.Folder.Placemark) ? obj.Folder.Placemark : [obj.Folder.Placemark];
        
        placemarks.forEach(placemark => {
          // Handle MultiGeometry containing multiple polygons
          if (placemark.MultiGeometry && placemark.MultiGeometry.Polygon) {
            const polygons = Array.isArray(placemark.MultiGeometry.Polygon) ? 
              placemark.MultiGeometry.Polygon : [placemark.MultiGeometry.Polygon];
            
            polygons.forEach((polygon, polyIndex) => {
              processPolygon(polygon, placemark, polyIndex);
            });
          } 
          // Handle single polygon
          else if (placemark.Polygon) {
            processPolygon(placemark.Polygon, placemark, 0);
          }
        });
      }
      
      // Also look for direct placemarks
      if (obj.Placemark) {
        const placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        
        placemarks.forEach(placemark => {
          if (placemark.MultiGeometry && placemark.MultiGeometry.Polygon) {
            const polygons = Array.isArray(placemark.MultiGeometry.Polygon) ? 
              placemark.MultiGeometry.Polygon : [placemark.MultiGeometry.Polygon];
            
            polygons.forEach((polygon, polyIndex) => {
              processPolygon(polygon, placemark, polyIndex);
            });
          } else if (placemark.Polygon) {
            processPolygon(placemark.Polygon, placemark, 0);
          }
        });
      }

      // Recursively search in folders
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(findWindProbPolygons);
      }
      
      if (obj.Document) {
        findWindProbPolygons(obj.Document);
      }
    }
    
    function processPolygon(polygon, placemark, polygonIndex) {
      if (polygon.outerBoundaryIs && 
          polygon.outerBoundaryIs.LinearRing && 
          polygon.outerBoundaryIs.LinearRing.coordinates) {
        
        const coordinatesText = polygon.outerBoundaryIs.LinearRing.coordinates;
        if (typeof coordinatesText === 'string') {
          const coords = coordinatesText.trim().split(/\s+/).map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          });

          // Extract probability percentage from name
          let probability = 0;
          const name = placemark.name || '';
          const description = placemark.description || '';
          
          // Handle different probability formats from NHC
          if (name.includes('<5%') || name.includes('&lt;5%')) {
            probability = 2.5; // Use middle of range
          } else if (name.includes('>90%') || name.includes('&gt;90%')) {
            probability = 95; // Use representative value
          } else {
            // Handle ranges like "80-90", "34-50", etc.
            const rangeMatch = name.match(/(\d+)-(\d+)/);
            if (rangeMatch) {
              const min = parseFloat(rangeMatch[1]);
              const max = parseFloat(rangeMatch[2]);
              probability = (min + max) / 2; // Use middle of range
            } else {
              // Try to extract single percentage
              const probMatch = name.match(/(\d+(?:\.\d+)?)\s*%?/);
              if (probMatch) {
                probability = parseFloat(probMatch[1]);
              }
            }
          }

          // Get style information for color coding
          let styleId = null;
          if (placemark.styleUrl) {
            styleId = placemark.styleUrl.replace('#', '');
          }

          features.push({
            type: 'Feature',
            properties: {
              name: name,
              description: description,
              probability: probability,
              styleId: styleId,
              windSpeed: windSpeed, // Dynamic wind speed based on endpoint
              type: 'wind_probability',
              polygonIndex: polygonIndex
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords]
            }
          });
        }
      }
    }

    if (result.kml) {
      findWindProbPolygons(result.kml);
    }

    return {
      type: 'FeatureCollection',
      features: features,
      source: 'kmz'
    };

  } catch (error) {
    console.error('Error parsing KML for wind probability:', error);
    throw error;
  }
}

/**
 * Parse wind arrival KMZ data and convert to GeoJSON
 */
async function parseKmzToWindArrivalGeoJSON(kmzBuffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('Error opening KMZ file for wind arrival:', err);
        return reject(err);
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.toLowerCase().endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error reading KML from wind arrival KMZ:', err);
              return reject(err);
            }

            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!kmlContent) {
          return reject(new Error('No KML file found in wind arrival KMZ'));
        }

        // Parse KML and extract wind arrival data
        extractWindArrivalFromKML(kmlContent)
          .then(resolve)
          .catch(reject);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract wind arrival time data from KML content
 */
async function extractWindArrivalFromKML(kmlContent) {
  try {
    const parser = new xml2js.Parser({ 
      explicitArray: false, 
      ignoreAttrs: false,
      mergeAttrs: true 
    });
    const result = await parser.parseStringPromise(kmlContent);
    
    const features = [];
    const styleMap = {}; // Map style IDs to time information

    // First, extract style definitions to understand time mapping
    function extractStyles(obj) {
      if (!obj) return;
      
      if (obj.Style) {
        const styles = Array.isArray(obj.Style) ? obj.Style : [obj.Style];
        styles.forEach(style => {
          if (style.id && style.IconStyle && style.IconStyle.Icon && style.IconStyle.Icon.href) {
            const href = style.IconStyle.Icon.href;
            const filename = href.split('/').pop(); // Get filename from path
            const label = filename.replace('.png', ''); // Remove extension
            styleMap[style.id] = label;
          }
        });
      }
      
      // Look in folders and documents for styles
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(extractStyles);
      }
      
      if (obj.Document) {
        extractStyles(obj.Document);
      }
    }
    
    // Extract styles first
    extractStyles(result.kml);
    
    // Helper function to convert word numbers to digits for hours
    function convertHourWordToNumber(text) {
      const numberMap = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6',
        'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12'
      };
      return numberMap[text.toLowerCase()] || text;
    }

    // Helper function to build time string from related styles
    function buildTimeFromStyleId(styleId) {
      if (!styleId) return null;
      
      // Extract base style number (e.g., "style1" from "style1a")
      const baseMatch = styleId.match(/^style(\d+)/);
      if (!baseMatch) return null;
      
      const baseNumber = baseMatch[1];
      const basePattern = `style${baseNumber}`;
      
      // Find all related styles (a, b, c variants)
      const relatedStyles = {};
      Object.keys(styleMap).forEach(id => {
        if (id.startsWith(basePattern)) {
          const suffix = id.replace(basePattern, '');
          relatedStyles[suffix] = styleMap[id];
        }
      });
      
      // Build time string from components
      let day = '';
      let hour = '';
      let period = '';
      
      // Map common label patterns
      Object.values(relatedStyles).forEach(label => {
        if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(label)) {
          day = label;
        } else if (['am', 'pm'].includes(label.toLowerCase())) {
          period = label.toUpperCase();
        } else if (['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'].includes(label.toLowerCase())) {
          // Convert word numbers to digits
          const numberMap = {
            'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6',
            'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12'
          };
          hour = numberMap[label.toLowerCase()] || label;
        } else if (/^\d+$/.test(label)) {
          hour = label;
        }
      });
      
      // Combine components
      if (day && hour && period) {
        return `${day} ${hour} ${period}`;
      } else if (hour && period) {
        return `${hour} ${period}`;
      } else if (day) {
        return day;
      }
      
      return styleMap[styleId] || null; // Fallback to direct style mapping
    }

    function findWindArrivalPolygons(obj) {
      if (!obj) return;

      // Look for placemarks with point, line, or polygon data
      if (obj.Placemark) {
        const placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        
        placemarks.forEach(placemark => {
          // Handle Point geometries for wind arrival time labels
          if (placemark.Point) {
            processWindArrivalPoint(placemark.Point, placemark, 0);
          }
          // Handle LineString geometries for wind arrival time lines
          else if (placemark.LineString) {
            processWindArrivalLineString(placemark.LineString, placemark, 0);
          }
          // Also handle any polygon data if present
          else if (placemark.MultiGeometry) {
            if (placemark.MultiGeometry.Point) {
              const points = Array.isArray(placemark.MultiGeometry.Point) ? 
                placemark.MultiGeometry.Point : [placemark.MultiGeometry.Point];
              points.forEach((point, pointIndex) => {
                processWindArrivalPoint(point, placemark, pointIndex);
              });
            }
            if (placemark.MultiGeometry.LineString) {
              const lines = Array.isArray(placemark.MultiGeometry.LineString) ? 
                placemark.MultiGeometry.LineString : [placemark.MultiGeometry.LineString];
              lines.forEach((line, lineIndex) => {
                processWindArrivalLineString(line, placemark, lineIndex);
              });
            }
            if (placemark.MultiGeometry.Polygon) {
              const polygons = Array.isArray(placemark.MultiGeometry.Polygon) ? 
                placemark.MultiGeometry.Polygon : [placemark.MultiGeometry.Polygon];
              polygons.forEach((polygon, polyIndex) => {
                processWindArrivalPolygon(polygon, placemark, polyIndex);
              });
            }
          } else if (placemark.Polygon) {
            processWindArrivalPolygon(placemark.Polygon, placemark, 0);
          }
        });
      }

      // Look in folders
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(findWindArrivalPolygons);
      }
      
      if (obj.Document) {
        findWindArrivalPolygons(obj.Document);
      }
    }
    
    function processWindArrivalLineString(lineString, placemark, lineIndex) {
      if (lineString.coordinates) {
        const coordinatesText = lineString.coordinates;
        if (typeof coordinatesText === 'string') {
          const coords = coordinatesText.trim().split(/\s+/).map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          });

          // Extract arrival time information from name and description
          const name = placemark.name || '';
          const description = placemark.description || '';
          
          // Get style information for visual representation
          let styleId = null;
          if (placemark.styleUrl) {
            styleId = placemark.styleUrl.replace('#', '');
          }
          
          // Use style mapping to get time information
          let arrivalTime = buildTimeFromStyleId(styleId);
          
          // Fallback to parsing name/description if style mapping fails
          if (!arrivalTime) {
            const timePatterns = [
              /(\w{3})\s+(\d{1,2})\s*(AM|PM)/i, // "Wed 8 AM", "Fri 2 PM"
              /(\d{1,2})\s*(AM|PM)\s*(\w{3})/i, // "8 AM Wed", "2 PM Fri"
              /(\d{1,2}):(\d{2})\s*(AM|PM)/i,   // "08:00 AM"
              /(\d{4})\s*(UTC|GMT)/i            // "0800 UTC"
            ];
            
            for (const pattern of timePatterns) {
              const match = (name + ' ' + description).match(pattern);
              if (match) {
                arrivalTime = match[0];
                break;
              }
            }
          }

          features.push({
            type: 'Feature',
            properties: {
              name: name,
              description: description,
              arrivalTime: arrivalTime,
              styleId: styleId,
              windSpeed: '34kt', // Wind arrival is typically for tropical storm force winds
              type: 'wind_arrival_line',
              lineIndex: lineIndex
            },
            geometry: {
              type: 'LineString',
              coordinates: coords
            }
          });
        }
      }
    }
    
    // Store individual label components to group later (moved to outer scope)
    const labelComponents = [];
    
    function processWindArrivalPoint(point, placemark, pointIndex) {
      if (point.coordinates) {
        const coordinatesText = point.coordinates;
        if (typeof coordinatesText === 'string') {
          const coords = coordinatesText.trim().split(',').map(Number);
          const [lon, lat] = coords;

          // Extract arrival time information from name and description
          const name = placemark.name || '';
          const description = placemark.description || '';
          
          // Get style information for visual representation
          let styleId = null;
          if (placemark.styleUrl) {
            styleId = placemark.styleUrl.replace('#', '');
          }
          
          // Extract icon filename from style
          let iconType = null;
          if (styleId) {
            // Parse style number and component (a, b, c)
            const styleMatch = styleId.match(/style(\d+)([abc])/);
            if (styleMatch) {
              const groupNumber = styleMatch[1];
              const component = styleMatch[2];
              
              // Store this component for grouping
              labelComponents.push({
                groupNumber: groupNumber,
                component: component,
                coordinates: [lon, lat],
                styleId: styleId,
                name: name,
                description: description
              });
              return; // Don't create individual features yet
            }
          }
          
          // Fallback for non-grouped points
          let arrivalTime = buildTimeFromStyleId(styleId);
          if (!arrivalTime) {
            const timePatterns = [
              /(\w{3})\s+(\d{1,2})\s*(AM|PM)/i, // "Wed 8 AM", "Fri 2 PM"
              /(\d{1,2})\s*(AM|PM)\s*(\w{3})/i, // "8 AM Wed", "2 PM Fri"
              /(\d{1,2}):(\d{2})\s*(AM|PM)/i,   // "08:00 AM"
              /(\d{4})\s*(UTC|GMT)/i            // "0800 UTC"
            ];
            
            for (const pattern of timePatterns) {
              const match = (name + ' ' + description).match(pattern);
              if (match) {
                arrivalTime = match[0];
                break;
              }
            }
          }

          // Create single marker for non-grouped points
          features.push({
            type: 'Feature',
            properties: {
              name: name,
              description: description,
              arrivalTime: arrivalTime || 'Unknown',
              styleId: styleId,
              windSpeed: '34kt',
              type: 'wind_arrival_point',
              pointIndex: pointIndex
            },
            geometry: {
              type: 'Point',
              coordinates: [lon, lat]
            }
          });
        }
      }
    }
    
    function processWindArrivalPolygon(polygon, placemark, polygonIndex) {
      if (polygon.outerBoundaryIs && 
          polygon.outerBoundaryIs.LinearRing && 
          polygon.outerBoundaryIs.LinearRing.coordinates) {
        
        const coordinatesText = polygon.outerBoundaryIs.LinearRing.coordinates;
        if (typeof coordinatesText === 'string') {
          const coords = coordinatesText.trim().split(/\s+/).map(coord => {
            const [lon, lat] = coord.split(',').map(Number);
            return [lon, lat];
          });

          // Extract arrival time information from name and description
          const name = placemark.name || '';
          const description = placemark.description || '';
          
          // Parse arrival time (could be in various formats)
          let arrivalTime = null;
          let timeWindow = null;
          
          // Common time patterns in NHC data
          const timePatterns = [
            /(\d{1,2})\s*(AM|PM)\s*(UTC|GMT)/i,
            /(\d{1,2}):(\d{2})\s*(AM|PM)\s*(UTC|GMT)/i,
            /(\d{4})\s*(UTC|GMT)/i,
            /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[\s,]*(\d{1,2})\s*(AM|PM)/i
          ];
          
          for (const pattern of timePatterns) {
            const match = (name + ' ' + description).match(pattern);
            if (match) {
              arrivalTime = match[0];
              break;
            }
          }

          // Get style information for color coding
          let styleId = null;
          if (placemark.styleUrl) {
            styleId = placemark.styleUrl.replace('#', '');
          }

          features.push({
            type: 'Feature',
            properties: {
              name: name,
              description: description,
              arrivalTime: arrivalTime,
              styleId: styleId,
              windSpeed: '34kt', // Wind arrival is typically for tropical storm force winds
              type: 'wind_arrival',
              polygonIndex: polygonIndex
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords]
            }
          });
        }
      }
    }

    if (result.kml) {
      findWindArrivalPolygons(result.kml);
    }

    // Group label components by arrival time
    const groupedComponents = {};
    labelComponents.forEach(component => {
      if (!groupedComponents[component.groupNumber]) {
        groupedComponents[component.groupNumber] = {};
      }
      groupedComponents[component.groupNumber][component.component] = component;
    });

    // Create grouped arrival point features
    Object.keys(groupedComponents).forEach(groupNumber => {
      const group = groupedComponents[groupNumber];
      
      // We expect components a, b, c for day, hour, am/pm
      if (group.a && group.b && group.c) {
        // Calculate average position for the group
        const avgLon = (group.a.coordinates[0] + group.b.coordinates[0] + group.c.coordinates[0]) / 3;
        const avgLat = (group.a.coordinates[1] + group.b.coordinates[1] + group.c.coordinates[1]) / 3;
        
        // Build arrival time from style IDs
        const arrivalTime = buildTimeFromStyleId(group.a.styleId) || 
                           buildTimeFromStyleId(group.b.styleId) || 
                           buildTimeFromStyleId(group.c.styleId) ||
                           'Unknown';

        // Create main arrival point feature
        features.push({
          type: 'Feature',
          properties: {
            name: '',
            description: '',
            arrivalTime: arrivalTime,
            styleId: `group${groupNumber}`,
            windSpeed: '34kt',
            type: 'wind_arrival_group',
            pointIndex: 0,
            components: [
              {
                type: 'day',
                styleId: group.a.styleId,
                text: styleMap[group.a.styleId] || '',
                coordinates: group.a.coordinates,
                offset: [-0.01, 0.01] // Northwest offset
              },
              {
                type: 'hour', 
                styleId: group.b.styleId,
                text: convertHourWordToNumber(styleMap[group.b.styleId] || ''),
                coordinates: group.b.coordinates,
                offset: [0.01, 0.01] // Northeast offset
              },
              {
                type: 'period',
                styleId: group.c.styleId,
                text: styleMap[group.c.styleId] || '',
                coordinates: group.c.coordinates,
                offset: [0, -0.01] // South offset
              }
            ]
          },
          geometry: {
            type: 'Point',
            coordinates: [avgLon, avgLat]
          }
        });
      }
    });

    return {
      type: 'FeatureCollection',
      features: features,
      source: 'kmz'
    };

  } catch (error) {
    console.error('Error parsing KML for wind arrival:', error);
    throw error;
  }
}

/**
 * Lambda handler for NHC API proxy
 */
exports.handler = async (event) => {
  console.log('NHC Proxy Lambda invoked:', JSON.stringify(event, null, 2));

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight response' })
    };
  }

  try {
    // Extract parameters from the request
    const { httpMethod, pathParameters, queryStringParameters } = event;
    
    if (httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method not allowed. Only GET requests are supported.' })
      };
    }

    // Determine which NHC endpoint to call based on path
    const endpoint = pathParameters?.proxy || 'active-storms';
    let nhcUrl;
    let isKmzEndpoint = false;
    
    switch (endpoint) {
      case 'active-storms':
        nhcUrl = `${NHC_BASE_URL}/CurrentStorms.json`;
        break;
      case 'adeck-techs': {
        const stormId = queryStringParameters?.stormId;
        if (!stormId) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'stormId is required' }) };
        }
        try {
          const result = await listAdeckTechs(stormId);
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, endpoint: 'adeck-techs', data: result }) };
        } catch (e) {
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, endpoint: 'adeck-techs', data: { message: e.message, filename: `${stormId.toLowerCase()}.dat`, techs: [], count: 0 } }) };
        }
      }
      case 'gefs-adeck': {
        const stormId = queryStringParameters?.stormId;
        if (!stormId) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'stormId is required' }) };
        }
        try {
          const result = await fetchGEFSAdeckTracks(stormId);
          // Wrap in data for consistency with other endpoints
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, endpoint: 'gefs-adeck', data: result }) };
        } catch (e) {
          // Still return success with empty data to indicate "no data available" rather than an error
          return { 
            statusCode: 200, 
            headers: corsHeaders, 
            body: JSON.stringify({ 
              success: true, 
              endpoint: 'gefs-adeck', 
              data: { message: e.message, filename: `${stormId.toLowerCase()}.dat`, tracks: [], modelsPresent: [] }
            }) 
          };
        }
      }
      case 'gefs-pds-latest': {
        const avail = await getLatestGEFSPDSAvailability();
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, endpoint: 'gefs-pds-latest', data: avail, timestamp: new Date().toISOString() })
        };
      }
      case 'gefs-member-grids': {
        // Returns a lightweight listing of file keys for a given date/cycle/resolution to help client compute tracks later.
        const date = queryStringParameters?.date; // YYYYMMDD
        const cycle = queryStringParameters?.cycle; // HH
        const res = queryStringParameters?.res || '0p25'; // 0p25 or 0p50
        const bucket = 'https://noaa-gefs-pds.s3.amazonaws.com';
        if (!date || !cycle) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ success: false, error: 'date and cycle are required' }) };
        }
        const base = res === '0p50' ? `gefs.${date}/${cycle}/atmos/pgrb2ap5/` : `gefs.${date}/${cycle}/atmos/pgrb2ap25/`;
        try {
          const list = await listS3Public(bucket, { 'list-type': '2', prefix: base });
          const files = list.Contents ? (Array.isArray(list.Contents) ? list.Contents : [list.Contents]) : [];
          const keys = files.map(o => o.Key).filter(Boolean);
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, endpoint: 'gefs-member-grids', data: { base, keys } }) };
        } catch (e) {
          return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, error: e.message }) };
        }
      }
        
      case 'track-kmz':
        const trackStormId = queryStringParameters?.stormId;
        const trackYear = queryStringParameters?.year || new Date().getFullYear();
        if (!trackStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for track-kmz endpoint' })
          };
        }
        nhcUrl = `${NHC_BASE_URL}/gis/best_track/${trackStormId.toLowerCase()}_best_track.kmz`;
        isKmzEndpoint = true;
        break;
        
      case 'forecast-track':
        const stormId = queryStringParameters?.stormId;
        const year = queryStringParameters?.year || new Date().getFullYear();
        if (!stormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for forecast-track endpoint' })
          };
        }
        nhcUrl = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId.toUpperCase()}_5day_latest.geojson`;
        break;
        
      case 'historical-track':
        const histStormId = queryStringParameters?.stormId;
        const histYear = queryStringParameters?.year || new Date().getFullYear();
        if (!histStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for historical-track endpoint' })
          };
        }
        nhcUrl = `${NHC_BASE_URL}/gis/best_track/archive/${histYear}/${histStormId.toUpperCase()}_best_track.geojson`;
        break;
        
      case 'forecast-cone':
        const coneStormId = queryStringParameters?.stormId;
        if (!coneStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for forecast-cone endpoint' })
          };
        }
        
        // Use the storm graphics API cone URL format
        nhcUrl = `https://www.nhc.noaa.gov/storm_graphics/api/${coneStormId.toUpperCase()}_CONE_latest.kmz`;
        isKmzEndpoint = true;
        console.log(`Using cone URL: ${nhcUrl}`);
        break;
        
      case 'forecast-track-kmz':
        const forecastStormId = queryStringParameters?.stormId;
        if (!forecastStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for forecast-track-kmz endpoint' })
          };
        }
        // Use the forecast track KMZ format: EP092025_TRACK_latest.kmz
        nhcUrl = `${NHC_BASE_URL}/storm_graphics/api/${forecastStormId.toUpperCase()}_TRACK_latest.kmz`;
        isKmzEndpoint = true;
        break;
        
      case 'storm-surge':
        const surgeStormId = queryStringParameters?.stormId;
        if (!surgeStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for storm-surge endpoint' })
          };
        }
        
        // Storm surge is primarily available for Atlantic storms (AL prefix)
        if (!surgeStormId.toUpperCase().startsWith('AL')) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Storm surge data is typically only available for Atlantic storms (AL prefix)',
              stormId: surgeStormId,
              timestamp: new Date().toISOString()
            })
          };
        }
        
        // Use the storm surge KMZ format
        nhcUrl = `${NHC_BASE_URL}/storm_graphics/api/${surgeStormId.toUpperCase()}_PeakStormSurge_latest.kmz`;
        isKmzEndpoint = true;
        break;
        
      case 'wind-speed-probability':
        // Use the latest 34kt wind speed probability KMZ
        nhcUrl = 'https://www.nhc.noaa.gov/gis/forecast/archive/latest_wsp34knt120hr_5km.kmz';
        isKmzEndpoint = true;
        break;
        
      case 'wind-speed-probability-50kt':
        // Use the latest 50kt wind speed probability KMZ
        nhcUrl = 'https://www.nhc.noaa.gov/gis/forecast/archive/latest_wsp50knt120hr_5km.kmz';
        isKmzEndpoint = true;
        break;
        
      case 'wind-speed-probability-64kt':
        // Use the latest 64kt wind speed probability KMZ
        nhcUrl = 'https://www.nhc.noaa.gov/gis/forecast/archive/latest_wsp64knt120hr_5km.kmz';
        isKmzEndpoint = true;
        break;
        
      case 'wind-arrival-most-likely':
        const mostLikelyStormId = queryStringParameters?.stormId;
        if (!mostLikelyStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for wind-arrival-most-likely endpoint' })
          };
        }
        // Use the most likely wind arrival KMZ format
        nhcUrl = `${NHC_BASE_URL}/storm_graphics/api/${mostLikelyStormId.toUpperCase()}_most_likely_toa_34_latest.kmz`;
        isKmzEndpoint = true;
        break;
        
      case 'wind-arrival-earliest':
        const earliestStormId = queryStringParameters?.stormId;
        if (!earliestStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for wind-arrival-earliest endpoint' })
          };
        }
        // Use the earliest reasonable wind arrival KMZ format
        nhcUrl = `${NHC_BASE_URL}/storm_graphics/api/${earliestStormId.toUpperCase()}_earliest_reasonable_toa_34_latest.kmz`;
        isKmzEndpoint = true;
        break;
        
      default:
    return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
      error: 'Invalid endpoint. Supported endpoints: active-storms, track-kmz, forecast-track, historical-track, forecast-cone, forecast-track-kmz, storm-surge, wind-speed-probability, wind-speed-probability-50kt, wind-speed-probability-64kt, wind-arrival-most-likely, wind-arrival-earliest, gefs-pds-latest, gefs-member-grids' 
          })
        };
    }

    console.log(`Fetching data from NHC: ${nhcUrl}`);

    // Make the request to NHC API
    const axiosConfig = {
      timeout: 20000,
      headers: {
        'User-Agent': 'CycloTrak (cyclotrak.com, jasonprice70@gmail.com)',
        'Accept': isKmzEndpoint ? 'application/vnd.google-earth.kmz' : 'application/json'
      }
    };

    if (isKmzEndpoint) {
      axiosConfig.responseType = 'arraybuffer';
    }

    const response = await axios.get(nhcUrl, axiosConfig);

    console.log(`NHC API response status: ${response.status}`);

    let responseData;

    if (isKmzEndpoint) {
      // Parse KMZ to GeoJSON - handle both track and cone data
      try {
        if (endpoint === 'track-kmz' || endpoint === 'forecast-track-kmz') {
          responseData = await parseKmzToTrackGeoJSON(response.data);
          console.log(`Successfully parsed KMZ track data with ${responseData.features.length} features`);
        } else if (endpoint === 'forecast-cone') {
          responseData = await parseKmzToConeGeoJSON(response.data);
          console.log(`Successfully parsed KMZ cone data with ${responseData.features.length} features`);
        } else if (endpoint === 'storm-surge') {
          responseData = await parseKmzToSurgeGeoJSON(response.data);
          console.log(`Successfully parsed KMZ storm surge data with ${responseData.features.length} features`);
        } else if (endpoint === 'wind-speed-probability') {
          responseData = await parseKmzToWindProbGeoJSON(response.data, '34kt');
          console.log(`Successfully parsed KMZ wind probability data with ${responseData.features.length} features`);
        } else if (endpoint === 'wind-speed-probability-50kt') {
          responseData = await parseKmzToWindProbGeoJSON(response.data, '50kt');
          console.log(`Successfully parsed KMZ 50kt wind probability data with ${responseData.features.length} features`);
        } else if (endpoint === 'wind-speed-probability-64kt') {
          responseData = await parseKmzToWindProbGeoJSON(response.data, '64kt');
          console.log(`Successfully parsed KMZ 64kt wind probability data with ${responseData.features.length} features`);
        } else if (endpoint === 'wind-arrival-most-likely' || endpoint === 'wind-arrival-earliest') {
          responseData = await parseKmzToWindArrivalGeoJSON(response.data, endpoint);
          console.log(`Successfully parsed KMZ wind arrival data with ${responseData.features.length} features`);
        } else {
          throw new Error(`Unknown KMZ endpoint: ${endpoint}`);
        }
      } catch (parseError) {
        console.error(`Error parsing KMZ ${endpoint} data:`, parseError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: `Failed to parse KMZ ${endpoint} data`,
            details: parseError.message,
            endpoint: endpoint,
            timestamp: new Date().toISOString()
          })
        };
      }
    } else {
      responseData = response.data;
    }

    // Return successful response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: responseData,
        endpoint: endpoint,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error proxying NHC request:', error);

    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.response) {
      // NHC API responded with an error
      statusCode = error.response.status;
      if (statusCode === 404) {
        errorMessage = 'Data not found (this is normal if no data is available for this storm/time period)';
      } else {
        errorMessage = `NHC API error: ${error.response.statusText}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 408;
      errorMessage = 'Request timeout while fetching data from NHC';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Unable to connect to NHC API';
    }

    return {
      statusCode: statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        endpoint: event.pathParameters?.proxy || 'unknown',
        timestamp: new Date().toISOString()
      })
    };
  }
};
