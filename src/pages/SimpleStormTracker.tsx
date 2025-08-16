import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimpleStormTracker.css';
import { useNHCData, useStormSurge, useWindSpeedProbability, useWindArrival } from '../hooks/useNHCData';
import SimpleHeader from '../components/SimpleHeader';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Format forecast time for labels (e.g., "6 PM MON")
const formatForecastTime = (datetimeString: string) => {
  if (!datetimeString || datetimeString.includes('Point')) {
    return '';
  }
  // Example input: "5:00 AM AST August 12, 2025"
  // Extract hour, AM/PM, and day abbreviation
  const timeMatch = datetimeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const dayMatch = datetimeString.match(/([A-Za-z]+)\s(\d{1,2}),\s*(\d{4})$/);
  let hour = '';
  let ampm = '';
  let dayAbbr = '';
  if (timeMatch) {
    hour = timeMatch[1];
    ampm = timeMatch[3].toUpperCase();
  }
  if (dayMatch) {
    // Get the day of week from the full date
    const monthDayYear = dayMatch[0];
    // Try to parse the full date
    const datePartMatch = datetimeString.match(/([A-Za-z]+)\s(\d{1,2}),\s*(\d{4})$/);
    if (datePartMatch) {
      const month = datePartMatch[1];
      const day = datePartMatch[2];
      const year = datePartMatch[3];
      // Create a date object
      const dateObj = new Date(`${month} ${day}, ${year}`);
      if (!isNaN(dateObj.getTime())) {
        dayAbbr = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      }
    }
  }
  // If we have hour, ampm, and dayAbbr, format as "5 AM TUE"
  if (hour && ampm && dayAbbr) {
    return `${hour} ${ampm} ${dayAbbr}`;
  }
  // Fallback: just show the original string
  return datetimeString;
};

