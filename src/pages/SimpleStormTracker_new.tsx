import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimpleStormTracker.css';
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
    iconAnchor: [15, 15],
  });
};

const SimpleStormTracker: React.FC = () => {
  const [showHistoricalPaths, setShowHistoricalPaths] = useState(true);
  const [showForecastPaths, setShowForecastPaths] = useState(true);
  const [showForecastCones, setShowForecastCones] = useState(true);
  const [fetchLiveTrackData, setFetchLiveTrackData] = useState(false);
  
  // Use live data hook
  const { storms, loading, error, lastUpdated, refresh } = useNHCData({ 
    autoRefresh: false,
    fetchOnMount: true,
    useProxy: true,
    fetchTrackData: fetchLiveTrackData
  });

  const hasStorms = storms.length > 0;

  return (
    <div className="simple-storm-tracker">
      <SimpleHeader />
      <div className="map-container">
        <MapContainer center={[25.0, -85.0]} zoom={6} className="leaflet-map">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* Storm markers */}
          {storms.map((storm) => (
            <Marker
              key={storm.id}
              position={storm.position}
              icon={createStormIcon(storm.category, storm.classification)}
            >
              <Popup closeOnClick={false} autoClose={false}>
                <div className="storm-popup">
                  <div className="storm-name">
                    <strong>{storm.name}</strong>
                  </div>
                  <div className="storm-details">
                    <div><strong>Classification:</strong> {storm.classification}</div>
                    {storm.category > 0 && (
                      <div><strong>Category:</strong> {storm.category}</div>
                    )}
                    <div><strong>Max Winds:</strong> {storm.maxWinds} mph</div>
                    <div><strong>Pressure:</strong> {storm.pressure} mb</div>
                    <div><strong>Movement:</strong> {storm.movement}</div>
                    <div><strong>Last Update:</strong> {new Date(storm.lastUpdate).toLocaleString()}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Historical paths */}
          {showHistoricalPaths && storms.map((storm) => {
            if (!storm.historical || storm.historical.length === 0) return null;

            const positions: [number, number][] = storm.historical.map(point => 
              [point.latitude, point.longitude]
            );

            return (
              <React.Fragment key={`historical-${storm.id}`}>
                <Polyline 
                  positions={positions} 
                  pathOptions={{ color: '#888888', weight: 2, opacity: 0.7, dashArray: '5, 5' }} 
                />
                {storm.historical.map((point, index) => (
                  <CircleMarker
                    key={`hist-${storm.id}-${index}`}
                    center={[point.latitude, point.longitude]}
                    radius={3}
                    pathOptions={{ color: '#666666', fillColor: '#cccccc', fillOpacity: 0.8 }}
                  >
                    <Popup>
                      <div>
                        <strong>Historical Position</strong><br />
                        Time: {new Date(point.dateTime).toLocaleString()}<br />
                        Winds: {point.maxWinds} mph<br />
                        Pressure: {point.pressure} mb<br />
                        Classification: {point.classification}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </React.Fragment>
            );
          })}

          {/* Forecast paths */}
          {showForecastPaths && storms.map((storm) => {
            if (!storm.forecast || storm.forecast.length === 0) return null;

            const currentPosition = storm.position;
            const forecastPositions: [number, number][] = [
              currentPosition,
              ...storm.forecast.map(point => [point.latitude, point.longitude] as [number, number])
            ];

            return (
              <React.Fragment key={`forecast-${storm.id}`}>
                <Polyline 
                  positions={forecastPositions} 
                  pathOptions={{ color: '#ff4444', weight: 3, opacity: 0.9 }} 
                />
                {storm.forecast.map((point, index) => (
                  <CircleMarker
                    key={`forecast-${storm.id}-${index}`}
                    center={[point.latitude, point.longitude]}
                    radius={4}
                    pathOptions={{ color: '#ff0000', fillColor: '#ffcccc', fillOpacity: 0.8 }}
                  >
                    <Popup>
                      <div>
                        <strong>Forecast Position</strong><br />
                        Time: {new Date(point.dateTime).toLocaleString()}<br />
                        Winds: {point.maxWinds} mph<br />
                        Gusts: {point.gusts} mph<br />
                        Pressure: {point.pressure} mb<br />
                        Hour: +{point.forecastHour}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </React.Fragment>
            );
          })}

          {/* Forecast cones */}
          {showForecastCones && storms.map((storm) => {
            if (!storm.cone || !storm.cone.coordinates || storm.cone.coordinates.length === 0) return null;

            return (
              <Polygon
                key={`cone-${storm.id}`}
                positions={storm.cone.coordinates[0].map(coord => [coord[1], coord[0]] as [number, number])}
                pathOptions={{
                  color: '#ffaa00',
                  weight: 2,
                  opacity: 0.8,
                  fillColor: '#ffaa00',
                  fillOpacity: 0.2
                }}
              >
                <Popup>
                  <div>
                    <strong>Forecast Cone</strong><br />
                    Storm: {storm.cone.properties?.stormName || storm.name}<br />
                    {storm.cone.properties?.advisoryNumber && (
                      <>Advisory: {storm.cone.properties.advisoryNumber}<br /></>
                    )}
                    {storm.cone.properties?.validTime && (
                      <>Valid: {new Date(storm.cone.properties.validTime).toLocaleString()}</>
                    )}
                  </div>
                </Popup>
              </Polygon>
            );
          })}
        </MapContainer>

        {/* Control Panel */}
        <div className="control-panel">
          <div className="control-panel-header">
            🌊 Live Data
          </div>
          
          {loading ? (
            <div className="loading-message">
              <div className="loading-spinner"></div>
              <div>Loading storm data...</div>
            </div>
          ) : error ? (
            <div className="error-message">
              <div>⚠️ Connection Error</div>
              <div style={{fontSize: '0.8rem', marginTop: '5px'}}>
                {error}
              </div>
            </div>
          ) : (
            <>
              <div className="control-panel-stats">
                <div>Active Storms: {storms.length}</div>
                {lastUpdated && (
                  <div>Updated: {new Date(lastUpdated).toLocaleTimeString()}</div>
                )}
              </div>

              <div className="control-panel-options">
                <div className="control-panel-section">
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#1a237e' }}>
                    Display Options
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showHistoricalPaths}
                      onChange={(e) => setShowHistoricalPaths(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Historical Paths
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showForecastPaths}
                      onChange={(e) => setShowForecastPaths(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Forecast Paths
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showForecastCones}
                      onChange={(e) => setShowForecastCones(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Forecast Cones
                  </label>
                </div>

                <div className="control-panel-section">
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
                      'Fetching forecast paths and cones from NHC' : 
                      'Using basic storm positions only'
                    }
                  </div>
                </div>
              </div>
              
              <div className="control-panel-buttons">
                <button 
                  onClick={refresh}
                  className="control-panel-button"
                >
                  Refresh
                </button>
              </div>
              
              {!hasStorms && (
                <div className="no-storms-message">
                  <div className="no-storms-icon">🌤️</div>
                  <div className="no-storms-title">All Clear!</div>
                  <div className="no-storms-subtitle">No active storms</div>
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
