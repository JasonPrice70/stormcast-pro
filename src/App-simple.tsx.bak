import { Routes, Route } from 'react-router-dom'
import SimpleHeader from './components/SimpleHeader'
import SimpleHomePage from './pages/SimpleHomePage'
import SimpleStormTracker from './pages/SimpleStormTracker'
import Forecast from './pages/Forecast'
import About from './pages/About'

function App() {
  return (
    <div>
      {/*<SimpleHeader />*/}
      <main>
        <Routes>
          <Route path="/" element={<SimpleHomePage />} />
          <Route path="/tracker" element={<SimpleStormTracker />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
