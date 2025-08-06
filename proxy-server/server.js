const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'NHC CORS Proxy Server is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/active-storms',
      '/api/forecast-track/:stormId',
      '/api/historical-track/:stormId',
      '/api/forecast-cone/:stormId'
    ]
  });
});

// Get active storms
app.get('/api/active-storms', async (req, res) => {
  try {
    console.log('Fetching active storms from NHC...');
    
    const response = await axios.get(`${NHC_BASE_URL}/CurrentStorms.json`, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'StormCast-Pro/1.0 (Hurricane Tracking Application)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      }
    });

    console.log('Successfully fetched active storms');
    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
      source: 'NHC'
    });

  } catch (error) {
    console.error('Error fetching active storms:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active storms from NHC',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get forecast track for a specific storm
app.get('/api/forecast-track/:stormId', async (req, res) => {
  try {
    const { stormId } = req.params;
    const year = new Date().getFullYear();
    
    console.log(`Fetching forecast track for storm: ${stormId}`);
    
    const url = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId.toUpperCase()}_5day_latest.geojson`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'StormCast-Pro/1.0 (Hurricane Tracking Application)',
        'Accept': 'application/json'
      }
    });

    console.log(`Successfully fetched forecast track for ${stormId}`);
    res.json({
      success: true,
      data: response.data,
      stormId: stormId,
      timestamp: new Date().toISOString(),
      source: 'NHC'
    });

  } catch (error) {
    console.error(`Error fetching forecast track for ${req.params.stormId}:`, error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({
        success: false,
        error: 'Forecast track not found',
        message: `No forecast data available for storm ${req.params.stormId}`,
        stormId: req.params.stormId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch forecast track',
        message: error.message,
        stormId: req.params.stormId,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Get historical track for a specific storm
app.get('/api/historical-track/:stormId', async (req, res) => {
  try {
    const { stormId } = req.params;
    const year = new Date().getFullYear();
    
    console.log(`Fetching historical track for storm: ${stormId}`);
    
    const url = `${NHC_BASE_URL}/gis/best_track/archive/${year}/${stormId.toUpperCase()}_best_track.geojson`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'StormCast-Pro/1.0 (Hurricane Tracking Application)',
        'Accept': 'application/json'
      }
    });

    console.log(`Successfully fetched historical track for ${stormId}`);
    res.json({
      success: true,
      data: response.data,
      stormId: stormId,
      timestamp: new Date().toISOString(),
      source: 'NHC'
    });

  } catch (error) {
    console.error(`Error fetching historical track for ${req.params.stormId}:`, error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({
        success: false,
        error: 'Historical track not found',
        message: `No historical data available for storm ${req.params.stormId}`,
        stormId: req.params.stormId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch historical track',
        message: error.message,
        stormId: req.params.stormId,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Get forecast cone for a specific storm
app.get('/api/forecast-cone/:stormId', async (req, res) => {
  try {
    const { stormId } = req.params;
    const year = new Date().getFullYear();
    
    console.log(`Fetching forecast cone for storm: ${stormId}`);
    
    const url = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId.toUpperCase()}_latest_CONE.geojson`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'StormCast-Pro/1.0 (Hurricane Tracking Application)',
        'Accept': 'application/json'
      }
    });

    console.log(`Successfully fetched forecast cone for ${stormId}`);
    res.json({
      success: true,
      data: response.data,
      stormId: stormId,
      timestamp: new Date().toISOString(),
      source: 'NHC'
    });

  } catch (error) {
    console.error(`Error fetching forecast cone for ${req.params.stormId}:`, error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({
        success: false,
        error: 'Forecast cone not found',
        message: `No forecast cone available for storm ${req.params.stormId}`,
        stormId: req.params.stormId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch forecast cone',
        message: error.message,
        stormId: req.params.stormId,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Generic proxy endpoint for any NHC URL
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing URL parameter',
        message: 'Please provide a url query parameter'
      });
    }

    // Validate that the URL is from NHC domain for security
    if (!url.startsWith(NHC_BASE_URL)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid URL',
        message: 'Only NHC URLs are allowed'
      });
    }

    console.log(`Proxying request to: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'StormCast-Pro/1.0 (Hurricane Tracking Application)',
        'Accept': 'application/json'
      }
    });

    res.json({
      success: true,
      data: response.data,
      url: url,
      timestamp: new Date().toISOString(),
      source: 'NHC'
    });

  } catch (error) {
    console.error(`Error proxying request:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Proxy request failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.path} not found`,
    availableEndpoints: [
      '/health',
      '/api/active-storms',
      '/api/forecast-track/:stormId',
      '/api/historical-track/:stormId',
      '/api/forecast-cone/:stormId',
      '/api/proxy?url=<nhc-url>'
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 NHC CORS Proxy Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌀 Active storms: http://localhost:${PORT}/api/active-storms`);
});

module.exports = app;
