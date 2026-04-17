import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import './Header.css'

const navLinks = [
  { to: '/',           label: 'Home',      icon: <HomeOutlinedIcon fontSize="small" /> },
  { to: '/tracker',    label: 'Tracker',   icon: <TrackChangesOutlinedIcon fontSize="small" /> },
  { to: '/satellite',  label: 'Satellite', icon: <SatelliteAltOutlinedIcon fontSize="small" /> },
  { to: '/forecast',   label: 'Forecast',  icon: <ShowChartOutlinedIcon fontSize="small" /> },
  { to: '/analytics',  label: 'Analytics', icon: <BarChartOutlinedIcon fontSize="small" /> },
  { to: '/about',      label: 'About',     icon: <InfoOutlinedIcon fontSize="small" /> },
]

interface SimpleHeaderProps {
  layersPanelOpen?: boolean
  onLayersToggle?: () => void
}

const SimpleHeader = ({ layersPanelOpen = false, onLayersToggle }: SimpleHeaderProps) => {
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => setIsMenuOpen(prev => !prev)
  const closeMenu  = () => setIsMenuOpen(false)

  return (
    <>
      <header className="header">
        <div className="header-inner">

          {/* ── Left: hamburger + brand ── */}
          <div className="header-brand">
            <button
              className={`hamburger${isMenuOpen ? ' active' : ''}`}
              onClick={toggleMenu}
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

            <img
              src="/cyclotrak-logo.svg"
              alt="CycloTrak"
              style={{ height: '58px', width: '239px', display: 'block' }}
            />
          </div>

          {/* ── Right: layers button ── */}
          {onLayersToggle && (
            <button
              className={`header-layers-btn${layersPanelOpen ? ' active' : ''}`}
              onClick={onLayersToggle}
              aria-label={layersPanelOpen ? 'Close Layers Panel' : 'Open Layers Panel'}
              aria-expanded={layersPanelOpen}
            >
              <LayersOutlinedIcon fontSize="small" />
              <span>Layers</span>
            </button>
          )}

        </div>
      </header>

      {/* Overlay */}
      <div
        className={`menu-overlay${isMenuOpen ? ' active' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Slide-out Navigation */}
      <nav className={`slide-menu${isMenuOpen ? ' active' : ''}`} aria-label="Slide-out navigation">
        <div className="slide-menu-header">
          <div className="slide-menu-brand">
            <img
              src="/cyclotrak-logo.svg"
              alt="CycloTrak"
              style={{ height: '30px', width: '124px', display: 'block' }}
            />
          </div>
          <button className="hamburger-close" onClick={closeMenu} aria-label="Close menu">
            <CloseOutlinedIcon />
          </button>
        </div>

        <ul className="slide-menu-items">
          {navLinks.map(({ to, label, icon }) => (
            <li key={to}>
              <Link
                to={to}
                className={location.pathname === to ? 'active' : ''}
                onClick={closeMenu}
              >
                <span className="menu-icon">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

export default SimpleHeader
