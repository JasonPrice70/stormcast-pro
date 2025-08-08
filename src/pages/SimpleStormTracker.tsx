import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimpleStormTracker.css';
import { useDemoData } from '../hooks/useDemoData';
import { useNHCData, useStormSurge } from '../hooks/useNHCData';
import SimpleHeader from '../components/SimpleHeader';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create storm icons based on category and type
const createStormIcon = (category: number, classification: string) => {
  let color = '#808080'; // Default gray
  let displayText = 'S';

  if (classification.toLowerCase().includes('hurricane')) {
    if (category >= 5) {
      color = '#8b0000'; // Category 5 - Dark red
      displayText = '5';
    } else if (category >= 4) {
      color = '#ff0000'; // Category 4 - Red
      displayText = '4';
    } else if (category >= 3) {
      color = '#ff6600'; // Category 3 - Orange
      displayText = '3';
    } else if (category >= 2) {
      color = '#ffaa00'; // Category 2 - Yellow-orange
      displayText = '2';
    } else if (category >= 1) {
      color = '#ffdd00'; // Category 1 - Yellow
      displayText = '1';
    }
  } else if (classification.toLowerCase().includes('tropical storm')) {
    color = '#00aaff'; // Blue
    displayText = 'TS';
  } else if (classification.toLowerCase().includes('depression')) {
    color = '#808080'; // Gray
    displayText = 'TD';
  }

  return L.divIcon({
    html: `<div class="storm-icon" style="background: ${color};">${displayText}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// Get color for track point intensity markers
const getIntensityColor = (stormType: string, styleCategory: string) => {
  switch (styleCategory) {
    case '5':
    case 'cat5':
      return '#8b0000'; // Dark red
    case '4':
    case 'cat4':
      return '#ff0000'; // Red
    case '3':
    case 'cat3':
      return '#ff6600'; // Orange
    case '2':
    case 'cat2':
      return '#ffaa00'; // Yellow-orange
    case '1':
    case 'cat1':
      return '#ffdd00'; // Yellow
    case 'ts':
      return '#00aaff'; // Blue
    case 'td':
      return '#808080'; // Gray
    case 'ex':
      return '#666666'; // Dark gray
    case 'fc':
      return '#9966ff'; // Purple for forecast
    default:
      return '#cccccc'; // Light gray
  }
};

// Get text color for track point intensity markers
const getIntensityTextColor = (stormType: string, styleCategory: string) => {
  switch (styleCategory) {
    case '5':
    case 'cat5':
    case '4':
    case 'cat4':
    case '3':
    case 'cat3':
    case 'ex':
    case 'fc':
      return '#ffffff'; // White text for dark backgrounds
    default:
      return '#000000'; // Black text for light backgrounds
  }
};

// Get color for forecast track point intensity markers (similar to regular track but with red tint)
const getForecastIntensityColor = (stormType: string, styleCategory: string) => {
  switch (styleCategory) {
    case '5':
    case 'cat5':
      return '#cc0000'; // Deep red
    case '4':
    case 'cat4':
      return '#ff3333'; // Red
    case '3':
    case 'cat3':
      return '#ff6666'; // Light red
    case '2':
    case 'cat2':
      return '#ff9999'; // Pink-red
    case '1':
    case 'cat1':
      return '#ffcccc'; // Light pink
    case 'ts':
      return '#ffaaaa'; // Light pink-red
    case 'td':
      return '#ffdddd'; // Very light pink
    case 'ex':
      return '#990000'; // Dark red
    case 'fc':
    default:
      return '#ffeeff'; // Very light purple for forecast
  }
};

// Get intensity category from wind speed (in knots or mph)
const getIntensityCategoryFromWinds = (windSpeed: number, isKnots: boolean = true): string => {
  const knotSpeed = isKnots ? windSpeed : windSpeed * 0.868976; // Convert mph to knots if needed
  
  if (knotSpeed < 34) return 'TD';
  else if (knotSpeed < 64) return 'TS';
  else if (knotSpeed < 83) return '1';
  else if (knotSpeed < 96) return '2';
  else if (knotSpeed < 113) return '3';
  else if (knotSpeed < 137) return '4';
  else return '5';
};

// Demo storm data for fallback
const demoStorms = [
  {
    id: 'demo-hurricane-emily',
    name: 'Hurricane Emily',
    classification: 'Hurricane',
    category: 3,
    position: [28.5, -85.0] as [number, number],
    maxWinds: 120,
    pressure: 960,
    movement: 'NW at 15 mph',
    lastUpdate: new Date('2025-08-04T18:00:00Z'),
    historical: [
      {
        latitude: 24.5,
        longitude: -81.0,
        dateTime: '2025-08-02T06:00:00Z',
        maxWinds: 80,
        pressure: 990,
        category: 1,
        classification: 'Hurricane'
      },
      {
        latitude: 25.2,
        longitude: -82.1,
        dateTime: '2025-08-02T18:00:00Z',
        maxWinds: 95,
        pressure: 975,
        category: 2,
        classification: 'Hurricane'
      },
      {
        latitude: 26.8,
        longitude: -83.5,
        dateTime: '2025-08-03T06:00:00Z',
        maxWinds: 110,
        pressure: 965,
        category: 3,
        classification: 'Hurricane'
      },
      {
        latitude: 27.8,
        longitude: -84.2,
        dateTime: '2025-08-04T06:00:00Z',
        maxWinds: 115,
        pressure: 962,
        category: 3,
        classification: 'Hurricane'
      }
    ],
    forecast: [
      {
        latitude: 29.2,
        longitude: -86.1,
        dateTime: '2025-08-05T06:00:00Z',
        maxWinds: 125,
        gusts: 155,
        pressure: 955,
        movement: { direction: 315, speed: 15 },
        forecastHour: 12
      },
      {
        latitude: 30.1,
        longitude: -87.5,
        dateTime: '2025-08-05T18:00:00Z',
        maxWinds: 130,
        gusts: 160,
        pressure: 950,
        movement: { direction: 320, speed: 16 },
        forecastHour: 24
      },
      {
        latitude: 31.5,
        longitude: -88.8,
        dateTime: '2025-08-06T06:00:00Z',
        maxWinds: 125,
        gusts: 150,
        pressure: 955,
        movement: { direction: 325, speed: 18 },
        forecastHour: 36
      },
      {
        latitude: 33.0,
        longitude: -89.5,
        dateTime: '2025-08-06T18:00:00Z',
        maxWinds: 100,
        gusts: 125,
        pressure: 975,
        movement: { direction: 330, speed: 20 },
        forecastHour: 48
      },
      {
        latitude: 34.8,
        longitude: -89.8,
        dateTime: '2025-08-07T06:00:00Z',
        maxWinds: 75,
        gusts: 95,
        pressure: 990,
        movement: { direction: 335, speed: 22 },
        forecastHour: 60
      }
    ],
    cone: {
      type: 'Polygon',
      coordinates: [[
        [-85.0, 28.5], [-86.1, 29.2], [-87.5, 30.1], [-88.8, 31.5], [-89.5, 33.0],
        [-89.8, 34.8], [-89.6, 35.2], [-89.0, 35.5], [-88.2, 35.3], [-87.1, 34.8],
        [-86.0, 33.9], [-85.2, 32.7], [-84.8, 31.2], [-84.9, 29.8], [-85.0, 28.5]
      ]],
      properties: {
        stormName: 'EMILY',
        advisoryNumber: '15A',
        validTime: '2025-08-05T06:00:00Z'
      }
    },
    track: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-81.0, 24.5]
          },
          properties: {
            category: 'TD',
            stormType: 'TD',
            styleCategory: 'td',
            intensity: 30,
            intensityMPH: 35,
            minSeaLevelPres: 1005,
            datetime: '2025-08-02T06:00:00Z'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-82.1, 25.2]
          },
          properties: {
            category: 'TS',
            stormType: 'TS',
            styleCategory: 'ts',
            intensity: 45,
            intensityMPH: 50,
            minSeaLevelPres: 1000,
            datetime: '2025-08-02T18:00:00Z'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-83.5, 26.8]
          },
          properties: {
            category: '1',
            stormType: 'HU',
            styleCategory: 'cat1',
            intensity: 80,
            intensityMPH: 90,
            minSeaLevelPres: 985,
            datetime: '2025-08-03T06:00:00Z'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-84.2, 27.8]
          },
          properties: {
            category: '3',
            stormType: 'HU',
            styleCategory: 'cat3',
            intensity: 110,
            intensityMPH: 125,
            minSeaLevelPres: 965,
            datetime: '2025-08-04T06:00:00Z'
          }
        }
      ],
      source: 'demo'
    },
    forecastTrack: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-85.5, 29.0]
          },
          properties: {
            category: '4',
            stormType: 'HU',
            styleCategory: 'cat4',
            intensity: 125,
            intensityMPH: 145,
            minSeaLevelPres: 955,
            datetime: '2025-08-05T06:00:00Z (Forecast)'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-86.8, 30.2]
          },
          properties: {
            category: '5',
            stormType: 'HU',
            styleCategory: 'cat5',
            intensity: 140,
            intensityMPH: 160,
            minSeaLevelPres: 940,
            datetime: '2025-08-05T18:00:00Z (Forecast)'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-88.0, 31.5]
          },
          properties: {
            category: '3',
            stormType: 'HU',
            styleCategory: 'cat3',
            intensity: 105,
            intensityMPH: 120,
            minSeaLevelPres: 970,
            datetime: '2025-08-06T06:00:00Z (Forecast)'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-89.2, 33.0]
          },
          properties: {
            category: 'TS',
            stormType: 'TS',
            styleCategory: 'ts',
            intensity: 55,
            intensityMPH: 65,
            minSeaLevelPres: 990,
            datetime: '2025-08-06T18:00:00Z (Forecast)'
          }
        }
      ],
      source: 'demo'
    },
    advisoryUrl: 'https://www.nhc.noaa.gov/',
    trackUrl: '#',
    coneUrl: '#'
  },
  {
    id: 'demo-tropical-storm-franklin',
    name: 'Tropical Storm Franklin',
    classification: 'Tropical Storm',
    category: 0,
    position: [22.0, -78.0] as [number, number],
    maxWinds: 65,
    pressure: 990,
    movement: 'N at 12 mph',
    lastUpdate: new Date('2025-08-04T18:00:00Z'),
    historical: [
      {
        latitude: 19.5,
        longitude: -76.5,
        dateTime: '2025-08-03T06:00:00Z',
        maxWinds: 35,
        pressure: 1005,
        category: 0,
        classification: 'Tropical Depression'
      },
      {
        latitude: 20.2,
        longitude: -77.1,
        dateTime: '2025-08-03T18:00:00Z',
        maxWinds: 45,
        pressure: 1000,
        category: 0,
        classification: 'Tropical Storm'
      },
      {
        latitude: 21.1,
        longitude: -77.6,
        dateTime: '2025-08-04T06:00:00Z',
        maxWinds: 60,
        pressure: 995,
        category: 0,
        classification: 'Tropical Storm'
      }
    ],
    forecast: [
      {
        latitude: 23.2,
        longitude: -78.5,
        dateTime: '2025-08-05T06:00:00Z',
        maxWinds: 70,
        gusts: 85,
        pressure: 985,
        movement: { direction: 0, speed: 12 },
        forecastHour: 12
      },
      {
        latitude: 24.8,
        longitude: -79.0,
        dateTime: '2025-08-05T18:00:00Z',
        maxWinds: 80,
        gusts: 100,
        pressure: 980,
        movement: { direction: 10, speed: 14 },
        forecastHour: 24
      },
      {
        latitude: 26.5,
        longitude: -79.2,
        dateTime: '2025-08-06T06:00:00Z',
        maxWinds: 90,
        gusts: 110,
        pressure: 975,
        movement: { direction: 15, speed: 16 },
        forecastHour: 36
      },
      {
        latitude: 28.0,
        longitude: -79.0,
        dateTime: '2025-08-06T18:00:00Z',
        maxWinds: 85,
        gusts: 105,
        pressure: 978,
        movement: { direction: 20, speed: 18 },
        forecastHour: 48
      }
    ],
    cone: {
      type: 'Polygon',
      coordinates: [[
        [-78.0, 22.0], [-78.5, 23.2], [-79.0, 24.8], [-79.2, 26.5], [-79.0, 28.0],
        [-78.5, 28.5], [-78.0, 28.2], [-77.5, 27.5], [-77.2, 26.2], [-77.4, 24.5],
        [-77.7, 23.0], [-78.0, 22.0]
      ]],
      properties: {
        stormName: 'FRANKLIN',
        advisoryNumber: '8A',
        validTime: '2025-08-05T06:00:00Z'
      }
    },
    advisoryUrl: 'https://www.nhc.noaa.gov/',
    trackUrl: '#',
    coneUrl: '#'
  }
];

const SimpleStormTracker: React.FC = () => {
  const [useDemo, setUseDemo] = useState(false); // Use live data to check cone fetching // Start with live data by default
  const [showTracks, setShowTracks] = useState(true);
  const [showForecastCones, setShowForecastCones] = useState(true);
  const [showStormSurge, setShowStormSurge] = useState(false);
  const [fetchLiveTrackData, setFetchLiveTrackData] = useState(true); // Enable track data fetching by default
  
  // Use both hooks
  const demoData = useDemoData();
  const liveData = useNHCData({ 
    autoRefresh: false, // Disable auto-refresh - only call once per page load
    fetchOnMount: true, // Fetch on mount since we start with live data by default
    useProxy: true, // Enable CORS proxy for development
    fetchTrackData: fetchLiveTrackData // Control track data fetching
  });

  // Choose which data source to use
  const currentData = useDemo ? demoData : liveData;
  const { storms, loading, error, lastUpdated, refresh } = currentData;

  // Get the first storm ID for storm surge data
  const firstStormId = storms.length > 0 ? storms[0].id : null;
  
  // Use storm surge hook for the first storm
  const stormSurge = useStormSurge(showStormSurge ? firstStormId : null);

  // Determine what data to display with proper fallback
  const shouldUseDemoData = useDemo || storms.length === 0;
  const displayStorms = shouldUseDemoData ? demoStorms : storms;
  const hasStorms = displayStorms.length > 0;
  const dataSource = shouldUseDemoData ? 'demo' : 'live';

  // Handle live data button click with error handling
  const handleLiveDataClick = async () => {
    try {
      setUseDemo(false);
      
      // Fetch live data - this will only happen once per page load when user clicks
      console.log('Fetching live storm data...');
      await liveData.refresh();
      console.log('Live data fetched, storms:', liveData.storms?.map(s => ({ id: s.id, name: s.name, cone: !!s.cone })));
    } catch (err) {
      console.error('Failed to switch to live data:', err);
      // Fall back to demo data if live data fails
      setUseDemo(true);
      
      // Show more helpful error message based on error type
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMsg.includes('CORS proxy access denied') || errorMsg.includes('403')) {
        alert('🔒 CORS Proxy Access Required!\n\n' +
              '✅ Step 1: Visit https://cors-anywhere.herokuapp.com/corsdemo\n' +
              '✅ Step 2: Click "Request temporary access to the demo server"\n' +
              '✅ Step 3: Return here and click "Live Data" again\n\n' +
              '💡 This is a one-time setup for accessing live hurricane data.\n' +
              'Using demo data for now.');
      } else if (errorMsg.includes('CORS restrictions') || errorMsg.includes('Development environment detected')) {
        alert('🌐 Development Environment Limitation\n\n' +
              'The NHC API works when you visit it directly in your browser,\n' +
              'but blocks requests from localhost due to CORS security policy.\n' +
              'This is normal and expected in development.\n\n' +
              '� To access live data:\n' +
              '1. Visit: https://cors-anywhere.herokuapp.com/corsdemo\n' +
              '2. Click "Request temporary access to the demo server"\n' +
              '3. Return here and try "Live Data" again\n\n' +
              'Using demo data for now.');
      } else if (errorMsg.includes('timeout')) {
        alert('⏱️ Connection Timeout\n\n' +
              'The hurricane data servers are taking too long to respond.\n' +
              'This often means CORS proxy access is needed.\n\n' +
              '🔑 To fix this:\n' +
              '1. Visit: https://cors-anywhere.herokuapp.com/corsdemo\n' +
              '2. Click "Request temporary access to the demo server"\n' +
              '3. Return here and try "Live Data" again\n\n' +
              'Using demo data for now.');
      } else {
        alert('⚠️ Unable to Connect to Live Data\n\n' +
              'There was an issue connecting to the hurricane data feed.\n' +
              'This could be due to:\n' +
              '• Network connectivity issues\n' +
              '• Server maintenance\n' +
              '• CORS proxy restrictions\n\n' +
              '💡 Try again later or use demo data for now.');
      }
    }
  };

  // Helper function to open CORS proxy access page
  const openCorsAccess = () => {
    window.open('https://cors-anywhere.herokuapp.com/corsdemo', '_blank');
  };

  // Debug function to test connectivity
  const testConnectivity = async () => {
    try {
      const result = await liveData.refresh();
      console.log('Test result:', result);
      alert('Connectivity test completed. Check browser console for details.');
    } catch (error) {
      console.error('Connectivity test failed:', error);
      alert(`Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Debug logging
  console.log('Storm Tracker Debug:', { 
    useDemo, 
    shouldUseDemoData, 
    displayStorms: displayStorms.length,
    hasStorms,
    dataSource,
    storms: storms?.length || 0,
    error: error?.substring(0, 50)
  });

  return (
    <div className="simple-storm-tracker">
      {/* Header positioned on top of map */}
      <SimpleHeader />
      
      {/* Map Container */}
      <div className="map-wrapper">
        <MapContainer 
          center={[26.0, -82.0]} 
          zoom={5} 
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Render storm markers */}
        {displayStorms.map((storm) => (
          <Marker
            key={storm.id}
            position={storm.position}
            icon={createStormIcon(storm.category, storm.classification)}
          >
            <Popup closeOnClick={false} autoClose={false}>
              <div className="storm-popup">
                <div className="storm-popup-header">
                  <h3 className="storm-popup-title">
                    {storm.name}
                    {dataSource === 'demo' && (
                      <span className="storm-popup-demo-badge"> (Demo)</span>
                    )}
                  </h3>
                </div>
                <div className="storm-popup-content">
                  <p className="storm-popup-field">
                    <strong>Classification:</strong> {storm.classification}
                  </p>
                  <p className="storm-popup-field">
                    <strong>Category:</strong> {storm.category > 0 ? storm.category : 'N/A'}
                  </p>
                  <p className="storm-popup-field storm-popup-winds">
                    <strong>Max Winds:</strong> {storm.maxWinds} mph
                  </p>
                  <p className="storm-popup-field">
                    <strong>Pressure:</strong> {storm.pressure} mb
                  </p>
                  <p className="storm-popup-field">
                    <strong>Movement:</strong> {storm.movement}
                  </p>
                  <p className="storm-popup-last-update">
                    Last Updated: {storm.lastUpdate.toLocaleString()}
                  </p>
                  <div className="storm-popup-advisory-container">
                    <a 
                      href={storm.advisoryUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="storm-popup-advisory-link"
                    >
                      View Advisory
                    </a>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render storm tracks from KMZ data or historical data */}
        {showTracks && displayStorms.map((storm) => {
          // First try to use official track data from KMZ
          if (storm.track && storm.track.features && storm.track.features.length > 0) {
            return (
              <React.Fragment key={`${storm.id}-track`}>
                {storm.track.features.map((feature: any, featureIndex: number) => {
                  if (feature.geometry.type === 'LineString') {
                    // Track line
                    const trackPath: [number, number][] = feature.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
                    
                    return (
                      <Polyline
                        key={`${storm.id}-track-line-${featureIndex}`}
                        positions={trackPath}
                        pathOptions={{
                          color: '#666666',
                          weight: 3,
                          opacity: 0.8,
                          dashArray: '5, 5'
                        }}
                      />
                    );
                  } else if (feature.geometry.type === 'Point') {
                    // Track point with intensity
                    const [lon, lat] = feature.geometry.coordinates;
                    const properties = feature.properties || {};
                  const category = properties.category || '';
                  
                  // Create custom icon with intensity text
                  const intensityIcon = L.divIcon({
                    html: `<div style="
                      background-color: ${getIntensityColor(properties.stormType, properties.styleCategory)};
                      border: 2px solid #333;
                      border-radius: 50%;
                      width: 24px;
                      height: 24px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 10px;
                      font-weight: bold;
                      color: ${getIntensityTextColor(properties.stormType, properties.styleCategory)};
                      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${category}</div>`,
                    className: 'intensity-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-track-point-${featureIndex}`}
                      position={[lat, lon]}
                      icon={intensityIcon}
                    >
                      <Popup>
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>{storm.name} - {properties.datetime || 'Track Position'}</strong><br />
                          {properties.category && (
                            <>
                              <strong>Intensity:</strong> {properties.category}<br />
                            </>
                          )}
                          {properties.intensity && (
                            <>
                              <strong>Max Winds:</strong> {properties.intensity} knots ({properties.intensityMPH} mph)<br />
                            </>
                          )}
                          {properties.minSeaLevelPres && (
                            <>
                              <strong>Pressure:</strong> {properties.minSeaLevelPres} mb<br />
                            </>
                          )}
                          <strong>Location:</strong> {lat.toFixed(1)}°N, {Math.abs(lon).toFixed(1)}°W
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
                return null;
              })}
            </React.Fragment>
          );
          }
          
          // If no official track data, use historical data as fallback
          if (storm.historical && storm.historical.length > 0) {
            const historicalPath = storm.historical.map(point => [point.latitude, point.longitude] as [number, number]);
            
            return (
              <React.Fragment key={`${storm.id}-historical-track`}>
                {/* Historical track line */}
                <Polyline
                  positions={[[storm.position[0], storm.position[1]], ...historicalPath.reverse()]}
                  pathOptions={{
                    color: '#888888',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '8, 4'
                  }}
                />
                {/* Historical track points */}
                {storm.historical.map((point, index) => {
                  // Determine intensity category for historical point
                  const category = getIntensityCategoryFromWinds(point.maxWinds, false); // maxWinds is in mph
                  
                  // Create historical intensity icon
                  const historicalIcon = L.divIcon({
                    html: `<div style="
                      background-color: ${getIntensityColor('', category.toLowerCase())};
                      border: 2px solid #333;
                      border-radius: 50%;
                      width: 18px;
                      height: 18px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 9px;
                      font-weight: bold;
                      color: ${getIntensityTextColor('', category.toLowerCase())};
                      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${category}</div>`,
                    className: 'historical-intensity-marker',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-historical-${index}`}
                      position={[point.latitude, point.longitude]}
                      icon={historicalIcon}
                    >
                      <Popup>
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>{storm.name} - Historical Position</strong><br />
                          <strong>Time:</strong> {new Date(point.dateTime).toLocaleString()}<br />
                          <strong>Intensity:</strong> {category}<br />
                          <strong>Max Winds:</strong> {point.maxWinds} mph<br />
                          <strong>Pressure:</strong> {point.pressure} mb
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </React.Fragment>
            );
          }
          
          return null;
        })}

        {/* Render forecast tracks from KMZ data or forecast data */}
        {showTracks && displayStorms.map((storm) => {
          // First try to use official forecast track data from KMZ
          if (storm.forecastTrack && storm.forecastTrack.features && storm.forecastTrack.features.length > 0) {
          
          return (
            <React.Fragment key={`${storm.id}-forecast-track`}>
              {storm.forecastTrack.features.map((feature: any, featureIndex: number) => {
                if (feature.geometry.type === 'LineString') {
                  // Forecast track line
                  const forecastPath: [number, number][] = feature.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
                  
                  return (
                    <Polyline
                      key={`${storm.id}-forecast-track-line-${featureIndex}`}
                      positions={forecastPath}
                      pathOptions={{
                        color: '#ff3333',
                        weight: 4,
                        opacity: 0.9,
                        dashArray: '10, 5'
                      }}
                    />
                  );
                } else if (feature.geometry.type === 'Point') {
                  // Forecast track point with intensity
                  const [lon, lat] = feature.geometry.coordinates;
                  const properties = feature.properties || {};
                  let category = properties.category || '';
                  
                  // Enhanced category determination for forecast points
                  if (!category || category.includes('Point')) {
                    // Fallback: determine category from intensity if available
                    if (properties.intensity) {
                      category = getIntensityCategoryFromWinds(parseInt(properties.intensity), true);
                    } else if (properties.intensityMPH) {
                      category = getIntensityCategoryFromWinds(parseInt(properties.intensityMPH), false);
                    } else {
                      // Default forecast category
                      category = 'FC';
                    }
                  }
                  
                  // Create custom forecast intensity icon with red styling
                  const forecastIntensityIcon = L.divIcon({
                    html: `<div style="
                      background-color: ${getForecastIntensityColor(properties.stormType, properties.styleCategory)};
                      border: 2px solid #cc0000;
                      border-radius: 50%;
                      width: 26px;
                      height: 26px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 11px;
                      font-weight: bold;
                      color: ${getIntensityTextColor(properties.stormType, properties.styleCategory)};
                      box-shadow: 0 2px 6px rgba(204,0,0,0.4);
                    ">${category}</div>`,
                    className: 'forecast-intensity-marker',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-forecast-track-point-${featureIndex}`}
                      position={[lat, lon]}
                      icon={forecastIntensityIcon}
                    >
                      <Popup>
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>{storm.name} - Forecast Position</strong><br />
                          {properties.category && (
                            <>
                              <strong>Forecast Intensity:</strong> {properties.category}<br />
                            </>
                          )}
                          {properties.intensity && (
                            <>
                              <strong>Forecast Max Winds:</strong> {properties.intensity} knots ({properties.intensityMPH} mph)<br />
                            </>
                          )}
                          {properties.minSeaLevelPres && (
                            <>
                              <strong>Forecast Pressure:</strong> {properties.minSeaLevelPres} mb<br />
                            </>
                          )}
                          {properties.datetime && !properties.datetime.includes('Point') && (
                            <>
                              <strong>Forecast Time:</strong> {properties.datetime}<br />
                            </>
                          )}
                          <strong>Location:</strong> {lat.toFixed(1)}°N, {Math.abs(lon).toFixed(1)}°W
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
                return null;
              })}
            </React.Fragment>
          );
        }
          
        // If no official forecast track data, use forecast data as fallback
          if (storm.forecast && storm.forecast.length > 0) {
            const forecastPath = storm.forecast.map(point => [point.latitude, point.longitude] as [number, number]);
            
            return (
              <React.Fragment key={`${storm.id}-forecast-track-simple`}>
                {/* Simple forecast track line */}
                <Polyline
                  positions={[[storm.position[0], storm.position[1]], ...forecastPath]}
                  pathOptions={{
                    color: '#ff6600',
                    weight: 3,
                    opacity: 0.9,
                    dashArray: '8, 4'
                  }}
                />
                {/* Forecast track points */}
                {storm.forecast.map((point, index) => {
                  // Determine intensity category for forecast point
                  const category = getIntensityCategoryFromWinds(point.maxWinds, false); // maxWinds is in mph
                  
                  // Create forecast intensity icon
                  const forecastIcon = L.divIcon({
                    html: `<div style="
                      background-color: ${getForecastIntensityColor('', category.toLowerCase())};
                      border: 2px solid #cc0000;
                      border-radius: 50%;
                      width: 20px;
                      height: 20px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 10px;
                      font-weight: bold;
                      color: ${getIntensityTextColor('', category.toLowerCase())};
                      box-shadow: 0 2px 4px rgba(204,0,0,0.4);
                    ">${category}</div>`,
                    className: 'forecast-intensity-marker',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-forecast-point-${index}`}
                      position={[point.latitude, point.longitude]}
                      icon={forecastIcon}
                    >
                      <Popup>
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>{storm.name} - Forecast Position</strong><br />
                          <strong>Time:</strong> {new Date(point.dateTime).toLocaleString()}<br />
                          <strong>Forecast Hour:</strong> +{point.forecastHour}h<br />
                          <strong>Forecast Intensity:</strong> {category}<br />
                          <strong>Max Winds:</strong> {point.maxWinds} mph<br />
                          <strong>Pressure:</strong> {point.pressure} mb
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </React.Fragment>
            );
          }
          
          return null;
        })}

        {/* Render forecast cones */}
        {showForecastCones && displayStorms.map((storm) => {
          console.log(`Checking cone for ${storm.name}:`, { 
            hasCone: !!storm.cone, 
            coneType: storm.cone?.type, 
            hasCoordinates: !!storm.cone?.coordinates,
            coordinatesLength: storm.cone?.coordinates?.length,
            stormId: storm.id,
            coneData: storm.cone
          });
          
          // First try to use official cone data
          if (storm.cone) {
            try {
              let coneCoordinates: [number, number][] = [];
              
              // Handle FeatureCollection format from KMZ (live data)
              if (storm.cone.type === 'FeatureCollection' && storm.cone.features && storm.cone.features.length > 0) {
                const coneFeature = storm.cone.features[0]; // Use first feature
                if (coneFeature.geometry && coneFeature.geometry.type === 'Polygon') {
                  // Convert from [lon, lat] to [lat, lon] format
                  coneCoordinates = coneFeature.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
                  console.log(`FeatureCollection cone for ${storm.name}:`, coneCoordinates.slice(0, 3));
                }
              }
              // Handle direct polygon format from demo data
              else if (storm.cone.coordinates) {
                if (storm.cone.type === 'Polygon') {
                  // Single polygon
                  coneCoordinates = storm.cone.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
                  console.log(`Polygon cone for ${storm.name}:`, coneCoordinates.slice(0, 3));
                } else if (storm.cone.type === 'MultiPolygon') {
                  // Multiple polygons - use the first one
                  coneCoordinates = storm.cone.coordinates[0][0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
                  console.log(`MultiPolygon cone for ${storm.name}:`, coneCoordinates.slice(0, 3));
                }
              }
              
              if (coneCoordinates.length > 0) {
                console.log(`Rendering cone for ${storm.name} with ${coneCoordinates.length} points`);
                return (
                  <Polygon
                    key={`${storm.id}-cone`}
                    positions={coneCoordinates}
                    pathOptions={{
                      color: '#ffaa00',
                      weight: 2,
                      opacity: 0.8,
                      fillColor: '#ffaa00',
                      fillOpacity: 0.15
                    }}
                  />
                );
              }
            } catch (error) {
              console.warn(`Error rendering cone for ${storm.name}:`, error);
            }
          }
          
          // If no official cone, generate a simple forecast track with uncertainty
          if (storm.forecast && storm.forecast.length > 0) {
            const forecastPositions = storm.forecast.map(point => [point.latitude, point.longitude] as [number, number]);
            
            if (forecastPositions.length >= 2) {
              return (
                <React.Fragment key={`${storm.id}-generated-cone`}>
                  {/* Draw forecast track as dashed line */}
                  <Polyline
                    positions={[[storm.position[0], storm.position[1]], ...forecastPositions]}
                    pathOptions={{
                      color: '#ffaa00',
                      weight: 3,
                      opacity: 0.8,
                      dashArray: '10, 5'
                    }}
                  />
                  {/* Draw uncertainty circles at forecast points */}
                  {storm.forecast.map((point, index) => {
                    const radius = 50000 + (index * 20000); // Increasing uncertainty with time
                    return (
                      <CircleMarker
                        key={`${storm.id}-uncertainty-${index}`}
                        center={[point.latitude, point.longitude]}
                        radius={Math.min(15, 8 + index * 2)} // Visual radius for screen
                        pathOptions={{
                          fillColor: 'rgba(255, 170, 0, 0.15)',
                          fillOpacity: 0.2,
                          color: '#ffaa00',
                          weight: 1,
                          opacity: 0.6
                        }}
                      />
                    );
                  })}
                </React.Fragment>
              );
            }
          }
          
          return null;
        })}

        {/* Storm Surge Layer */}
        {showStormSurge && stormSurge.surgeData && stormSurge.surgeData.features && stormSurge.surgeData.features.map((feature: any, index: number) => {
          if (feature.geometry && feature.geometry.type === 'Polygon') {
            const coordinates = feature.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            
            // Get surge height from properties for color coding
            let surgeColor = '#ff4444'; // Default red
            let surgeOpacity = 0.3;
            
            if (feature.properties) {
              const height = feature.properties.SURGE_FT || feature.properties.height || 0;
              if (height >= 15) {
                surgeColor = '#800000'; // Dark red for 15+ feet
                surgeOpacity = 0.5;
              } else if (height >= 10) {
                surgeColor = '#ff0000'; // Red for 10-15 feet
                surgeOpacity = 0.4;
              } else if (height >= 6) {
                surgeColor = '#ff4400'; // Orange-red for 6-10 feet
                surgeOpacity = 0.35;
              } else if (height >= 3) {
                surgeColor = '#ff8800'; // Orange for 3-6 feet
                surgeOpacity = 0.3;
              } else {
                surgeColor = '#ffaa00'; // Yellow for 0-3 feet
                surgeOpacity = 0.25;
              }
            }
            
            return (
              <Polygon
                key={`surge-${index}`}
                positions={coordinates}
                pathOptions={{
                  color: surgeColor,
                  weight: 1,
                  opacity: 0.8,
                  fillColor: surgeColor,
                  fillOpacity: surgeOpacity
                }}
              >
                <Popup>
                  <div>
                    <strong>Storm Surge</strong><br />
                    Height: {feature.properties?.SURGE_FT || feature.properties?.height || 'Unknown'} ft
                  </div>
                </Popup>
              </Polygon>
            );
          }
          return null;
        })}

      </MapContainer>
      </div>

      {/* Floating Control Panel */}
      <div className="floating-control-panel">
        <h3 className="control-panel-header">
          {dataSource === 'demo' ? '🌀 Demo Mode' : '🌊 Live Data'}
        </h3>
        <div className="control-panel-content">
          {loading ? (
            <span className="control-panel-loading">Loading storms...</span>
          ) : error && !shouldUseDemoData ? (
            <>
              <div className="control-panel-error">
                {error.includes('CORS proxy access required') || error.includes('🔒') ? (
                  <>
                    <div>🔒 Proxy Access Required</div>
                    <div style={{fontSize: '0.8rem', marginTop: '5px', lineHeight: '1.3'}}>
                      <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" rel="noopener noreferrer" style={{color: '#5e35b1', textDecoration: 'underline'}}>
                        Click here to request access
                      </a>
                      <br />
                      Then return and try "Live Data" again
                    </div>
                  </>
                ) : error.includes('CORS restrictions') || error.includes('🌐') ? (
                  <>
                    <div>🌐 Browser Security Restriction</div>
                    <div style={{fontSize: '0.8rem', marginTop: '5px', lineHeight: '1.3'}}>
                      This is normal in development.<br />
                      <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" rel="noopener noreferrer" style={{color: '#5e35b1', textDecoration: 'underline'}}>
                        Request proxy access
                      </a> to connect to live data
                    </div>
                  </>
                ) : error.includes('port conflict') || error.includes('🔌') || error.includes('localhost:3002') ? (
                  <>
                    <div>🔌 Port Configuration Issue</div>
                    <div style={{fontSize: '0.8rem', marginTop: '5px', lineHeight: '1.3'}}>
                      CORS proxy expects different port.<br />
                      <button 
                        onClick={openCorsAccess}
                        style={{
                          marginTop: '4px',
                          padding: '3px 6px',
                          fontSize: '0.7rem',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        🔑 Get Access
                      </button>
                    </div>
                  </>
                ) : error.includes('timeout') || error.includes('⏱️') ? (
                  <>
                    <div>⏱️ Connection Timeout</div>
                    <div style={{fontSize: '0.8rem', marginTop: '5px', lineHeight: '1.3'}}>
                      Likely needs CORS proxy access.<br />
                      <button 
                        onClick={openCorsAccess}
                        style={{
                          marginTop: '4px',
                          padding: '3px 6px',
                          fontSize: '0.7rem',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        🔑 Get Access
                      </button>
                    </div>
                  </>
                ) : error.includes('Network') || error.includes('📡') ? (
                  <>
                    <div>📡 Network Issue</div>
                    <div style={{fontSize: '0.8rem', marginTop: '5px'}}>
                      Check your internet connection
                    </div>
                  </>
                ) : (
                  <>
                    <div>⚠️ Data Unavailable</div>
                    <div style={{fontSize: '0.8rem', marginTop: '5px'}}>
                      {error.substring(0, 50)}...
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={() => setUseDemo(true)}
                className="control-panel-button control-panel-button--view-demo"
              >
                Use Demo Data
              </button>
            </>
          ) : (
            <>
              {lastUpdated && (
                <span className="control-panel-updated">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              
              {/* Path Visibility Controls */}
              <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#1a237e' }}>
                  Storm Paths
                  {dataSource === 'live' && (
                    <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#666', marginTop: '2px' }}>
                      Fetching real NHC forecast & historical data...
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showTracks}
                      onChange={(e) => setShowTracks(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#666666' }}>━━━━</span> Track Path
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showForecastCones}
                      onChange={(e) => setShowForecastCones(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#ffaa00' }}>▲▲▲</span> Forecast Cone
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showStormSurge}
                      onChange={(e) => setShowStormSurge(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#ff4444' }}>〰〰〰</span> Storm Surge
                    {stormSurge.available === false && (
                      <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '5px' }}>
                        (N/A for EP storms)
                      </span>
                    )}
                  </label>
                </div>
              </div>
              
              {/* Live Track Data Control */}
              {dataSource === 'live' && (
                <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#1a237e' }}>
                    Track Data Options
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={fetchLiveTrackData}
                      onChange={(e) => setFetchLiveTrackData(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Fetch Live Track Data
                  </label>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '3px', marginLeft: '20px' }}>
                    {fetchLiveTrackData ? 
                      'Fetching forecast paths and cones from NHC (may cause CORS errors)' : 
                      'Using basic storm positions only (prevents CORS errors)'
                    }
                  </div>
                  
                  {/* Storm Surge Status */}
                  {showStormSurge && (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#d32f2f' }}>
                        Storm Surge Status
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                        {stormSurge.loading ? (
                          'Loading surge data...'
                        ) : stormSurge.available === false ? (
                          'No surge data (Eastern Pacific storms typically don\'t have surge products)'
                        ) : stormSurge.surgeData ? (
                          `Showing surge data with ${stormSurge.surgeData.features?.length || 0} areas`
                        ) : stormSurge.error ? (
                          `Error: ${stormSurge.error}`
                        ) : (
                          'Checking availability...'
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="control-panel-buttons">
                <button 
                  onClick={refresh}
                  className="control-panel-button"
                >
                  Refresh
                </button>
              </div>
              {/* Helpful tip for demo mode */}
              {dataSource === 'demo' && (
                <div style={{
                  fontSize: '0.75rem', 
                  color: '#666', 
                  marginTop: '8px', 
                  padding: '6px 8px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '4px',
                  border: '1px solid #e9ecef'
                }}>
                  💡 <strong>Development Mode:</strong> 
                  <br />
                  The NHC API works in your browser but blocks localhost requests due to CORS policy.
                  <br />
                  <button 
                    onClick={openCorsAccess}
                    style={{
                      marginTop: '4px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    🔑 Get CORS Access
                  </button>
                  <span style={{marginLeft: '6px', fontSize: '0.7rem'}}>
                    → Then try "Live Data"
                  </span>
                </div>
              )}
              {!hasStorms && (
                <div className="no-storms-message">
                  <div className="no-storms-icon">🌤️</div>
                  <div className="no-storms-title">All Clear!</div>
                  <div className="no-storms-subtitle">
                    {dataSource === 'demo' ? 'No demo storms active' : 'No active storms'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleStormTracker;
