# NHC CORS Proxy Server

A simple Express.js server that acts as a CORS proxy for the National Hurricane Center (NHC) API, allowing browser-based applications to access hurricane data without CORS restrictions.

## Quick Start

1. Install dependencies:
```bash
cd proxy-server
npm install
```

2. Start the server:
```bash
npm start
```

3. The server will be running at `http://localhost:3001`

## Deployment Options

### Option 1: Railway (Recommended)
1. Push this `proxy-server` folder to a GitHub repository
2. Sign up at [Railway](https://railway.app)
3. Connect your GitHub repo and deploy
4. Railway will automatically detect the Node.js app and deploy it

### Option 2: Render
1. Push this `proxy-server` folder to a GitHub repository
2. Sign up at [Render](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repo and deploy

### Option 3: Heroku
1. Install Heroku CLI
2. Create a new Heroku app
3. Deploy using Git

### Option 4: AWS Lambda (Alternative)
If you want to use AWS Lambda, you can convert this Express app to serverless functions.

## API Endpoints

- `GET /health` - Health check
- `GET /api/active-storms` - Get active storms from NHC
- `GET /api/forecast-track/:stormId` - Get forecast track for specific storm
- `GET /api/historical-track/:stormId` - Get historical track for specific storm  
- `GET /api/forecast-cone/:stormId` - Get forecast cone for specific storm
- `GET /api/proxy?url=<nhc-url>` - Generic proxy for any NHC URL

## Environment Variables

- `PORT` - Server port (default: 3001)

## Usage in StormCast Pro

Once deployed, update your `nhcApi.ts` file to use this proxy server instead of the public CORS proxies.
