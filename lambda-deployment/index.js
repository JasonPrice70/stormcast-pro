const axios = require('axios');
const yauzl = require('yauzl');
const xml2js = require('xml2js');

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov';

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Parse KMZ file and extract cone polygon coordinates
 */
async function parseKmzToConeGeoJSON(kmzBuffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(new Error(`Failed to read KMZ file: ${err.message}`));
        return;
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(new Error(`Failed to read KML entry: ${err.message}`));
              return;
            }
            
            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf-8');
              
              // Parse KML XML
              xml2js.parseString(kmlContent, (err, result) => {
                if (err) {
                  reject(new Error(`Failed to parse KML XML: ${err.message}`));
                  return;
                }
                
                try {
                  const coneGeoJSON = extractConeFromKML(result);
                  resolve(coneGeoJSON);
                } catch (parseErr) {
                  reject(new Error(`Failed to extract cone data: ${parseErr.message}`));
                }
              });
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });
      
      zipfile.on('end', () => {
        if (!kmlContent) {
          reject(new Error('No KML file found in KMZ archive'));
        }
      });
      
      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract cone polygon coordinates from parsed KML
 */
function extractConeFromKML(kmlObject) {
  try {
    const kml = kmlObject.kml || kmlObject;
    const document = kml.Document?.[0] || kml.Folder?.[0];
    
    if (!document) {
      throw new Error('No Document or Folder found in KML');
    }
    
    // Look for cone polygon in placemarks
    const placemarks = document.Placemark || [];
    
    for (const placemark of placemarks) {
      const name = placemark.name?.[0] || '';
      
      // Look for cone-related polygons
      if (name.toLowerCase().includes('cone') || 
          name.toLowerCase().includes('uncertainty') ||
          placemark.Polygon) {
        
        const polygon = placemark.Polygon?.[0];
        if (polygon && polygon.outerBoundaryIs?.[0]?.LinearRing?.[0]?.coordinates?.[0]) {
          const coordString = polygon.outerBoundaryIs[0].LinearRing[0].coordinates[0];
          const coordinates = parseKMLCoordinates(coordString);
          
          return {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: {
                name: name,
                stormName: extractStormNameFromKML(kmlObject),
                description: placemark.description?.[0] || ''
              },
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
              }
            }]
          };
        }
      }
    }
    
    throw new Error('No cone polygon found in KML data');
  } catch (error) {
    throw new Error(`Failed to extract cone from KML: ${error.message}`);
  }
}

/**
 * Parse KML coordinate string into [lon, lat] pairs
 */
function parseKMLCoordinates(coordString) {
  return coordString.trim().split(/\s+/).map(coord => {
    const parts = coord.split(',');
    return [parseFloat(parts[0]), parseFloat(parts[1])]; // [longitude, latitude]
  });
}

/**
 * Extract storm name from KML metadata
 */
function extractStormNameFromKML(kmlObject) {
  try {
    const kml = kmlObject.kml || kmlObject;
    const document = kml.Document?.[0] || kml.Folder?.[0];
    return document?.name?.[0] || 'Unknown Storm';
  } catch (error) {
    return 'Unknown Storm';
  }
}

/**
 * Parse KMZ file and extract track line coordinates
 */
async function parseKmzToTrackGeoJSON(kmzBuffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(kmzBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(new Error(`Failed to read KMZ file: ${err.message}`));
        return;
      }

      let kmlContent = '';
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('.kml')) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(new Error(`Failed to read KML entry: ${err.message}`));
              return;
            }
            
            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              kmlContent = Buffer.concat(chunks).toString('utf-8');
              
              // Parse KML XML
              xml2js.parseString(kmlContent, (err, result) => {
                if (err) {
                  reject(new Error(`Failed to parse KML XML: ${err.message}`));
                  return;
                }
                
                try {
                  const trackGeoJSON = extractTrackFromKML(result);
                  resolve(trackGeoJSON);
                } catch (parseErr) {
                  reject(new Error(`Failed to extract track data: ${parseErr.message}`));
                }
              });
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });
      
      zipfile.on('end', () => {
        if (!kmlContent) {
          reject(new Error('No KML file found in KMZ archive'));
        }
      });
      
      zipfile.on('error', reject);
    });
  });
}

/**
 * Extract track line coordinates from parsed KML
 */
