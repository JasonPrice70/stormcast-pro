import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SimpleStormTracker from './pages/SimpleStormTracker'
import StormTracker from './pages/StormTracker'
import Forecast from './pages/Forecast'
import ForecastModels from './pages/ForecastModels'
import WindFieldPage from './pages/WindFieldPage'
import About from './pages/About'
import Analytics from './pages/Analytics'
import SatellitePage from './pages/SatellitePage'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/tracker" element={<SimpleStormTracker />} />
        <Route path="/advanced" element={<StormTracker />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/models" element={<ForecastModels />} />
        <Route path="/wind" element={<WindFieldPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/satellite" element={<SatellitePage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </div>
  )
}

export default App
