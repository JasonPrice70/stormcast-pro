# 🌪️ StormCast Pro

A modern React application for tracking hurricanes and tropical cyclones with real-time data from the National Hurricane Center.

## 🚀 Features

- **Real-time Storm Tracking**: Live hurricane and tropical cyclone positions
- **Interactive Maps**: Leaflet-based mapping with storm paths and forecast cones
- **Weather Model Visualization**: Multiple forecast models (GFS, ECMWF, HWRF, etc.)
- **Data Visualization**: Charts showing wind speeds, pressure, and forecast trends
- **Responsive Design**: Mobile-friendly interface
- **Official Data Integration**: NHC and other meteorological agency data

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Mapping**: React Leaflet + Leaflet
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Date Handling**: date-fns
- **Styling**: CSS3 with CSS Variables

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd stormcast-pro
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## 🏗️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Header.tsx      # Navigation header
├── pages/              # Page components
│   ├── HomePage.tsx    # Landing page
│   ├── StormTracker.tsx # Storm tracking page
│   ├── Forecast.tsx    # Forecast models page
│   └── About.tsx       # About page
├── App.tsx             # Main app component
├── main.tsx           # App entry point
├── App.css            # Global styles
└── index.css          # Base styles
```

## 🌐 API Integration

The application is designed to integrate with:
- **National Hurricane Center (NHC)** APIs
- **Central Pacific Hurricane Center (CPHC)** data
- **Global Forecast System (GFS)** models
- **European Centre (ECMWF)** models
- **Hurricane Weather Research and Forecasting (HWRF)** models

*Note: Currently using mock data for demonstration. Production implementation requires API keys and proper error handling.*

## 🎯 Usage

1. **Home Page**: Overview of features and current storm activity
2. **Storm Tracker**: Interactive map showing active storms and their forecast paths
3. **Forecast**: Detailed weather model comparisons and intensity forecasts
4. **About**: Information about the application and data sources

## ⚠️ Important Disclaimer

**This application is for educational and informational purposes only.**

- Always rely on official sources (NHC, NWS, local emergency management) for life-safety decisions
- Never use this application as your sole source for emergency planning
- Follow official evacuation orders and weather warnings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] Real API integration with NHC data
- [ ] WebSocket connections for real-time updates
- [ ] Push notifications for storm alerts
- [ ] Historical storm data analysis
- [ ] Advanced forecast model comparisons
- [ ] Mobile app development
- [ ] Offline functionality
- [ ] Storm surge modeling

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **National Hurricane Center** for providing official storm data
- **OpenStreetMap** contributors for mapping data
- **React Community** for excellent documentation and tools
- **Leaflet** for the mapping library
- **Recharts** for data visualization components

## 📞 Official Weather Sources

- [National Hurricane Center](https://www.nhc.noaa.gov)
- [National Weather Service](https://www.weather.gov)
- [NOAA Hurricane Database](https://www.aoml.noaa.gov/hrd/hurdat/)

---

**Remember: For emergency situations, always contact local emergency services or follow evacuation orders from official authorities.**
