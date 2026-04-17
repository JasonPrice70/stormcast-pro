import { useState, useMemo } from 'react'
import SimpleHeader from '../components/SimpleHeader'
import './ForecastModels.css'

// ─── Config ────────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'ecmwf', label: 'ECMWF',  desc: 'European Centre — highest global accuracy' },
  { id: 'gfs',   label: 'GFS',    desc: 'NOAA Global Forecast System — 16-day range' },
  { id: 'icon',  label: 'ICON',   desc: 'German Weather Service — strong in tropics' },
  { id: 'nam',   label: 'NAM',    desc: 'North American Mesoscale — high US detail' },
]

const OVERLAYS = [
  { id: 'wind',     label: 'Wind' },
  { id: 'pressure', label: 'Pressure' },
  { id: 'rain',     label: 'Precipitation' },
  { id: 'temp',     label: 'Temperature' },
  { id: 'clouds',   label: 'Cloud Cover' },
]

const REGIONS = [
  { id: 'atlantic',  label: 'Atlantic',   lat: 25,  lon: -65,  zoom: 4 },
  { id: 'conus',     label: 'CONUS',      lat: 38,  lon: -96,  zoom: 4 },
  { id: 'epacific',  label: 'E. Pacific', lat: 15,  lon: -110, zoom: 4 },
  { id: 'wpacific',  label: 'W. Pacific', lat: 20,  lon: 145,  zoom: 4 },
  { id: 'global',    label: 'Global',     lat: 20,  lon: -30,  zoom: 2 },
]

// ─── Component ─────────────────────────────────────────────────────────────────

const ForecastModels = () => {
  const [modelId,   setModelId]   = useState('ecmwf')
  const [overlayId, setOverlayId] = useState('wind')
  const [regionId,  setRegionId]  = useState('atlantic')

  const region = REGIONS.find(r => r.id === regionId)!
  const model  = MODELS.find(m => m.id === modelId)!

  const iframeSrc = useMemo(() => {
    const p = new URLSearchParams({
      lat:         String(region.lat),
      lon:         String(region.lon),
      detailLat:   String(region.lat),
      detailLon:   String(region.lon),
      zoom:        String(region.zoom),
      level:       'surface',
      overlay:     overlayId,
      product:     modelId,
      menu:        '',
      message:     'true',
      marker:      '',
      calendar:    'now',
      pressure:    '',
      type:        'map',
      location:    'coordinates',
      detail:      '',
      metricWind:  'default',
      metricTemp:  'default',
      radarRange:  '-1',
    })
    return `https://embed.windy.com/embed2.html?${p.toString()}`
  }, [modelId, overlayId, regionId])

  return (
    <div className="models-page">
      <SimpleHeader />

      {/* ── Controls (single compact bar) ── */}
      <div className="fm-controls">
        <div className="fm-controls-inner">
          <div className="fm-title-group">
            <span className="fm-eyebrow">FORECAST MODELS</span>
            <span className="fm-model-desc">{model.desc}</span>
          </div>
          <div className="fm-tab-group">
            <span className="fm-tab-label">MODEL</span>
            <div className="fm-tabs">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  className={`fm-tab${modelId === m.id ? ' active' : ''}`}
                  onClick={() => setModelId(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="fm-tab-group">
            <span className="fm-tab-label">OVERLAY</span>
            <div className="fm-tabs">
              {OVERLAYS.map(o => (
                <button
                  key={o.id}
                  className={`fm-tab${overlayId === o.id ? ' active' : ''}`}
                  onClick={() => setOverlayId(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="fm-tab-group">
            <span className="fm-tab-label">REGION</span>
            <div className="fm-tabs">
              {REGIONS.map(r => (
                <button
                  key={r.id}
                  className={`fm-tab${regionId === r.id ? ' active' : ''}`}
                  onClick={() => setRegionId(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Windy embed ── */}
      <div className="fm-embed-wrap">
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title="Windy forecast model"
          className="fm-iframe"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>

      {/* ── Attribution ── */}
      <div className="fm-footer">
        <p>
          Interactive model data powered by{' '}
          <a href="https://www.windy.com" target="_blank" rel="noopener noreferrer">Windy.com</a>.
          ECMWF, GFS, ICON, and NAM data displayed via the Windy embed API.
          For official NHC forecasts always refer to{' '}
          <a href="https://www.nhc.noaa.gov" target="_blank" rel="noopener noreferrer">nhc.noaa.gov</a>.
        </p>
      </div>
    </div>
  )
}

export default ForecastModels
