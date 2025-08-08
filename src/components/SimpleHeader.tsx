import { Link, useLocation } from 'react-router-dom'
import './Header.css'

const SimpleHeader = () => {
  const location = useLocation()

  return (
    <header className="header">
      <div className="container">
        <div>
          <h1>🌪️ CycloTrak</h1>
          <p>Professional Hurricane & Tropical Cyclone Tracking</p>
        </div>
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

export default SimpleHeader
