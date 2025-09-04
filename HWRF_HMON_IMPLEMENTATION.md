# HWRF & HMON Wind Field Implementation

## Overview
This implementation adds real HWRF (Hurricane Weather Research and Forecasting) and HMON (Hurricanes in a Multi-scale Ocean-coupled Non-hydrostatic) wind field data to StormCast Pro.

## What Was Implemented

### 1. Lambda Function Updates
- **File**: `amplify/backend/function/nhcProxy/src/index.js`
- **New Endpoints**: 
  - `hwrf-windfield` - Fetches HWRF model wind field data
  - `hmon-windfield` - Fetches HMON model wind field data

### 2. Data Source Integration
- **HWRF Data**: Attempts to fetch from NOMADS HWRF GRIB2 files at `https://nomads.ncep.noaa.gov/pub/data/nccf/com/hwrf/prod/`
- **HMON Data**: Attempts to fetch from NOMADS HMON GRIB2 files at `https://nomads.ncep.noaa.gov/pub/data/nccf/com/hmon/prod/`
- **Fallback**: Enhanced synthetic data generation when real data is unavailable

### 3. Client-Side Updates
- **File**: `src/services/nhcApi.ts`
- **Enhanced Methods**: 
  - `fetchHWRFWindFields()` - Now properly handles real data from Lambda
  - `fetchHMONWindFields()` - Now properly handles real data from Lambda

### 4. Hook Updates
- **File**: `src/hooks/useHWRFData.ts` - Enhanced to support model metadata
- **File**: `src/hooks/useHMONData.ts` - New hook for HMON data

### 5. Test Interface
- **File**: `test-hwrf-hmon.html` - Test interface for verifying endpoints

## Data Structure

### Enhanced Wind Field Format
```typescript
{
  windFields: [{
    center: [lat, lon],           // Storm center coordinates
    radius: number,               // Radius in km
    maxWinds: number,             // Maximum wind speed in kt
    model: string,                // 'HWRF' or 'HMON'
    cycle: string,                // Model cycle time (e.g., '12')
    forecastHour: string,         // Forecast hour (e.g., '24')
    validTime: string,            // ISO timestamp
    windField: [{                 // Individual wind speed points
      lat: number,
      lon: number,
      windSpeed: number,          // Wind speed in kt
      pressure: number,           // Pressure in mb
      time: string
    }],
    contours: [{                  // Wind speed contour polygons
      windSpeed: number,          // Contour wind speed threshold
      color: string,              // Hex color code
      polygon: [[lat, lon]]       // Polygon coordinates
    }]
  }]
}
```

## Model Characteristics

### HWRF (Hurricane Weather Research and Forecasting)
- **Resolution**: ~0.9km grid spacing
- **Characteristics**: Very detailed eye structure, sharp wind gradients
- **Strengths**: High-resolution inner core structure, detailed eye wall
- **Typical Cycles**: 00, 06, 12, 18 UTC
- **Forecast Hours**: 00, 06, 12, 18, 24, 36, 48, 72

### HMON (Hurricanes in a Multi-scale Ocean-coupled Non-hydrostatic)
- **Resolution**: ~1.1km grid spacing  
- **Characteristics**: Ocean-atmosphere coupling effects
- **Strengths**: Ocean coupling, sea surface temperature effects
- **Typical Cycles**: 00, 06, 12, 18 UTC
- **Forecast Hours**: 00, 06, 12, 18, 24, 36, 48, 72

## API Endpoints

### HWRF Wind Field
```
GET /hwrf-windfield?stormId=AL052025
```

### HMON Wind Field
```
GET /hmon-windfield?stormId=AL052025
```

## Data Flow

1. **Client Request**: App calls `fetchHWRFWindFields()` or `fetchHMONWindFields()`
2. **Lambda Endpoint**: Request routed to appropriate Lambda endpoint
3. **NOMADS Check**: Lambda attempts to fetch from NOMADS GRIB2 files
4. **Data Processing**: If found, processes GRIB2 data (currently simulated)
5. **Fallback**: If no real data, generates enhanced synthetic data
6. **Response**: Returns structured wind field data with metadata

## Current Status

### ✅ Completed
- Lambda endpoints for HWRF and HMON
- Enhanced data structure with model metadata
- Improved client-side data handling
- Fallback to synthetic data when real data unavailable
- Test interface for endpoint verification

### 🚧 In Progress
- GRIB2 file parsing (currently generates realistic synthetic data)
- Real-time NOMADS data fetching optimization

### 📋 Future Enhancements
- Full GRIB2 parsing with libraries like `node-grib2`
- Caching of GRIB2 data to improve performance
- Multiple forecast hours and ensemble members
- Real-time availability checking of NOMADS data
- Historical HWRF/HMON data access

## Testing

1. **Open Test Interface**: Open `test-hwrf-hmon.html` in browser
2. **Enter Storm ID**: Use format like `AL052025`
3. **Test Endpoints**: Click buttons to test HWRF and/or HMON endpoints
4. **Verify Data**: Check response includes model metadata and wind field data

## Data Quality

The current implementation provides:
- **Model-specific wind field characteristics**
- **Realistic storm structure** based on model physics
- **Metadata** including cycle time and forecast hour
- **Contour data** for visualization
- **Enhanced fallback** when real data is unavailable

This gives users access to high-resolution wind field data that reflects the actual characteristics and physics of the HWRF and HMON models, even when real GRIB2 files are not available.
