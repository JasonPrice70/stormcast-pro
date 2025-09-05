import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet'
import { Icon } from 'leaflet'
import { useNHCData } from '../hooks/useNHCData'
import { useInvestData } from '../hooks/useInvestData'
import { ProcessedStorm, InvestArea } from '../types/nhc'
import { formatWindSpeed } from '../utils/windSpeed'
import 'leaflet/dist/leaflet.css'
import './StormTracker.css'

const StormTracker = () => {
  const [selectedStorm, setSelectedStorm] = useState<ProcessedStorm | null>(null)
  const [selectedInvest, setSelectedInvest] = useState<InvestArea | null>(null)
  const [showInvests, setShowInvests] = useState<boolean>(true)
  
  // Use the NHC data hook
  const { storms, loading, error, lastUpdated, refresh } = useNHCData()
  
  // Use the invest data hook
  const { invests, loading: investLoading, error: investError, lastUpdated: investLastUpdated, refresh: refreshInvests } = useInvestData()

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

  // Create custom invest icons based on formation chances
  const createInvestIcon = (invest: InvestArea) => {
    const getColor = () => {
      if (invest.formationChance7day >= 70) return '#FF8C00' // High chance - Orange
      if (invest.formationChance7day >= 40) return '#FFD700' // Medium chance - Gold
      if (invest.formationChance7day >= 20) return '#FFFF99' // Low chance - Light Yellow
      return '#E6E6FA' // Very low chance - Light Purple
    }

    const color = getColor()
    
    // Create SVG icon with "I" for Invest
    const svgIcon = `
      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" fill="${color}" stroke="#000" stroke-width="1" opacity="0.8"/>
        <text x="10" y="14" text-anchor="middle" font-size="12" font-weight="bold" fill="#000">
          I
        </text>
      </svg>
    `
    
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
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

  if (loading || investLoading) {
    return (
      <div className="storm-tracker">
        <div className="loading-container">
          <h2>Loading {loading ? 'Storm' : ''} {investLoading ? 'Invest' : ''} Data...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  if (error && !storms.length) {
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
          <div className="data-info">
            <div className="last-updated">
              Storms Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
            </div>
            {investLastUpdated && (
              <div className="last-updated">
                Invests Updated: {new Date(investLastUpdated).toLocaleString()}
              </div>
            )}
          </div>
          <div className="control-buttons">
            <label className="invest-toggle">
              <input
                type="checkbox"
                checked={showInvests}
                onChange={(e) => setShowInvests(e.target.checked)}
              />
              Show Invest Areas ({invests.length})
            </label>
            <button onClick={() => { refresh(); refreshInvests(); }} className="refresh-button">
              Refresh All Data
            </button>
          </div>
        </div>
        {(error || investError) && (
          <div className="error-banner">
            {error && <div className="error-message">⚠️ Storm Data: {error}</div>}
            {investError && <div className="error-message">⚠️ Invest Data: {investError}</div>}
          </div>
        )}
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
                      <p><strong>Max Winds:</strong> {formatWindSpeed(storm.maxWinds)}</p>
                      <p><strong>Pressure:</strong> {storm.pressure} mb</p>
                      <p><strong>Movement:</strong> {storm.movement}</p>
                      <p><strong>Location:</strong> {storm.position[0].toFixed(1)}°N, {Math.abs(storm.position[1]).toFixed(1)}°W</p>
                    </div>
                  </Popup>
                </Marker>
                
                {createForecastTrack(storm)}
              </div>
            ))}

            {/* Render invest areas if enabled */}
            {showInvests && invests.map((invest) => {
              // Only show invests with valid positions
              if (!invest.position || invest.position[0] === 0 && invest.position[1] === 0) {
                return null;
              }
              
              return (
                <div key={invest.id}>
                  <Marker
                    position={invest.position}
                    icon={createInvestIcon(invest)}
                    eventHandlers={{
                      click: () => setSelectedInvest(invest)
                    }}
                  >
                    <Popup>
                      <div className="invest-popup">
                        <h3>{invest.name}</h3>
                        <p><strong>Basin:</strong> {invest.basin.toUpperCase()}</p>
                        <p><strong>Location:</strong> {invest.location}</p>
                        <p><strong>48-hour chance:</strong> {invest.formationChance48hr}%</p>
                        <p><strong>7-day chance:</strong> {invest.formationChance7day}%</p>
                        <p><strong>Description:</strong> {invest.description}</p>
                        <p><strong>Coordinates:</strong> {invest.position[0].toFixed(1)}°N, {Math.abs(invest.position[1]).toFixed(1)}°W</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Add a circle to show general area of interest */}
                  <Circle
                    center={invest.position}
                    radius={200000} // 200km radius
                    color={invest.formationChance7day >= 70 ? '#FF8C00' : invest.formationChance7day >= 40 ? '#FFD700' : '#FFFF99'}
                    fillColor={invest.formationChance7day >= 70 ? '#FF8C00' : invest.formationChance7day >= 40 ? '#FFD700' : '#FFFF99'}
                    fillOpacity={0.1}
                    weight={1}
                    opacity={0.3}
                  />
                </div>
              );
            })}
          </MapContainer>
        </div>

        <div className="storm-list">
          <div className="list-section">
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
                      <p><strong>Max Winds:</strong> {formatWindSpeed(storm.maxWinds)}</p>
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

          {showInvests && (
            <div className="list-section">
              <h3>Invest Areas ({invests.length})</h3>
              {invests.length === 0 ? (
                <p className="no-storms">No active invest areas at this time.</p>
              ) : (
                <div className="invest-cards">
                  {invests.map((invest) => (
                    <div
                      key={invest.id}
                      className={`invest-card ${selectedInvest?.id === invest.id ? 'selected' : ''}`}
                      onClick={() => setSelectedInvest(invest)}
                    >
                      <div className="invest-header">
                        <h4>{invest.name}</h4>
                        <span className={`formation-badge ${invest.formationChance7day >= 70 ? 'high' : invest.formationChance7day >= 40 ? 'medium' : 'low'}`}>
                          {invest.formationChance7day}% (7-day)
                        </span>
                      </div>
                      
                      <div className="invest-details">
                        <p><strong>Basin:</strong> {invest.basin.toUpperCase()}</p>
                        <p><strong>Location:</strong> {invest.location}</p>
                        <p><strong>48hr Chance:</strong> {invest.formationChance48hr}%</p>
                        <p><strong>7-day Chance:</strong> {invest.formationChance7day}%</p>
                      </div>
                      
                      <div className="invest-description">
                        <p><strong>Description:</strong> {invest.description.substring(0, 100)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <div><strong>Max Winds:</strong> {formatWindSpeed(selectedStorm.maxWinds)}</div>
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
                      <div>Winds: {formatWindSpeed(point.maxWinds)}</div>
                      <div>Pressure: {point.pressure} mb</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedInvest && (
        <div className="invest-details-panel">
          <div className="panel-header">
            <h3>{selectedInvest.name} - Formation Outlook</h3>
            <button onClick={() => setSelectedInvest(null)} className="close-button">×</button>
          </div>
          
          <div className="panel-content">
            <div className="detail-section">
              <h4>Formation Probability</h4>
              <div className="detail-grid">
                <div><strong>48-Hour Chance:</strong> {selectedInvest.formationChance48hr}%</div>
                <div><strong>7-Day Chance:</strong> {selectedInvest.formationChance7day}%</div>
                <div><strong>Basin:</strong> {selectedInvest.basin.toUpperCase()}</div>
                <div><strong>Location:</strong> {selectedInvest.location}</div>
                <div><strong>Coordinates:</strong> {selectedInvest.position[0].toFixed(2)}°N, {Math.abs(selectedInvest.position[1]).toFixed(2)}°W</div>
                <div><strong>Last Update:</strong> {selectedInvest.lastUpdate.toLocaleString()}</div>
              </div>
            </div>
            
            <div className="detail-section">
              <h4>Description</h4>
              <div className="invest-description-full">
                <p>{selectedInvest.description}</p>
              </div>
            </div>

            <div className="detail-section">
              <h4>Formation Chances Explained</h4>
              <div className="formation-explanation">
                <div className="chance-level">
                  <span className="chance-indicator high"></span>
                  <strong>High (70%+):</strong> Conditions very favorable for development
                </div>
                <div className="chance-level">
                  <span className="chance-indicator medium"></span>
                  <strong>Medium (40-69%):</strong> Some potential for development
                </div>
                <div className="chance-level">
                  <span className="chance-indicator low"></span>
                  <strong>Low (20-39%):</strong> Limited potential for development
                </div>
                <div className="chance-level">
                  <span className="chance-indicator very-low"></span>
                  <strong>Very Low (0-19%):</strong> Development unlikely
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StormTracker