// Create storm icons based on category and type
const createStormIcon = (category: any, classification: string) => {
  const isHurricane = classification.toLowerCase().includes('hurricane') || classification === 'HU';
  const isTropicalStorm = classification.toLowerCase().includes('tropical storm') || classification === 'TS';
  
  // Debug logging to see what's happening with the classification
  console.log('createStormIcon called with:', { category, classification, isHurricane, isTropicalStorm });
  
  if (isHurricane) {
    // Custom Hurricane SVG icon
    const hurricaneIcon = `
      <svg width="48" height="48" viewBox="0 0 455.13 639.78" style="filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));">
        <path fill="#ed1c24" d="M404.75,422.16C344.9,540.18,188.17,639.96.11,639.78c-5.6-.02,200.47-113.65,132.59-152.82C40.8,433.89,6.14,314.27,52.78,218.95,108.63,104.8,263.52-5.63,454.97.22c6.5.2-194.96,116.53-130.14,153.95,91.89,53.05,127.92,173.36,79.92,267.99Z"/>
      </svg>
    `;
    return L.divIcon({
      html: hurricaneIcon,
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  } else if (isTropicalStorm) {
    // Custom Tropical Storm SVG icon
    const tropicalStormIcon = `
      <svg width="48" height="48" viewBox="0 0 455.13 639.77" style="filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));">
        <path fill="#ed1c24" d="M404.75,422.16c48-94.64,11.98-214.94-79.92-268C260.02,116.74,461.48.41,454.98.22,263.52-5.63,108.63,104.79,52.78,218.95c-46.64,95.32-11.99,214.94,79.92,268.01C200.59,526.14-5.5,639.76.11,639.77c188.06.18,344.79-99.59,404.64-217.61ZM176.68,410.53c-49.67-28.68-66.69-92.18-38.01-141.86,28.68-49.67,92.18-66.69,141.86-38.01,49.68,28.68,66.69,92.18,38.01,141.85-28.68,49.68-92.17,66.69-141.86,38.01Z"/>
      </svg>
    `;
    return L.divIcon({
      html: tropicalStormIcon,
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  } else {
    // Fallback to original design for other storm types
    let color = '#808080'; // Default gray
    let displayText = 'S';

    if (classification.toLowerCase().includes('depression')) {
      color = '#808080'; // Gray
      displayText = 'TD';
    } else {
      displayText = 'S';
    }

    return L.divIcon({
      html: `<div class="storm-icon" style="background: ${color};">${displayText}</div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }
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

const SimpleStormTracker: React.FC = () => {
  const [showTracks, setShowTracks] = useState(true);
  const [showForecastCones, setShowForecastCones] = useState(true);
  const [showStormSurge, setShowStormSurge] = useState(false);
  const [showWindArrival, setShowWindArrival] = useState(false);
  const [windArrivalType, setWindArrivalType] = useState<'most-likely' | 'earliest'>('most-likely');
  const [showWindSpeedProb, setShowWindSpeedProb] = useState(false);
  const [windSpeedProbType, setWindSpeedProbType] = useState<'34kt' | '50kt' | '64kt'>('34kt');
  const [isControlPanelMinimized, setIsControlPanelMinimized] = useState(false);
  const [fetchLiveTrackData, setFetchLiveTrackData] = useState(true); // Enable track data fetching by default
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null); // New state for selected storm  // Use live data hook only - fetch on mount by default
  const liveData = useNHCData({ 
    autoRefresh: false, // Disable auto-refresh - only call when user requests
    fetchOnMount: true, // Fetch on mount - load live data by default
    useProxy: true, // Enable CORS proxy for development
    fetchTrackData: fetchLiveTrackData // Control track data fetching
  });

  // Choose which data source to use
  const currentData = liveData; // Only use live data now
  const { storms, loading, error, lastUpdated, refresh } = currentData;

  // Determine what data to display with proper fallback
  const shouldUseDemoData = false; // Never use demo data
  const displayStorms = storms || []; // Always use live storms (empty array if none)
  const hasStorms = displayStorms.length > 0;

  // Auto-select first storm only if storms list changes and we had a selected storm that no longer exists
  React.useEffect(() => {
    if (selectedStormId && displayStorms.length > 0) {
      const stormExists = displayStorms.find(s => s.id === selectedStormId);
      if (!stormExists) {
        setSelectedStormId(null); // Reset to show all storms
      }
    }
  }, [displayStorms, selectedStormId]);

  // Get selected storm data
  const selectedStorm = selectedStormId ? displayStorms.find(s => s.id === selectedStormId) : null;
  const stormsToDisplay = selectedStormId ? (selectedStorm ? [selectedStorm] : []) : displayStorms;
  
  // Use storm surge hook for the selected storm
  const stormSurge = useStormSurge(showStormSurge && selectedStormId ? selectedStormId : null);
  
  // Use wind speed probability hook when enabled and no specific storm is selected
  const windSpeedProb = useWindSpeedProbability(showWindSpeedProb && !selectedStormId, windSpeedProbType);

  // Use wind arrival hook for the selected storm
  const windArrival = useWindArrival(showWindArrival && selectedStormId !== null, selectedStormId, windArrivalType);

  // Use NOAA NOMADS spaghetti models hook when enabled and a storm is selected


  // Helper function to open CORS proxy access page
  const openCorsAccess = () => {
    window.open('https://cors-anywhere.herokuapp.com/corsdemo', '_blank');
  };

  // Debug logging
  console.log('Storm Tracker Debug:', { 
    dataSource: 'live', // Always live now
    displayStorms: displayStorms.length,
    hasStorms,
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

        {/* Debug: Log storms to display */}
        {console.log('StormTracker DEBUG - stormsToDisplay:', stormsToDisplay.map(s => ({ name: s.name, category: s.category, classification: s.classification, position: s.position })))}

        {/* Render storm markers */}
        {stormsToDisplay.map((storm) => {
          console.log('Rendering storm marker for:', storm.name, 'Category:', storm.category, 'Classification:', storm.classification);
          return (
            <Marker
              key={storm.id}
              position={storm.position}
              icon={createStormIcon(storm.category, storm.classification)}
              zIndexOffset={1000}
            >
            <Popup closeOnClick={false} autoClose={false}>
              <div className="storm-popup">
                <div className="storm-popup-header">
                  <h3 className="storm-popup-title">
                    {storm.name}
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
          );
        })}

        {/* Render storm tracks from KMZ data or historical data */}
        {showTracks && stormsToDisplay.map((storm) => {
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
                      width: 16px;
                      height: 16px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 8px;
                      font-weight: bold;
                      color: ${getIntensityTextColor(properties.stormType, properties.styleCategory)};
                      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${category}</div>`,
                    className: 'intensity-marker',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-track-point-${featureIndex}`}
                      position={[lat, lon]}
                      icon={intensityIcon}
                      zIndexOffset={100}
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
                      width: 12px;
                      height: 12px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 7px;
                      font-weight: bold;
                      color: ${getIntensityTextColor('', category.toLowerCase())};
                      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${category}</div>`,
                    className: 'historical-intensity-marker',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-historical-${index}`}
                      position={[point.latitude, point.longitude]}
                      icon={historicalIcon}
                      zIndexOffset={50}
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
        {showTracks && stormsToDisplay.map((storm) => {
          // First try to use official forecast track data from KMZ
          if (storm.forecastTrack && storm.forecastTrack.features && storm.forecastTrack.features.length > 0) {
            return (
            <React.Fragment key={`${storm.id}-forecast-track`}>
              {storm.forecastTrack.features.map((feature: any, featureIndex: number) => {
                if (feature.geometry.type === 'LineString') {
                  // Forecast track line (thin black dashed)
                  const forecastPath: [number, number][] = feature.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
                  return (
                    <Polyline
                      key={`${storm.id}-forecast-track-line-${featureIndex}`}
                      positions={forecastPath}
                      pathOptions={{
                        color: '#222',
                        weight: 2,
                        opacity: 0.9,
                        dashArray: '8, 4'
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
                      width: 18px;
                      height: 18px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 8px;
                      font-weight: bold;
                      color: ${getIntensityTextColor(properties.stormType, properties.styleCategory)};
                      box-shadow: 0 2px 6px rgba(204,0,0,0.4);
                    ">${category}</div>`,
                    className: 'forecast-intensity-marker',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                  });
                  
                  return (
                    <React.Fragment key={`${storm.id}-forecast-track-fragment-${featureIndex}`}>
                      <Marker
                        key={`${storm.id}-forecast-track-point-${featureIndex}`}
                        position={[lat, lon]}
                        icon={forecastIntensityIcon}
                        zIndexOffset={200}
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
                      {/* Time label for forecast point */}
                      {(() => {
                        console.log('Forecast Point datetime:', properties.datetime, 'Formatted:', formatForecastTime(properties.datetime));
                        return formatForecastTime(properties.datetime);
                      })() && (
                        <Marker
                          key={`${storm.id}-forecast-time-label-${featureIndex}`}
                          position={[lat, lon]}
                          icon={L.divIcon({
                            html: `<div style="
                              padding: 2px 8px;
                              font-size: 13px;
                              font-weight: bold;
                              color: #222;
                              white-space: nowrap;
                              text-align: center;
                              min-width: 60px;
                              min-height: 20px;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              margin-left: 7px;
                              transform: rotate(-45deg);
                            ">${formatForecastTime(properties.datetime)}</div>`,
                            className: 'forecast-time-label',
                            iconSize: [60, 20],
                            iconAnchor: [0, 60]
                          })}
                          zIndexOffset={150}
                        />
                      )}
                    </React.Fragment>
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
                      width: 14px;
                      height: 14px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 7px;
                      font-weight: bold;
                      color: ${getIntensityTextColor('', category.toLowerCase())};
                      box-shadow: 0 2px 4px rgba(204,0,0,0.4);
                    ">${category}</div>`,
                    className: 'forecast-intensity-marker',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                  });
                  
                  return (
                    <Marker
                      key={`${storm.id}-forecast-point-${index}`}
                      position={[point.latitude, point.longitude]}
                      icon={forecastIcon}
                      zIndexOffset={150}
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
        {showForecastCones && stormsToDisplay.map((storm) => {
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
                      color: '#2196F3',
                      weight: 2,
                      opacity: 0.8,
                      fillColor: '#2196F3',
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
                      color: '#2196F3',
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
                        radius={Math.min(10, 5 + index * 1)} // Visual radius for screen
                        pathOptions={{
                          fillColor: 'rgba(33, 150, 243, 0.15)',
                          fillOpacity: 0.2,
                          color: '#2196F3',
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

        {/* Wind Speed Probability Layer (34kt winds) */}
        {/* Only show wind probability when all storms are displayed, not for individual storm selection */}
        {showWindSpeedProb && !selectedStormId && windSpeedProb.probabilityData && windSpeedProb.probabilityData.features && windSpeedProb.probabilityData.features.map((feature: any, index: number) => {
          if (feature.geometry && feature.geometry.type === 'Polygon') {
            const coordinates = feature.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            
            // Get probability percentage for color coding
            let probColor = '#0066cc'; // Default blue
            let probOpacity = 0.2;
            
            if (feature.properties) {
              const probability = feature.properties.probability || 0;
              if (probability >= 90) {
                probColor = '#4d0000'; // Very dark red for 90%+
                probOpacity = 0.6;
              } else if (probability >= 70) {
                probColor = '#800000'; // Dark red for 70-90%
                probOpacity = 0.5;
              } else if (probability >= 50) {
                probColor = '#cc0000'; // Red for 50-70%
                probOpacity = 0.4;
              } else if (probability >= 30) {
                probColor = '#ff6600'; // Orange for 30-50%
                probOpacity = 0.35;
              } else if (probability >= 20) {
                probColor = '#ffaa00'; // Yellow for 20-30%
                probOpacity = 0.3;
              } else if (probability >= 10) {
                probColor = '#00aa00'; // Green for 10-20%
                probOpacity = 0.25;
              } else {
                probColor = '#0066cc'; // Blue for <10%
                probOpacity = 0.2;
              }
            }
            
            return (
              <Polygon
                key={`windprob-${index}`}
                positions={coordinates}
                pathOptions={{
                  color: probColor,
                  weight: 1,
                  opacity: 0.7,
                  fillColor: probColor,
                  fillOpacity: probOpacity
                }}
              >
                <Popup>
                  <div>
                    <strong>{windSpeedProbType} Wind Probability</strong><br />
                    Probability: {feature.properties?.probability || 'Unknown'}%<br />
                    <small>
                      {windSpeedProbType === '34kt' && 'Chance of tropical storm force winds (34+ kt / 39+ mph)'}
                      {windSpeedProbType === '50kt' && 'Chance of strong tropical storm winds (50+ kt / 58+ mph)'}
                      {windSpeedProbType === '64kt' && 'Chance of hurricane force winds (64+ kt / 74+ mph)'}
                    </small>
                  </div>
                </Popup>
              </Polygon>
            );
          }
          return null;
        })}

        {/* Wind Arrival Layer */}
        {showWindArrival && selectedStormId && windArrival.arrivalData && windArrival.arrivalData.features && (() => {
          // Helper function to find line segments and calculate their top coordinates
          const findLineSegmentTopCoords = (arrivalData: any) => {
            const lineSegments: { [key: string]: { topLat: number, leftLon: number, rightLon: number } } = {};
            
            arrivalData.features.forEach((feature: any) => {
              if (feature.geometry?.type === 'LineString' && feature.properties?.styleId) {
                const coordinates = feature.geometry.coordinates;
                if (coordinates && coordinates.length > 0) {
                  // Find the topmost (max latitude) point and leftmost/rightmost longitudes
                  let topLat = -90;
                  let leftLon = 180;
                  let rightLon = -180;
                  
                  coordinates.forEach(([lon, lat]: [number, number]) => {
                    if (lat > topLat) topLat = lat;
                    if (lon < leftLon) leftLon = lon;
                    if (lon > rightLon) rightLon = lon;
                  });
                  
                  lineSegments[feature.properties.styleId] = { topLat, leftLon, rightLon };
                }
              }
            });
            
            return lineSegments;
          };
          
          const lineSegmentCoords = findLineSegmentTopCoords(windArrival.arrivalData);
          
          return windArrival.arrivalData.features.map((feature: any, index: number) => {
            if (!feature.geometry) return null;
          
          // Color coding based on arrival time
          let arrivalColor = '#9932CC'; // Default purple
          let arrivalOpacity = 0.3;
          
          if (feature.properties) {
            const arrivalTime = feature.properties.arrivalTime || feature.properties.arrival_time || feature.properties.time || '';
            // You can add time-based color coding here
            arrivalColor = '#9932CC'; // Purple for wind arrival
            arrivalOpacity = 0.4;
          }
          
          // Handle Point geometries (arrival time labels)
          if (feature.geometry.type === 'Point') {
            const [lon, lat] = feature.geometry.coordinates;
            const arrivalTime = feature.properties?.arrivalTime || 'Unknown';
            
            // Check if this is a grouped arrival point with components
            if (feature.properties?.type === 'wind_arrival_group' && feature.properties?.components) {
              return (
                <React.Fragment key={`wind-arrival-group-${index}`}>
                  {/* Main arrival point */}
                  <CircleMarker
                    center={[lat, lon]}
                    radius={6}
                    pathOptions={{
                      color: '#9932CC',
                      weight: 2,
                      fillColor: '#9932CC',
                      fillOpacity: 0.2
                    }}
                  >
                    <Tooltip direction="center" offset={[0, 0]}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>
                        {arrivalTime}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                  
                  {/* Component labels positioned at the top of line segments */}
                  {feature.properties.components.map((component: any, compIndex: number) => {
                    // Try to find corresponding line segment coordinates
                    const lineSegment = lineSegmentCoords[component.styleId];
                    
                    let compLat, compLon;
                    if (lineSegment) {
                      // Position labels at the top of the line segment
                      compLat = lineSegment.topLat + 0.02; // Slightly above the top of the line
                      
                      // Distribute components across the width of the line segment
                      if (compIndex === 0) { // day (left)
                        compLon = lineSegment.leftLon;
                      } else if (compIndex === 1) { // hour (center)
                        compLon = (lineSegment.leftLon + lineSegment.rightLon) / 2;
                      } else { // period (right)
                        compLon = lineSegment.rightLon;
                      }
                    } else {
                      // Fallback to original positioning if no line segment found
                      compLat = component.coordinates[1] + component.offset[1];
                      compLon = component.coordinates[0] + component.offset[0];
                    }
                    
                    // Use the text property from the component
                    const labelText = component.text || component.type;
                    
                    return (
                      <Marker
                        key={`component-${index}-${compIndex}`}
                        position={[compLat, compLon]}
                        icon={L.divIcon({
                          html: `<div style="
                            display: flex;
                            align-items: flex-end;
                            justify-content: center;
                            font-size: 20px;
                            font-weight: bold;
                            color: #000;
                            -webkit-text-stroke: 1px white;
                            text-stroke: 1px white;
                            white-space: nowrap;
                            height: 24px;
                          ">${labelText}</div>`,
                          className: '',
                          iconSize: [40, 24],
                          iconAnchor: [20, 24]
                        })}
                      />
                    );
                  })}
                </React.Fragment>
              );
            } else {
              // Legacy single point display
              return (
                <CircleMarker
                  key={`wind-arrival-point-${index}`}
                  center={[lat, lon]}
                  radius={8}
                  pathOptions={{
                    color: '#9932CC',
                    weight: 2,
                    fillColor: '#9932CC',
                    fillOpacity: arrivalOpacity
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -13]}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#333' }}>
                      {arrivalTime}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            }
          }
          
          // Handle LineString geometries (arrival time lines)
          else if (feature.geometry.type === 'LineString') {
            const coordinates = feature.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            // Create time labels based on style ID or use generic label
            let arrivalTime = 'Wind Arrival Line';
            if (feature.properties?.styleId) {
              arrivalTime = `Wind Arrival Time Line (${feature.properties.styleId})`;
            } else if (feature.properties?.arrivalTime) {
              arrivalTime = feature.properties.arrivalTime;
            }
            
            return (
              <Polyline
                key={`wind-arrival-line-${index}`}
                positions={coordinates}
                pathOptions={{
                  color: arrivalColor,
                  weight: 3,
                  opacity: arrivalOpacity + 0.3
                }}
              >
                <Tooltip>
                  <div>
                    <strong>Wind Arrival Time</strong><br/>
                    {arrivalTime}
                  </div>
                </Tooltip>
              </Polyline>
            );
          }
          
          // Handle Polygon geometries (arrival time areas)
          else if (feature.geometry.type === 'Polygon') {
            const coordinates = feature.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            
            return (
              <Polygon
                key={`wind-arrival-polygon-${index}`}
                positions={coordinates}
                pathOptions={{
                  color: arrivalColor,
                  weight: 2,
                  opacity: 0.8,
                  fillColor: arrivalColor,
                  fillOpacity: arrivalOpacity,
                  dashArray: '5, 5' // Dashed line to distinguish from other layers
                }}
              >
                <Popup>
                  <div>
                    <strong>Tropical Storm Wind Arrival</strong><br />
                    Most Likely Time: {feature.properties?.arrivalTime || feature.properties?.arrival_time || feature.properties?.time || 'Unknown'}<br />
                    <small>
                      Most likely arrival time of tropical storm force winds (34+ kt / 39+ mph)
                    </small>
                  </div>
                </Popup>
              </Polygon>
            );
          }
          
          return null;
          });
        })()}

      </MapContainer>
      
      {/* Wind Speed Probability Legend */}
      {showWindSpeedProb && !selectedStormId && windSpeedProb.probabilityData && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          border: '1px solid #ddd',
          fontSize: '0.75rem',
          zIndex: 1000,
          minWidth: '200px'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '6px', 
            color: '#333',
            borderBottom: '1px solid #eee',
            paddingBottom: '3px',
            fontSize: '0.8rem'
          }}>
            🌪️ {windSpeedProbType} Wind Probability
          </div>
          
          {/* Probability scale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#4d0000',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>90%+ (Very High)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#800000',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>70-89% (High)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#cc0000',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>50-69% (Moderate)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#ff6600',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>30-49% (Low-Mod)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#2196F3',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>20-29% (Low)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#00aa00',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>10-19% (Very Low)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#0066cc',
                border: '1px solid #333',
                borderRadius: '2px'
              }}></div>
              <span>&lt;10% (Minimal)</span>
            </div>
          </div>
          
          <div style={{
            fontSize: '0.65rem',
            color: '#666',
            marginTop: '6px',
            fontStyle: 'italic',
            borderTop: '1px solid #eee',
            paddingTop: '4px'
          }}>
            {windSpeedProbType === '34kt' && 'Tropical storm force winds (39+ mph)'}
            {windSpeedProbType === '50kt' && 'Strong tropical storm winds (58+ mph)'}
            {windSpeedProbType === '64kt' && 'Hurricane force winds (74+ mph)'}
          </div>
        </div>
      )}
      </div>

      {/* Floating Control Panel */}
      <div className={`floating-control-panel ${isControlPanelMinimized ? 'minimized' : ''}`}>
        <div className="control-panel-header-wrapper">
          <h3 className="control-panel-header">
             Live Storm Tracking
          </h3>
          <button 
            className="control-panel-minimize-btn"
            onClick={() => setIsControlPanelMinimized(!isControlPanelMinimized)}
            title={isControlPanelMinimized ? "Expand panel" : "Minimize panel"}
          >
            {isControlPanelMinimized ? (
              <ExpandLessOutlinedIcon fontSize="small" />
            ) : (
              <ExpandMoreOutlinedIcon fontSize="small" />
            )}
          </button>
        </div>
        {!isControlPanelMinimized && (
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
            </>
          ) : (
            <>
              {lastUpdated && (
                <span className="control-panel-updated">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              
              {/* Storm Selector Dropdown */}
              {displayStorms.length > 0 && (
                <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#1a237e' }}>
                    Select Storm
                  </div>
                  <select 
                    value={selectedStormId || ''}
                    onChange={(e) => setSelectedStormId(e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="">All Storms</option>
                    {displayStorms.map(storm => (
                      <option key={storm.id} value={storm.id}>
                        {storm.name} ({storm.classification})
                      </option>
                    ))}
                  </select>
                  {selectedStorm && (
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '3px' }}>
                      Showing: {selectedStorm.name} - {selectedStorm.maxWinds} mph winds
                    </div>
                  )}
                </div>
              )}
              
              {/* Path Visibility Controls */}
              <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#1a237e' }}>
                  Storm Paths
                  <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#666', marginTop: '2px' }}>
                    Real-time NHC forecast & historical data
                  </div>
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
                    <span style={{ color: '#2196F3' }}>▲▲▲</span> Forecast Cone
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
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: !selectedStormId ? 'not-allowed' : 'pointer', opacity: !selectedStormId ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={showWindArrival}
                      onChange={(e) => setShowWindArrival(e.target.checked)}
                      disabled={!selectedStormId}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#9932CC' }}>▣▣▣</span> Wind Arrival Time
                    {!selectedStormId ? (
                      <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '5px' }}>
                        (Select a storm to view)
                      </span>
                    ) : windArrival.available === false ? (
                      <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '5px' }}>
                        (No data available)
                      </span>
                    ) : null}
                  </label>
                  {showWindArrival && selectedStormId && (
                    <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', marginBottom: '2px' }}>
                        <input
                          type="radio"
                          name="windArrivalType"
                          value="most-likely"
                          checked={windArrivalType === 'most-likely'}
                          onChange={(e) => setWindArrivalType(e.target.value as 'most-likely' | 'earliest')}
                          style={{ marginRight: '4px' }}
                        />
                        Most Likely Arrival
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                        <input
                          type="radio"
                          name="windArrivalType"
                          value="earliest"
                          checked={windArrivalType === 'earliest'}
                          onChange={(e) => setWindArrivalType(e.target.value as 'most-likely' | 'earliest')}
                          style={{ marginRight: '4px' }}
                        />
                        Earliest Reasonable Arrival
                      </label>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: selectedStormId ? 'not-allowed' : 'pointer', opacity: selectedStormId ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={showWindSpeedProb}
                      onChange={(e) => setShowWindSpeedProb(e.target.checked)}
                      disabled={selectedStormId !== null}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#0066cc' }}>⬢⬢⬢</span> {windSpeedProbType} Wind Probability
                    {selectedStormId ? (
                      <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '5px' }}>
                        (Only available when viewing all storms)
                      </span>
                    ) : windSpeedProb.available === false ? (
                      <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '5px' }}>
                        (No data available)
                      </span>
                    ) : null}
                  </label>
                  
                  {/* Wind Speed Options - only show when wind speed probability is enabled */}
                  {showWindSpeedProb && !selectedStormId && (
                    <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '3px' }}>Wind Speed Options:</div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {(['34kt', '50kt', '64kt'] as const).map((speed) => (
                          <label key={speed} style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="windSpeedType"
                              value={speed}
                              checked={windSpeedProbType === speed}
                              onChange={(e) => setWindSpeedProbType(e.target.value as '34kt' | '50kt' | '64kt')}
                              style={{ marginRight: '4px', transform: 'scale(0.8)' }}
                            />
                            {speed}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Live Track Data Control - Hidden */}
              <div style={{ display: 'none', marginTop: '10px', padding: '8px 0', borderTop: '1px solid #e0e0e0' }}>
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
                  
                  {showWindSpeedProb && (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1976d2' }}>
                        Wind Probability Status
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                        {windSpeedProb.loading ? (
                          'Loading wind probability data...'
                        ) : windSpeedProb.available === false ? (
                          'No wind probability data available (typically only available during active storm threats)'
                        ) : windSpeedProb.probabilityData ? (
                          `Showing ${windSpeedProb.probabilityData.features?.length || 0} probability zones for ${windSpeedProbType} winds`
                        ) : windSpeedProb.error ? (
                          `Error: ${windSpeedProb.error}`
                        ) : (
                          'Checking availability...'
                        )}
                      </div>
                    </div>
                  )}
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
                  <div className="no-storms-subtitle">
                    No active storms detected
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default SimpleStormTracker;