function extractTrackFromKML(kmlObject) {
  try {
    const kml = kmlObject.kml || kmlObject;
    const document = kml.Document?.[0] || kml.Folder?.[0];
    
    if (!document) {
      throw new Error('No Document or Folder found in KML');
    }
    
    const features = [];
    let placemarks = [];
    
    // Look for Placemarks directly in the document
    if (document.Placemark) {
      placemarks = placemarks.concat(document.Placemark);
    }
    
    // Look for Placemarks inside Folders
    if (document.Folder) {
      for (const folder of document.Folder) {
        if (folder.Placemark) {
          placemarks = placemarks.concat(folder.Placemark);
        }
      }
    }
    
    if (placemarks.length === 0) {
      throw new Error('No Placemarks found in KML data');
    }
    
    for (const placemark of placemarks) {
      const name = placemark.name?.[0] || '';
      
      // Look for track lines (LineString geometry)
      if (placemark.LineString) {
        const lineString = placemark.LineString[0];
        if (lineString.coordinates?.[0]) {
          const coordString = lineString.coordinates[0];
          const coordinates = parseKMLCoordinates(coordString);
          
          features.push({
            type: 'Feature',
            properties: {
              name: name,
              stormName: extractStormNameFromKML(kmlObject),
              description: placemark.description?.[0] || '',
              trackType: name.toLowerCase().includes('forecast') ? 'forecast' : 
                         name.toLowerCase().includes('past') ? 'historical' : 'track'
            },
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          });
        }
      }
      
      // Look for track points (Point geometry for position markers)
      if (placemark.Point) {
        const point = placemark.Point[0];
        if (point.coordinates?.[0]) {
          const coordString = point.coordinates[0];
          const coords = parseKMLCoordinates(coordString)[0]; // Just get the first point
          
          features.push({
            type: 'Feature',
            properties: {
              name: name,
              stormName: extractStormNameFromKML(kmlObject),
              description: placemark.description?.[0] || '',
              pointType: name.toLowerCase().includes('current') ? 'current' : 'position'
            },
            geometry: {
              type: 'Point',
              coordinates: coords
            }
          });
        }
      }
    }
    
    if (features.length === 0) {
      throw new Error('No track features found in KML data');
    }
    
    return {
      type: 'FeatureCollection',
      features: features
    };
  } catch (error) {
    throw new Error(`Failed to extract track from KML: ${error.message}`);
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
    
    switch (endpoint) {
      case 'active-storms':
        nhcUrl = `${NHC_BASE_URL}/CurrentStorms.json`;
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
        
        // Try to fetch the actual GeoJSON track data from NHC first
        const trackGeoJsonUrl = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId.toUpperCase()}_5day_latest.geojson`;
        try {
          const trackResponse = await axios.get(trackGeoJsonUrl, {
            timeout: 20000,
            headers: {
              'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
              'Accept': 'application/json'
            }
          });
          
          console.log(`Successfully fetched forecast track GeoJSON for ${stormId}`);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              data: trackResponse.data,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        } catch (trackError) {
          console.log(`Forecast track GeoJSON not available for ${stormId}, trying KMZ data`);
          
          // Get storm metadata to find the correct KMZ URL
          try {
            const currentStormsResponse = await axios.get(`${NHC_BASE_URL}/CurrentStorms.json`, {
              timeout: 20000,
              headers: {
                'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
                'Accept': 'application/json'
              }
            });
            
            const storms = currentStormsResponse.data.activeStorms || [];
            const targetStorm = storms.find(storm => storm.id.toLowerCase() === stormId.toLowerCase());
            
            if (!targetStorm || !targetStorm.forecastTrack?.kmzFile) {
              return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ 
                  error: 'Forecast track KMZ data not available',
                  stormId: stormId
                })
              };
            }
            
            const trackKmzUrl = targetStorm.forecastTrack.kmzFile;
            console.log(`Attempting to download KMZ track data: ${trackKmzUrl}`);
            
            const kmzResponse = await axios.get(trackKmzUrl, {
              timeout: 30000,
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
                'Accept': 'application/vnd.google-earth.kmz'
              }
            });
            
            console.log(`Successfully downloaded track KMZ file (${kmzResponse.data.byteLength} bytes)`);
            
            // Parse KMZ to extract track GeoJSON
            const trackGeoJSON = await parseKmzToTrackGeoJSON(Buffer.from(kmzResponse.data));
            
            console.log(`Successfully parsed forecast track data from KMZ for ${stormId}`);
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                data: trackGeoJSON,
                source: 'kmz',
                endpoint: endpoint,
                timestamp: new Date().toISOString()
              })
            };
            
          } catch (kmzError) {
            console.log(`Failed to download/parse KMZ track data for ${stormId}:`, kmzError.message);
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ 
                error: 'Forecast track data not available',
                stormId: stormId
              })
            };
          }
        }
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
        
        // Try to fetch the actual GeoJSON historical track data from NHC first
        const histTrackGeoJsonUrl = `${NHC_BASE_URL}/gis/best_track/archive/${histYear}/${histStormId.toUpperCase()}_best_track.geojson`;
        try {
          const histTrackResponse = await axios.get(histTrackGeoJsonUrl, {
            timeout: 20000,
            headers: {
              'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
              'Accept': 'application/json'
            }
          });
          
          console.log(`Successfully fetched historical track GeoJSON for ${histStormId}`);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              data: histTrackResponse.data,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        } catch (histTrackError) {
          console.log(`Historical track GeoJSON not available for ${histStormId}, trying alternative sources`);
          
          // For historical tracks, return empty data rather than 404 since "no data" is a valid state
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
              success: true,
              data: { features: [] },
              message: 'No historical track data available for this storm',
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        }
        break;
        
      case 'forecast-cone':
        const coneStormId = queryStringParameters?.stormId;
        const coneYear = queryStringParameters?.year || new Date().getFullYear();
        if (!coneStormId) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'stormId parameter is required for forecast-cone endpoint' })
          };
        }
        
        // Try to fetch the actual GeoJSON cone data from NHC first
        const coneGeoJsonUrl = `${NHC_BASE_URL}/gis/forecast/archive/${coneYear}/${coneStormId.toUpperCase()}_latest_CONE.geojson`;
        try {
          const coneResponse = await axios.get(coneGeoJsonUrl, {
            timeout: 20000,
            headers: {
              'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
              'Accept': 'application/json'
            }
          });
          
          console.log(`Successfully fetched cone GeoJSON for ${coneStormId}`);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              data: coneResponse.data,
              endpoint: endpoint,
              timestamp: new Date().toISOString()
            })
          };
        } catch (coneError) {
          console.log(`Cone GeoJSON not available for ${coneStormId}, trying KMZ data`);
          
          // Try to download and parse KMZ cone data
          const coneKmzUrl = `${NHC_BASE_URL}/storm_graphics/api/${coneStormId.toUpperCase()}_CONE_latest.kmz`;
          try {
            console.log(`Attempting to download KMZ cone data: ${coneKmzUrl}`);
            const kmzResponse = await axios.get(coneKmzUrl, {
              timeout: 30000,
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
                'Accept': 'application/vnd.google-earth.kmz'
              }
            });
            
            console.log(`Successfully downloaded KMZ file (${kmzResponse.data.byteLength} bytes)`);
            
            // Parse KMZ to extract cone GeoJSON
            const coneGeoJSON = await parseKmzToConeGeoJSON(Buffer.from(kmzResponse.data));
            
            console.log(`Successfully parsed cone data from KMZ for ${coneStormId}`);
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                data: coneGeoJSON,
                source: 'kmz',
                endpoint: endpoint,
                timestamp: new Date().toISOString()
              })
            };
            
          } catch (kmzError) {
            console.log(`Failed to download/parse KMZ cone data for ${coneStormId}:`, kmzError.message);
            
            // Fall back to basic metadata from CurrentStorms.json
            try {
              const currentStormsResponse = await axios.get(`${NHC_BASE_URL}/CurrentStorms.json`, {
                timeout: 20000,
                headers: {
                  'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
                  'Accept': 'application/json'
                }
              });
              
              const storms = currentStormsResponse.data.activeStorms || [];
              const targetStorm = storms.find(storm => storm.id.toLowerCase() === coneStormId.toLowerCase());
              
              if (!targetStorm) {
                return {
                  statusCode: 404,
                  headers: corsHeaders,
                  body: JSON.stringify({ error: 'Storm not found in active storms list' })
                };
              }
              
              // Return basic metadata indicating cone data is not available
              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                  success: true,
                  data: {
                    stormId: targetStorm.id,
                    name: targetStorm.name,
                    hasKmzCone: false,
                    error: 'Cone data could not be processed',
                    trackCone: targetStorm.trackCone,
                    forecastTrack: targetStorm.forecastTrack
                  },
                  endpoint: endpoint,
                  timestamp: new Date().toISOString()
                })
              };
            } catch (metadataError) {
              console.error('Failed to fetch storm metadata:', metadataError.message);
              return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ 
                  error: 'Failed to fetch cone data and storm metadata',
                  stormId: coneStormId
                })
              };
            }
          }
        }
        
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Invalid endpoint. Supported endpoints: active-storms, forecast-track, historical-track, forecast-cone' 
          })
        };
    }

    console.log(`Fetching data from NHC: ${nhcUrl}`);

    // Make the request to NHC API
    const response = await axios.get(nhcUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'StormCast Pro (cyclotrak.com, jasonprice70@gmail.com)',
        'Accept': 'application/json'
      }
    });

    console.log(`NHC API response status: ${response.status}`);

    // Return successful response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: response.data,
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
        endpoint: pathParameters?.proxy || 'unknown',
        timestamp: new Date().toISOString()
      })
    };
  }
};
