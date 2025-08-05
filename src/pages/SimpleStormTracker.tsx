import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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
    advisoryUrl: 'https://www.nhc.noaa.gov/',
    trackUrl: '#',
    coneUrl: '#'
  }
];

const SimpleStormTracker: React.FC = () => {
  const [useDemo, setUseDemo] = useState(true); // Start with demo data to test
  
  // Use both hooks
  const demoData = useDemoData();
  const liveData = useNHCData({ 
    autoRefresh: false, // Disable auto-refresh - only call once per page load
    fetchOnMount: false, // Don't fetch on mount - only when user clicks "Live Data"
    useProxy: true // Enable CORS proxy for development
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
