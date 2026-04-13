import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import CycloTrakIcon from './CycloTrakIcon'
import './Header.css'

const navLinks = [
  { to: '/',         label: 'Home',     icon: <HomeOutlinedIcon fontSize="small" /> },
  { to: '/forecast', label: 'Forecast', icon: <ShowChartOutlinedIcon fontSize="small" /> },
  { to: '/about',    label: 'About',    icon: <InfoOutlinedIcon fontSize="small" /> },
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

            <CycloTrakIcon size={34} />

            <div className="brand-text">
              <span className="brand-name">CycloTrak</span>
              <span className="brand-sub">Hurricane &amp; Cyclone Tracking</span>
            </div>
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
            <CycloTrakIcon size={28} />
            <h3>CycloTrak</h3>
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
