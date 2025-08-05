import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { Icon } from 'leaflet'
import { useNHCData } from '../hooks/useNHCData'
import { ProcessedStorm } from '../types/nhc'
import 'leaflet/dist/leaflet.css'
import './StormTracker.css'

const StormTracker = () => {
  const [selectedStorm, setSelectedStorm] = useState<ProcessedStorm | null>(null)
  
  // Use the NHC data hook
  const { storms, loading, error, lastUpdated, refresh } = useNHCData()

  // Create custom storm icons based on category/intensity
  const createStormIcon = (storm: ProcessedStorm) => {
    const getColor = () => {
      if (storm.category >= 5) return '#FF0000' // Category 5 - Red
      if (storm.category >= 4) return '#FF6600' // Category 4 - Orange-Red
      if (storm.category >= 3) return '#FFAA00' // Category 3 - Orange
      if (storm.category >= 2) return '#FFDD00' // Category 2 - Yellow-Orange
      if (storm.category >= 1) return '#FFFF00' // Category 1 - Yellow
      return '#00AAFF' // Tropical Storm - Blue
    }

    const color = getColor()
    
    // Create SVG icon
    const svgIcon = `
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="#000" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">
          ${storm.category || 'TS'}
        </text>
      </svg>
    `
    
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    })
  }

  // Create forecast track line
  const createForecastTrack = (storm: ProcessedStorm) => {
    if (!storm.forecast || storm.forecast.length === 0) return null

    const positions: [number, number][] = [
      storm.position, // Current position
      ...storm.forecast.map(point => [point.latitude, point.longitude] as [number, number])
    ]

    return (
      <Polyline
        positions={positions}
        color="#FF0000"
        weight={3}
        opacity={0.7}
        dashArray="10, 10"
      />
    )
  }

  if (loading) {
    return (
      <div className="storm-tracker">
        <div className="loading-container">
          <h2>Loading Storm Data...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="storm-tracker">
        <div className="error-container">
          <h2>Error Loading Storm Data</h2>
          <p>{error}</p>
          <button onClick={refresh} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="storm-tracker">
      <div className="tracker-header">
        <h1>Active Storm Tracker</h1>
        <div className="tracker-controls">
          <div className="last-updated">
            Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
          </div>
          <button onClick={refresh} className="refresh-button">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="tracker-content">
        <div className="map-container">
          <MapContainer
            center={[25.0, -80.0]} // Centered on Florida/Caribbean
            zoom={5}
            style={{ height: '500px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {storms.map((storm) => (
              <div key={storm.id}>
                <Marker
                  position={storm.position}
                  icon={createStormIcon(storm)}
                  eventHandlers={{
                    click: () => setSelectedStorm(storm)
                  }}
                >
                  <Popup>
                    <div className="storm-popup">
                      <h3>{storm.name}</h3>
                      <p><strong>Status:</strong> {storm.classification}</p>
                      <p><strong>Category:</strong> {storm.category || 'Tropical Storm'}</p>
                      <p><strong>Max Winds:</strong> {storm.maxWinds} mph</p>
                      <p><strong>Pressure:</strong> {storm.pressure} mb</p>
                      <p><strong>Movement:</strong> {storm.movement}</p>
                      <p><strong>Location:</strong> {storm.position[0].toFixed(1)}°N, {Math.abs(storm.position[1]).toFixed(1)}°W</p>
                    </div>
                  </Popup>
                </Marker>
                
                {createForecastTrack(storm)}
              </div>
            ))}
          </MapContainer>
        </div>

        <div className="storm-list">
          <h3>Active Storms ({storms.length})</h3>
          {storms.length === 0 ? (
            <p className="no-storms">No active storms at this time.</p>
          ) : (
            <div className="storm-cards">
              {storms.map((storm) => (
                <div
                  key={storm.id}
                  className={`storm-card ${selectedStorm?.id === storm.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStorm(storm)}
                >
                  <div className="storm-header">
                    <h4>{storm.name}</h4>
                    <span className={`category-badge category-${storm.category || 0}`}>
                      {storm.category ? `Cat ${storm.category}` : 'TS'}
                    </span>
                  </div>
                  
                  <div className="storm-details">
                    <p><strong>Classification:</strong> {storm.classification}</p>
                    <p><strong>Max Winds:</strong> {storm.maxWinds} mph</p>
                    <p><strong>Pressure:</strong> {storm.pressure} mb</p>
                    <p><strong>Movement:</strong> {storm.movement}</p>
                  </div>
                  
                  {storm.forecast && storm.forecast.length > 0 && (
                    <div className="forecast-summary">
                      <p><strong>Forecast Points:</strong> {storm.forecast.length}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStorm && (
        <div className="storm-details-panel">
          <div className="panel-header">
            <h3>{selectedStorm.name} - Detailed Information</h3>
            <button onClick={() => setSelectedStorm(null)} className="close-button">×</button>
          </div>
          
          <div className="panel-content">
            <div className="detail-section">
              <h4>Current Status</h4>
              <div className="detail-grid">
                <div><strong>Classification:</strong> {selectedStorm.classification}</div>
                <div><strong>Category:</strong> {selectedStorm.category || 'Tropical Storm'}</div>
                <div><strong>Max Winds:</strong> {selectedStorm.maxWinds} mph</div>
                <div><strong>Central Pressure:</strong> {selectedStorm.pressure} mb</div>
                <div><strong>Movement:</strong> {selectedStorm.movement}</div>
                <div><strong>Location:</strong> {selectedStorm.position[0].toFixed(2)}°N, {Math.abs(selectedStorm.position[1]).toFixed(2)}°W</div>
              </div>
            </div>
            
            {selectedStorm.forecast && selectedStorm.forecast.length > 0 && (
              <div className="detail-section">
                <h4>Forecast Track</h4>
                <div className="forecast-points">
                  {selectedStorm.forecast.slice(0, 5).map((point, index) => (
                    <div key={index} className="forecast-point">
                      <div><strong>+{point.forecastHour}h:</strong></div>
                      <div>Position: {point.latitude.toFixed(1)}°N, {Math.abs(point.longitude).toFixed(1)}°W</div>
                      <div>Winds: {point.maxWinds} mph</div>
                      <div>Pressure: {point.pressure} mb</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StormTracker
