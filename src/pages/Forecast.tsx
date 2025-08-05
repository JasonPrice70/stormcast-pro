import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import '../App.css'
import SimpleHeader from '../components/SimpleHeader';

// Mock forecast data
const mockForecastData = [
  { day: 'Day 1', windSpeed: 115, pressure: 960, latitude: 25.5, longitude: -80.0 },
  { day: 'Day 2', windSpeed: 120, pressure: 955, latitude: 26.2, longitude: -81.1 },
  { day: 'Day 3', windSpeed: 125, pressure: 950, latitude: 27.0, longitude: -82.5 },
  { day: 'Day 4', windSpeed: 130, pressure: 945, latitude: 28.1, longitude: -84.0 },
  { day: 'Day 5', windSpeed: 110, pressure: 965, latitude: 29.5, longitude: -85.8 },
]

const mockIntensityData = [
  { time: '00Z', windSpeed: 115 },
  { time: '06Z', windSpeed: 118 },
  { time: '12Z', windSpeed: 120 },
  { time: '18Z', windSpeed: 125 },
  { time: '24Z', windSpeed: 130 },
]

const Forecast = () => {
  const [selectedModel, setSelectedModel] = useState('GFS')
  const [forecastData] = useState(mockForecastData) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [intensityData] = useState(mockIntensityData) // eslint-disable-line @typescript-eslint/no-unused-vars

  useEffect(() => {
    // In a real application, fetch forecast data from weather models
    console.log('Fetching forecast data for model:', selectedModel)
  }, [selectedModel])

  const models = ['GFS', 'ECMWF', 'HWRF', 'NAM', 'Ensemble']

  return (
    <div className="forecast-page">
        <SimpleHeader />
      <h2>Hurricane Forecast Models</h2>
      
      <div className="model-selector">
        <h3>Select Forecast Model:</h3>
        <div className="model-buttons">
          {models.map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={selectedModel === model ? 'active' : ''}
              style={{
                backgroundColor: selectedModel === model ? '#5e35b1' : '#f0f0f0',
                color: selectedModel === model ? 'white' : 'black',
                margin: '0.25rem',
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {model}
            </button>
          ))}
        </div>
      </div>

      <div className="forecast-charts">
        <div className="forecast-grid">
          <div className="forecast-card">
            <h3>5-Day Wind Speed Forecast</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis label={{ value: 'Wind Speed (mph)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="windSpeed" 
                  stroke="#5e35b1" 
                  strokeWidth={3}
                  name="Max Wind Speed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="forecast-card">
            <h3>Pressure Forecast</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis label={{ value: 'Pressure (mb)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="pressure" 
                  stroke="#1a237e" 
                  strokeWidth={3}
                  name="Central Pressure"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="forecast-card">
            <h3>24-Hour Intensity Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={intensityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Wind Speed (mph)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="windSpeed" fill="#5e35b1" name="Wind Speed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="forecast-card">
            <h3>Model Information</h3>
            <div style={{ textAlign: 'left' }}>
              <h4>Current Model: {selectedModel}</h4>
              {selectedModel === 'GFS' && (
                <div>
                  <p><strong>Global Forecast System (GFS)</strong></p>
                  <p>Resolution: 13 km globally</p>
                  <p>Update Frequency: Every 6 hours</p>
                  <p>Forecast Range: Up to 16 days</p>
                </div>
              )}
              {selectedModel === 'ECMWF' && (
                <div>
                  <p><strong>European Centre Model</strong></p>
                  <p>Resolution: 9 km globally</p>
                  <p>Update Frequency: Every 12 hours</p>
                  <p>Forecast Range: Up to 10 days</p>
                </div>
              )}
              {selectedModel === 'HWRF' && (
                <div>
                  <p><strong>Hurricane Weather Research and Forecasting</strong></p>
                  <p>Resolution: 2 km in storm core</p>
                  <p>Update Frequency: Every 6 hours</p>
                  <p>Forecast Range: Up to 5 days</p>
                  <p>Specialized for tropical cyclones</p>
                </div>
              )}
              {selectedModel === 'NAM' && (
                <div>
                  <p><strong>North American Mesoscale Model</strong></p>
                  <p>Resolution: 12 km over North America</p>
                  <p>Update Frequency: Every 6 hours</p>
                  <p>Forecast Range: Up to 84 hours</p>
                </div>
              )}
              {selectedModel === 'Ensemble' && (
                <div>
                  <p><strong>Ensemble Forecast</strong></p>
                  <p>Multiple model runs with slight variations</p>
                  <p>Shows forecast uncertainty</p>
                  <p>Provides probabilistic forecasts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="forecast-details">
        <div className="storm-info">
          <h3>📊 Forecast Analysis</h3>
          <p>
            The forecast models shown above represent different approaches to predicting tropical cyclone behavior.
            Each model has its strengths and weaknesses, and meteorologists use multiple models to create the
            official National Hurricane Center forecast.
          </p>
          <h4>Key Points:</h4>
          <ul>
            <li><strong>Uncertainty increases with time:</strong> Forecasts become less reliable beyond 3-5 days</li>
            <li><strong>Model agreement:</strong> When models agree, confidence is higher</li>
            <li><strong>Track vs. Intensity:</strong> Track forecasts are generally more accurate than intensity forecasts</li>
            <li><strong>Local effects:</strong> Storm surge, rainfall, and wind impacts can vary significantly from the track</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Forecast
