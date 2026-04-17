import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined'
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import AirOutlinedIcon from '@mui/icons-material/AirOutlined'
import RadarOutlinedIcon from '@mui/icons-material/RadarOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import SimpleHeader from '../components/SimpleHeader'
import { useNHCData } from '../hooks/useNHCData'
import { useInvestData } from '../hooks/useInvestData'
import './LandingPage.css'

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'

const BASINS = [
  {
    id: 'atlantic',
    label: 'Atlantic',
    badge: 'GOES-EAST LIVE',
    layer: 'GOES-East_ABI_GeoColor',
    center: [22, -62] as [number, number],
    zoom: 3,
  },
  {
    id: 'epacific',
    label: 'E. Pacific',
    badge: 'GOES-EAST LIVE',
    layer: 'GOES-East_ABI_GeoColor',
    center: [15, -110] as [number, number],
    zoom: 3,
  },
  {
    id: 'wpacific',
    label: 'W. Pacific',
    badge: 'HIMAWARI LIVE',
    layer: 'Himawari_AHI_Band13_Clean_Infrared',
    center: [20, 140] as [number, number],
    zoom: 3,
  },
]

function getGIBSTime(): string {
  const d = new Date()
  d.setUTCMinutes(d.getUTCMinutes() - 30)
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 10) * 10, 0, 0)
  return d.toISOString().slice(0, 19) + 'Z'
}

function FlyToView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.2 })
  }, [center[0], center[1], zoom])
  return null
}

const LandingPage = () => {
  const { storms, loading: stormsLoading } = useNHCData({ fetchTrackData: false })
  const { invests, loading: investsLoading } = useInvestData()
  const [activeBasin, setActiveBasin] = useState(BASINS[0])
  const [tileTime, setTileTime] = useState(getGIBSTime)
  const [scrolled, setScrolled] = useState(false)

  const satelliteUrl = `${GIBS_BASE}/${activeBasin.layer}/default/${tileTime}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`

  useEffect(() => {
    const id = setInterval(() => setTileTime(getGIBSTime()), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const activeStorms = stormsLoading ? '—' : storms.length
  const activeInvests = investsLoading ? '—' : invests.length

  return (
    <div className="landing-page">
      <SimpleHeader />

      {/* ── Hero ── */}
      <section className="lp-hero">

        {/* Live satellite map background */}
        <div className="lp-map-bg">
          <MapContainer
            center={activeBasin.center}
            zoom={activeBasin.zoom}
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            keyboard={false}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer url={DARK_TILES} />
            <TileLayer key={satelliteUrl} url={satelliteUrl} opacity={0.82} />
            <FlyToView center={activeBasin.center} zoom={activeBasin.zoom} />
          </MapContainer>
        </div>

        {/* Gradient scrim */}
        <div className="lp-scrim" />

        {/* Basin selector */}
        <div className="lp-basin-selector">
          {BASINS.map(b => (
            <button
              key={b.id}
              className={`lp-basin-btn${activeBasin.id === b.id ? ' active' : ''}`}
              onClick={() => setActiveBasin(b)}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Hero content */}
        <div className="lp-hero-content">
          <div className="lp-live-badge">
            <span className="lp-live-dot" />
            {activeBasin.badge}
          </div>

          <h1 className="lp-headline">
            Track Every Storm.<br />
            <span className="lp-headline-accent">Before It Hits.</span>
          </h1>

          <p className="lp-subheadline">
            Real-time hurricane tracking with GOES satellite imagery,
            NHC official forecasts, and multi-model ensemble guidance.
          </p>

          {/* Live counters */}
          <div className="lp-counters">
            <div className="lp-counter">
              <span className="lp-counter-num">{activeStorms}</span>
              <span className="lp-counter-label">Active Storms</span>
            </div>
            <div className="lp-counter-divider" />
            <div className="lp-counter">
              <span className="lp-counter-num">{activeInvests}</span>
              <span className="lp-counter-label">Invest Areas</span>
            </div>
            <div className="lp-counter-divider" />
            <div className="lp-counter">
              <span className="lp-counter-num">{new Date().getFullYear()}</span>
              <span className="lp-counter-label">Season</span>
            </div>
          </div>

          <div className="lp-ctas">
            <Link to="/tracker" className="lp-cta-primary">
              Open Storm Tracker
            </Link>
            <Link to="/forecast" className="lp-cta-secondary">
              View Forecast
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className={`lp-scroll-hint${scrolled ? ' hidden' : ''}`}>
          <span>Explore Features</span>
          <div className="lp-scroll-arrow" />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-features">
        <div className="lp-features-inner">
          <p className="lp-section-label">WHAT'S INSIDE</p>
          <h2 className="lp-section-title">Professional-grade tools,<br />built for storm season.</h2>

          <div className="lp-grid">
            <div className="lp-card">
              <div className="lp-card-icon"><SatelliteAltOutlinedIcon /></div>
              <h3>GOES Satellite Imagery</h3>
              <p>Live GOES-East GeoColor and infrared composites updated every 10 minutes directly from NASA GIBS.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><TrackChangesOutlinedIcon /></div>
              <h3>NHC Official Tracks</h3>
              <p>Cone of uncertainty, forecast points, wind radii, and storm surge zones from the National Hurricane Center.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><HubOutlinedIcon /></div>
              <h3>Ensemble Models</h3>
              <p>GEFS spaghetti tracks alongside HWRF and HMON intensity guidance — all in one interactive map.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><AirOutlinedIcon /></div>
              <h3>Wind Probabilities</h3>
              <p>34, 50, and 64-knot wind speed probability fields with arrival time overlays for active storms.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><RadarOutlinedIcon /></div>
              <h3>Invest Monitoring</h3>
              <p>Track pre-season disturbances and invest areas with development probability data.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-icon"><BarChartOutlinedIcon /></div>
              <h3>Analytics Dashboard</h3>
              <p>Historical storm archive with intensity charts, track analysis, and season statistics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="lp-banner">
        <div className="lp-banner-inner">
          <h2>Ready for storm season?</h2>
          <p>Open the tracker and see what's active in the Atlantic right now.</p>
          <Link to="/tracker" className="lp-cta-primary">Launch Storm Tracker →</Link>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
