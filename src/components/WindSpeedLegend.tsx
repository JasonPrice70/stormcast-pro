import React from 'react'
import './WindSpeedLegend.css'

interface WindSpeedLegendProps {
  visible: boolean
  modelType: 'HWRF' | 'HMON'
}

const WindSpeedLegend: React.FC<WindSpeedLegendProps> = ({ visible, modelType }) => {
  if (!visible) return null

  const windLevels = [
    { speed: 140, color: '#4B0000', label: '140+ kt' },
    { speed: 120, color: '#8B0000', label: '120-139 kt' },
    { speed: 100, color: '#DC143C', label: '100-119 kt' },
    { speed: 80, color: '#FF6347', label: '80-99 kt' },
    { speed: 60, color: '#FF8C00', label: '60-79 kt' },
    { speed: 45, color: '#FFD700', label: '45-59 kt' },
    { speed: 30, color: '#ADFF2F', label: '30-44 kt' },
    { speed: 15, color: '#87CEFA', label: '15-29 kt' },
  ]

  return (
    <div className="wind-speed-legend">
      <div className="legend-header">
        <h4>{modelType} Wind Field</h4>
        <span className="legend-subtitle">Wind Speed (knots)</span>
      </div>
      <div className="legend-items">
        {windLevels.map((level) => (
          <div key={level.speed} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: level.color }}
            ></div>
            <span className="legend-label">{level.label}</span>
          </div>
        ))}
      </div>
      <div className="legend-note">
        <small>
          {modelType === 'HWRF' 
            ? 'Hurricane Weather Research & Forecasting Model' 
            : 'Hurricane Multiscale Ocean-coupled Non-hydrostatic Model'
          }
        </small>
      </div>
    </div>
  )
}

export default WindSpeedLegend
