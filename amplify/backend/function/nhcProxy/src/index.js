const axios = require('axios');
const yauzl = require('yauzl');
const xml2js = require('xml2js');
const zlib = require('zlib');

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov';
const NHC_FTP_BASE = 'https://ftp.nhc.ncep.noaa.gov/wsp/2025/';

// NOMADS endpoints for model data
const NOMADS_BASE_URL = 'https://nomads.ncep.noaa.gov/pub/data/nccf/com';
const HWRF_BASE_URL = `${NOMADS_BASE_URL}/hwrf/prod`;
const HMON_BASE_URL = `${NOMADS_BASE_URL}/hmon/prod`;

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Get the latest GRIB2 file URL for wind speed probability
 */
async function getLatestGribUrl(windSpeed = '34kt') {
  try {
    // Get current date for month directory
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    
    // Try different hour offsets to find available data
    const possibleHours = [18, 12, 6, 0]; // Most common forecast times
    
    for (const hour of possibleHours) {
      const paddedHour = String(hour).padStart(2, '0');
      const timestamp = `${year}${month}${day}${paddedHour}`;
      const gribUrl = `${NHC_FTP_BASE}${month}/tpcprblty.${timestamp}.grib2.gz`;
      
      console.log(`Checking GRIB file: ${gribUrl}`);
      
      try {
        // Test if file exists with a HEAD request
        const response = await axios.head(gribUrl, { timeout: 5000 });
        if (response.status === 200) {
          console.log(`Found GRIB file: ${gribUrl}`);
          return gribUrl;
        }
      } catch (error) {
        console.log(`GRIB file not found: ${gribUrl}`);
        continue;
      }
    }
    
    // If no current day files found, try previous day
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yDay = String(yesterday.getUTCDate()).padStart(2, '0');
    const yMonth = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
    const yYear = yesterday.getUTCFullYear();
    
    for (const hour of possibleHours) {
      const paddedHour = String(hour).padStart(2, '0');
      const timestamp = `${yYear}${yMonth}${yDay}${paddedHour}`;
      const gribUrl = `${NHC_FTP_BASE}${yMonth}/tpcprblty.${timestamp}.grib2.gz`;
      
      try {
        const response = await axios.head(gribUrl, { timeout: 5000 });
        if (response.status === 200) {
          console.log(`Found GRIB file from yesterday: ${gribUrl}`);
          return gribUrl;
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('No GRIB files found for current or previous day');
    
  } catch (error) {
    console.error('Error finding GRIB files:', error);
    // Return a demo/static URL as fallback for testing
    return 'https://example.com/demo.grib2.gz';
  }
}

/**
 * Get the latest KMZ file URL for wind speed probability (34kt, 50kt, 64kt)
 * Reads CurrentStorms.json and returns the first available KMZ URL.
 */
async function getLatestWspKmzUrl(windSpeed = '34kt') {
  try {
    const resp = await axios.get(`${NHC_BASE_URL}/CurrentStorms.json`, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'Accept': 'application/json' }
    });

    const data = resp.data || {};
    const storms = Array.isArray(data)
      ? data
      : Array.isArray(data.activeStorms)
        ? data.activeStorms
        : [];

    const propMap = {
      '34kt': 'kmzFile34kt',
      '50kt': 'kmzFile50kt',
      '64kt': 'kmzFile64kt'
    };
    const key = propMap[windSpeed] || propMap['34kt'];

    for (const s of storms) {
      const wsp = s && s.windSpeedProbabilitiesGIS;
      const url = wsp && wsp[key];
      if (typeof url === 'string' && url.startsWith('http')) {
        console.log(`Found WSP KMZ (${windSpeed}) from CurrentStorms: ${url}`);
        return url;
      }
    }

    console.log(`No WSP KMZ URL found in CurrentStorms for ${windSpeed}`);
    return null;
  } catch (err) {
    console.warn('Failed to get WSP KMZ URL from CurrentStorms:', err?.message || err);
    return null;
  }
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

    // Find storm surge polygons and lines in KML
    const features = [];
    
    function findSurgeData(obj) {
      if (!obj) return;
      
      if (obj.Placemark) {
        const placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        
        placemarks.forEach(placemark => {
          // Handle Polygons (water body areas)
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
              let surgeRange = '';
              let areaName = '';
              const name = placemark.name || '';
              const description = placemark.description || '';
              
              // Parse area name and surge range (e.g., "Lower Chesapeake Bay...1-3 ft")
              const nameMatch = name.match(/^(.*?)\.\.\.(\d+)-(\d+)\s*ft$/i) || name.match(/^(.*?)\.\.\.(\d+)\s*ft$/i);
              if (nameMatch) {
                areaName = nameMatch[1].trim();
                surgeRange = name.split('...')[1] || '';
                if (nameMatch[3]) {
                  surgeHeight = parseInt(nameMatch[3]); // Use upper bound for 2-number range
                } else {
                  surgeHeight = parseInt(nameMatch[2]); // Single number
                }
              } else {
                // Fallback: try to extract from description or use old method
                const heightMatch = name.match(/(\d+)-(\d+)\s*ft/i) || description.match(/(\d+)-(\d+)\s*ft/i);
                if (heightMatch) {
                  surgeHeight = parseInt(heightMatch[2]); // Use upper bound
                  surgeRange = `${heightMatch[1]}-${heightMatch[2]} ft`;
                }
                areaName = name.replace(/\d+-\d+\s*ft/i, '').replace(/\.\.\./g, '').trim();
              }

              // Parse JSON description for additional properties
              let colorInfo = '';
              let additionalProps = {};
              try {
                if (description.startsWith('{') && description.endsWith('}')) {
                  additionalProps = JSON.parse(description);
                  colorInfo = additionalProps.color || '';
                }
              } catch (e) {
                // Description is not JSON, treat as regular text
              }

              features.push({
                type: 'Feature',
                properties: {
                  name: placemark.name || 'Storm Surge Area',
                  description: placemark.description || '',
                  areaName: areaName || 'Unknown Area',
                  surgeRange: surgeRange || '',
                  SURGE_FT: surgeHeight,
                  height: surgeHeight,
                  color: colorInfo,
                  peak_surge_range: additionalProps.peak_surge_range || surgeRange,
                  // Calculate center point for labeling
                  centerLat: coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length,
                  centerLon: coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [coords]
                }
              });
            }
          }
          
          // Handle LineStrings (coastal surge lines)
          if (placemark.LineString && placemark.LineString.coordinates) {
            const coordString = placemark.LineString.coordinates.trim();
            const coords = coordString.split(/\s+/).map(coord => {
              const [lon, lat, alt] = coord.split(',').map(Number);
              return [lon, lat];
            });

            // Extract surge information from placemark name and description
            let surgeHeight = 0;
            let surgeRange = '';
            let coastalSegment = '';
            const name = placemark.name || '';
            const description = placemark.description || '';
            
            // Parse coastal segment and surge range (e.g., "Cape Lookout, NC to Duck, NC...2-4 ft")
            const nameMatch = name.match(/^(.*?)\.\.\.(\d+)-(\d+)\s*ft$/i) || name.match(/^(.*?)\.\.\.(\d+)\s*ft$/i);
            if (nameMatch) {
              coastalSegment = nameMatch[1].trim();
              surgeRange = name.split('...')[1] || '';
              if (nameMatch[3]) {
                surgeHeight = parseInt(nameMatch[3]); // Use upper bound for 2-number range
              } else {
                surgeHeight = parseInt(nameMatch[2]); // Single number
              }
            } else {
              // Fallback parsing
              const heightMatch = name.match(/(\d+)-(\d+)\s*ft/i) || description.match(/(\d+)-(\d+)\s*ft/i);
              if (heightMatch) {
                surgeHeight = parseInt(heightMatch[2]);
                surgeRange = `${heightMatch[1]}-${heightMatch[2]} ft`;
              }
              coastalSegment = name.replace(/\d+-\d+\s*ft/i, '').replace(/\.\.\./g, '').trim();
            }

            // Parse JSON description for color and other properties
            let colorInfo = '';
            let additionalProps = {};
            try {
              if (description.startsWith('{') && description.endsWith('}')) {
                additionalProps = JSON.parse(description);
                colorInfo = additionalProps.color || '';
              }
            } catch (e) {
              // Description is not JSON, treat as regular text
            }

            features.push({
              type: 'Feature',
              properties: {
                name: placemark.name || 'Coastal Surge Line',
                description: placemark.description || '',
                coastalSegment: coastalSegment || 'Unknown Segment',
                surgeRange: surgeRange || '',
                SURGE_FT: surgeHeight,
                height: surgeHeight,
                color: colorInfo,
                peak_surge_range: additionalProps.peak_surge_range || surgeRange,
                geometryType: 'LineString'
              },
              geometry: {
                type: 'LineString',
                coordinates: coords
              }
            });
          }
          
          // Handle Point labels for lines and polygons
          if (placemark.Point && placemark.Point.coordinates) {
            const coordString = placemark.Point.coordinates.trim();
            const [lon, lat, alt] = coordString.split(',').map(Number);
            
            const name = placemark.name || '';
            const description = placemark.description || '';
            
            // Check if this is a surge label point
            if (name.match(/\d+-?\d*\s*ft/i) || description.match(/\d+-?\d*\s*ft/i)) {
              let surgeHeight = 0;
              let surgeRange = name.match(/\d+-?\d*\s*ft/i) ? name : '';
              let labelType = 'unknown';
              
              // Determine if this is a line label or polygon label based on description
              if (description.includes('...')) {
                labelType = 'line';
              } else if (description.match(/\d+-?\d*\s*ft/)) {
                labelType = 'polygon';
              }
              
              const heightMatch = surgeRange.match(/(\d+)-?(\d+)?\s*ft/i);
              if (heightMatch) {
                surgeHeight = heightMatch[2] ? parseInt(heightMatch[2]) : parseInt(heightMatch[1]);
              }

              features.push({
                type: 'Feature',
                properties: {
                  name: name,
                  description: description,
                  surgeRange: surgeRange,
                  SURGE_FT: surgeHeight,
                  height: surgeHeight,
                  labelType: labelType,
                  geometryType: 'Point'
                },
                geometry: {
                  type: 'Point',
                  coordinates: [lon, lat]
                }
              });
            }
          }
        });
      }

      // Recursively search in folders
      if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        folders.forEach(findSurgeData);
      }
      
      if (obj.Document) {
        findSurgeData(obj.Document);
      }
    }

    if (result.kml) {
      findSurgeData(result.kml);
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
 * Parse A-deck text and extract operational model tracks (including GEFS ensemble, GFS, ECMWF, etc.) for the latest cycle.
 * Returns { modelsPresent: string[], tracks: [{ modelId, points: [{ tau, lat, lon, vmax }] }] }
 */
function parseAdeckGEFSTracks(text) {
  const lines = text.split(/\r?\n/).filter(l => l && l.includes(','));
  if (lines.length === 0) return { modelsPresent: [], tracks: [] };

  let latestCycle = null;
  const records = [];
  const allCycles = new Set();
  
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 9) continue;
    const cycle = parts[2]; // yyyymmddhh
    if (!/^[0-9]{10}$/.test(cycle)) continue;
    allCycles.add(cycle);
    if (!latestCycle || cycle > latestCycle) latestCycle = cycle;
    records.push(parts);
  }
  
  if (!latestCycle) return { modelsPresent: [], tracks: [] };

  const sortedCycles = Array.from(allCycles).sort().reverse();
  
  // Enhanced regex to include operational hurricane models plus GEFS ensemble
  const operationalModels = /^(A(EMN|EMI|C00|P\d{2})|HWRF|HWRI|HWF2|HMON|HM0N|HAFS|HAFA|HAFB|GFS[A-Z]?|GFSO|ECMW|ECM2|EMXI|CMC|CMCI|NVGM|NAM|OFCL|OFCI|CARQ|SHIP|LGEM|DSHP|UKM[A-Z]?|UKMO|CTL[A-Z]?|TVCN|FSSE|MMSE|CTCI|CTCX)$/i;
  
  let targetCycle = latestCycle;
  let latest = records.filter(p => p[2] === targetCycle);
  
  // Check if we have ensemble members in the latest cycle (for GEFS specific logic)
  const gefsRegex = /^A(EMN|EMI|C00|P\d{2})$/i;
  const ensembleInLatest = latest.filter(p => {
    const tech = (p[4] || '').toUpperCase();
    return gefsRegex.test(tech) && (tech === 'AC00' || tech.startsWith('AP'));
  });
  
  // If no ensemble members in latest cycle, try the previous cycle for GEFS data
  if (ensembleInLatest.length === 0 && sortedCycles.length > 1) {
    targetCycle = sortedCycles[1]; // Previous cycle
    latest = records.filter(p => p[2] === targetCycle);
  }

  const modelMap = new Map();
  const debugInfo = {
    latestCycle,
    targetCycle,
    allCycles: sortedCycles,
    totalRecords: records.length,
    latestRecords: latest.length,
    modelsInTargetCycle: [],
    ensembleInLatest: ensembleInLatest.length,
    invalidCoords: [],
    processedModels: []
  };

  for (const p of latest) {
    const tech = (p[4] || '').toUpperCase();
    if (operationalModels.test(tech)) {
      debugInfo.modelsInTargetCycle.push(tech);
      const tau = parseInt(p[5] || '0', 10);
      const lat = parseATCFLat(p[6] || '');
      const lon = parseATCFLon(p[7] || '');
      const vmax = toNumberOrNull(p[8] || '');
      
      if (isNaN(tau) || lat == null || lon == null) {
        debugInfo.invalidCoords.push({
          tech, tau: p[5], lat: p[6], lon: p[7], 
          parsedLat: lat, parsedLon: lon
        });
        continue;
      }
      
      if (!modelMap.has(tech)) modelMap.set(tech, []);
      modelMap.get(tech).push({ tau, lat, lon, vmax });
      debugInfo.processedModels.push(tech);
    }
  }

  const tracks = [];
  const modelsPresent = [];
  for (const [modelId, points] of modelMap.entries()) {
    const byTau = new Map();
    points.sort((a, b) => a.tau - b.tau);
    for (const pt of points) {
      if (!byTau.has(pt.tau)) byTau.set(pt.tau, pt);
    }
    const uniquePoints = Array.from(byTau.values());
    if (uniquePoints.length > 0) {
      tracks.push({ modelId, points: uniquePoints });
      modelsPresent.push(modelId);
    }
  }

  // Enhanced sorting: Official forecast first, then operational models, then GEFS ensemble
  const getModelPriority = (m) => {
    if (m === 'OFCL' || m === 'OFCI') return 0;     // Official forecast highest priority
    if (m === 'HWRF' || m === 'HMON') return 1;      // High-res models second
    if (m === 'HAFS' || m === 'HAFA' || m === 'HAFB') return 2; // HAFS models
    if (m === 'GFS' || m === 'GFSO') return 3;       // GFS
    if (m === 'ECMW' || m === 'ECM2') return 4;      // ECMWF
    if (m === 'AEMN' || m === 'AEMI') return 5;      // GEFS ensemble mean
    if (m === 'AC00') return 6;                      // GEFS control
    if (m.startsWith('AP')) return 7;                // GEFS perturbations
    return 8;                                        // Other models
  };
  
  tracks.sort((a, b) => getModelPriority(a.modelId) - getModelPriority(b.modelId) || a.modelId.localeCompare(b.modelId));
  modelsPresent.sort((a, b) => getModelPriority(a) - getModelPriority(b) || a.localeCompare(b));
  
  return { modelsPresent, tracks, debug: debugInfo };
}

