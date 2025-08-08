import { Link } from 'react-router-dom'
import './HomePage.css'
import SimpleHeader from '../components/SimpleHeader';

const HomePage = () => {
  return (
    <div className="home-page">
        <SimpleHeader />
      <div className="hero">
        <h1>Welcome to CycloTrak</h1>
        <p>Real-time hurricane and tropical cyclone tracking with official National Hurricane Center data</p>
      </div>

      <div className="features">
        <div className="forecast-grid">
          <div className="forecast-card">
            <h3>🌀 Real-time Tracking</h3>
            <p>
              Track active hurricanes and tropical cyclones with live data from the National Hurricane Center.
              Get accurate position updates, wind speeds, and storm categories.
            </p>
            <Link to="/tracker">
              <button>View Storm Tracker</button>
            </Link>
          </div>

          <div className="forecast-card">
            <h3>📊 Advanced Forecasting</h3>
            <p>
              Access detailed forecast models, cone of uncertainty projections, and storm path predictions
              up to 5 days in advance.
            </p>
            <Link to="/forecast">
              <button>View Forecasts</button>
            </Link>
          </div>

          <div className="forecast-card">
            <h3>🗺️ Interactive Maps</h3>
            <p>
              Visualize storm paths, intensity changes, and affected areas on our interactive map interface
              powered by the latest meteorological data.
            </p>
            <Link to="/tracker">
              <button>Explore Maps</button>
            </Link>
          </div>
        </div>
      </div>

      <div className="storm-info">
        <h3>🚨 Current Storm Activity</h3>
        <p>
          Stay informed with the latest tropical cyclone activity in the Atlantic, Pacific, and other ocean basins.
          Our system integrates directly with official weather services to provide you with the most accurate
          and up-to-date information available.
        </p>
        <p>
          <strong>Data Sources:</strong> National Hurricane Center (NHC), Central Pacific Hurricane Center (CPHC),
          and other official meteorological agencies.
        </p>
      </div>
    </div>
  )
}

export default HomePage
