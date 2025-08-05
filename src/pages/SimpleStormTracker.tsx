import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimpleStormTracker.css';
import { useDemoData } from '../hooks/useDemoData';
import { useNHCData } from '../hooks/useNHCData';
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
  const [useDemo, setUseDemo] = useState(true); // Start with demo data to test
  const [showHistoricalPaths, setShowHistoricalPaths] = useState(true);
  const [showForecastPaths, setShowForecastPaths] = useState(true);
  const [showForecastCones, setShowForecastCones] = useState(true);
  const [fetchLiveTrackData, setFetchLiveTrackData] = useState(false); // Control live track data fetching
  
  // Use both hooks
  const demoData = useDemoData();
  const liveData = useNHCData({ 
    autoRefresh: false, // Disable auto-refresh - only call once per page load
    fetchOnMount: false, // Don't fetch on mount - only when user clicks "Live Data"
    useProxy: true, // Enable CORS proxy for development
    fetchTrackData: fetchLiveTrackData // Control track data fetching
  });

  // Choose which data source to use
  const currentData = useDemo ? demoData : liveData;
  const { storms, loading, error, lastUpdated, refresh } = currentData;

  // Determine what data to display with proper fallback
  const shouldUseDemoData = useDemo || (error && storms.length === 0);
  const displayStorms = shouldUseDemoData ? demoStorms : storms;
  const hasStorms = displayStorms.length > 0;
  const dataSource = shouldUseDemoData ? 'demo' : 'live';

  // Handle live data button click with error handling
  const handleLiveDataClick = async () => {
    try {
      setUseDemo(false);
      
      // Fetch live data - this will only happen once per page load when user clicks
      await liveData.refresh();
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

        {/* Render historical storm paths */}
        {showHistoricalPaths && displayStorms.map((storm) => {
          if (!storm.historical || storm.historical.length === 0) return null;
          
          const historicalPath: [number, number][] = storm.historical.map((point: any) => [point.latitude, point.longitude]);
          
          return (
            <React.Fragment key={`${storm.id}-historical`}>
              {/* Historical path line */}
              <Polyline
                positions={historicalPath}
                pathOptions={{
                  color: '#666666',
                  weight: 3,
                  opacity: 0.8,
                  dashArray: '5, 5'
                }}
              />
              
              {/* Historical position markers */}
              {storm.historical.map((point: any, index: number) => (
                <CircleMarker
                  key={`${storm.id}-hist-${index}`}
                  center={[point.latitude, point.longitude]}
                  radius={4}
                  pathOptions={{
                    color: '#444444',
                    fillColor: point.category >= 1 ? '#ff6600' : '#0099ff',
                    fillOpacity: 0.7,
                    weight: 1
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.9rem' }}>
                      <strong>{storm.name} - Historical Position</strong><br />
                      <strong>Date:</strong> {new Date(point.dateTime).toLocaleString()}<br />
                      <strong>Winds:</strong> {point.maxWinds} mph<br />
                      <strong>Pressure:</strong> {point.pressure} mb<br />
                      <strong>Category:</strong> {point.category > 0 ? point.category : 'N/A'}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </React.Fragment>
          );
        })}

        {/* Render forecast storm paths */}
        {showForecastPaths && displayStorms.map((storm) => {
          if (!storm.forecast || storm.forecast.length === 0) return null;
          
          const forecastPath: [number, number][] = storm.forecast.map((point: any) => [point.latitude, point.longitude]);
          
          return (
            <React.Fragment key={`${storm.id}-forecast`}>
              {/* Forecast path line */}
              <Polyline
                positions={forecastPath}
                pathOptions={{
                  color: '#ff3333',
                  weight: 4,
                  opacity: 0.9,
                  dashArray: '10, 5'
                }}
              />
              
              {/* Forecast position markers */}
              {storm.forecast.map((point: any, index: number) => (
                <CircleMarker
                  key={`${storm.id}-forecast-${index}`}
                  center={[point.latitude, point.longitude]}
                  radius={6}
                  pathOptions={{
                    color: '#cc0000',
                    fillColor: '#ff3333',
                    fillOpacity: 0.8,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.9rem' }}>
                      <strong>{storm.name} - Forecast Position</strong><br />
                      <strong>Time:</strong> {new Date(point.dateTime).toLocaleString()}<br />
                      <strong>Forecast Hour:</strong> +{point.forecastHour}h<br />
                      <strong>Max Winds:</strong> {point.maxWinds} mph<br />
                      <strong>Gusts:</strong> {point.gusts} mph<br />
                      <strong>Pressure:</strong> {point.pressure} mb
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </React.Fragment>
          );
        })}

        {/* Render forecast cones */}
        {showForecastCones && displayStorms.map((storm) => {
          if (!storm.cone || !storm.cone.coordinates) return null;
          
          try {
            // Convert cone coordinates to Leaflet format
            let coneCoordinates: [number, number][] = [];
            
            if (storm.cone.type === 'Polygon') {
              // Single polygon
              coneCoordinates = storm.cone.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            } else if (storm.cone.type === 'MultiPolygon') {
              // Multiple polygons - use the first one
              coneCoordinates = storm.cone.coordinates[0][0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            }
            
            if (coneCoordinates.length === 0) return null;
            
            return (
              <Polygon
                key={`${storm.id}-cone`}
                positions={coneCoordinates}
                pathOptions={{
                  color: '#ffaa00',
                  weight: 2,
                  opacity: 0.8,
                  fillColor: '#ffaa00',
                  fillOpacity: 0.2
                }}
              >
                <Popup>
                  <div style={{ fontSize: '0.9rem' }}>
                    <strong>{storm.name} - Forecast Cone</strong><br />
                    <strong>Advisory:</strong> {storm.cone.properties?.advisoryNumber || 'N/A'}<br />
                    <strong>Valid Time:</strong> {storm.cone.properties?.validTime ? new Date(storm.cone.properties.validTime).toLocaleString() : 'N/A'}<br />
                    <div style={{ fontSize: '0.8rem', marginTop: '5px', fontStyle: 'italic' }}>
                      The cone represents the probable path of the storm center (66% confidence).
                      The entire storm may extend well beyond this area.
                    </div>
                  </div>
                </Popup>
              </Polygon>
            );
          } catch (error) {
            console.warn('Error rendering cone for storm', storm.name, ':', error);
            return null;
          }
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
                      checked={showHistoricalPaths}
                      onChange={(e) => setShowHistoricalPaths(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#666666' }}>━━━━</span> Historical Path
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showForecastPaths}
                      onChange={(e) => setShowForecastPaths(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#ff3333' }}>━━━━</span> Forecast Path
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
                </div>
              )}
              
              <div className="control-panel-buttons">
                <button 
                  onClick={refresh}
                  className="control-panel-button"
                >
                  Refresh
                </button>
                <button 
                  onClick={testConnectivity}
                  className="control-panel-button"
                  style={{backgroundColor: '#6c757d'}}
                  title="Test API connectivity and debug issues"
                >
                  🔧 Debug
                </button>
                {dataSource === 'demo' && (
                  <button 
                    onClick={handleLiveDataClick}
                    className="control-panel-button control-panel-button--demo"
                  >
                    Live Data
                  </button>
                )}
                {dataSource === 'live' && (
                  <button 
                    onClick={() => setUseDemo(true)}
                    className="control-panel-button control-panel-button--demo"
                  >
                    Demo Data
                  </button>
                )}
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
