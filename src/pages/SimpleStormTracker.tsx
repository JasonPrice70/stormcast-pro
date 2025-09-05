import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Polygon, Tooltip, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimpleStormTracker.css';
import { useNHCData, useStormSurge, usePeakStormSurge, useWindSpeedProbability, useWindArrival } from '../hooks/useNHCData';
import { useInvestData } from '../hooks/useInvestData';
import { useGEFSSpaghetti } from '../hooks/useGEFSSpaghetti';
import WindSpeedLegend from '../components/WindSpeedLegend';
import { useHWRFData, useHMONData } from '../hooks/useHWRFData';
import SimpleHeader from '../components/SimpleHeader';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map controller component for auto-zoom functionality
interface MapControllerProps {
  selectedStorm: any;
  stormsToDisplay: any[];
  selectedInvest: any;
  lastSelectionType: 'storm' | 'invest' | null;
}

const MapController: React.FC<MapControllerProps> = ({ selectedStorm, stormsToDisplay, selectedInvest, lastSelectionType }) => {
  const map = useMap();
  
  useEffect(() => {
    // Prioritize based on what was selected most recently
    if (lastSelectionType === 'storm' && selectedStorm) {
      // Auto-center to selected storm (preserve current zoom level)
      const [lat, lon] = selectedStorm.position;
      
      // Simply pan to the storm position without changing zoom
      map.panTo([lat, lon], {
        animate: true,
        duration: 1.0
      });
    } else if (lastSelectionType === 'invest' && selectedInvest) {
      // Auto-center to selected invest (preserve current zoom level)
      const [lat, lon] = selectedInvest.position;
      
      // Simply pan to the invest position without changing zoom
      map.panTo([lat, lon], {
        animate: true,
        duration: 1.0
      });
    } else if (!selectedStorm && !selectedInvest && stormsToDisplay.length > 0) {
      // If no specific storm selected but storms are available, center on the group
      try {
        const stormPositions = stormsToDisplay.map(storm => L.latLng(storm.position[0], storm.position[1]));
        if (stormPositions.length === 1) {
          // Single storm - center on it
          const storm = stormsToDisplay[0];
          map.panTo([storm.position[0], storm.position[1]], {
            animate: true,
            duration: 1.0
          });
        } else {
          // Multiple storms - center on the geographic center of all storms
          const bounds = L.latLngBounds(stormPositions);
          const center = bounds.getCenter();
          map.panTo([center.lat, center.lng], {
            animate: true,
            duration: 1.0
          });
        }
      } catch (error) {
        console.warn('Error centering on storms:', error);
      }
    }
  }, [selectedInvest, selectedStorm, stormsToDisplay, lastSelectionType, map]);
  
  return null;
};

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
    // Custom Hurricane SVG icon with category number
    const categoryNumber = category && category > 0 && category <= 5 ? category : '';
    const hurricaneIcon = `
      <div style="position: relative; width: 48px; height: 48px;">
        <svg width="48" height="48" viewBox="0 0 455.13 639.78" style="filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));">
          <path fill="#ed1c24" d="M404.75,422.16C344.9,540.18,188.17,639.96.11,639.78c-5.6-.02,200.47-113.65,132.59-152.82C40.8,433.89,6.14,314.27,52.78,218.95,108.63,104.8,263.52-5.63,454.97.22c6.5.2-194.96,116.53-130.14,153.95,91.89,53.05,127.92,173.36,79.92,267.99Z"/>
        </svg>
        ${categoryNumber ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 18px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); pointer-events: none;">${categoryNumber}</div>` : ''}
      </div>
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

