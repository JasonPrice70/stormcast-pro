# Invest Areas Feature Documentation

## Overview
The StormCast Pro application now includes support for displaying **Invest Areas** on the map. Invest areas are regions of interest that meteorologists are monitoring for potential tropical development.

## What are Invest Areas?
- **Invest** stands for "Investigation Area"
- These are areas where conditions may be favorable for tropical cyclone development
- Each invest is assigned a number (90, 91, 92, etc.) and basin prefix (AL, EP, CP)
- Formation chances are given for 48-hour and 7-day periods

## Features Added

### 1. Data Types
- Added `InvestArea` interface to track invest information
- Added `TropicalWeatherOutlook` interface for complete outlook data
- Supports all three basins: Atlantic (AL), Eastern Pacific (EP), Central Pacific (CP)

### 2. API Integration
- New methods in `NHCApiService`:
  - `getTropicalWeatherOutlook()` - Fetches all basin outlooks
  - `getInvestAreas()` - Gets just the invest areas for map display
  - `parseTropicalWeatherOutlook()` - Parses NHC text products
- Automatic coordinate extraction from outlook text
- Fallback to CORS proxies when Lambda endpoints unavailable

### 3. Map Display
- Invest areas shown as circles with "I" icon
- Color-coded by formation chance:
  - 🟠 **Orange**: High chance (70%+)
  - 🟡 **Gold**: Medium chance (40-69%)
  - 🟡 **Light Yellow**: Low chance (20-39%)
  - 🟣 **Light Purple**: Very low chance (0-19%)
- Semi-transparent area circles show general region of interest
- Toggle button to show/hide invest areas

### 4. User Interface
- Checkbox to toggle invest display
- Separate section in sidebar for invest areas
- Detailed popup information when clicking invest markers
- Formation chance explanations in detail panel

### 5. Data Updates
- Invest data refreshes every 15 minutes (less frequent than storms)
- Independent error handling for invest vs storm data
- Combined refresh button updates both data types

## Usage

### Viewing Invest Areas
1. Open StormCast Pro
2. Ensure "Show Invest Areas" checkbox is checked
3. Invest areas appear as small circles with "I" markers
4. Click on any invest area for detailed information

### Understanding Formation Chances
- **48-hour chance**: Probability of development in next 2 days
- **7-day chance**: Probability of development in next week
- Chances are updated 4 times daily by NHC (2 AM, 8 AM, 2 PM, 8 PM EDT)

### Reading Invest Information
Each invest area shows:
- Unique ID (e.g., AL91, EP92)
- Current location and coordinates
- Formation probabilities
- Meteorological description
- Last update time

## Technical Implementation

### Data Flow
1. `useInvestData` hook manages invest data state
2. `NHCApiService` fetches from Lambda or CORS proxies
3. Text outlook parsed to extract invest areas
4. Coordinates extracted using regex patterns
5. Data displayed on map with React Leaflet components

### Error Handling
- Graceful fallback when invest data unavailable
- User-friendly error messages
- Continues showing storm data even if invest data fails

### Performance
- Invest data cached until next refresh cycle
- Lightweight icons and rendering
- Optional display to reduce map clutter

## Future Enhancements
- GIS shapefile integration for precise invest boundaries
- Historical invest tracking
- Formation probability trends
- Push notifications for high-probability invests
- Integration with satellite imagery overlays

## Benefits for Users
- **Early Awareness**: See potential storms before they develop
- **Planning**: Better preparation for possible tropical activity
- **Education**: Learn about tropical development processes
- **Comprehensive View**: Complete picture of tropical activity

This feature makes StormCast Pro the most comprehensive tropical weather tracking application, providing users with the earliest possible awareness of potential tropical development.
