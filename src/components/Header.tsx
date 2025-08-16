import { Link, useLocation } from 'react-router-dom'
import './Header.css'

const Header = () => {
  const location = useLocation()

  return (
    <header className="header">
      <div className="container">
        <h1>Hurricane Command Center</h1>
        <p>Professional Hurricane & Tropical Cyclone Tracking</p>
        <nav>
          <ul className="nav">
            <li>
              <Link 
                to="/" 
                className={location.pathname === '/' ? 'active' : ''}
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                to="/tracker" 
                className={location.pathname === '/tracker' ? 'active' : ''}
              >
                Storm Tracker
              </Link>
            </li>
            <li>
              <Link 
                to="/forecast" 
                className={location.pathname === '/forecast' ? 'active' : ''}
              >
                Forecast
              </Link>
            </li>
            <li>
              <Link 
                to="/about" 
                className={location.pathname === '/about' ? 'active' : ''}
              >
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Header
