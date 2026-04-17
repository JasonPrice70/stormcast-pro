import { Link } from 'react-router-dom'
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined'
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import SimpleHeader from '../components/SimpleHeader'
import './About.css'

const dataSources = [
  {
    icon: <TrackChangesOutlinedIcon />,
    title: 'National Hurricane Center',
    desc: 'Official storm advisories, forecast cones, wind radii, and storm surge data directly from NOAA/NHC.',
  },
  {
    icon: <SatelliteAltOutlinedIcon />,
    title: 'NASA GIBS / GOES-East',
    desc: 'Live GeoColor and infrared satellite composites from GOES-East via NASA\'s Global Imagery Browse Services.',
  },
  {
    icon: <HubOutlinedIcon />,
    title: 'GEFS Ensemble Models',
    desc: 'Global Ensemble Forecast System spaghetti tracks for probabilistic path guidance.',
  },
  {
    icon: <TuneOutlinedIcon />,
    title: 'HWRF & HMON Models',
    desc: 'Hurricane Weather Research & Forecasting and Hurricanes in a Multi-scale Ocean-coupled Non-hydrostatic model intensity guidance.',
  },
]

const techStack = [
  'React 18', 'TypeScript', 'Vite', 'Leaflet / React-Leaflet',
  'AWS Amplify', 'NASA GIBS', 'NOAA NHC API', 'PostHog Analytics',
]

const About = () => {
  return (
    <div className="about-page">
      <SimpleHeader />

      {/* ── Hero ── */}
      <section className="ab-hero">
        <div className="ab-hero-glow" />
        <div className="ab-hero-content">
          <p className="ab-eyebrow">ABOUT CYCLOTRAK</p>
          <h1 className="ab-headline">
            Built for the storms<br />
            <span className="ab-accent">that matter most.</span>
          </h1>
          <p className="ab-subheadline">
            CycloTrak is a professional hurricane tracking platform delivering real-time
            satellite imagery, NHC official data, and multi-model ensemble guidance
            — all in one place.
          </p>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="ab-section">
        <div className="ab-inner">
          <p className="ab-label">MISSION</p>
          <div className="ab-mission-card">
            <div className="ab-mission-icon"><GpsFixedOutlinedIcon /></div>
            <div>
              <h2>Keeping people informed when it counts.</h2>
              <p>
                CycloTrak exists to give communities, emergency planners, and weather
                enthusiasts access to the best available storm data — presented clearly,
                updated continuously, and available on any device. When a storm is
                approaching, there's no time for complicated tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Dev Behind the Data ── */}
      <section className="ab-section ab-section-alt">
        <div className="ab-inner">
          <p className="ab-label">THE DEV BEHIND THE DATA</p>
          <div className="ab-dev-card">
            <img
              src="/jason-price.jpg"
              alt="Jason Price"
              className="ab-dev-avatar"
            />
            <div className="ab-dev-bio">
              <h2>Jason Price</h2>
              <p>
                Jason has been writing code since <strong>1984</strong> — starting with
                Applesoft Basic on an Apple II and never really stopping. He spent his
                entire career in software, cutting his teeth on the Microsoft stack from
                Visual Basic through the full .NET ecosystem.
              </p>
              <p>
                Today he works in the <strong>Energy &amp; Utilities</strong> space, where
                a passion for emerging technologies drives him to continuously find better
                ways to build and deliver. CycloTrak is entirely his own work — a personal
                project born from a conviction that hurricane data can be presented more
                clearly, accessibly, and usefully than it currently is.
              </p>
              <p>
                This site has no corporate backing. Every line of code, every design
                decision, and every data pipeline was built by Jason — with the goal of
                giving people better situational awareness when a storm is bearing down.
              </p>
              <div className="ab-dev-contact">
                <span className="ab-contact-icon"><EmailOutlinedIcon /></span>
                <div>
                  <p className="ab-contact-label">Get in touch</p>
                  <a href="mailto:jason.cyclotrak@gmail.com" className="ab-contact-link">
                    jason.cyclotrak@gmail.com
                  </a>
                </div>
              </div>
              <p className="ab-contact-note" style={{ marginTop: 10 }}>
                Feedback, bug reports, and feature suggestions are always welcome.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Data Sources ── */}
      <section className="ab-section">
        <div className="ab-inner">
          <p className="ab-label">DATA SOURCES</p>
          <h2 className="ab-section-title">Official data. Live feeds.</h2>
          <div className="ab-grid">
            {dataSources.map(({ icon, title, desc }) => (
              <div className="ab-card" key={title}>
                <span className="ab-card-icon">{icon}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="ab-section">
        <div className="ab-inner">
          <p className="ab-label">TECHNOLOGY</p>
          <h2 className="ab-section-title">Modern stack, reliable delivery.</h2>
          <p className="ab-body-text">
            Built with React and TypeScript on Vite, deployed globally on AWS Amplify,
            and powered by open geospatial standards. Every layer of the stack is chosen
            for performance and reliability during peak storm-season traffic.
          </p>
          <div className="ab-pills">
            {techStack.map(t => (
              <span className="ab-pill" key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>



      {/* ── Disclaimer ── */}
      <section className="ab-section">
        <div className="ab-inner">
          <div className="ab-disclaimer">
            <span className="ab-disclaimer-icon"><WarningAmberOutlinedIcon /></span>
            <div>
              <h3>Important Disclaimer</h3>
              <p>
                CycloTrak is for <strong>informational purposes only</strong>. Always follow
                guidance from the{' '}
                <a
                  href="https://www.nhc.noaa.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ab-inline-link"
                >
                  National Hurricane Center
                </a>{' '}
                and local emergency management officials for evacuation orders and
                life-safety decisions. Do not rely solely on this tool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="ab-banner">
        <div className="ab-banner-inner">
          <h2>Ready to track the storm?</h2>
          <p>Open the live tracker and see what's active right now.</p>
          <Link to="/tracker" className="ab-cta">Launch Storm Tracker →</Link>
        </div>
      </section>
    </div>
  )
}

export default About
