import './HomePage.css'
import SimpleHeader from '../components/SimpleHeader';

const SimpleHomePage = () => {
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
            </p>
          </div>

          <div className="forecast-card">
            <h3>📊 Advanced Forecasting</h3>
            <p>
              Access detailed forecast models and storm path predictions up to 5 days in advance.
            </p>
          </div>

          <div className="forecast-card">
            <h3>🗺️ Interactive Maps</h3>
            <p>
              Visualize storm paths and intensity changes on our interactive map interface.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleHomePage
