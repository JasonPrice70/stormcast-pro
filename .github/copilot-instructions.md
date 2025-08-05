<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# StormCast Pro - Hurricane & Tropical Cyclone Tracking Application

## Project Overview
This is a modern React + TypeScript application for tracking hurricanes and tropical cyclones. The application integrates with National Hurricane Center (NHC) data and provides real-time storm tracking, forecasting, and visualization capabilities.

## Technologies Used
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Mapping:** React Leaflet + Leaflet
- **Charts:** Recharts
- **Styling:** CSS3 with CSS Variables
- **HTTP Client:** Axios
- **Date Handling:** date-fns

## Key Features
1. **Real-time Storm Tracking:** Live hurricane and tropical cyclone positions
2. **Interactive Maps:** Leaflet-based mapping with storm paths and forecast cones
3. **Weather Model Visualization:** Multiple forecast models (GFS, ECMWF, HWRF, etc.)
4. **Data Visualization:** Charts showing wind speeds, pressure, and forecast trends
5. **Responsive Design:** Mobile-friendly interface
6. **Official Data Integration:** NHC and other meteorological agency data

## API Integration Guidelines
- Use National Hurricane Center APIs for official storm data
- Implement proper error handling for API failures
- Cache data appropriately to avoid excessive API calls
- Follow rate limiting guidelines for external APIs

## Code Standards
- Use TypeScript for all new code
- Follow React functional component patterns with hooks
- Use CSS modules or styled-components for component-specific styling
- Implement proper error boundaries
- Add loading states for async operations
- Use semantic HTML elements

## Data Flow
- Storm data flows from NHC APIs → State management → Components
- Forecast data from multiple weather models
- Map interactions update selected storm details
- Real-time updates via periodic API polling

## Performance Considerations
- Lazy load map components and large datasets
- Optimize re-renders with React.memo and useMemo
- Implement virtual scrolling for large storm lists
- Use appropriate chart libraries for data visualization

## Security & Best Practices
- Validate all external API data
- Implement proper CORS handling
- Use environment variables for API keys
- Follow accessibility guidelines (WCAG)
- Implement proper error logging

## Future Enhancements
- WebSocket connections for real-time updates
- Push notifications for storm alerts
- Historical storm data analysis
- Advanced forecast model comparisons
- Mobile app development
