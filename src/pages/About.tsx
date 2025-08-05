import React from 'react'
import '../App.css'
import SimpleHeader from '../components/SimpleHeader';

const About = () => {
  return (
    <div className="about-page">
        <SimpleHeader />
      <h2>About StormCast Pro</h2>
      
      <div className="hero">
        <h3>🌪️ Professional Hurricane Tracking & Forecasting</h3>
        <p>
          StormCast Pro is a comprehensive platform for tracking and analyzing tropical cyclones,
          hurricanes, and severe weather systems using official data from the National Hurricane Center
          and other meteorological agencies.
        </p>
      </div>

      <div className="forecast-grid">
        <div className="forecast-card">
          <h3>🎯 Our Mission</h3>
          <p>
            To provide accurate, real-time tropical cyclone information to help communities, 
            emergency managers, and weather enthusiasts make informed decisions during hurricane season.
          </p>
        </div>

        <div className="forecast-card">
          <h3>📡 Data Sources</h3>
          <ul style={{ textAlign: 'left' }}>
            <li>National Hurricane Center (NHC)</li>
            <li>Central Pacific Hurricane Center (CPHC)</li>
            <li>Global Forecast System (GFS)</li>
            <li>European Centre for Medium-Range Weather Forecasts (ECMWF)</li>
            <li>Hurricane Weather Research and Forecasting Model (HWRF)</li>
          </ul>
        </div>

        <div className="forecast-card">
          <h3>🛠️ Technology Stack</h3>
          <ul style={{ textAlign: 'left' }}>
            <li>React + TypeScript for the frontend</li>
            <li>Leaflet for interactive mapping</li>
            <li>Recharts for data visualization</li>
            <li>Real-time API integration</li>
            <li>Responsive design for all devices</li>
          </ul>
        </div>

        <div className="forecast-card">
          <h3>⚡ Features</h3>
          <ul style={{ textAlign: 'left' }}>
            <li>Real-time storm tracking</li>
            <li>Interactive forecast maps</li>
            <li>Multiple weather model comparisons</li>
            <li>Historical storm data</li>
            <li>Mobile-friendly interface</li>
            <li>Automated data updates</li>
          </ul>
        </div>
      </div>

      <div className="storm-info">
        <h3>🚨 Important Disclaimer</h3>
        <p>
          <strong>This application is for educational and informational purposes only.</strong>
        </p>
        <p>
          While StormCast Pro strives to provide accurate and timely information, users should always
          rely on official sources such as the National Hurricane Center, National Weather Service,
          and local emergency management agencies for official warnings, watches, and evacuation orders.
        </p>
        <p>
          <strong>Never use this application as your sole source for life-safety decisions.</strong>
          Always follow the guidance of local emergency management officials and meteorologists.
        </p>
      </div>

      <div className="storm-info">
        <h3>📞 Official Sources</h3>
        <ul style={{ textAlign: 'left' }}>
          <li><strong>National Hurricane Center:</strong> <a href="https://www.nhc.noaa.gov" target="_blank" rel="noopener noreferrer">nhc.noaa.gov</a></li>
          <li><strong>National Weather Service:</strong> <a href="https://www.weather.gov" target="_blank" rel="noopener noreferrer">weather.gov</a></li>
          <li><strong>NOAA Hurricane Database:</strong> <a href="https://www.aoml.noaa.gov/hrd/hurdat/" target="_blank" rel="noopener noreferrer">aoml.noaa.gov/hrd/hurdat</a></li>
          <li><strong>Weather Underground:</strong> <a href="https://www.wunderground.com" target="_blank" rel="noopener noreferrer">wunderground.com</a></li>
        </ul>
      </div>

      <div className="forecast-grid">
        <div className="forecast-card">
          <h3>🌊 Hurricane Preparedness</h3>
          <p>
            Hurricane season runs from June 1 to November 30 in the Atlantic basin.
            Stay prepared by having an emergency plan, emergency kit, and staying informed
            about weather conditions in your area.
          </p>
        </div>

        <div className="forecast-card">
          <h3>📈 Climate Change Impact</h3>
          <p>
            Climate change is affecting hurricane patterns, with studies showing trends toward
            more intense storms and changing storm tracks. Stay informed about the latest
            research and its implications for your region.
          </p>
        </div>
      </div>

      <div className="storm-info">
        <h3>🤝 Contact & Support</h3>
        <p>
          StormCast Pro is developed as an educational project to demonstrate modern web technologies
          applied to meteorological data visualization. For questions about the application or
          to report issues, please contact our development team.
        </p>
        <p>
          <strong>Remember:</strong> For emergency situations, always contact local emergency services
          or follow evacuation orders from official authorities.
        </p>
      </div>
    </div>
  )
}

export default About
