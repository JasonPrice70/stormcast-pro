import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import WavesOutlinedIcon from '@mui/icons-material/WavesOutlined'
import SimpleHeader from '../components/SimpleHeader'
import './Forecast.css'

const mockForecastData = [
  { day: 'Day 1', windSpeed: 115, pressure: 960 },
  { day: 'Day 2', windSpeed: 120, pressure: 955 },
  { day: 'Day 3', windSpeed: 125, pressure: 950 },
  { day: 'Day 4', windSpeed: 130, pressure: 945 },
  { day: 'Day 5', windSpeed: 110, pressure: 965 },
]

const mockIntensityData = [
  { time: '00Z', windSpeed: 115 },
  { time: '06Z', windSpeed: 118 },
  { time: '12Z', windSpeed: 120 },
  { time: '18Z', windSpeed: 125 },
  { time: '24Z', windSpeed: 130 },
]

const MODEL_INFO: Record<string, { name: string; resolution: string; updateFreq: string; range: string; note?: string }> = {
  GFS:      { name: 'Global Forecast System',                       resolution: '13 km globally',          updateFreq: 'Every 6 hours',  range: 'Up to 16 days' },
  ECMWF:    { name: 'European Centre Model',                        resolution: '9 km globally',           updateFreq: 'Every 12 hours', range: 'Up to 10 days' },
  HWRF:     { name: 'Hurricane Weather Research & Forecasting',     resolution: '2 km in storm core',      updateFreq: 'Every 6 hours',  range: 'Up to 5 days',  note: 'Specialized for tropical cyclones' },
  NAM:      { name: 'North American Mesoscale Model',               resolution: '12 km over North America',updateFreq: 'Every 6 hours',  range: 'Up to 84 hours' },
  Ensemble: { name: 'Ensemble Forecast',                            resolution: 'Multiple model runs',     updateFreq: 'Every 6 hours',  range: 'Probabilistic',  note: 'Shows forecast uncertainty across many runs' },
}

const chartTooltipStyle = {
  backgroundColor: '#0a1628',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: '8px',
  color: '#e8f4ff',
}

const Forecast = () => {
  const [selectedModel, setSelectedModel] = useState('GFS')

  useEffect(() => {
    console.log('Fetching forecast data for model:', selectedModel)
  }, [selectedModel])

  const info = MODEL_INFO[selectedModel]

  return (
    <div className="forecast-page">
      <SimpleHeader />

      {/* ── Hero ── */}
      <section className="fc-hero">
        <div className="fc-hero-glow" />
        <div className="fc-hero-content">
          <p className="fc-eyebrow">FORECAST MODELS</p>
          <h1 className="fc-headline">Hurricane Forecast <span className="fc-accent">Models</span></h1>
          <p className="fc-subheadline">
            Compare GFS, ECMWF, HWRF, NAM, and ensemble guidance for track and intensity forecasts.
          </p>
        </div>
      </section>

      <div className="fc-body">

        {/* ── Model selector ── */}
        <div className="fc-model-selector">
          <span className="fc-selector-label">MODEL</span>
          <div className="fc-model-tabs">
            {Object.keys(MODEL_INFO).map(model => (
              <button
                key={model}
                className={`fc-model-tab${selectedModel === model ? ' active' : ''}`}
                onClick={() => setSelectedModel(model)}
              >
                {model}
              </button>
            ))}
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="fc-grid">

          <div className="fc-card">
            <h3>5-Day Wind Speed Forecast</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={mockForecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} label={{ value: 'Wind (mph)', angle: -90, position: 'insideLeft', fill: 'rgba(232,244,255,0.4)', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ color: 'rgba(232,244,255,0.6)', fontSize: 12 }} />
                <Line type="monotone" dataKey="windSpeed" stroke="#00d4ff" strokeWidth={2.5} dot={{ fill: '#00d4ff', r: 4 }} name="Max Wind Speed" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="fc-card">
            <h3>5-Day Pressure Forecast</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={mockForecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} label={{ value: 'Pressure (mb)', angle: -90, position: 'insideLeft', fill: 'rgba(232,244,255,0.4)', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ color: 'rgba(232,244,255,0.6)', fontSize: 12 }} />
                <Line type="monotone" dataKey="pressure" stroke="#4a9abb" strokeWidth={2.5} dot={{ fill: '#4a9abb', r: 4 }} name="Central Pressure" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="fc-card">
            <h3>24-Hour Intensity Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mockIntensityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} label={{ value: 'Wind (mph)', angle: -90, position: 'insideLeft', fill: 'rgba(232,244,255,0.4)', fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ color: 'rgba(232,244,255,0.6)', fontSize: 12 }} />
                <Bar dataKey="windSpeed" fill="rgba(0,212,255,0.7)" name="Wind Speed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="fc-card fc-card-info">
            <h3>Model: <span className="fc-accent">{selectedModel}</span></h3>
            <p className="fc-info-name">{info.name}</p>
            <div className="fc-info-rows">
              <div className="fc-info-row">
                <span className="fc-info-label">Resolution</span>
                <span className="fc-info-value">{info.resolution}</span>
              </div>
              <div className="fc-info-row">
                <span className="fc-info-label">Updates</span>
                <span className="fc-info-value">{info.updateFreq}</span>
              </div>
              <div className="fc-info-row">
                <span className="fc-info-label">Range</span>
                <span className="fc-info-value">{info.range}</span>
              </div>
            </div>
            {info.note && <p className="fc-info-note">{info.note}</p>}
          </div>

        </div>

        {/* ── Analysis ── */}
        <div className="fc-analysis">
          <p className="fc-section-label">FORECAST ANALYSIS</p>
          <h2 className="fc-section-title">How to read model guidance.</h2>
          <div className="fc-analysis-grid">
            {[
              { icon: <TrendingUpOutlinedIcon />, title: 'Uncertainty grows with time', body: 'Forecasts become less reliable beyond 3–5 days. Treat long-range guidance as probabilistic, not definitive.' },
              { icon: <GroupsOutlinedIcon />,    title: 'Model agreement = higher confidence', body: 'When GFS, ECMWF, and HWRF agree on a track, forecasters have greater confidence in the official NHC outlook.' },
              { icon: <GpsFixedOutlinedIcon />,  title: 'Track vs. intensity', body: 'Track forecasts have improved dramatically. Intensity forecasts — especially rapid intensification — remain a harder problem.' },
              { icon: <WavesOutlinedIcon />,     title: 'Local impacts vary', body: 'Storm surge, rainfall totals, and wind impacts can vary significantly from the center track. Always check NHC local advisories.' },
            ].map(({ icon, title, body }) => (
              <div className="fc-analysis-card" key={title}>
                <div className="fc-analysis-icon">{icon}</div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

export default Forecast