// Create invest icon based on formation probability
const createInvestIcon = (formationChance: number) => {
  const getColor = () => {
    if (formationChance >= 70) return '#FF8C00'; // High chance - Orange
    if (formationChance >= 40) return '#FFD700'; // Medium chance - Gold
    if (formationChance >= 20) return '#FFFF99'; // Low chance - Light Yellow
    return '#E6E6FA'; // Very low chance - Light Purple
  };

  const color = getColor();
  
  return L.divIcon({
    html: `<div class="invest-icon" style="background: ${color}; border: 2px solid #333; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #333;">I</div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
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
      return '#1976d2'; // Blue for forecast
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
  const [showHistoricalTracks, setShowHistoricalTracks] = useState(false);
  const [showForecastTracks, setShowForecastTracks] = useState(true);
  const [showForecastCones, setShowForecastCones] = useState(true);
  const [showStormSurge, setShowStormSurge] = useState(false);
  const [showPeakStormSurge, setShowPeakStormSurge] = useState(false);
  const [showWindArrival, setShowWindArrival] = useState(false);
  const [windArrivalType, setWindArrivalType] = useState<'most-likely' | 'earliest'>('most-likely');
  const [showWindSpeedProb, setShowWindSpeedProb] = useState(false);
  const [windSpeedProbType, setWindSpeedProbType] = useState<'34kt' | '50kt' | '64kt'>('34kt');
  const [showGEFSSpaghetti, setShowGEFSSpaghetti] = useState(false);
  const [showInvests, setShowInvests] = useState(true); // New: Show invest areas
  
  // Individual model track toggles
  const [showOfficialTrack, setShowOfficialTrack] = useState(true);
  const [showHWRF, setShowHWRF] = useState(false);
  const [showHMON, setShowHMON] = useState(false);
  const [showHAFS, setShowHAFS] = useState(true);
  const [showGFS, setShowGFS] = useState(true);
  const [showECMWF, setShowECMWF] = useState(true);
  const [showGEFSEnsemble, setShowGEFSEnsemble] = useState(true);
  const [showOtherModels, setShowOtherModels] = useState(false);
  
  // Individual model windfield toggles
  const [showHWRFWindfield, setShowHWRFWindfield] = useState(false);
  const [showHMONWindfield, setShowHMONWindfield] = useState(false);
  
  const [isControlPanelClosed, setIsControlPanelClosed] = useState(true);
  
  // Refs for click-outside detection
  const layerButtonRef = useRef<HTMLButtonElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);

  // Click-outside effect to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !isControlPanelClosed &&
        layerButtonRef.current &&
        controlPanelRef.current &&
        !layerButtonRef.current.contains(event.target as Node) &&
        !controlPanelRef.current.contains(event.target as Node)
      ) {
        setIsControlPanelClosed(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isControlPanelClosed]);

  const [fetchLiveTrackData, setFetchLiveTrackData] = useState(true); // Enable track data fetching by default
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null); // Primary selected storm for storm-specific layers
  const [selectedStormIds, setSelectedStormIds] = useState<string[]>([]); // Multiple selected storms for map display
  const [selectedInvestId, setSelectedInvestId] = useState<string | null>(null); // Selected invest for map centering
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set()); // Track which invest descriptions are expanded
  const [lastSelectionType, setLastSelectionType] = useState<'storm' | 'invest' | null>(null); // Track what was selected last
  const liveData = useNHCData({ 
    autoRefresh: false, // Disable auto-refresh - only call when user requests
    fetchOnMount: true, // Fetch on mount - load live data by default
    useProxy: true, // Enable CORS proxy for development
    fetchTrackData: fetchLiveTrackData // Control track data fetching
  });

  // Invest data hook
  const { invests, loading: investLoading, error: investError } = useInvestData({
    autoRefresh: false,
    fetchOnMount: true,
    useProxy: true
  });

  // Choose which data source to use
  const currentData = liveData; // Only use live data now
  const { storms, loading, error, lastUpdated, refresh } = currentData;

  // Determine what data to display with proper fallback
  const shouldUseDemoData = false; // Never use demo data
  const displayStorms = storms || []; // Always use live storms (empty array if none)
  const hasStorms = displayStorms.length > 0;

  // Auto-select first storm when storms are available and none is selected
  React.useEffect(() => {
    if (displayStorms.length > 0) {
      if (selectedStormId) {
        // Check if currently selected storm still exists
        const stormExists = displayStorms.find(s => s.id === selectedStormId);
        if (!stormExists) {
          setSelectedStormId(displayStorms[0].id); // Select first available storm
        }
      } else {
        // Auto-select first storm if none is selected
        setSelectedStormId(displayStorms[0].id);
      }
    } else {
      // Clear selection if no storms available
      setSelectedStormId(null);
    }
  }, [displayStorms, selectedStormId]);

  // Clean up expanded descriptions when invest data changes
  useEffect(() => {
    // Keep only expanded descriptions for invests that still exist
    const currentInvestIds = new Set(invests.map(i => i.id));
    setExpandedDescriptions(prev => {
      const filtered = new Set<string>();
      prev.forEach(id => {
        if (currentInvestIds.has(id)) {
          filtered.add(id);
        }
      });
      return filtered;
    });
  }, [invests]);

  // Get selected storm data (primary for overlays) and which storms to show on map (multi-select)
  const selectedStorm = selectedStormId ? displayStorms.find(s => s.id === selectedStormId) : null;
  const selectedInvest = selectedInvestId ? invests.find(i => i.id === selectedInvestId) : null;
  const stormsToDisplay = selectedStormIds.length > 0
    ? displayStorms.filter(s => selectedStormIds.includes(s.id))
    : displayStorms;
  const isAllStormsShown = selectedStormIds.length === 0 || selectedStormIds.length === displayStorms.length;
  
  // Use storm surge hook for the selected storm
  const stormSurge = useStormSurge(showStormSurge && selectedStormId ? selectedStormId : null);
  
  // Use peak storm surge hook for the selected storm
  const peakStormSurge = usePeakStormSurge(showPeakStormSurge && selectedStormId ? selectedStormId : null);
  
  // Use wind speed probability hook when enabled and all storms are shown (no filter or all selected)
  const windSpeedProb = useWindSpeedProbability(showWindSpeedProb && isAllStormsShown, windSpeedProbType);

  // Use wind arrival hook for the selected storm
  const windArrival = useWindArrival(showWindArrival && selectedStormId !== null, selectedStormId, windArrivalType);

  // Use NOAA NOMADS spaghetti models hook when enabled and a storm is selected
  const gefs = useGEFSSpaghetti(showGEFSSpaghetti && !!selectedStormId, selectedStormId);

  // Use HWRF and HMON wind field hooks when enabled and a storm is selected
  const hwrf = useHWRFData();
  const hmon = useHMONData();

  // Fetch HWRF and HMON data when storm is selected and models are enabled
  useEffect(() => {
    if (selectedStormId && (showHWRF || showHWRFWindfield) && !hwrf.isLoading) {
      hwrf.fetchHWRFData(selectedStormId);
    }
  }, [selectedStormId, showHWRF, showHWRFWindfield]);

  useEffect(() => {
    if (selectedStormId && (showHMON || showHMONWindfield) && !hmon.isLoading) {
      hmon.fetchHMONData(selectedStormId);
    }
  }, [selectedStormId, showHMON, showHMONWindfield]);


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

  // Function to get full intensity name for storms
  const getFullIntensityName = (storm: any) => {
    if (storm.category >= 5) return 'Category 5 Hurricane';
    if (storm.category >= 4) return 'Category 4 Hurricane';
    if (storm.category >= 3) return 'Category 3 Hurricane';
    if (storm.category >= 2) return 'Category 2 Hurricane';
    if (storm.category >= 1) return 'Category 1 Hurricane';
    
    // Check for abbreviations first
    const classification = storm.classification.toLowerCase();
    if (classification === 'ts' || classification.includes('tropical storm')) return 'Tropical Storm';
    if (classification === 'td' || classification.includes('tropical depression')) return 'Tropical Depression';
    if (classification === 'ss' || classification.includes('subtropical')) return 'Subtropical Storm';
    if (classification.includes('hurricane')) return `Category ${storm.category || 'Unknown'} Hurricane`;
    
    return storm.classification; // Fallback to original classification
  };

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

        {/* Map Controller for auto-zoom functionality */}
        <MapController 
          selectedStorm={selectedStorm}
          stormsToDisplay={stormsToDisplay}
          selectedInvest={selectedInvest}
          lastSelectionType={lastSelectionType}
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
              eventHandlers={{
                click: () => {
                  // Set this storm as the primary selected storm for auto-zoom and overlays
                  setSelectedStormId(storm.id);
                  // Also add to selected storms display list if not already there
                  if (!selectedStormIds.includes(storm.id)) {
                    setSelectedStormIds(prev => [...prev, storm.id]);
                  }
                }
              }}
            >
            <Popup closeOnClick={true} autoClose={true}>
              <div className="storm-popup">
                <div className="storm-popup-header">
                  <h3 className="storm-popup-title">
                    {storm.name}
                  </h3>
                </div>
                <div className="storm-popup-content">
                  <p className="storm-popup-field">
                    <strong>Classification:</strong> {getFullIntensityName(storm)}
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
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
                    <em>Click marker to zoom and track this storm</em>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
          );
        })}

        {/* Render invest areas */}
        {showInvests && invests.map((invest) => {
          console.log('🗺️ Rendering invest:', invest.id, 'Position:', invest.position, 'Show invests:', showInvests)
          
          // Only show invests with valid positions
          if (!invest.position || (invest.position[0] === 0 && invest.position[1] === 0)) {
            console.log('❌ Skipping invest with invalid position:', invest.id, invest.position)
            return null;
          }
          
          console.log('✅ Rendering invest marker for:', invest.id, 'at position:', invest.position)
          
          return (
            <React.Fragment key={invest.id}>
              <Marker
                position={invest.position}
                icon={createInvestIcon(invest.formationChance7day)}
                zIndexOffset={500}
              >
                <Popup>
                  <div className="invest-popup">
                    <div className="invest-popup-header">
                      <h3 className="invest-popup-title">{invest.name}</h3>
                      <span className="invest-popup-basin">{invest.basin.toUpperCase()}</span>
                    </div>
                    <div className="invest-popup-content">
                      <div className="invest-popup-field">
                        <span className="field-label">Location:</span>
                        <span className="field-value">{invest.location}</span>
                      </div>
                      <div className="invest-popup-formation-chances">
                        <div className="formation-chance-item">
                          <span className="chance-label">Formation chance (next 48 hours):</span>
                          <span className={`chance-value ${invest.formationChance48hr >= 60 ? 'high' : invest.formationChance48hr >= 30 ? 'medium' : 'low'}`}>
                            {invest.formationChance48hr}%
                          </span>
                        </div>
                        <div className="formation-chance-item">
                          <span className="chance-label">Formation chance (next 7 days):</span>
                          <span className={`chance-value ${invest.formationChance7day >= 60 ? 'high' : invest.formationChance7day >= 30 ? 'medium' : 'low'}`}>
                            {invest.formationChance7day}%
                          </span>
                        </div>
                      </div>
                      <div className="invest-popup-description">
                        <span className="field-label">Outlook:</span>
                        {(() => {
                          const isExpanded = expandedDescriptions.has(invest.id);
                          const shouldTruncate = invest.description.length > 200;
                          const displayText = isExpanded || !shouldTruncate 
                            ? invest.description 
                            : invest.description.substring(0, 200) + '...';
                          
                          return (
                            <div>
                              <p className="description-text">{displayText}</p>
                              {shouldTruncate && (
                                <button
                                  className="read-more-btn"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent popup from closing
                                    setExpandedDescriptions(prev => {
                                      const newSet = new Set(prev);
                                      if (isExpanded) {
                                        newSet.delete(invest.id);
                                      } else {
                                        newSet.add(invest.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                >
                                  {isExpanded ? 'Read less' : 'Read more'}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
              
              {/* Add a subtle circle to show general area */}
              <Circle
                center={invest.position}
                radius={100000} // 100km radius
                color={invest.formationChance7day >= 70 ? '#FF8C00' : invest.formationChance7day >= 40 ? '#FFD700' : '#FFFF99'}
                fillColor={invest.formationChance7day >= 70 ? '#FF8C00' : invest.formationChance7day >= 40 ? '#FFD700' : '#FFFF99'}
                fillOpacity={0.05}
                weight={1}
                opacity={0.2}
              />
            </React.Fragment>
          );
        })}

        {/* Render storm tracks from KMZ data or historical data */}
        {showHistoricalTracks && stormsToDisplay.map((storm) => {
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

        {/* GEFS Spaghetti (A-deck proxy) */}
        {showGEFSSpaghetti && selectedStormId && gefs.tracks && gefs.tracks.tracks && (() => {
          // Debug: Log what models are present and which ones are GEFS ensemble members
          if (gefs.tracks) {
            console.log('GEFS Debug - Models present:', gefs.tracks.modelsPresent);
            console.log('GEFS Debug - GEFS Ensemble members:', gefs.tracks.modelsPresent.filter(m => m.startsWith('AP')));
            console.log('GEFS Debug - showGEFSEnsemble:', showGEFSEnsemble);
            console.log('GEFS Debug - Total tracks:', gefs.tracks.tracks.length);
          }
          return (
          <React.Fragment>
            {gefs.tracks!.tracks.map((t, idx) => {
              // Check if this model should be displayed based on toggles
              const modelId = t.modelId;
              let shouldShow = false;
              
              if ((modelId === 'OFCL' || modelId === 'OFCI') && showOfficialTrack) {
                shouldShow = true;
              } else if (modelId === 'HWRF' && showHWRF) {
                shouldShow = true;
              } else if (modelId === 'HMON' && showHMON) {
                shouldShow = true;
              } else if ((modelId === 'HAFS' || modelId === 'HAFA' || modelId === 'HAFB') && showHAFS) {
                shouldShow = true;
              } else if ((modelId === 'GFS' || modelId === 'GFSO') && showGFS) {
                shouldShow = true;
              } else if ((modelId === 'ECMW' || modelId === 'ECM2') && showECMWF) {
                shouldShow = true;
              } else if ((modelId === 'AEMI' || modelId === 'AEMN' || modelId === 'AEM2' || modelId === 'AC00' || modelId.startsWith('AP')) && showGEFSEnsemble) {
                shouldShow = true;
              } else if (showOtherModels) {
                // Show other/miscellaneous models when "Other Models" is enabled
                const knownModels = ['OFCL', 'OFCI', 'HWRF', 'HMON', 'HAFS', 'HAFA', 'HAFB', 'GFS', 'GFSO', 'ECMW', 'ECM2', 'AEMI', 'AEMN', 'AEM2', 'AC00'];
                if (!knownModels.includes(modelId) && !modelId.startsWith('AP')) {
                  shouldShow = true;
                }
              }
              
              // Debug: Log which models are being shown or hidden
              if (modelId.startsWith('AP')) {
                console.log(`GEFS Debug - ${modelId}: shouldShow=${shouldShow}, showGEFSEnsemble=${showGEFSEnsemble}`);
              }
              
              if (!shouldShow) return null;
              
              // Deduplicate repeated points that can appear in A-deck for the same tau
              const seen = new Set<string>();
              const deduped = t.points.filter((p: any) => {
                const key = `${p.tau}:${p.lat?.toFixed(2)}:${p.lon?.toFixed(2)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              const positions = deduped
                .map((p: any) => [p.lat, p.lon] as [number, number])
                .filter(([lat, lon]) => isFinite(lat) && isFinite(lon));
              if (positions.length < 2) return null;
              
              // Enhanced model categorization and styling
              let color, weight, opacity, dashArray;
              
              if (modelId === 'OFCL' || modelId === 'OFCI') {
                // Official forecast - thick black line
                color = '#000000';
                weight = 4;
                opacity = 1.0;
                dashArray = undefined;
              } else if (modelId === 'HWRF' || modelId === 'HMON') {
                // High-resolution models - thick colored lines
                color = modelId === 'HWRF' ? '#ff4444' : '#4682b4';
                weight = 3;
                opacity = 0.9;
                dashArray = undefined;
              } else if (modelId === 'HAFS' || modelId === 'HAFA' || modelId === 'HAFB') {
                // HAFS models - thick blue lines
                color = '#4444ff';
                weight = 3;
                opacity = 0.9;
                dashArray = undefined;
              } else if (modelId === 'GFS' || modelId === 'GFSO') {
                // GFS - medium purple line
                color = '#9c27b0';
                weight = 2.5;
                opacity = 0.8;
                dashArray = undefined;
              } else if (modelId === 'ECMW' || modelId === 'ECM2') {
                // ECMWF - medium orange line
                color = '#ff9800';
                weight = 2.5;
                opacity = 0.8;
                dashArray = undefined;
              } else if (modelId === 'AEMI' || modelId === 'AEMN' || modelId === 'AEM2') {
                // GEFS ensemble mean - thick blue line
                color = '#0d47a1';
                weight = 3;
                opacity = 0.95;
                dashArray = undefined;
              } else if (modelId === 'AC00') {
                // GEFS control - medium line
                color = '#1976d2';
                weight = 2;
                opacity = 0.8;
                dashArray = undefined;
              } else if (modelId.startsWith('AP')) {
                // GEFS perturbations - thin lines
                const colors = ['#42a5f5','#66bb6a','#ffa726','#ab47bc','#ec407a','#26c6da','#7e57c2','#4db6ac','#78909c','#a1887f'];
                color = colors[idx % colors.length];
                weight = 1.5;
                opacity = 0.6;
                dashArray = undefined;
              } else {
                // Other models - default styling
                const colors = ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c2185b','#0097a7','#512da8','#00796b','#455a64','#8d6e63'];
                color = colors[idx % colors.length];
                weight = 2;
                opacity = 0.7;
                dashArray = undefined;
              }
              
              return (
                <Polyline
                  key={`model-${t.modelId}-${idx}`}
                  positions={positions}
                  pathOptions={{ color, weight, opacity, dashArray }}
                >
                  <Tooltip sticky>
                    <div>
                      <strong>{t.modelId}</strong>
                      {modelId === 'OFCL' && <div style={{fontSize: '0.8em', color: '#666'}}>Official NHC Forecast</div>}
                      {modelId === 'HWRF' && <div style={{fontSize: '0.8em', color: '#666'}}>Hurricane Weather Research & Forecasting</div>}
                      {modelId === 'HMON' && <div style={{fontSize: '0.8em', color: '#666'}}>Hurricane Multi-scale Ocean-coupled</div>}
                      {(modelId === 'HAFS' || modelId === 'HAFA' || modelId === 'HAFB') && <div style={{fontSize: '0.8em', color: '#666'}}>Hurricane Analysis & Forecast System</div>}
                      {(modelId === 'GFS' || modelId === 'GFSO') && <div style={{fontSize: '0.8em', color: '#666'}}>Global Forecast System</div>}
                      {(modelId === 'ECMW' || modelId === 'ECM2') && <div style={{fontSize: '0.8em', color: '#666'}}>European Centre Model</div>}
                      {(modelId === 'AEMI' || modelId === 'AEMN') && <div style={{fontSize: '0.8em', color: '#666'}}>GEFS Ensemble Mean</div>}
                      {modelId === 'AC00' && <div style={{fontSize: '0.8em', color: '#666'}}>GEFS Control Run</div>}
                      {modelId.startsWith('AP') && <div style={{fontSize: '0.8em', color: '#666'}}>GEFS Perturbation {modelId.substring(2)}</div>}
                    </div>
                  </Tooltip>
                </Polyline>
              );
            })}
          </React.Fragment>
          );
        })()}

        {/* Render forecast tracks from KMZ data or forecast data */}
        {showForecastTracks && stormsToDisplay.map((storm) => {
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

        {/* Peak Storm Surge Layer */}
        {showPeakStormSurge && peakStormSurge.peakSurgeData && peakStormSurge.peakSurgeData.features && peakStormSurge.peakSurgeData.features.map((feature: any, index: number) => {
          // Handle Polygon features (water body areas)
          if (feature.geometry && feature.geometry.type === 'Polygon') {
            const coordinates = feature.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            
            // Use height-based color scheme with specified ranges
            let surgeColor = '#0070ff'; // Default blue (0, 112, 255)
            let surgeOpacity = 0.4;
            
            if (feature.properties) {
              const height = feature.properties.SURGE_FT || feature.properties.height || 0;
              if (height >= 10) {
                surgeColor = '#ff0000'; // Red (255, 0, 0) - 10+ feet
                surgeOpacity = 0.6;
              } else if (height >= 7) {
                surgeColor = '#ffaa00'; // Orange (255, 170, 0) - 7-9 feet
                surgeOpacity = 0.5;
              } else if (height >= 4) {
                surgeColor = '#ffff00'; // Yellow (255, 255, 0) - 4-6 feet
                surgeOpacity = 0.45;
              } else if (height >= 1) {
                surgeColor = '#0070ff'; // Blue (0, 112, 255) - 1-3 feet
                surgeOpacity = 0.4;
              } else {
                surgeColor = '#cccccc'; // Light gray for areas under 1 foot
                surgeOpacity = 0.3;
              }
            }
            
            // Create custom surge area marker with label for area name and height
            const areaName = feature.properties?.areaName || 'Unknown Area';
            const surgeRange = feature.properties?.surgeRange || '';
            const centerLat = feature.properties?.centerLat;
            const centerLon = feature.properties?.centerLon;
            
            return (
              <React.Fragment key={`peak-surge-${index}`}>
                {/* Surge Area Polygon */}
                <Polygon
                  positions={coordinates}
                  pathOptions={{
                    color: surgeColor,
                    weight: 2,
                    opacity: 0.9,
                    fillColor: surgeColor,
                    fillOpacity: surgeOpacity,
                    dashArray: '8, 4' // Dashed border to distinguish from regular surge
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        color: surgeColor, 
                        borderBottom: '1px solid #eee',
                        paddingBottom: '4px',
                        marginBottom: '6px'
                      }}>
                        🌊 Peak Storm Surge Zone
                      </div>
                      <div><strong>Area:</strong> {areaName}</div>
                      <div><strong>Surge Height:</strong> {surgeRange || `${feature.properties?.SURGE_FT || feature.properties?.height || 'Unknown'} ft`}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                        <strong>Impact Level:</strong> {
                          (feature.properties?.SURGE_FT || 0) >= 10 ? 
                            '🔴 Extreme' : 
                          (feature.properties?.SURGE_FT || 0) >= 6 ? 
                            '🟠 High' : 
                          (feature.properties?.SURGE_FT || 0) >= 3 ? 
                            '🟡 Moderate' : 
                            '🟢 Low'
                        }
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                        Maximum potential storm surge heights for this area
                      </div>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                    <div>
                      <strong>{areaName}</strong><br />
                      {surgeRange}
                    </div>
                  </Tooltip>
                </Polygon>
                
                {/* Area Label Marker - only if we have center coordinates */}
                {centerLat && centerLon && (
                  <Marker
                    position={[centerLat, centerLon]}
                    icon={L.divIcon({
                      html: `
                        <div style="
                          background: transparent;
                          border: none;
                          border-radius: 4px;
                          padding: 2px 6px;
                          font-size: 0.85rem;
                          font-weight: bold;
                          color: black;
                          text-align: center;
                          text-shadow: 1px 1px 2px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.8), 1px -1px 2px rgba(255,255,255,0.8), -1px 1px 2px rgba(255,255,255,0.8);
                          white-space: nowrap;
                          max-width: 120px;
                          overflow: hidden;
                          text-overflow: ellipsis;
                        ">
                          ${surgeRange || `${feature.properties?.SURGE_FT || '?'} ft`}
                        </div>
                      `,
                      className: 'surge-label-marker',
                      iconSize: [80, 20],
                      iconAnchor: [40, 10]
                    })}
                  />
                )}
              </React.Fragment>
            );
          }
          
          // Handle LineString features (coastal surge lines)
          if (feature.geometry && feature.geometry.type === 'LineString') {
            const coordinates = feature.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
            
            // Use height-based color scheme for coastal lines
            let lineColor = '#0070ff'; // Default blue (0, 112, 255)
            let lineWeight = 3;
            
            if (feature.properties) {
              const height = feature.properties.SURGE_FT || feature.properties.height || 0;
              if (height >= 10) {
                lineColor = '#ff0000'; // Red (255, 0, 0) - 10+ feet
              } else if (height >= 7) {
                lineColor = '#ffaa00'; // Orange (255, 170, 0) - 7-9 feet
              } else if (height >= 4) {
                lineColor = '#ffff00'; // Yellow (255, 255, 0) - 4-6 feet
              } else if (height >= 1) {
                lineColor = '#0070ff'; // Blue (0, 112, 255) - 1-3 feet
              } else {
                lineColor = '#cccccc'; // Light gray for areas under 1 foot
              }
            }
            
            const coastalSegment = feature.properties?.coastalSegment || 'Unknown Segment';
            const surgeRange = feature.properties?.surgeRange || '';
            
            return (
              <React.Fragment key={`coastal-surge-line-${index}`}>
                <Polyline
                  positions={coordinates}
                  pathOptions={{
                    color: lineColor,
                    weight: lineWeight,
                    opacity: 0.8,
                    dashArray: '12, 8' // Dashed line to distinguish from other features
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        color: lineColor, 
                        borderBottom: '1px solid #eee',
                        paddingBottom: '4px',
                        marginBottom: '6px'
                      }}>
                        🌊 Coastal Surge Line
                      </div>
                      <div><strong>Segment:</strong> {coastalSegment}</div>
                      <div><strong>Surge Height:</strong> {surgeRange}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                        Expected surge heights along this coastal segment
                      </div>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                    <div style={{
                      background: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      textAlign: 'center'
                    }}>
                      {surgeRange}
                    </div>
                  </Tooltip>
                </Polyline>
              </React.Fragment>
            );
          }
          
          // Handle Point features (line labels)
          if (feature.geometry && feature.geometry.type === 'Point' && feature.properties?.labelType === 'line') {
            const [lat, lon] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
            const surgeRange = feature.properties?.surgeRange || feature.properties?.name || '';
            
            // Get color based on surge height using new ranges
            let labelColor = '#0070ff'; // Default blue (0, 112, 255)
            const height = feature.properties?.SURGE_FT || 0;
            if (height >= 10) {
              labelColor = '#ff0000'; // Red (255, 0, 0) - 10+ feet
            } else if (height >= 7) {
              labelColor = '#ffaa00'; // Orange (255, 170, 0) - 7-9 feet
            } else if (height >= 4) {
              labelColor = '#ffff00'; // Yellow (255, 255, 0) - 4-6 feet
            } else if (height >= 1) {
              labelColor = '#0070ff'; // Blue (0, 112, 255) - 1-3 feet
            } else {
              labelColor = '#cccccc'; // Light gray for areas under 1 foot
            }
            
            // Determine text shadow based on color - black outline for yellow, white for others
            const textShadow = labelColor === '#ffff00' 
              ? '1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9), 1px -1px 2px rgba(0,0,0,0.9), -1px 1px 2px rgba(0,0,0,0.9)'
              : '1px 1px 2px rgba(255,255,255,0.9), -1px -1px 2px rgba(255,255,255,0.9), 1px -1px 2px rgba(255,255,255,0.9), -1px 1px 2px rgba(255,255,255,0.9)';
            
            return (
              <Marker
                key={`surge-line-label-${index}`}
                position={[lat, lon]}
                icon={L.divIcon({
                  html: `
                    <div style="
                      background: transparent;
                      border: none;
                      border-radius: 4px;
                      padding: 3px 8px;
                      font-size: 0.9rem;
                      font-weight: bold;
                      color: ${labelColor};
                      text-align: center;
                      text-shadow: ${textShadow};
                      white-space: nowrap;
                    ">
                      ${surgeRange}
                    </div>
                  `,
                  className: 'surge-line-label-marker',
                  iconSize: [60, 24],
                  iconAnchor: [30, 12]
                })}
              />
            );
          }
          
          return null;
        })}

        {/* Wind Speed Probability Layer (34kt winds) */}
  {/* Show wind probability when all storms are displayed (no filter or all selected) */}
  {showWindSpeedProb && isAllStormsShown && windSpeedProb.probabilityData && windSpeedProb.probabilityData.features && windSpeedProb.probabilityData.features.map((feature: any, index: number) => {
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

        {/* HWRF Wind Field Layer - Enhanced Contour Display */}
        {showHWRFWindfield && selectedStormId && hwrf.hwrfData && hwrf.hwrfData.windFields && hwrf.hwrfData.windFields.map((windField, index) => (
          <React.Fragment key={`hwrf-windfield-${index}`}>
            {/* Render contour polygons if available */}
            {windField.contours && windField.contours.map((contour, contourIndex) => (
              <Polygon
                key={`hwrf-contour-${index}-${contourIndex}`}
                positions={contour.polygon}
                color={contour.color}
                fillColor={contour.color}
                fillOpacity={0.35}
                weight={1}
                opacity={0.8}
              >
                <Tooltip>
                  <div>
                    <strong>HWRF Wind Contour</strong><br/>
                    Wind Speed: {contour.windSpeed}+ kt<br/>
                    Model Center: {windField.center[0].toFixed(2)}, {windField.center[1].toFixed(2)}<br/>
                    Max Winds: {windField.maxWinds} kt
                  </div>
                </Tooltip>
              </Polygon>
            ))}
            
            {/* Center marker for HWRF */}
            <CircleMarker
              center={windField.center}
              radius={6}
              color="#FF0000"
              fillColor="#FF0000"
              fillOpacity={0.9}
              weight={2}
            >
              <Tooltip>
                <div>
                  <strong>HWRF Model Center</strong><br/>
                  Max Winds: {windField.maxWinds} kt<br/>
                  Radius: {Math.round(windField.radius)} km
                </div>
              </Tooltip>
            </CircleMarker>
            
            {/* Fallback to point display if no contours */}
            {!windField.contours && windField.windField.map((point, pointIndex) => (
              <CircleMarker
                key={`hwrf-point-${index}-${pointIndex}`}
                center={[point.lat, point.lon]}
                radius={Math.max(1, point.windSpeed / 20)}
                color="#ff4444"
                fillColor="#ff4444"
                fillOpacity={Math.min(0.8, point.windSpeed / 100)}
                weight={0}
              >
                <Tooltip>
                  <div>
                    <strong>HWRF Wind Field</strong><br/>
                    Wind Speed: {point.windSpeed} kt<br/>
                    Pressure: {point.pressure} mb<br/>
                    Time: {new Date(point.time).toLocaleString()}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </React.Fragment>
        ))}

        {/* HMON Wind Field Layer - Enhanced Contour Display */}
        {showHMONWindfield && selectedStormId && hmon.hmonData && hmon.hmonData.windFields && hmon.hmonData.windFields.map((windField, index) => (
          <React.Fragment key={`hmon-windfield-${index}`}>
            {/* Render contour polygons if available */}
            {windField.contours && windField.contours.map((contour, contourIndex) => (
              <Polygon
                key={`hmon-contour-${index}-${contourIndex}`}
                positions={contour.polygon}
                color={contour.color}
                fillColor={contour.color}
                fillOpacity={0.35}
                weight={1}
                opacity={0.8}
              >
                <Tooltip>
                  <div>
                    <strong>HMON Wind Contour</strong><br/>
                    Wind Speed: {contour.windSpeed}+ kt<br/>
                    Model Center: {windField.center[0].toFixed(2)}, {windField.center[1].toFixed(2)}<br/>
                    Max Winds: {windField.maxWinds} kt
                  </div>
                </Tooltip>
              </Polygon>
            ))}
            
            {/* Center marker for HMON */}
            <CircleMarker
              center={windField.center}
              radius={6}
              color="#8B4513"
              fillColor="#8B4513"
              fillOpacity={0.9}
              weight={2}
            >
              <Tooltip>
                <div>
                  <strong>HMON Model Center</strong><br/>
                  Max Winds: {windField.maxWinds} kt<br/>
                  Radius: {Math.round(windField.radius)} km
                </div>
              </Tooltip>
            </CircleMarker>
            
            {/* Fallback to point display if no contours */}
            {!windField.contours && windField.windField.map((point, pointIndex) => (
              <CircleMarker
                key={`hmon-point-${index}-${pointIndex}`}
                center={[point.lat, point.lon]}
                radius={Math.max(1, point.windSpeed / 20)}
                color="#4682b4"
                fillColor="#4682b4"
                fillOpacity={Math.min(0.8, point.windSpeed / 100)}
                weight={0}
              >
                <Tooltip>
                  <div>
                    <strong>HMON Wind Field</strong><br/>
                    Wind Speed: {point.windSpeed} kt<br/>
                    Pressure: {point.pressure} mb<br/>
                    Time: {new Date(point.time).toLocaleString()}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </React.Fragment>
        ))}

      </MapContainer>
      
      {/* Wind Speed Legend for HWRF/HMON */}
      <WindSpeedLegend 
        visible={!!(
          (showHWRFWindfield && hwrf.hwrfData?.windFields && hwrf.hwrfData.windFields.length > 0) || 
          (showHMONWindfield && hmon.hmonData?.windFields && hmon.hmonData.windFields.length > 0)
        )}
        modelType={showHWRFWindfield && hwrf.hwrfData?.windFields && hwrf.hwrfData.windFields.length > 0 ? 'HWRF' : 'HMON'}
      />
      
      {/* Wind Speed Probability Legend */}
  {showWindSpeedProb && isAllStormsShown && windSpeedProb.probabilityData && (
        <div className="wind-speed-probability-legend" style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          border: '1px solid #ddd',
          fontSize: '0.75rem',
          zIndex: 1000,
          minWidth: '200px',
          maxWidth: '220px'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '6px', 
            color: '#ffffff',
            borderBottom: '1px solid #555',
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
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>90%+ (Very High)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#800000',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>70-89% (High)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#cc0000',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>50-69% (Moderate)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#ff6600',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>30-49% (Low-Mod)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#2196F3',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>20-29% (Low)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#00aa00',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>10-19% (Very Low)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#0066cc',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>&lt;10% (Minimal)</span>
            </div>
          </div>
          
          <div style={{
            fontSize: '0.65rem',
            color: '#cccccc',
            marginTop: '6px',
            fontStyle: 'italic',
            borderTop: '1px solid #555',
            paddingTop: '4px'
          }}>
            {windSpeedProbType === '34kt' && 'Tropical storm force winds (39+ mph)'}
            {windSpeedProbType === '50kt' && 'Strong tropical storm winds (58+ mph)'}
            {windSpeedProbType === '64kt' && 'Hurricane force winds (74+ mph)'}
          </div>
        </div>
      )}
      
      {/* Peak Storm Surge Legend - Bottom Left */}
      {showPeakStormSurge && selectedStormId && peakStormSurge.peakSurgeData && (
        <div className="peak-surge-legend" style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '10px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          border: '1px solid #ddd',
          fontSize: '0.75rem',
          zIndex: 1000,
          minWidth: '180px',
          maxWidth: '220px'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '6px', 
            color: '#ffffff',
            borderBottom: '1px solid #555',
            paddingBottom: '3px',
            fontSize: '0.8rem'
          }}>
            🌊 Peak Storm Surge
          </div>
          
          {/* Surge Statistics Summary */}
          {(() => {
            const features = peakStormSurge.peakSurgeData.features || [];
            const totalAreas = features.length;
            const extremeAreas = features.filter((f: any) => (f.properties?.SURGE_FT || 0) >= 10).length;
            const highAreas = features.filter((f: any) => (f.properties?.SURGE_FT || 0) >= 7 && (f.properties?.SURGE_FT || 0) < 10).length;
            const maxHeight = Math.max(...features.map((f: any) => f.properties?.SURGE_FT || 0));
            
            return (
              <div style={{ marginBottom: '8px', fontSize: '0.7rem', color: '#cccccc' }}>
                <div><strong>{totalAreas}</strong> affected areas</div>
                {extremeAreas > 0 && <div>🔴 <strong>{extremeAreas}</strong> extreme zones (10+ ft)</div>}
                {highAreas > 0 && <div>🟠 <strong>{highAreas}</strong> high-impact zones (7-9 ft)</div>}
                {maxHeight > 0 && <div>📏 Max height: <strong>{maxHeight} ft</strong></div>}
              </div>
            );
          })()}
          
          {/* Height-based surge color scale with specified RGB values */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#ff0000',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>10+ ft above ground</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#ffaa00',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>7-9 ft above ground</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#ffff00',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>4-6 ft above ground</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#0070ff',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>1-3 ft above ground</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '16px',
                height: '12px',
                backgroundColor: '#cccccc',
                border: '1px solid #333',
                borderStyle: 'dashed',
                flexShrink: 0
              }}></div>
              <span style={{ color: '#ffffff' }}>Less than 1 ft</span>
            </div>
          </div>
          <div style={{ 
            fontSize: '0.65rem', 
            color: '#cccccc', 
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
            Storm surge heights above ground level
          </div>
        </div>
      )}
      </div>

      {/* Layer Toggle Button */}
      <button 
        ref={layerButtonRef}
        className="layer-toggle-btn"
        onClick={() => setIsControlPanelClosed(!isControlPanelClosed)}
        title={isControlPanelClosed ? "Open Layers Panel" : "Close Layers Panel"}
      >
        <LayersOutlinedIcon fontSize="medium" />
      </button>

      {/* Sliding Control Panel */}
      <div 
        ref={controlPanelRef}
        className={`sliding-control-panel ${isControlPanelClosed ? 'closed' : 'open'}`}
      >
        <div className="control-panel-header-wrapper">
          <h3 className="control-panel-header">
             Map Layers
          </h3>
        </div>
        <div className="control-panel-content">
          {loading ? (
            <span className="control-panel-loading">
              <div className="loading-spinner"></div>
              Loading storms...
            </span>
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
              
              {/* Visual Storm Selector */}
              {displayStorms.length > 0 && (
                <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
                    Select Storms
                  </div>
                  {/* Selection helpers */}
                  {selectedStormIds.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        onClick={() => {
                          setSelectedStormIds([]);
                          setSelectedStormId(null);
                          setLastSelectionType(null);
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.3)',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        Clear selection (show all)
                      </button>
                    </div>
                  )}
                  
                  {/* Individual Storm Options */}
                  {displayStorms.map(storm => {
                    const isSelected = selectedStormIds.includes(storm.id);
                    const categoryColor = storm.category >= 5 ? '#8B0000' : 
                                        storm.category >= 3 ? '#FF4500' : 
                                        storm.category >= 1 ? '#FFD700' : 
                                        storm.classification.toLowerCase().includes('tropical storm') || storm.classification.toLowerCase() === 'ts' ? '#4FC3F7' : '#87CEEB';
                    
                    // Function to get badge text for category indicator
                    const getBadgeText = (storm: any) => {
                      if (storm.category >= 1) return storm.category.toString();
                      const classification = storm.classification.toLowerCase();
                      if (classification === 'ts' || classification.includes('tropical storm')) return 'TS';
                      if (classification === 'td' || classification.includes('tropical depression')) return 'TD';
                      if (classification === 'ss' || classification.includes('subtropical')) return 'SS';
                      return 'TS'; // Default fallback
                    };
                    
                    return (
                      <div 
                        key={storm.id}
                        className={`storm-selector-box ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedStormIds(prev => {
                            if (prev.includes(storm.id)) {
                              const next = prev.filter(id => id !== storm.id);
                              // If removing the primary selection, set a new primary or clear
                              if (selectedStormId === storm.id) {
                                setSelectedStormId(next[0] ?? null);
                                // If no storms left selected, clear the selection type
                                if (next.length === 0) {
                                  setLastSelectionType(null);
                                }
                              }
                              return next;
                            } else {
                              const next = [...prev, storm.id];
                              // Set this as the primary selection for storm-specific layers
                              setSelectedStormId(storm.id);
                              // Clear invest selection when selecting a storm
                              setSelectedInvestId(null);
                              // Set this as a storm selection
                              setLastSelectionType('storm');
                              return next;
                            }
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          marginBottom: '8px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #4FC3F7' : '1px solid rgba(255, 255, 255, 0.3)',
                          backgroundColor: isSelected ? 'rgba(79, 195, 247, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Storm Icon - Hurricane or Tropical Storm SVG */}
                        <div style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? 'rgba(79, 195, 247, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '12px',
                          border: `2px solid ${categoryColor}`,
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {/* SVG Icon based on storm type */}
                          <div style={{
                            width: '48px',
                            height: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {(() => {
                              const isHurricane = storm.classification.toLowerCase().includes('hurricane') || 
                                                storm.classification === 'HU' || 
                                                (storm.category && storm.category >= 1);
                              const iconPath = isHurricane ? '/HU.svg' : '/TS.svg';
                              
                              return (
                                <img 
                                  src={iconPath}
                                  alt={isHurricane ? 'Hurricane' : 'Tropical Storm'}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))'
                                  }}
                                />
                              );
                            })()}
                          </div>
                          
                          {/* Category indicator */}
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            backgroundColor: categoryColor,
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            minWidth: '16px',
                            textAlign: 'center'
                          }}>
                            {getBadgeText(storm)}
                          </div>
                        </div>
                        
                        {/* Storm Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ffffff' }}>
                            {storm.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#cccccc', marginTop: '2px' }}>
                            {getFullIntensityName(storm)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#aaaaaa', marginTop: '1px' }}>
                            {storm.maxWinds} mph • {storm.pressure} mb
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {selectedStorm && (
                    <div style={{ fontSize: '0.7rem', color: '#cccccc', marginTop: '6px', padding: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
                      <strong>Tracking:</strong> {selectedStorm.name} - {selectedStorm.maxWinds} mph winds
                    </div>
                  )}
                </div>
              )}
              
              {/* Invest Areas Section */}
              <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#ffffff' }}>
                  Areas of Interest
                  <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#cccccc', marginTop: '2px' }}>
                    Tropical development areas being monitored
                  </div>
                </div>
                
                {/* Global invest toggle */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showInvests}
                      onChange={(e) => setShowInvests(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Show All Invest Areas ({invests.length})
                    {investLoading && (
                      <div className="loading-spinner" style={{ marginLeft: '8px', transform: 'scale(0.6)' }}></div>
                    )}
                    {investError && (
                      <span style={{ fontSize: '0.7rem', color: '#d32f2f', marginLeft: '6px' }}>
                        Error
                      </span>
                    )}
                  </label>
                </div>

                {/* Individual Invest Cards */}
                {showInvests && invests.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {invests.map(invest => {
                      // Determine color based on formation chances
                      const maxChance = Math.max(invest.formationChance48hr, invest.formationChance7day);
                      const investColor = maxChance >= 70 ? '#FF6B35' : // High (orange-red)
                                         maxChance >= 40 ? '#FF8C00' : // Medium (orange) 
                                         '#FFD700'; // Low (yellow)
                      
                      const isSelected = selectedInvestId === invest.id;
                      
                      return (
                        <div 
                          key={invest.id}
                          className={`storm-selector-box ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (selectedInvestId === invest.id) {
                              // Deselect if clicking the same invest
                              setSelectedInvestId(null);
                              // Clear any storm selection too
                              setSelectedStormId(null);
                              setSelectedStormIds([]);
                              // Clear selection type
                              setLastSelectionType(null);
                            } else {
                              // Select this invest and center map on it
                              setSelectedInvestId(invest.id);
                              // Clear storm selections when selecting an invest
                              setSelectedStormId(null);
                              setSelectedStormIds([]);
                              // Set this as an invest selection
                              setLastSelectionType('invest');
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #FF8C00' : '1px solid rgba(255, 255, 255, 0.3)',
                            backgroundColor: isSelected ? 'rgba(255, 140, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            cursor: 'pointer'
                          }}
                        >
                          {/* Invest Icon */}
                          <div style={{
                            position: 'relative',
                            width: '32px',
                            height: '32px',
                            marginRight: '12px',
                            flexShrink: 0
                          }}>
                            {/* Main invest icon circle */}
                            <div style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: investColor,
                              border: '2px solid #333',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              color: '#333'
                            }}>
                              I
                            </div>
                            
                            {/* Formation chance indicator */}
                            <div style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '-2px',
                              backgroundColor: maxChance >= 70 ? '#8B0000' : 
                                             maxChance >= 40 ? '#FF4500' : '#DAA520',
                              color: 'white',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              padding: '1px 3px',
                              borderRadius: '3px',
                              minWidth: '16px',
                              textAlign: 'center',
                              border: '1px solid #333'
                            }}>
                              {maxChance}%
                            </div>
                          </div>
                          
                          {/* Invest Info */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ffffff' }}>
                              {invest.name || `Invest ${invest.id}`}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#cccccc', marginTop: '2px' }}>
                              {invest.location || invest.basin}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#aaaaaa', marginTop: '1px' }}>
                              48hr: {invest.formationChance48hr}% • 7-day: {invest.formationChance7day}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Show message when no invests or hidden */}
                {!showInvests && invests.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#cccccc', fontStyle: 'italic' }}>
                    {invests.length} invest area{invests.length !== 1 ? 's' : ''} hidden
                  </div>
                )}
                
                {showInvests && invests.length === 0 && !investLoading && (
                  <div style={{ fontSize: '0.7rem', color: '#cccccc', fontStyle: 'italic' }}>
                    No active invest areas
                  </div>
                )}
              </div>
              
              {/* Path Visibility Controls */}
              <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#ffffff' }}>
                  NHC Layers
                  <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#cccccc', marginTop: '2px' }}>
                    Real-time NHC forecast & historical data
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showHistoricalTracks}
                      onChange={(e) => setShowHistoricalTracks(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Historical Track
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showForecastTracks}
                      onChange={(e) => setShowForecastTracks(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    Forecast Track
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showForecastCones}
                      onChange={(e) => setShowForecastCones(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#2196F3' }}></span> Forecast Cone
                  </label>
                  {/* Hidden: Regular Storm Surge toggle
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showStormSurge}
                      onChange={(e) => setShowStormSurge(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#ff4444' }}></span> Storm Surge
                    {stormSurge.available === false && (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        (N/A for EP storms)
                      </span>
                    )}
                  </label>
                  */}
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: !selectedStormId ? 'not-allowed' : 'pointer', opacity: !selectedStormId ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={showPeakStormSurge}
                      onChange={(e) => setShowPeakStormSurge(e.target.checked)}
                      disabled={!selectedStormId}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#cc00cc' }}></span> Peak Storm Surge
                    {peakStormSurge.loading && selectedStormId && (
                      <div className="loading-spinner" style={{ marginLeft: '8px' }}></div>
                    )}
                    {!selectedStormId ? (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        (Select a storm to view)
                      </span>
                    ) : peakStormSurge.available === false && !peakStormSurge.loading ? (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        (N/A for EP storms)
                      </span>
                    ) : null}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: !selectedStormId ? 'not-allowed' : 'pointer', opacity: !selectedStormId ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      checked={showWindArrival}
                      onChange={(e) => setShowWindArrival(e.target.checked)}
                      disabled={!selectedStormId}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#9932CC' }}></span> Wind Arrival Time
                    {!selectedStormId ? (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        (Select a storm to view)
                      </span>
                    ) : windArrival.available === false ? (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        
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

                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: isAllStormsShown ? 'pointer' : 'not-allowed', opacity: isAllStormsShown ? 1 : 0.6 }}>
                    <input
                      type="checkbox"
                      checked={showWindSpeedProb}
                      onChange={(e) => setShowWindSpeedProb(e.target.checked)}
                      disabled={!isAllStormsShown}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ color: '#0066cc' }}></span> Wind Speed Probability
                    {!isAllStormsShown ? (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        (Only available when viewing all storms)
                      </span>
                    ) : windSpeedProb.available === false ? (
                      <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                        (No data available)
                      </span>
                    ) : null}
                  </label>
                  
                  {/* Wind Speed Options - only show when wind speed probability is enabled */}
                  {showWindSpeedProb && isAllStormsShown && (
                    <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#cccccc', marginBottom: '3px' }}>Wind Speed Options:</div>
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
              <div style={{ display: 'none', marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#ffffff' }}>
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
                  <div style={{ fontSize: '0.7rem', color: '#cccccc', marginTop: '3px', marginLeft: '20px' }}>
                    {fetchLiveTrackData ? 
                      'Fetching forecast paths and cones from NHC (may cause CORS errors)' : 
                      'Using basic storm positions only (prevents CORS errors)'
                    }
                  </div>
                  
                  {/* Storm Surge Status */}
                  {showStormSurge && (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#d32f2f' }}>
                        Storm Surge Status
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cccccc', marginTop: '2px' }}>
                        {stormSurge.loading ? (
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <div className="loading-spinner"></div>
                            Loading surge data...
                          </span>
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
                  
                  {/* Peak Storm Surge Status */}
                  {showPeakStormSurge && (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#cc00cc' }}>
                        Peak Storm Surge Status
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cccccc', marginTop: '2px' }}>
                        {peakStormSurge.loading ? (
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <div className="loading-spinner"></div>
                            Loading peak surge data...
                          </span>
                        ) : peakStormSurge.available === false ? (
                          'No peak surge data (Eastern Pacific storms typically don\'t have surge products)'
                        ) : peakStormSurge.peakSurgeData ? (
                          `Showing peak surge data with ${peakStormSurge.peakSurgeData.features?.length || 0} areas`
                        ) : peakStormSurge.error ? (
                          `Error: ${peakStormSurge.error}`
                        ) : (
                          'Checking availability...'
                        )}
                      </div>
                    </div>
                  )}
                  
                  {showWindSpeedProb && (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#4FC3F7' }}>
                        Wind Probability Status
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cccccc', marginTop: '2px' }}>
                        {windSpeedProb.loading ? (
                          <span style={{ display: 'flex', alignItems: 'center' }}>
                            <div className="loading-spinner"></div>
                            Loading wind probability data...
                          </span>
                        ) : windSpeedProb.available === false ? (
                          'No wind probability data available (typically only available during active storm threats)'
                        ) : windSpeedProb.probabilityData ? (
                          (windSpeedProb.probabilityData.features?.length || 0) > 0
                            ? `Showing ${windSpeedProb.probabilityData.features.length} probability zones for ${windSpeedProbType} winds`
                            : `No polygon probability zones found in latest ${windSpeedProbType} KMZ (product may be raster-only this cycle)`
                        ) : windSpeedProb.error ? (
                          `Error: ${windSpeedProb.error}`
                        ) : (
                          'Checking availability...'
                        )}
                      </div>
                    </div>
                  )}
              </div>
              
              {/* Hurricane Models Section */}
              <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#ffffff' }}>
                  Hurricane Models
                  <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#999', marginTop: '2px' }}>
                    High-resolution hurricane-specific models
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '10px' }}>
                  {/* HWRF Windfield Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showHWRFWindfield}
                      onChange={(e) => setShowHWRFWindfield(e.target.checked)}
                      style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                    />
                    <span style={{ color: '#ffffff', backgroundColor: '#ff4444', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      HWRF
                    </span>
                    Wind Field
                    {hwrf.isLoading && (
                      <span style={{ display: 'flex', alignItems: 'center', marginLeft: '6px', fontSize: '0.7rem', color: '#4FC3F7' }}>
                        <div className="gefs-spinner"></div>
                      </span>
                    )}
                    {hwrf.error && (
                      <span style={{ fontSize: '0.7rem', color: '#d32f2f', marginLeft: '6px' }}>
                        Error
                      </span>
                    )}
                  </label>
                  
                  {/* HMON Windfield Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showHMONWindfield}
                      onChange={(e) => setShowHMONWindfield(e.target.checked)}
                      style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                    />
                    <span style={{ color: '#ffffff', backgroundColor: '#4682b4', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      HMON
                    </span>
                    Wind Field
                    {hmon.isLoading && (
                      <span style={{ display: 'flex', alignItems: 'center', marginLeft: '6px', fontSize: '0.7rem', color: '#4FC3F7' }}>
                        <div className="gefs-spinner"></div>
                      </span>
                    )}
                    {hmon.error && (
                      <span style={{ fontSize: '0.7rem', color: '#d32f2f', marginLeft: '6px' }}>
                        Error
                      </span>
                    )}
                  </label>
                </div>
              </div>
              
              <div style={{ marginTop: '10px', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#ffffff' }}>
                  Model Tracks
                  <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: '#999', marginTop: '2px' }}>
                    Individual model controls
                  </div>
                </div>
                
                {/* Master toggle for all models */}
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: selectedStormId ? 'pointer' : 'not-allowed', opacity: selectedStormId ? 1 : 0.6, marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={showGEFSSpaghetti}
                    onChange={(e) => setShowGEFSSpaghetti(e.target.checked)}
                    disabled={!selectedStormId}
                    style={{ marginRight: '6px' }}
                  />
                  <strong>Enable Model Display</strong>
                  {gefs.loading && (
                    <span style={{ display: 'flex', alignItems: 'center', marginLeft: '6px', fontSize: '0.7rem', color: '#4FC3F7' }}>
                      <div className="gefs-spinner"></div>
                      loading...
                    </span>
                  )}
                  {selectedStormId && gefs.tracks && gefs.tracks.modelsPresent && gefs.tracks.modelsPresent.length > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#4FC3F7', marginLeft: '6px' }}>
                      ({gefs.tracks.modelsPresent.length} models available)
                    </span>
                  )}
                  {gefs.error && (
                    <span style={{ fontSize: '0.7rem', color: '#d32f2f', marginLeft: '6px' }}>
                      {gefs.error}
                    </span>
                  )}
                  {!selectedStormId ? (
                    <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                      (Select a storm)
                    </span>
                  ) : gefs.available === false ? (
                    <span style={{ fontSize: '0.7rem', color: '#aaaaaa', marginLeft: '5px' }}>
                      (No data found)
                    </span>
                  ) : null}
                </label>

                {/* Individual Model Toggles */}
                {showGEFSSpaghetti && selectedStormId && gefs.tracks && gefs.tracks.modelsPresent && (
                  <div style={{ marginLeft: '20px' }}>
                    
                    {/* Quick Actions */}
                    <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setShowOfficialTrack(true);
                          setShowHAFS(true);
                          setShowGFS(true);
                          setShowECMWF(true);
                          setShowGEFSEnsemble(true);
                          setShowOtherModels(true);
                          setShowHWRF(true);
                          setShowHMON(true);
                        }}
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          backgroundColor: 'rgba(76, 175, 80, 0.2)',
                          border: '1px solid rgba(76, 175, 80, 0.5)',
                          borderRadius: '3px',
                          color: '#4caf50',
                          cursor: 'pointer'
                        }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => {
                          setShowOfficialTrack(false);
                          setShowHAFS(false);
                          setShowGFS(false);
                          setShowECMWF(false);
                          setShowGEFSEnsemble(false);
                          setShowOtherModels(false);
                          setShowHWRF(false);
                          setShowHMON(false);
                        }}
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          backgroundColor: 'rgba(244, 67, 54, 0.2)',
                          border: '1px solid rgba(244, 67, 54, 0.5)',
                          borderRadius: '3px',
                          color: '#f44336',
                          cursor: 'pointer'
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    
                    {/* Official Forecast */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'OFCL' || m === 'OFCI') && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showOfficialTrack}
                          onChange={(e) => setShowOfficialTrack(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#000000', backgroundColor: '#ffffff', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          OFCL
                        </span>
                        Official NHC Forecast
                      </label>
                    )}
                    
                    {/* HAFS */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'HAFS' || m === 'HAFA' || m === 'HAFB') && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showHAFS}
                          onChange={(e) => setShowHAFS(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#ffffff', backgroundColor: '#4444ff', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          HAFS
                        </span>
                        Hurricane Analysis & Forecast System
                      </label>
                    )}
                    
                    {/* GFS */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'GFS' || m === 'GFSO') && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showGFS}
                          onChange={(e) => setShowGFS(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#ffffff', backgroundColor: '#9c27b0', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          GFS
                        </span>
                        Global Forecast System
                      </label>
                    )}
                    
                    {/* ECMWF */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'ECMW' || m === 'ECM2') && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showECMWF}
                          onChange={(e) => setShowECMWF(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#ffffff', backgroundColor: '#ff9800', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          ECMWF
                        </span>
                        European Centre Model
                      </label>
                    )}
                    
                    {/* GEFS Ensemble */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'AEMI' || m === 'AEMN' || m === 'AC00' || m.startsWith('AP')) && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showGEFSEnsemble}
                          onChange={(e) => setShowGEFSEnsemble(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#ffffff', backgroundColor: '#0d47a1', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          GEFS
                        </span>
                        GEFS Ensemble ({gefs.tracks.modelsPresent.filter((m: string) => m === 'AEMI' || m === 'AEMN' || m === 'AC00' || m.startsWith('AP')).length} members)
                      </label>
                    )}
                    
                    {/* HWRF Track */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'HWRF') && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showHWRF}
                          onChange={(e) => setShowHWRF(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#ffffff', backgroundColor: '#ff4444', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          HWRF
                        </span>
                        Hurricane Weather Research & Forecasting
                      </label>
                    )}
                    
                    {/* HMON Track */}
                    {gefs.tracks.modelsPresent.some((m: string) => m === 'HMON') && (
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showHMON}
                          onChange={(e) => setShowHMON(e.target.checked)}
                          style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                        />
                        <span style={{ color: '#ffffff', backgroundColor: '#4682b4', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          HMON
                        </span>
                        Hurricane Multi-scale Ocean-coupled
                      </label>
                    )}
                    
                    {/* Other Models */}
                    {(() => {
                      const knownModels = ['OFCL', 'OFCI', 'HWRF', 'HMON', 'HAFS', 'HAFA', 'HAFB', 'GFS', 'GFSO', 'ECMW', 'ECM2', 'AEMI', 'AEMN', 'AEM2', 'AC00'];
                      const otherModels = gefs.tracks.modelsPresent.filter((m: string) => !knownModels.includes(m) && !m.startsWith('AP'));
                      return otherModels.length > 0 ? (
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={showOtherModels}
                            onChange={(e) => setShowOtherModels(e.target.checked)}
                            style={{ marginRight: '6px', transform: 'scale(0.9)' }}
                          />
                          <span style={{ color: '#ffffff', backgroundColor: '#666666', padding: '1px 4px', borderRadius: '2px', marginRight: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            OTHER
                          </span>
                          Other Models ({otherModels.join(', ')})
                        </label>
                      ) : null;
                    })()}
                    </div>
                  </div>
                )}
                  
                  {/* Model Data Details */}
                  {selectedStormId && gefs.tracks && (
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#999', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px' }}>
                      {/* Cycle Time */}
                      {gefs.tracks.cycleTime && (
                        <div>
                          Cycle: {(() => {
                            const cycle = gefs.tracks.cycleTime;
                            const year = cycle.substring(0, 4);
                            const month = cycle.substring(4, 6);
                            const day = cycle.substring(6, 8);
                            const hour = cycle.substring(8, 10);
                            return `${year}-${month}-${day} ${hour}:00 UTC`;
                          })()}
                        </div>
                      )}
                      {/* Fetch Time */}
                      {gefs.tracks.fetchTime && (
                        <div>
                          Updated: {gefs.tracks.fetchTime.toLocaleTimeString()}
                          <button
                            onClick={() => gefs.refresh && gefs.refresh()}
                            style={{
                              marginLeft: '8px',
                              padding: '1px 4px',
                              fontSize: '0.6rem',
                              backgroundColor: 'rgba(79, 195, 247, 0.2)',
                              border: '1px solid rgba(79, 195, 247, 0.5)',
                              borderRadius: '3px',
                              color: '#4FC3F7',
                              cursor: 'pointer'
                            }}
                            title="Force refresh model data"
                          >
                            ↻
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
              {/*<div className="control-panel-buttons">
                <button 
                  onClick={refresh}
                  className="control-panel-button"
                >
                  Refresh
                </button>
              </div>*/}
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
      </div>
    </div>
  );
};

export default SimpleStormTracker;
