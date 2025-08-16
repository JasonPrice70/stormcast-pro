import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Header.css'

const SimpleHeader = () => {
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <>
      <header className="header">
        <div className="container">
          <div className="header-content">
            {/* Hamburger Menu Button - Moved to Left */}
            <button 
              className={`hamburger ${isMenuOpen ? 'active' : ''}`}
              onClick={toggleMenu}
              aria-label="Toggle navigation menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            
            <div className="header-text">
              <h1>Hurricane Command Center</h1>
              <p>Professional Hurricane & Tropical Cyclone Tracking</p>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Menu Overlay */}
      <div className={`menu-overlay ${isMenuOpen ? 'active' : ''}`} onClick={closeMenu}></div>
      
      {/* Slide-out Navigation Menu - Coming from Left */}
      <nav className={`slide-menu ${isMenuOpen ? 'active' : ''}`}>
        <div className="slide-menu-header">
          <h3>Navigation</h3>
          <button className="close-btn" onClick={closeMenu} aria-label="Close menu">
            ×
          </button>
        </div>
        
        <ul className="slide-menu-items">
          <li>
            <Link 
              to="/" 
              className={location.pathname === '/' ? 'active' : ''}
              onClick={closeMenu}
            >
              <span className="menu-icon">🏠</span>
              Home
            </Link>
          </li>
          <li>
            <Link 
              to="/tracker" 
              className={location.pathname === '/tracker' ? 'active' : ''}
              onClick={closeMenu}
            >
              <span className="menu-icon">🌪️</span>
              Storm Tracker
            </Link>
          </li>
          <li>
            <Link 
              to="/forecast" 
              className={location.pathname === '/forecast' ? 'active' : ''}
              onClick={closeMenu}
            >
              <span className="menu-icon">📊</span>
              Forecast
            </Link>
          </li>
          <li>
            <Link 
              to="/about" 
              className={location.pathname === '/about' ? 'active' : ''}
              onClick={closeMenu}
            >
              <span className="menu-icon">ℹ️</span>
              About
            </Link>
          </li>
        </ul>
      </nav>
    </>
  )
}

export default SimpleHeader
