import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined'
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined'
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined'
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined'
import CloudQueueOutlinedIcon from '@mui/icons-material/CloudQueueOutlined'
import TornadoOutlinedIcon from '@mui/icons-material/TornadoOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined'
import './BottomNav.css'

const primaryTabs = [
  { to: '/',          label: 'Home',      icon: <HomeOutlinedIcon /> },
  { to: '/tracker',   label: 'Tracker',   icon: <TrackChangesOutlinedIcon /> },
  { to: '/satellite', label: 'Satellite', icon: <SatelliteAltOutlinedIcon /> },
  { to: '/forecast',  label: 'Forecast',  icon: <ShowChartOutlinedIcon /> },
]

const moreLinks = [
  { to: '/outlook',   label: 'Outlook',    icon: <WbSunnyOutlinedIcon /> },
  { to: '/models',    label: 'Models',     icon: <CloudQueueOutlinedIcon /> },
  { to: '/wind',      label: 'Wind Field', icon: <TornadoOutlinedIcon /> },
  { to: '/analytics', label: 'Analytics',  icon: <BarChartOutlinedIcon /> },
  { to: '/about',     label: 'About',      icon: <InfoOutlinedIcon /> },
]

const BottomNav = () => {
  const location = useLocation()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const isMoreActive = moreLinks.some(link => link.to === location.pathname)
  const closeMore = () => setIsMoreOpen(false)

  return (
    <>
      <div
        className={`bottom-sheet-overlay${isMoreOpen ? ' active' : ''}`}
        onClick={closeMore}
        aria-hidden="true"
      />

      <nav className={`more-sheet${isMoreOpen ? ' active' : ''}`} aria-label="More pages">
        <div className="more-sheet-handle" />
        <ul className="more-sheet-grid">
          {moreLinks.map(({ to, label, icon }) => (
            <li key={to}>
              <Link
                to={to}
                className={location.pathname === to ? 'active' : ''}
                onClick={closeMore}
              >
                <span className="more-sheet-icon">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav className="bottom-nav" aria-label="Primary mobile navigation">
        {primaryTabs.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            className={`bottom-nav-item${location.pathname === to ? ' active' : ''}`}
            onClick={closeMore}
          >
            <span className="bottom-nav-icon">{icon}</span>
            <span className="bottom-nav-label">{label}</span>
          </Link>
        ))}

        <button
          className={`bottom-nav-item bottom-nav-more${isMoreActive ? ' active' : ''}`}
          onClick={() => setIsMoreOpen(prev => !prev)}
          aria-label="More pages"
          aria-expanded={isMoreOpen}
        >
          <span className="bottom-nav-icon">
            <MoreHorizOutlinedIcon />
          </span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>
    </>
  )
}

export default BottomNav
