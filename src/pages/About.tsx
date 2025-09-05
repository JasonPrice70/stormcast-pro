import SimpleHeader from '../components/SimpleHeader'
import '../App.css'

const About = () => {
  return (
    <div className="page">
      <SimpleHeader />
      <div className="container" style={{ padding: '40px 20px' }}>
        <div className="hero">
          <h1>About Cyclotrak</h1>
          <p>Professional Hurricane & Tropical Cyclone Tracking Platform</p>
        </div>

        <div className="content">
          <section className="storm-info">
            <h2>Mission Statement</h2>
            <p>
              Cyclotrak is dedicated to providing accurate, real-time hurricane and tropical cyclone 
              tracking information to help communities, emergency responders, and researchers stay 
              informed about developing weather threats.
            </p>
          </section>

          <section className="storm-info">
            <h2>Data Sources</h2>
            <ul>
              <li><strong>National Hurricane Center (NHC)</strong> - Official storm advisories and forecasts</li>
              <li><strong>Weather Models</strong> - GFS, ECMWF, HWRF, and other meteorological models</li>
              <li><strong>Satellite Data</strong> - Real-time satellite imagery and analysis</li>
              <li><strong>Observational Data</strong> - Hurricane hunter aircraft and weather stations</li>
            </ul>
          </section>

          <section className="storm-info">
            <h2>Features</h2>
            <div className="forecast-grid">
              <div className="forecast-card">
                <h3>🗺️ Interactive Maps</h3>
                <p>Real-time storm tracking with forecast cones, wind probability zones, and storm surge data.</p>
              </div>
              <div className="forecast-card">
                <h3>📊 Data Visualization</h3>
                <p>Charts and graphs showing storm intensity, pressure trends, and forecast models.</p>
              </div>
              <div className="forecast-card">
                <h3>🌪️ Multi-Storm Tracking</h3>
                <p>Monitor multiple active storms simultaneously across all ocean basins.</p>
              </div>
              <div className="forecast-card">
                <h3>⚡ Real-time Updates</h3>
                <p>Automatic data refresh to ensure you have the latest storm information.</p>
              </div>
            </div>
          </section>

          <section className="storm-info">
            <h2>Technology</h2>
            <p>
              Built with modern web technologies including React, TypeScript, Leaflet mapping, 
              and AWS cloud infrastructure for reliable, scalable storm tracking.
            </p>
          </section>

          <section className="storm-info">
            <h2>Contact Information</h2>
            <p>
              For questions, feedback, or technical support regarding Cyclotrak, please reach out:
            </p>
            <div className="contact-info">
              <p>
                <strong>📧 Email:</strong> 
                <a href="mailto:jason.cyclotrak@gmail.com" style={{
                  color: '#1a237e',
                  textDecoration: 'none',
                  marginLeft: '8px'
                }}>
                  jason.cyclotrak@gmail.com
                </a>
              </p>
              <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
                We welcome your feedback and suggestions to help improve Cyclotrak's storm tracking capabilities.
              </p>
            </div>
          </section>

          <section className="storm-info">
            <h2>Disclaimer</h2>
            <p>
              <strong>⚠️ Important:</strong> This application is for informational purposes only. 
              Always consult official sources like the National Hurricane Center for authoritative 
              storm information and evacuation guidance. Do not rely solely on this tool for 
              life-safety decisions.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default About
