# Manual AWS Lambda Setup Guide

## Step 1: Create Lambda Function

1. Go to AWS Console → Lambda → Functions
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `nhc-cors-proxy`
5. Runtime: Node.js 18.x
6. Click "Create function"

## Step 2: Add Lambda Code

Copy this code into the Lambda function editor:

```javascript
const axios = require('axios');

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov';

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }
  
  try {
    const path = event.path || event.pathParameters?.proxy || '';
    const pathParts = path.split('/').filter(p => p);
    
    let nhcUrl;
    let endpoint = pathParts[0];
    
    if (endpoint === 'active-storms') {
      nhcUrl = `${NHC_BASE_URL}/CurrentStorms.json`;
    } else if (endpoint === 'forecast-track' && pathParts[1]) {
      const stormId = pathParts[1].toUpperCase();
      const year = new Date().getFullYear();
      nhcUrl = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId}_5day_latest.geojson`;
    } else if (endpoint === 'historical-track' && pathParts[1]) {
      const stormId = pathParts[1].toUpperCase();
      const year = new Date().getFullYear();
      nhcUrl = `${NHC_BASE_URL}/gis/best_track/archive/${year}/${stormId}_best_track.geojson`;
    } else if (endpoint === 'forecast-cone' && pathParts[1]) {
      const stormId = pathParts[1].toUpperCase();
      const year = new Date().getFullYear();
      nhcUrl = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId}_latest_CONE.geojson`;
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid endpoint',
          message: `Endpoint '${endpoint}' not supported`
        })
      };
    }
    
    console.log(`Fetching from NHC: ${nhcUrl}`);
    
    const response = await axios.get(nhcUrl, {
      timeout: 25000,
      headers: {
        'User-Agent': 'StormCast-Pro-Lambda/1.0',
        'Accept': 'application/json'
      }
    });
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
        source: 'NHC'
      })
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    
    const statusCode = error.response?.status || 500;
    
    return {
      statusCode: statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
```

## Step 3: Configure Function

1. Go to Configuration → General configuration
2. Set Timeout to 30 seconds
3. Set Memory to 256 MB

## Step 4: Create API Gateway

1. Go to API Gateway in AWS Console
2. Create new "REST API"
3. API name: `nhc-cors-proxy-api`
4. Create API

## Step 5: Set up Proxy Resource

1. Click "Actions" → "Create Resource"
2. Check "Configure as proxy resource"
3. Resource Name: `proxy`
4. Resource Path: `{proxy+}`
5. Enable CORS: Yes
6. Create Resource

## Step 6: Connect Lambda

1. Select the `{proxy+}` resource
2. Click "Actions" → "Create Method" → "ANY"
3. Integration type: Lambda Function
4. Use Lambda Proxy integration: Yes
5. Lambda Function: `nhc-cors-proxy`
6. Save

## Step 7: Deploy API

1. Click "Actions" → "Deploy API"
2. Deployment stage: "dev" (create new)
3. Deploy

## Step 8: Get API URL

Copy the Invoke URL from the deployment (looks like: `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev`)

## Step 9: Update Frontend

Add this to your environment or directly in nhcApi.ts:
```javascript
const getLambdaApiUrl = () => {
  return 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev';
};
```
