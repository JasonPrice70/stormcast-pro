import { Routes, Route } from 'react-router-dom'
import SimpleStormTracker from './pages/SimpleStormTracker'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<SimpleStormTracker />} />
        <Route path="/tracker" element={<SimpleStormTracker />} />
        <Route path="*" element={<SimpleStormTracker />} />
      </Routes>
    </div>
  )
}

export default App
