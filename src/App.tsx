import { Routes, Route } from 'react-router-dom'
import SimpleStormTracker from './pages/SimpleStormTracker'
import Forecast from './pages/Forecast'
import About from './pages/About'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<SimpleStormTracker />} />
        <Route path="/tracker" element={<SimpleStormTracker />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<SimpleStormTracker />} />
      </Routes>
    </div>
  )
}

export default App
