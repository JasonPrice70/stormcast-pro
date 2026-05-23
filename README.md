# CycloTrak

A modern, full-featured hurricane and tropical cyclone tracking application built with React and TypeScript. CycloTrak pulls live data from the National Hurricane Center (NHC) and overlays it on real-time satellite imagery from NASA GIBS, GOES-East, and Himawari — giving you a professional-grade view of active storms across all basins.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-4-646CFF?logo=vite&logoColor=white) ![AWS](https://img.shields.io/badge/AWS-Lambda%20%2B%20API%20Gateway-FF9900?logo=amazonaws&logoColor=white)

---

## Features

- **Live Storm Tracking** — Real-time hurricane and tropical cyclone positions sourced directly from the NHC RSS/API feeds, refreshed every 5 minutes
- **Interactive Maps** — Leaflet-based maps with storm tracks, 5-day forecast cones, historical paths, and wind radii
- **Real-time Satellite Imagery** — Live GOES-East GeoColor (Atlantic / East Pacific) and Himawari infrared (West Pacific) tiles via NASA GIBS
- **Multi-basin Support** — Atlantic, Eastern Pacific, and Western Pacific basin views
- **Invest Tracking** — Monitors tropical disturbances and invest areas before they become named storms
- **Weather Model Forecasts** — HWRF, HMON, GFS, ECMWF, and GEFS ensemble spaghetti model support
- **Wind Field Visualization** — Modeled wind speed probability fields
- **Satellite Page** — Dedicated full-screen satellite viewer
- **Analytics Dashboard** — Storm statistics and trend charts via Recharts
- **Responsive Design** — Mobile-friendly layout with a dark-themed UI
- **AWS Backend** — Lambda + API Gateway CORS proxy ensures reliable NHC data delivery without browser restrictions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Build | Vite 4 |
| Routing | React Router DOM v6 |
| Mapping | React Leaflet + Leaflet |
| Charts | Recharts |
| UI Components | MUI (Material UI) v7 + FontAwesome |
| HTTP | Axios |
| Dates | date-fns |
| Backend | AWS Lambda (Node.js 18) + API Gateway |
| Hosting | AWS Amplify |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/JasonPrice70/stormcast-pro.git
cd stormcast-pro
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
├── components/        # Shared UI components (Header, WindSpeedLegend, etc.)
├── hooks/             # Data-fetching hooks
│   ├── useNHCData.ts      # Live NHC storm data (auto-refreshes every 5 min)
│   ├── useInvestData.ts   # Tropical disturbance / invest tracking
│   ├── useHWRFData.ts     # HWRF model data
│   ├── useHMONData.ts     # HMON model data
│   ├── useGEFSEnsemble.ts # GEFS ensemble tracks
│   └── useGEFSSpaghetti.ts
├── pages/             # Route-level page components
│   ├── LandingPage.tsx    # Home — live satellite map + storm overview
│   ├── SimpleStormTracker.tsx  # Primary storm tracking map
│   ├── StormTracker.tsx   # Advanced tracker
│   ├── ForecastModels.tsx # Model comparison view
│   ├── WindFieldPage.tsx  # Wind probability field visualization
│   ├── SatellitePage.tsx  # Full-screen satellite imagery
│   ├── Analytics.tsx      # Storm statistics dashboard
│   └── About.tsx
├── services/
│   └── nhcApi.ts      # NHC API client (Lambda primary, CORS proxy fallback)
├── types/
│   └── nhc.ts         # TypeScript types for all storm data structures
└── utils/
    ├── windField.ts   # Wind field modeling utilities
    ├── windSpeed.ts   # Wind speed conversion helpers
    └── landMask.ts    # Land/ocean masking
```

---

## API & Data Sources

Data is fetched via an AWS Lambda CORS proxy that forwards requests to official meteorological sources:

| Source | Data |
|---|---|
| [National Hurricane Center](https://www.nhc.noaa.gov) | Active storms, forecast tracks, wind radii |
| [NASA GIBS](https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | GOES-East and Himawari satellite imagery tiles |
| GFS / ECMWF / HWRF / HMON | Forecast model guidance |
| GEFS Ensemble | Spaghetti model tracks |

The Lambda function (`nhc-cors-proxy`) is deployed on AWS API Gateway and acts as the primary data source. The app falls back to public CORS proxies if Lambda is unavailable.

---

## Available Routes

| Path | Page |
|---|---|
| `/` | Landing page with live satellite map |
| `/tracker` | Storm tracker (primary) |
| `/advanced` | Advanced storm tracker |
| `/forecast` | Forecast details |
| `/models` | Weather model comparison |
| `/wind` | Wind field visualization |
| `/satellite` | Full-screen satellite viewer |
| `/analytics` | Statistics dashboard |
| `/about` | About page |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | TypeScript check + production build |
| `npm run build:prod` | Production build (explicit mode) |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

---

## Disclaimer

> **This application is for informational purposes only.**
> Always rely on official sources — [NHC](https://www.nhc.noaa.gov), [NWS](https://www.weather.gov), and your local emergency management agency — for life-safety decisions. Never use this application as your sole source for emergency planning or evacuation decisions.

---

## Acknowledgments

- [National Hurricane Center / NOAA](https://www.nhc.noaa.gov) for official storm data
- [NASA GIBS / Worldview](https://worldview.earthdata.nasa.gov) for satellite imagery
- [OpenStreetMap](https://www.openstreetmap.org) contributors and CartoDB for base map tiles
- [Leaflet](https://leafletjs.com) for the mapping library
- [Recharts](https://recharts.org) for data visualization
