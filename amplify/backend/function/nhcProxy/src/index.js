const axios = require('axios');
const yauzl = require('yauzl');
const xml2js = require('xml2js');

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov';

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

            features.push({
              type: 'Feature',
              properties: {
                name: placemark.name || 'Position',
                description: placemark.description || ''
              },
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
        
        // First get active storms to find the correct cone URL
        try {
          const activeStormsResponse = await axios.get(`${NHC_BASE_URL}/CurrentStorms.json`, {
            timeout: REQUEST_TIMEOUT,
            headers: { 'User-Agent': 'StormCast-Pro/1.0' }
          });
          
          const storm = activeStormsResponse.data.activeStorms?.find(s => 
            s.id?.toLowerCase() === coneStormId.toLowerCase()
          );
          
          if (storm && storm.trackCone && storm.trackCone.kmzFile) {
            nhcUrl = storm.trackCone.kmzFile;
            isKmzEndpoint = true;
          } else {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ 
                success: false, 
                error: 'Storm not found or no cone data available',
                stormId: coneStormId,
                availableStorms: activeStormsResponse.data.activeStorms?.map(s => s.id) 
              })
            };
          }
        } catch (activeStormsError) {
          console.error('Error fetching active storms for cone:', activeStormsError);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
              success: false, 
              error: 'Failed to fetch active storms data',
              details: activeStormsError.message 
            })
          };
        }
        break;
        
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Invalid endpoint. Supported endpoints: active-storms, track-kmz, forecast-track, historical-track, forecast-cone' 
          })
        };
    }

    console.log(`Fetching data from NHC: ${nhcUrl}`);

    // Make the request to NHC API
    const axiosConfig = {
      timeout: 20000,
      headers: {
        'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
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
        if (endpoint === 'track-kmz') {
          responseData = await parseKmzToTrackGeoJSON(response.data);
          console.log(`Successfully parsed KMZ track data with ${responseData.features.length} features`);
        } else if (endpoint === 'forecast-cone') {
          responseData = await parseKmzToConeGeoJSON(response.data);
          console.log(`Successfully parsed KMZ cone data with ${responseData.features.length} features`);
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