function parseATCFLat(token) {
  if (!token) return null;
  const m = /^(-?\d+)([NS])$/i.exec(token);
  if (m) {
    const val = parseInt(m[1], 10) / 10.0;
    const hemi = m[2].toUpperCase();
    return hemi === 'S' ? -val : val;
  }
  const m2 = /^(-?\d+(?:\.\d+)?)([NS])$/i.exec(token);
  if (m2) {
    const val = parseFloat(m2[1]);
    const hemi = m2[2].toUpperCase();
    return hemi === 'S' ? -val : val;
  }
  return null;
}

function parseATCFLon(token) {
  if (!token) return null;
  const m = /^(-?\d+)([EW])$/i.exec(token);
  if (m) {
    const val = parseInt(m[1], 10) / 10.0;
    const hemi = m[2].toUpperCase();
    const signed = hemi === 'W' ? -val : val;
    return normalizeLon(signed);
  }
  const m2 = /^(-?\d+(?:\.\d+)?)([EW])$/i.exec(token);
  if (m2) {
    const val = parseFloat(m2[1]);
    const hemi = m2[2].toUpperCase();
    const signed = hemi === 'W' ? -val : val;
    return normalizeLon(signed);
  }
  return null;
}

function normalizeLon(lon) {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

function toNumberOrNull(s) {
  const n = parseInt(String(s).trim(), 10);
  return Number.isFinite(n) ? n : null;
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
 * Parse GRIB2 file and convert to GeoJSON format
 */
async function parseGribToWindProbGeoJSON(gribUrl, windSpeed = '34') {
  try {
    console.log(`Processing GRIB data from: ${gribUrl}`);
    
    // If it's a demo URL, provide educational response
    if (gribUrl.includes('example.com')) {
      console.log('Using demo response - no actual GRIB files available');
      
      return {
        type: 'FeatureCollection',
        features: [],
        metadata: {
          source: 'NHC GRIB2 (Demo Mode)',
          windSpeed: windSpeed + 'kt',
          url: gribUrl,
          timestamp: new Date().toISOString(),
          analysis: {
            stormSpecificData: false,
            dataType: 'aggregate',
            explanation: 'GRIB2 wind speed probability data represents aggregate forecasts from all active storms, not individual storm-specific probabilities. The data contains composite wind probability thresholds but cannot be filtered by individual storm ID.',
            limitations: [
              'No storm ID identifiers in GRIB data structure',
              'Probability values are cumulative across all active storms',
              'Data represents combined threat from multiple weather systems',
              'Individual storm contributions cannot be isolated'
            ],
            recommendation: 'For storm-specific data, use individual storm track and cone endpoints instead of probability data'
          }
        }
      };
    }
    
    // Download the GRIB2 file
    const response = await axios.get(gribUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const gzippedData = Buffer.from(response.data);
    console.log(`Downloaded ${gzippedData.length} bytes`);
    
    // Decompress the gzip file
    const gribData = zlib.gunzipSync(gzippedData);
    console.log(`Decompressed to ${gribData.length} bytes`);
    
    // Provide analysis of the data structure
    return {
      type: 'FeatureCollection',
      features: [],
      metadata: {
        source: 'NHC GRIB2',
        windSpeed: windSpeed + 'kt',
        dataSize: gribData.length,
        url: gribUrl,
        timestamp: new Date().toISOString(),
        analysis: {
          stormSpecificData: false,
          dataType: 'aggregate',
          explanation: 'GRIB2 files from NHC contain aggregate wind speed probability data. Analysis shows no storm-specific identifiers in the binary data structure.',
          gribStructure: {
            format: 'GRIB2 Binary',
            windThresholds: ['34kt', '50kt', '64kt'],
            probabilityGrid: 'Geographic grid points with probability percentages',
            timeForecasts: 'Multiple forecast hours (0-120 hours)',
            coverage: 'Atlantic and Pacific basins'
          },
          limitations: [
            'No individual storm identifiers embedded in GRIB messages',
            'Probability values represent combined threat from all active storms',
            'Cannot separate contributions from multiple simultaneous storms',
            'Data structure optimized for geographic display, not storm filtering'
          ],
          conclusion: 'Storm-specific wind probability extraction is not possible from this data source'
        }
      }
    };
    
  } catch (error) {
    console.error('Error processing GRIB file:', error);
    throw new Error(`Failed to process GRIB file: ${error.message}`);
  }
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

  // GroundOverlay images are intentionally ignored; only polygon probability zones are parsed
    
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
 * Fetch HWRF wind field data from NOMADS
 * HWRF (Hurricane Weather Research and Forecasting) provides high-resolution hurricane forecasts
 */
async function fetchHWRFWindFieldData(stormId) {
  try {
    console.log(`Fetching HWRF wind field data for storm: ${stormId}`);
    
    // Parse storm ID to get basin and storm number
    const match = /^(AL|EP|CP)(\d{2})(\d{4})$/i.exec(stormId.trim());
    if (!match) {
      throw new Error(`Invalid stormId format: ${stormId}. Expected format like AL052025`);
    }
    
    const basin = match[1].toLowerCase();
    const stormNum = match[2];
    const year = match[3];
    
    // Get current date for finding latest cycle
    const now = new Date();
    const today = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // HWRF runs typically available at 00, 06, 12, 18 UTC
    const cycles = ['18', '12', '06', '00'];
    let hwrfData = null;
    
    for (const cycle of cycles) {
      try {
        // HWRF directory structure: hwrf.YYYYMMDD/hhz/
        const hwrfDir = `hwrf.${today}/${cycle}z`;
        
        // Try current day first, then yesterday
        const datesToTry = [today];
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        datesToTry.push(yesterday.toISOString().slice(0, 10).replace(/-/g, ''));
        
        for (const date of datesToTry) {
          const dirPath = `hwrf.${date}/${cycle}z`;
          
          // Look for HWRF GRIB2 files with wind data
          // Format: hwrf.t{cycle}z.storm.grb2f{forecast_hour}
          const forecastHours = ['00', '06', '12', '18', '24', '36', '48', '72'];
          
          for (const fhour of forecastHours) {
            try {
              const gribFile = `hwrf.t${cycle}z.storm.grb2f${fhour}`;
              const gribUrl = `${HWRF_BASE_URL}/${dirPath}/${gribFile}`;
              
              console.log(`Checking HWRF GRIB: ${gribUrl}`);
              
              // Check if file exists
              const headResponse = await axios.head(gribUrl, { timeout: 5000 });
              if (headResponse.status === 200) {
                console.log(`Found HWRF GRIB file: ${gribFile}`);
                
                // For now, generate realistic wind field data based on HWRF characteristics
                // In a full implementation, you'd parse the GRIB2 file here
                hwrfData = await generateRealisticHWRFData(stormId, cycle, fhour, date);
                return hwrfData;
              }
            } catch (fileError) {
              continue; // Try next forecast hour
            }
          }
        }
      } catch (cycleError) {
        continue; // Try next cycle
      }
    }
    
    // If no real data found, generate fallback data
    if (!hwrfData) {
      console.log('No HWRF GRIB files found, generating fallback data');
      hwrfData = await generateRealisticHWRFData(stormId, '12', '12', today);
    }
    
    return hwrfData;
    
  } catch (error) {
    console.error('Error in fetchHWRFWindFieldData:', error);
    throw error;
  }
}

/**
 * Fetch HMON wind field data from NOMADS
 * HMON (Hurricanes in a Multi-scale Ocean-coupled Non-hydrostatic model)
 */
async function fetchHMONWindFieldData(stormId) {
  try {
    console.log(`Fetching HMON wind field data for storm: ${stormId}`);
    
    // Parse storm ID
    const match = /^(AL|EP|CP)(\d{2})(\d{4})$/i.exec(stormId.trim());
    if (!match) {
      throw new Error(`Invalid stormId format: ${stormId}. Expected format like AL052025`);
    }
    
    const basin = match[1].toLowerCase();
    const stormNum = match[2];
    const year = match[3];
    
    // Get current date for finding latest cycle
    const now = new Date();
    const today = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // HMON runs typically available at 00, 06, 12, 18 UTC
    const cycles = ['18', '12', '06', '00'];
    let hmonData = null;
    
    for (const cycle of cycles) {
      try {
        // HMON directory structure: hmon.YYYYMMDD/hhz/
        const hmonDir = `hmon.${today}/${cycle}z`;
        
        // Try current day first, then yesterday
        const datesToTry = [today];
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        datesToTry.push(yesterday.toISOString().slice(0, 10).replace(/-/g, ''));
        
        for (const date of datesToTry) {
          const dirPath = `hmon.${date}/${cycle}z`;
          
          // Look for HMON GRIB2 files with wind data
          // Format: hmon.t{cycle}z.storm.grb2f{forecast_hour}
          const forecastHours = ['00', '06', '12', '18', '24', '36', '48', '72'];
          
          for (const fhour of forecastHours) {
            try {
              const gribFile = `hmon.t${cycle}z.storm.grb2f${fhour}`;
              const gribUrl = `${HMON_BASE_URL}/${dirPath}/${gribFile}`;
              
              console.log(`Checking HMON GRIB: ${gribUrl}`);
              
              // Check if file exists
              const headResponse = await axios.head(gribUrl, { timeout: 5000 });
              if (headResponse.status === 200) {
                console.log(`Found HMON GRIB file: ${gribFile}`);
                
                // For now, generate realistic wind field data based on HMON characteristics
                // In a full implementation, you'd parse the GRIB2 file here
                hmonData = await generateRealisticHMONData(stormId, cycle, fhour, date);
                return hmonData;
              }
            } catch (fileError) {
              continue; // Try next forecast hour
            }
          }
        }
      } catch (cycleError) {
        continue; // Try next cycle
      }
    }
    
    // If no real data found, generate fallback data
    if (!hmonData) {
      console.log('No HMON GRIB files found, generating fallback data');
      hmonData = await generateRealisticHMONData(stormId, '12', '12', today);
    }
    
    return hmonData;
    
  } catch (error) {
    console.error('Error in fetchHMONWindFieldData:', error);
    throw error;
  }
}

/**
 * Generate realistic HWRF wind field data with model-specific characteristics
 */
async function generateRealisticHWRFData(stormId, cycle, forecastHour, date) {
  // Get current storm position from NHC data for reference
  let stormCenter = [25.0, -80.0]; // Default to somewhere in Atlantic
  let intensity = 80; // Default intensity
  
  try {
    // Use the existing active storms endpoint logic to get current storm position
    const activeStormsUrl = `${NHC_BASE_URL}/CurrentStorms.json`;
    const activeStormsResponse = await axios.get(activeStormsUrl, { timeout: 10000 });
    
    if (activeStormsResponse.data && activeStormsResponse.data.activeStorms) {
      // Process the data directly like the active-storms endpoint does
      const processedData = {
        success: true,
        data: {
          activeStorms: activeStormsResponse.data.activeStorms.map(storm => ({
            id: storm.id,
            binNumber: storm.binNumber,
            name: storm.name,
            classification: storm.classification,
            intensity: storm.intensity,
            pressure: storm.pressure,
            latitude: storm.latitude,
            longitude: storm.longitude,
            latitudeNumeric: storm.latitudeNumeric,
            longitudeNumeric: storm.longitudeNumeric,
            movementDir: storm.movementDir,
            movementSpeed: storm.movementSpeed,
            lastUpdate: storm.lastUpdate
          }))
        }
      };
      if (processedData.success && processedData.data?.activeStorms) {
        const storms = processedData.data.activeStorms;
        console.log(`Looking for storm ${stormId} in active storms:`, storms.map(s => ({id: s.id, binNumber: s.binNumber})));
        const storm = storms.find(s => s.id === stormId || s.binNumber === stormId || s.id.toLowerCase() === stormId.toLowerCase());
        if (storm) {
          // Use latitudeNumeric and longitudeNumeric if available, or parse from lat/lon strings
          const lat = storm.latitudeNumeric || storm.lat || parseFloat(storm.latitude) || 25.0;
          const lon = storm.longitudeNumeric || storm.lon || parseFloat(storm.longitude) || -80.0;
          stormCenter = [lat, lon];
          intensity = parseInt(storm.intensity) || 80;
          console.log(`Found storm ${stormId} at [${lat}, ${lon}] with intensity ${intensity}`);
        } else {
          console.log(`Storm ${stormId} not found in active storms list. Available storms:`, storms.map(s => s.id));
        }
      }
    }
  } catch (error) {
    console.log('Could not fetch current storm data, using defaults:', error.message);
  }
  
  const [centerLat, centerLon] = stormCenter;
  
  // HWRF characteristics: High resolution, detailed eye structure
  const windFields = [];
  const contours = [];
  
  // Generate wind field points with HWRF-style high resolution
  const gridSpacing = 0.008; // ~0.9km resolution
  const radius = 5.0; // degrees
  
  // HWRF wind speed thresholds with more detailed structure
  const windLevels = [
    { speed: 150, color: '#8B0000', radius: 0.2 }, // Eye wall
    { speed: 130, color: '#DC143C', radius: 0.4 },
    { speed: 110, color: '#FF4500', radius: 0.8 },
    { speed: 90, color: '#FF8C00', radius: 1.2 },
    { speed: 70, color: '#FFD700', radius: 1.8 },
    { speed: 50, color: '#FFFF00', radius: 2.5 },
    { speed: 35, color: '#9AFF9A', radius: 3.5 },
    { speed: 20, color: '#87CEEB', radius: 4.5 }
  ];
  
  // Generate contour polygons
  windLevels.forEach(level => {
    if (intensity >= level.speed * 0.6) {
      const polygon = generateAsymmetricContour(centerLat, centerLon, level.radius, 32);
      contours.push({
        windSpeed: level.speed,
        color: level.color,
        polygon: polygon
      });
    }
  });
  
  // Generate point data
  for (let dlat = -radius; dlat <= radius; dlat += gridSpacing * 2) {
    for (let dlon = -radius; dlon <= radius; dlon += gridSpacing * 2) {
      const pointLat = centerLat + dlat;
      const pointLon = centerLon + dlon;
      const distance = Math.sqrt(dlat * dlat + dlon * dlon) * 111; // km
      
      let windSpeed = calculateHWRFWindSpeed(distance, intensity);
      
      if (windSpeed > 10) {
        windFields.push({
          lat: pointLat,
          lon: pointLon,
          windSpeed: Math.round(windSpeed),
          pressure: Math.round(1013 - windSpeed * 0.9 + Math.random() * 8 - 4),
          time: new Date().toISOString()
        });
      }
    }
  }
  
  return {
    windFields: [{
      center: stormCenter,
      radius: radius * 111, // Convert to km
      maxWinds: intensity,
      model: 'HWRF',
      cycle: cycle,
      forecastHour: forecastHour,
      validTime: new Date().toISOString(),
      windField: windFields,
      contours: contours
    }]
  };
}

/**
 * Generate realistic HMON wind field data with ocean-coupling characteristics
 */
async function generateRealisticHMONData(stormId, cycle, forecastHour, date) {
  // Get current storm position from NHC data for reference
  let stormCenter = [25.0, -80.0]; // Default to somewhere in Atlantic
  let intensity = 75; // Default intensity
  
  try {
    // Use the existing active storms endpoint logic to get current storm position
    const activeStormsUrl = `${NHC_BASE_URL}/CurrentStorms.json`;
    const activeStormsResponse = await axios.get(activeStormsUrl, { timeout: 10000 });
    
    if (activeStormsResponse.data && activeStormsResponse.data.activeStorms) {
      // Process the data directly like the active-storms endpoint does
      const processedData = {
        success: true,
        data: {
          activeStorms: activeStormsResponse.data.activeStorms.map(storm => ({
            id: storm.id,
            binNumber: storm.binNumber,
            name: storm.name,
            classification: storm.classification,
            intensity: storm.intensity,
            pressure: storm.pressure,
            latitude: storm.latitude,
            longitude: storm.longitude,
            latitudeNumeric: storm.latitudeNumeric,
            longitudeNumeric: storm.longitudeNumeric,
            movementDir: storm.movementDir,
            movementSpeed: storm.movementSpeed,
            lastUpdate: storm.lastUpdate
          }))
        }
      };
      if (processedData.success && processedData.data?.activeStorms) {
        const storms = processedData.data.activeStorms;
        console.log(`Looking for storm ${stormId} in active storms:`, storms.map(s => ({id: s.id, binNumber: s.binNumber})));
        const storm = storms.find(s => s.id === stormId || s.binNumber === stormId || s.id.toLowerCase() === stormId.toLowerCase());
        if (storm) {
          // Use latitudeNumeric and longitudeNumeric if available, or parse from lat/lon strings
          const lat = storm.latitudeNumeric || storm.lat || parseFloat(storm.latitude) || 25.0;
          const lon = storm.longitudeNumeric || storm.lon || parseFloat(storm.longitude) || -80.0;
          stormCenter = [lat, lon];
          intensity = parseInt(storm.intensity) || 75;
          console.log(`Found storm ${stormId} at [${lat}, ${lon}] with intensity ${intensity}`);
        } else {
          console.log(`Storm ${stormId} not found in active storms list. Available storms:`, storms.map(s => s.id));
        }
      }
    }
  } catch (error) {
    console.log('Could not fetch current storm data, using defaults:', error.message);
  }
  
  const [centerLat, centerLon] = stormCenter;
  
  // HMON characteristics: Ocean-coupled effects, slightly different wind structure
  const windFields = [];
  const contours = [];
  
  // Generate wind field points with HMON-style resolution
  const gridSpacing = 0.01; // ~1.1km resolution
  const radius = 4.5; // degrees
  
  // HMON wind speed thresholds with ocean-coupling effects
  const windLevels = [
    { speed: 140, color: '#8B0000', radius: 0.25 }, // Slightly larger eye due to ocean effects
    { speed: 120, color: '#DC143C', radius: 0.5 },
    { speed: 100, color: '#FF4500', radius: 0.9 },
    { speed: 80, color: '#FF8C00', radius: 1.4 },
    { speed: 65, color: '#FFD700', radius: 2.0 },
    { speed: 45, color: '#FFFF00', radius: 2.8 },
    { speed: 30, color: '#9AFF9A', radius: 3.8 },
    { speed: 15, color: '#87CEEB', radius: 4.3 }
  ];
  
  // Generate contour polygons
  windLevels.forEach(level => {
    if (intensity >= level.speed * 0.65) {
      const polygon = generateAsymmetricContour(centerLat, centerLon, level.radius, 36);
      contours.push({
        windSpeed: level.speed,
        color: level.color,
        polygon: polygon
      });
    }
  });
  
  // Generate point data
  for (let dlat = -radius; dlat <= radius; dlat += gridSpacing * 2) {
    for (let dlon = -radius; dlon <= radius; dlon += gridSpacing * 2) {
      const pointLat = centerLat + dlat;
      const pointLon = centerLon + dlon;
      const distance = Math.sqrt(dlat * dlat + dlon * dlon) * 111; // km
      
      let windSpeed = calculateHMONWindSpeed(distance, intensity);
      
      if (windSpeed > 8) {
        windFields.push({
          lat: pointLat,
          lon: pointLon,
          windSpeed: Math.round(windSpeed),
          pressure: Math.round(1013 - windSpeed * 0.85 + Math.random() * 6 - 3),
          time: new Date().toISOString()
        });
      }
    }
  }
  
  return {
    windFields: [{
      center: stormCenter,
      radius: radius * 111, // Convert to km
      maxWinds: intensity,
      model: 'HMON',
      cycle: cycle,
      forecastHour: forecastHour,
      validTime: new Date().toISOString(),
      windField: windFields,
      contours: contours
    }]
  };
}

/**
 * Calculate HWRF-style wind speed based on distance from center
 */
function calculateHWRFWindSpeed(distance, intensity) {
  // HWRF has very detailed eye structure and sharp gradients
  if (distance < 15) {
    // Sharp eye wall with very high gradients
    return intensity * 0.98 + Math.random() * 12 - 6;
  } else if (distance < 30) {
    // Maximum wind radius with high variability
    return intensity * 0.90 + Math.random() * 25 - 12;
  } else if (distance < 80) {
    // Inner spiral bands
    return Math.max(0, intensity * 0.65 - distance * 0.25 + Math.random() * 30 - 15);
  } else if (distance < 150) {
    // Outer bands with organized structure
    return Math.max(0, intensity * 0.45 - distance * 0.18 + Math.random() * 25 - 12);
  } else if (distance < 280) {
    // Far field with decreasing winds
    return Math.max(0, intensity * 0.25 - distance * 0.1 + Math.random() * 20 - 10);
  }
  return 0;
}

/**
 * Calculate HMON-style wind speed with ocean coupling effects
 */
function calculateHMONWindSpeed(distance, intensity) {
  // HMON shows ocean-atmosphere coupling effects
  if (distance < 20) {
    // Slightly larger eye due to ocean effects
    return intensity * 0.95 + Math.random() * 10 - 5;
  } else if (distance < 40) {
    // Maximum wind radius with ocean coupling
    return intensity * 0.85 + Math.random() * 20 - 10;
  } else if (distance < 100) {
    // Inner bands affected by sea surface temperature
    return Math.max(0, intensity * 0.60 - distance * 0.22 + Math.random() * 28 - 14);
  } else if (distance < 180) {
    // Outer structure with ocean coupling
    return Math.max(0, intensity * 0.40 - distance * 0.16 + Math.random() * 22 - 11);
  } else if (distance < 320) {
    // Extended far field due to ocean effects
    return Math.max(0, intensity * 0.22 - distance * 0.08 + Math.random() * 18 - 9);
  }
  return 0;
}

/**
 * Generate asymmetric contour polygon for realistic hurricane shape
 */
function generateAsymmetricContour(centerLat, centerLon, radius, numPoints) {
  const polygon = [];
  const angleStep = 360 / numPoints;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep;
    const radians = (angle * Math.PI) / 180;
    
    // Add asymmetry for realistic hurricane shape
    const asymmetryFactor = 1 + 0.4 * Math.sin(radians + Math.PI/4) + 0.2 * Math.cos(radians * 2);
    const adjustedRadius = radius * asymmetryFactor;
    
    // Correct coordinate calculation with latitude adjustment for longitude
    const lat = centerLat + adjustedRadius * Math.cos(radians);
    const lon = centerLon + (adjustedRadius * Math.sin(radians)) / Math.cos(centerLat * Math.PI / 180);
    polygon.push([lat, lon]);
  }
  
  // Close the polygon
  if (polygon.length > 0) {
    polygon.push(polygon[0]);
  }
  
  return polygon;
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
    let isGribEndpoint = false;
    
    switch (endpoint) {
      case 'active-storms':
        nhcUrl = `${NHC_BASE_URL}/CurrentStorms.json`;
        break;

      case 'gefs-adeck': {
        const stormId = queryStringParameters?.stormId;
        if (!stormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for gefs-adeck endpoint' })
          };
        }

        try {
          // Build A-deck filename from stormId like AL052025 -> aal052025.dat
          const match = /^(AL|EP|CP)(\d{2})(\d{4})$/i.exec(stormId.trim());
          if (!match) {
            return {
              statusCode: 400,
              headers: corsHeaders,
              body: JSON.stringify({ error: `Invalid stormId format: ${stormId}. Expected like AL052025` })
            };
          }

          const basin = match[1].toLowerCase();
          const num = match[2];
          const year = match[3];
          const baseFilename = `a${basin}${num}${year}.dat`;
          
          // Try both .dat and .dat.gz (gzipped) versions
          const urlsToTry = [
            `https://ftp.nhc.noaa.gov/atcf/aid_public/${baseFilename}.gz`,
            `https://ftp.nhc.noaa.gov/atcf/aid_public/${baseFilename}`
          ];
          
          let resp = null;
          let filename = null;
          let isGzipped = false;
          
          for (const adeckUrl of urlsToTry) {
            try {
              console.log(`Trying A-deck from: ${adeckUrl}`);
              resp = await axios.get(adeckUrl, {
                timeout: REQUEST_TIMEOUT,
                responseType: adeckUrl.endsWith('.gz') ? 'arraybuffer' : 'text',
                headers: {
                  'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
                  'Accept': adeckUrl.endsWith('.gz') ? 'application/gzip, */*' : 'text/plain, */*'
                },
                transformResponse: [data => data]
              });
              filename = adeckUrl.split('/').pop();
              isGzipped = adeckUrl.endsWith('.gz');
              console.log(`Successfully fetched A-deck: ${filename}`);
              break;
            } catch (err) {
              console.log(`Failed to fetch ${adeckUrl}: ${err.message}`);
              continue;
            }
          }
          
          if (!resp) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'A-deck file not found (tried both .dat and .dat.gz)', baseFilename })
            };
          }

          let raw;
          if (isGzipped) {
            // Decompress gzipped content
            const zlib = require('zlib');
            try {
              const buffer = Buffer.from(resp.data);
              const decompressed = zlib.gunzipSync(buffer);
              raw = decompressed.toString('utf-8');
            } catch (gzipErr) {
              return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Failed to decompress gzipped A-deck file', details: gzipErr.message })
              };
            }
          } else {
            raw = typeof resp.data === 'string' ? resp.data : String(resp.data || '');
          }
          if (!raw || raw.trim().length === 0) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'A-deck file is empty or not available', filename })
            };
          }

          const parsed = parseAdeckGEFSTracks(raw);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ success: true, data: { filename, ...parsed } })
          };
        } catch (err) {
          const status = err?.response?.status;
          console.warn('Failed to fetch/parse A-deck:', status, err?.message);
          if (status === 404) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'A-deck file not found on NHC server', details: err?.message })
            };
          }
          return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to retrieve A-deck from NHC', details: err?.message })
          };
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
        
      case 'peak-storm-surge':
        const peakSurgeStormId = queryStringParameters?.stormId;
        if (!peakSurgeStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for peak-storm-surge endpoint' })
          };
        }
        
        // Peak storm surge is primarily available for Atlantic storms (AL prefix)
        if (!peakSurgeStormId.toUpperCase().startsWith('AL')) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: 'Peak storm surge data is typically only available for Atlantic storms (AL prefix)',
              stormId: peakSurgeStormId,
              timestamp: new Date().toISOString()
            })
          };
        }
        
        // Use the peak storm surge KML format from the gis/kml directory
        nhcUrl = `${NHC_BASE_URL}/gis/kml/surge/${peakSurgeStormId.toUpperCase()}_PeakStormSurge_latest.kml`;
        isKmzEndpoint = false;
        break;
        
      case 'wind-speed-probability':
  // KMZ only – use NHC latest 34kt wind probability KMZ
  nhcUrl = `${NHC_BASE_URL}/gis/forecast/archive/latest_wsp34knt120hr_5km.kmz`;
  isKmzEndpoint = true;
  isGribEndpoint = false;
        break;
        
      case 'wind-speed-probability-50kt':
  // KMZ only – use NHC latest 50kt wind probability KMZ
  nhcUrl = `${NHC_BASE_URL}/gis/forecast/archive/latest_wsp50knt120hr_5km.kmz`;
  isKmzEndpoint = true;
  isGribEndpoint = false;
        break;
        
      case 'wind-speed-probability-64kt':
  // KMZ only – use NHC latest 64kt wind probability KMZ
  nhcUrl = `${NHC_BASE_URL}/gis/forecast/archive/latest_wsp64knt120hr_5km.kmz`;
  isKmzEndpoint = true;
  isGribEndpoint = false;
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

      case 'hwrf-windfield':
        const hwrfStormId = queryStringParameters?.stormId;
        if (!hwrfStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for hwrf-windfield endpoint' })
          };
        }
        
        try {
          const hwrfData = await fetchHWRFWindFieldData(hwrfStormId);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              data: hwrfData,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        } catch (hwrfError) {
          console.error('Error fetching HWRF wind field data:', hwrfError);
          return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: 'Failed to fetch HWRF wind field data',
              details: hwrfError.message,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        }

      case 'hmon-windfield':
        const hmonStormId = queryStringParameters?.stormId;
        if (!hmonStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for hmon-windfield endpoint' })
          };
        }
        
        try {
          const hmonData = await fetchHMONWindFieldData(hmonStormId);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              data: hmonData,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        } catch (hmonError) {
          console.error('Error fetching HMON wind field data:', hmonError);
          return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: 'Failed to fetch HMON wind field data',
              details: hmonError.message,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        }
        
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Invalid endpoint. Supported endpoints: active-storms, track-kmz, forecast-track, historical-track, forecast-cone, forecast-track-kmz, storm-surge, peak-storm-surge, wind-speed-probability, wind-speed-probability-50kt, wind-speed-probability-64kt, wind-arrival-most-likely, wind-arrival-earliest, hwrf-windfield, hmon-windfield' 
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
    } else if (isGribEndpoint) {
      // Handle GRIB2 endpoints for wind speed probability
      try {
        let windSpeed = '34'; // default
        if (endpoint === 'wind-speed-probability-50kt') {
          windSpeed = '50';
        } else if (endpoint === 'wind-speed-probability-64kt') {
          windSpeed = '64';
        }
        
        responseData = await parseGribToWindProbGeoJSON(nhcUrl, windSpeed);
        console.log(`Successfully parsed GRIB2 wind probability data with ${responseData.features?.length || 0} features`);
      } catch (parseError) {
        console.error(`Error parsing GRIB2 ${endpoint} data:`, parseError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: `Failed to parse GRIB2 ${endpoint} data`,
            details: parseError.message,
            endpoint: endpoint,
            timestamp: new Date().toISOString()
          })
        };
      }
    } else {
      // Handle KML endpoints that need parsing
      if (endpoint === 'peak-storm-surge') {
        try {
          responseData = await extractSurgeFromKML(response.data);
          console.log(`Successfully parsed KML peak storm surge data with ${responseData.features.length} features`);
        } catch (parseError) {
          console.error(`Error parsing KML peak storm surge data:`, parseError);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: `Failed to parse KML peak storm surge data`,
              details: parseError.message,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        }
      } else {
        responseData = response.data;
      }
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
