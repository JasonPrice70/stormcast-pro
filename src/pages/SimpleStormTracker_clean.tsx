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
    autoRefresh: !useDemo,
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
      // Trigger a refresh of live data
      await liveData.refresh();
    } catch (err) {
      console.error('Failed to switch to live data:', err);
      // Fall back to demo data if live data fails
      setUseDemo(true);
      alert('Unable to connect to live data feed. CORS proxy may be unavailable. Using demo data instead.');
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
              <span className="control-panel-error">
                {error.includes('CORS') || error.includes('cors') || error.includes('Network Error') 
                  ? 'Live data unavailable (CORS/Network issue)' 
                  : 'API Error'}
              </span>
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
