import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import WavesOutlinedIcon from '@mui/icons-material/WavesOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import TornadoOutlinedIcon from '@mui/icons-material/TornadoOutlined'
import AirOutlinedIcon from '@mui/icons-material/Air'
import SimpleHeader from '../components/SimpleHeader'
import { useNHCData } from '../hooks/useNHCData'
import NHCApiService from '../services/nhcApi'
import { knotsToMph, getHurricaneCategoryFromKnots } from '../utils/windSpeed'
import { ProcessedStorm } from '../types/nhc'
import './Forecast.css'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartPoint {
  hour: number
  label: string
  windMph: number
  windKnots: number
  pressure: number
  category: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Saffir-Simpson reference areas (mph bounds) for wind chart */
const SS_BANDS = [
  { label: 'TD',     y1: 0,   y2: 38,  fill: 'rgba(94,186,94,0.07)' },
  { label: 'TS',     y1: 39,  y2: 73,  fill: 'rgba(90,185,234,0.07)' },
  { label: 'Cat 1',  y1: 74,  y2: 95,  fill: 'rgba(255,253,86,0.07)' },
  { label: 'Cat 2',  y1: 96,  y2: 110, fill: 'rgba(255,180,70,0.07)' },
  { label: 'Cat 3',  y1: 111, y2: 129, fill: 'rgba(255,90,60,0.07)' },
  { label: 'Cat 4',  y1: 130, y2: 156, fill: 'rgba(200,30,120,0.07)' },
  { label: 'Cat 5',  y1: 157, y2: 260, fill: 'rgba(120,20,200,0.07)' },
]

/** Model tab display config: maps UI label → A-deck tech IDs */
const MODEL_TABS: Record<string, {
  label: string
  fullName: string
  resolution: string
  updateFreq: string
  range: string
  note?: string
  adeckIds: string[]
  color: string
}> = {
  Official: {
    label: 'Official',
    fullName: 'NHC Official Forecast',
    resolution: '5-day track & intensity',
    updateFreq: 'Every 6 hours',
    range: '5 days (120 hours)',
    note: 'The NHC official forecast is the authoritative guidance used in public advisories.',
    adeckIds: ['OFCL', 'OFCI'],
    color: '#00d4ff',
  },
  GFS: {
    label: 'GFS',
    fullName: 'Global Forecast System',
    resolution: '13 km globally',
    updateFreq: 'Every 6 hours',
    range: 'Up to 16 days',
    adeckIds: ['GFS', 'GFSO'],
    color: '#4ade80',
  },
  ECMWF: {
    label: 'ECMWF',
    fullName: 'European Centre Model',
    resolution: '9 km globally',
    updateFreq: 'Every 12 hours',
    range: 'Up to 10 days',
    adeckIds: ['EMXI', 'ECMW', 'ECM2'],
    color: '#f59e0b',
  },
  HWRF: {
    label: 'HWRF',
    fullName: 'Hurricane WRF Model',
    resolution: '2 km in storm core',
    updateFreq: 'Every 6 hours',
    range: 'Up to 5 days',
    note: 'Specialized for tropical cyclones with inner-core physics.',
    adeckIds: ['HWRF', 'HWFI', 'HWF2'],
    color: '#f97316',
  },
  HAFS: {
    label: 'HAFS',
    fullName: 'Hurricane Analysis & Forecast System',
    resolution: '6 km in storm core',
    updateFreq: 'Every 6 hours',
    range: 'Up to 5 days',
    note: "NOAA’s next-generation hurricane model replacing HWRF.",
    adeckIds: ['HAFS', 'HAFA', 'HAFB'],
    color: '#a78bfa',
  },
  Ensemble: {
    label: 'Ensemble',
    fullName: 'GEFS Ensemble Mean',
    resolution: '35 km, 30 members',
    updateFreq: 'Every 6 hours',
    range: 'Probabilistic, up to 16 days',
    note: 'Ensemble mean from 30 GEFS members. Wider spread = higher uncertainty.',
    adeckIds: ['AEMN', 'AEMI', 'AC00'],
    color: '#94a3b8',
  },
}

/** Colors for each A-deck model line in the comparison chart */
const ADECK_MODEL_COLORS: Record<string, string> = {
  OFCL: '#00d4ff', OFCI: '#00d4ff',
  GFS: '#4ade80',  GFSO: '#4ade80',
  EMXI: '#f59e0b', ECMW: '#f59e0b', ECM2: '#f59e0b',
  HWRF: '#f97316', HWFI: '#f97316', HWF2: '#f97316',
  HAFS: '#a78bfa', HAFA: '#a78bfa', HAFB: '#a78bfa',
  AEMN: '#94a3b8', AEMI: '#94a3b8', AC00: '#94a3b8',
  HMON: '#22d3ee', HM0N: '#22d3ee',
  CMC: '#fb7185', CMCI: '#fb7185',
  UKMO: '#e879f9', UKM2: '#e879f9',
}

const chartTooltipStyle = {
  backgroundColor: '#0a1628',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: '8px',
  color: '#e8f4ff',
  fontSize: '12px',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hourToLabel(hour: number): string {
  if (hour === 0) return 'Current'
  if (hour % 24 === 0) return `Day ${hour / 24}`
  const d = Math.floor(hour / 24)
  const h = hour % 24
  return d > 0 ? `D${d}+${h}h` : `+${hour}h`
}

/** Parse NHC official forecast track from forecastTrack GeoJSON */
function parseForecastTrack(forecastTrack: any): ChartPoint[] {
  if (!forecastTrack?.features) return []

  const points: ChartPoint[] = forecastTrack.features
    .filter((f: any) => f.geometry?.type === 'Point')
    .map((f: any) => {
      const p = f.properties || {}
      const hour = parseInt(p.FHOUR ?? p.TAU ?? p.FCST_HR ?? p.forecastHour ?? '0') || 0
      const windKnots = parseInt(p.MAXWIND ?? p.INTENSITY ?? p.windSpeed ?? '0') || 0
      const pressure = parseInt(p.MSLP ?? p.PRESSURE ?? p.pressure ?? '0') || 0
      return {
        hour,
        label: hourToLabel(hour),
        windKnots,
        windMph: knotsToMph(windKnots),
        pressure,
        category: getHurricaneCategoryFromKnots(windKnots),
      }
    })
    .filter((pt: ChartPoint) => pt.hour >= 0 && (pt.windKnots > 0 || pt.pressure > 0))
    .sort((a: ChartPoint, b: ChartPoint) => a.hour - b.hour)

  // Deduplicate by hour
  const seen = new Set<number>()
  return points.filter((pt: ChartPoint) => {
    if (seen.has(pt.hour)) return false
    seen.add(pt.hour)
    return true
  })
}

/** Fallback: build a minimal chart from current storm stats only */
function buildCurrentPointChart(storm: ProcessedStorm): ChartPoint[] {
  if (!storm.maxWinds) return []
  return [{
    hour: 0,
    label: 'Current',
    windKnots: storm.maxWinds,
    windMph: knotsToMph(storm.maxWinds),
    pressure: storm.pressure,
    category: storm.category,
  }]
}

/** Build model comparison dataset from A-deck tracks */
function buildComparisonData(
  tracks: Array<{ modelId: string; points: Array<{ tau: number; lat: number; lon: number; vmax: number | null }> }>,
  visibleModels: string[],
): { label: string; hour: number; [modelId: string]: any }[] {
  const allHours = new Set<number>()
  tracks.forEach(t => {
    if (visibleModels.includes(t.modelId)) {
      t.points.forEach(p => allHours.add(p.tau))
    }
  })
  const sorted = Array.from(allHours).sort((a, b) => a - b)

  return sorted.map(hour => {
    const row: any = { hour, label: hourToLabel(hour) }
    tracks.forEach(t => {
      if (!visibleModels.includes(t.modelId)) return
      const pt = t.points.find(p => p.tau === hour)
      if (pt?.vmax != null) row[t.modelId] = knotsToMph(pt.vmax)
    })
    return row
  })
}

/** Get category color for wind speed */
function categoryColor(windMph: number): string {
  if (windMph >= 157) return '#c814e6'
  if (windMph >= 130) return '#c81e78'
  if (windMph >= 111) return '#ff5a3c'
  if (windMph >= 96)  return '#ffb446'
  if (windMph >= 74)  return '#fffd56'
  if (windMph >= 39)  return '#5ab9ea'
  return '#5eba5e'
}

/** Format datetime string for display */
function formatAdvisoryTime(dt: Date): string {
  return dt.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

const Forecast = () => {
  const { storms, loading, error, lastUpdated, refresh } = useNHCData({
    fetchTrackData: true,
    autoRefresh: true,
  })

  const [selectedStormId, setSelectedStormId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('Official')
  const [adeckData, setAdeckData] = useState<{
    filename: string
    modelsPresent: string[]
    tracks: Array<{ modelId: string; points: Array<{ tau: number; lat: number; lon: number; vmax: number | null }> }>
  } | null>(null)
  const [adeckLoading, setAdeckLoading] = useState(false)

  // Auto-select first storm when storms load
  useEffect(() => {
    if (storms.length > 0 && !selectedStormId) {
      setSelectedStormId(storms[0].id)
    }
    if (storms.length === 0) {
      setSelectedStormId(null)
    }
  }, [storms, selectedStormId])

  // Fetch A-deck data when selected storm changes
  useEffect(() => {
    if (!selectedStormId) { setAdeckData(null); return }

    setAdeckLoading(true)
    setAdeckData(null)

    const api = new NHCApiService(false, false)
    api.getGEFSAdeckTracks(selectedStormId)
      .then(data => {
        if (data && data.tracks.length > 0) {
          setAdeckData(data)
        }
      })
      .catch(err => console.warn('A-deck fetch failed:', err))
      .finally(() => setAdeckLoading(false))
  }, [selectedStormId])

  const selectedStorm = storms.find(s => s.id === selectedStormId) ?? null

  // Parse official forecast track into chart data
  const officialChartData: ChartPoint[] = useMemo(() => {
    if (!selectedStorm) return []
    const fromTrack = parseForecastTrack(selectedStorm.forecastTrack)
    if (fromTrack.length > 0) return fromTrack
    // Fallback: try the raw track field
    const fromForecast = parseForecastTrack(selectedStorm.track)
    if (fromForecast.length > 0) return fromForecast
    // Last resort: just show current conditions
    return buildCurrentPointChart(selectedStorm)
  }, [selectedStorm])

  // Determine which A-deck models to show in comparison chart
  const visibleAdeckModels = useMemo(() => {
    if (!adeckData) return []
    // Show all "interesting" models (not individual GEFS perturbations)
    return adeckData.modelsPresent.filter(m => !m.startsWith('AP'))
  }, [adeckData])

  // Build model comparison chart data
  const comparisonData = useMemo(() => {
    if (!adeckData || visibleAdeckModels.length === 0) return []
    return buildComparisonData(adeckData.tracks, visibleAdeckModels)
  }, [adeckData, visibleAdeckModels])

  // Which models from the selected tab are present in the A-deck?
  const selectedTabAdeckIds = MODEL_TABS[selectedModel]?.adeckIds ?? []
  const selectedAdeckModel = selectedTabAdeckIds.find(id => visibleAdeckModels.includes(id))

  const modelInfo = MODEL_TABS[selectedModel]
  const hasActiveStorms = storms.length > 0
  const hasChartData = officialChartData.length > 1
  const hasPressureData = officialChartData.some(p => p.pressure > 0)

  // Wind chart domain
  const windMax = Math.max(...officialChartData.map(p => p.windMph), 160)
  const windChartMax = Math.ceil(windMax / 20) * 20 + 20

  return (
    <div className="forecast-page">
      <SimpleHeader />

      {/* ── Hero ── */}
      <section className="fc-hero">
        <div className="fc-hero-glow" />
        <div className="fc-hero-content">
          <p className="fc-eyebrow">STORM FORECASTS</p>
          <h1 className="fc-headline">
            Official NHC <span className="fc-accent">Forecasts</span>
          </h1>
          <p className="fc-subheadline">
            Real-time 5-day track and intensity guidance from NHC advisories, with
            multi-model A-deck comparison for active tropical storms.
          </p>
        </div>
      </section>

      <div className="fc-body">

        {/* ── Storm Selector ── */}
        {hasActiveStorms && (
          <div className="fc-storm-selector">
            <span className="fc-selector-label">ACTIVE STORM</span>
            <div className="fc-storm-tabs">
              {storms.map(storm => (
                <button
                  key={storm.id}
                  className={`fc-storm-tab${selectedStormId === storm.id ? ' active' : ''}`}
                  onClick={() => setSelectedStormId(storm.id)}
                >
                  <TornadoOutlinedIcon className="fc-storm-tab-icon" />
                  <span className="fc-storm-tab-name">{storm.name}</span>
                  <span className={`fc-storm-tab-cat cat-${storm.category}`}>
                    {storm.category === 0
                      ? (storm.maxWinds >= 34 ? 'TS' : 'TD')
                      : `Cat ${storm.category}`}
                  </span>
                </button>
              ))}
            </div>
            <div className="fc-refresh-row">
              {lastUpdated && (
                <span className="fc-last-updated">
                  Updated {formatAdvisoryTime(lastUpdated)}
                </span>
              )}
              <button className="fc-refresh-btn" onClick={refresh} title="Refresh data">
                <RefreshOutlinedIcon />
              </button>
            </div>
          </div>
        )}

        {/* ── Active Storm Banner ── */}
        {selectedStorm && (
          <div className="fc-storm-banner">
            <div className="fc-storm-banner-name">
              <span className={`fc-storm-badge cat-${selectedStorm.category}`}>
                {selectedStorm.category === 0
                  ? (selectedStorm.maxWinds >= 34 ? 'Tropical Storm' : 'Tropical Depression')
                  : `Category ${selectedStorm.category} Hurricane`}
              </span>
              <span className="fc-storm-banner-title">{selectedStorm.name}</span>
            </div>
            <div className="fc-storm-stats">
              <div className="fc-stat">
                <span className="fc-stat-label">MAX WINDS</span>
                <span className="fc-stat-value" style={{ color: categoryColor(knotsToMph(selectedStorm.maxWinds)) }}>
                  {knotsToMph(selectedStorm.maxWinds)} mph
                </span>
                <span className="fc-stat-sub">({selectedStorm.maxWinds} kt)</span>
              </div>
              <div className="fc-stat-divider" />
              <div className="fc-stat">
                <span className="fc-stat-label">PRESSURE</span>
                <span className="fc-stat-value">{selectedStorm.pressure} mb</span>
              </div>
              <div className="fc-stat-divider" />
              <div className="fc-stat">
                <span className="fc-stat-label">MOVEMENT</span>
                <span className="fc-stat-value fc-stat-movement">{selectedStorm.movement}</span>
              </div>
              <div className="fc-stat-divider" />
              <div className="fc-stat">
                <span className="fc-stat-label">POSITION</span>
                <span className="fc-stat-value">
                  {selectedStorm.position[0].toFixed(1)}°N,{' '}
                  {Math.abs(selectedStorm.position[1]).toFixed(1)}°
                  {selectedStorm.position[1] < 0 ? 'W' : 'E'}
                </span>
              </div>
              {selectedStorm.advisoryUrl && (
                <>
                  <div className="fc-stat-divider" />
                  <a
                    href={selectedStorm.advisoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fc-advisory-link"
                  >
                    NHC Advisory <OpenInNewOutlinedIcon className="fc-advisory-icon" />
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Loading / Error ── */}
        {loading && !hasActiveStorms && (
          <div className="fc-loading">
            <div className="fc-loading-spinner" />
            <p>Fetching NHC data…</p>
          </div>
        )}

        {error && (
          <div className="fc-error">
            <p>⚠️ {error}</p>
          </div>
        )}

        {/* ── Off-Season State ── */}
        {!loading && !hasActiveStorms && (
          <div className="fc-offseason">
            <div className="fc-offseason-icon">
              <AirOutlinedIcon />
            </div>
            <h2 className="fc-offseason-title">No Active Tropical Cyclones</h2>
            <p className="fc-offseason-body">
              The NHC is not issuing advisories on any tropical storms or hurricanes at this
              time. The Atlantic hurricane season runs{' '}
              <strong>June 1 – November 30</strong>. During an active storm, this page shows
              the NHC official 5-day track and intensity forecast alongside real-time model
              comparison from the ATCF A-deck.
            </p>
            <div className="fc-offseason-season">
              <div className="fc-season-bar">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <div
                    key={m}
                    className={`fc-season-month${i >= 5 && i <= 10 ? ' active' : ''}${i === 8 ? ' peak' : ''}`}
                  >
                    <span className="fc-season-month-label">{m}</span>
                    <div className="fc-season-month-bar" />
                  </div>
                ))}
              </div>
              <p className="fc-season-caption">
                Peak of season: <strong>September</strong> · Typical season: June – November
              </p>
            </div>
          </div>
        )}

        {/* ── Model Selector ── */}
        <div className="fc-model-selector">
          <span className="fc-selector-label">MODEL</span>
          <div className="fc-model-tabs">
            {Object.keys(MODEL_TABS).map(model => {
              const hasData = adeckData
                ? MODEL_TABS[model].adeckIds.some(id => adeckData.modelsPresent.includes(id))
                : false
              return (
                <button
                  key={model}
                  className={`fc-model-tab${selectedModel === model ? ' active' : ''}${hasData ? ' has-data' : ''}`}
                  onClick={() => setSelectedModel(model)}
                >
                  {MODEL_TABS[model].label}
                  {hasData && <span className="fc-model-dot" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Charts Grid ── */}
        <div className="fc-grid">

          {/* Wind Speed Chart */}
          <div className="fc-card">
            <div className="fc-card-header">
              <h3>5-Day Wind Speed Forecast</h3>
              {hasChartData && (
                <span className="fc-card-badge">NHC Official</span>
              )}
            </div>
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={officialChartData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  {SS_BANDS.map(band => (
                    <ReferenceArea
                      key={band.label}
                      y1={band.y1}
                      y2={Math.min(band.y2, windChartMax)}
                      fill={band.fill}
                      ifOverflow="hidden"
                      label={{ value: band.label, position: 'insideRight', fill: 'rgba(232,244,255,0.18)', fontSize: 9 }}
                    />
                  ))}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, windChartMax]}
                    tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    label={{ value: 'mph', angle: -90, position: 'insideLeft', fill: 'rgba(232,244,255,0.35)', fontSize: 11, dx: -4 }}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: any) => [`${v} mph`, 'Max Wind']}
                  />
                  <Line
                    type="monotone"
                    dataKey="windMph"
                    stroke="#00d4ff"
                    strokeWidth={2.5}
                    dot={(props: any) => {
                      const color = categoryColor(props.payload.windMph)
                      return (
                        <circle
                          key={props.key || `dot-${props.index}`}
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={color}
                          stroke="#0a1628"
                          strokeWidth={1.5}
                        />
                      )
                    }}
                    name="Max Wind (mph)"
                    activeDot={{ r: 6 }}
                  />
                  {/* Show selected A-deck model if available */}
                  {selectedAdeckModel && adeckData && (() => {
                    const track = adeckData.tracks.find(t => t.modelId === selectedAdeckModel)
                    if (!track) return null
                    // Merge adeck points onto same chart hours
                    const merged = officialChartData.map(pt => {
                      const ap = track.points.find(p => p.tau === pt.hour)
                      return { ...pt, modelMph: ap ? knotsToMph(ap.vmax ?? 0) : null }
                    })
                    return (
                      <Line
                        data={merged}
                        type="monotone"
                        dataKey="modelMph"
                        stroke={MODEL_TABS[selectedModel].color}
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        dot={false}
                        name={`${selectedModel} (kt→mph)`}
                        connectNulls
                      />
                    )
                  })()}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="fc-chart-empty">
                <TornadoOutlinedIcon />
                <p>No active storm forecast available</p>
              </div>
            )}
          </div>

          {/* Pressure Chart */}
          <div className="fc-card">
            <div className="fc-card-header">
              <h3>5-Day Pressure Forecast</h3>
              {hasPressureData && (
                <span className="fc-card-badge">NHC Official</span>
              )}
            </div>
            {hasPressureData ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={officialChartData.filter(p => p.pressure > 0)} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    reversed
                    tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    label={{ value: 'mb', angle: -90, position: 'insideLeft', fill: 'rgba(232,244,255,0.35)', fontSize: 11, dx: -4 }}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: any) => [`${v} mb`, 'Central Pressure']}
                  />
                  <ReferenceLine y={1013} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 3" label={{ value: 'Ambient (1013 mb)', position: 'right', fill: 'rgba(232,244,255,0.3)', fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="pressure"
                    stroke="#4a9abb"
                    strokeWidth={2.5}
                    dot={{ fill: '#4a9abb', r: 4, stroke: '#0a1628', strokeWidth: 1.5 }}
                    name="Central Pressure (mb)"
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="fc-chart-empty">
                <TornadoOutlinedIcon />
                <p>No pressure forecast available</p>
              </div>
            )}
          </div>

          {/* Model Comparison Chart */}
          <div className="fc-card fc-card-wide">
            <div className="fc-card-header">
              <h3>Multi-Model Intensity Comparison</h3>
              {adeckLoading && <span className="fc-card-loading">Fetching A-deck…</span>}
              {adeckData && !adeckLoading && (
                <span className="fc-card-badge">
                  {visibleAdeckModels.length} models · ATCF A-deck
                </span>
              )}
            </div>

            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={comparisonData} margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
                  {SS_BANDS.map(band => (
                    <ReferenceArea
                      key={band.label}
                      y1={band.y1}
                      y2={band.y2}
                      fill={band.fill}
                      ifOverflow="hidden"
                    />
                  ))}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(232,244,255,0.5)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    label={{ value: 'mph', angle: -90, position: 'insideLeft', fill: 'rgba(232,244,255,0.35)', fontSize: 11, dx: -4 }}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: any, name: string) => [`${v} mph`, name]}
                  />
                  <Legend
                    wrapperStyle={{ color: 'rgba(232,244,255,0.55)', fontSize: 11, paddingTop: 12 }}
                  />
                  {visibleAdeckModels.map(modelId => (
                    <Line
                      key={modelId}
                      type="monotone"
                      dataKey={modelId}
                      stroke={ADECK_MODEL_COLORS[modelId] || '#ffffff'}
                      strokeWidth={modelId.startsWith('OFCL') ? 2.5 : 1.5}
                      dot={false}
                      connectNulls
                      opacity={
                        selectedAdeckModel
                          ? (modelId === selectedAdeckModel || modelId.startsWith('OFCL') ? 1 : 0.3)
                          : 0.85
                      }
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="fc-chart-empty fc-chart-empty-lg">
                {adeckLoading ? (
                  <>
                    <div className="fc-loading-spinner" />
                    <p>Loading A-deck model data…</p>
                  </>
                ) : hasActiveStorms ? (
                  <>
                    <GroupsOutlinedIcon />
                    <p>A-deck model data not yet available for this advisory cycle.</p>
                    <p className="fc-chart-empty-sub">
                      Model tracks typically appear within 1–3 hours of each NHC advisory.
                    </p>
                  </>
                ) : (
                  <>
                    <GroupsOutlinedIcon />
                    <p>Multi-model comparison is available when a tropical storm is active.</p>
                    <p className="fc-chart-empty-sub">
                      When storms are active, the ATCF A-deck provides tracks from GFS, ECMWF,
                      HWRF, HAFS, and ensemble members in near–real time.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Model Info Card */}
          <div className="fc-card fc-card-info">
            <h3>Model: <span className="fc-accent">{selectedModel}</span></h3>
            <p className="fc-info-name">{modelInfo.fullName}</p>
            <div className="fc-info-rows">
              <div className="fc-info-row">
                <span className="fc-info-label">Resolution</span>
                <span className="fc-info-value">{modelInfo.resolution}</span>
              </div>
              <div className="fc-info-row">
                <span className="fc-info-label">Updates</span>
                <span className="fc-info-value">{modelInfo.updateFreq}</span>
              </div>
              <div className="fc-info-row">
                <span className="fc-info-label">Range</span>
                <span className="fc-info-value">{modelInfo.range}</span>
              </div>
              {adeckData && (
                <div className="fc-info-row">
                  <span className="fc-info-label">A-deck Status</span>
                  <span className={`fc-info-value${selectedAdeckModel ? ' fc-info-value-active' : ''}`}>
                    {selectedAdeckModel ? `✓ ${selectedAdeckModel} data live` : 'Not in current cycle'}
                  </span>
                </div>
              )}
            </div>
            {modelInfo.note && <p className="fc-info-note">{modelInfo.note}</p>}

            {/* SS Category Legend */}
            <div className="fc-ss-legend">
              <p className="fc-ss-legend-title">Saffir-Simpson Scale</p>
              {[
                { label: 'TD', color: '#5eba5e',  range: '< 39 mph' },
                { label: 'TS', color: '#5ab9ea',  range: '39 – 73 mph' },
                { label: 'Cat 1', color: '#fffd56', range: '74 – 95 mph' },
                { label: 'Cat 2', color: '#ffb446', range: '96 – 110 mph' },
                { label: 'Cat 3', color: '#ff5a3c', range: '111 – 129 mph' },
                { label: 'Cat 4', color: '#c81e78', range: '130 – 156 mph' },
                { label: 'Cat 5', color: '#7814c8', range: '157+ mph' },
              ].map(row => (
                <div key={row.label} className="fc-ss-row">
                  <span className="fc-ss-dot" style={{ background: row.color }} />
                  <span className="fc-ss-label">{row.label}</span>
                  <span className="fc-ss-range">{row.range}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Analysis ── */}
        <div className="fc-analysis">
          <p className="fc-section-label">FORECAST SCIENCE</p>
          <h2 className="fc-section-title">How to read model guidance.</h2>
          <div className="fc-analysis-grid">
            {[
              {
                icon: <TrendingUpOutlinedIcon />,
                title: 'Uncertainty grows with time',
                body: 'Forecasts become less reliable beyond 3–5 days. Treat long-range guidance as probabilistic, not definitive.',
              },
              {
                icon: <GroupsOutlinedIcon />,
                title: 'Model agreement = higher confidence',
                body: 'When GFS, ECMWF, HWRF, and HAFS agree on a track, forecasters have greater confidence in the official NHC outlook.',
              },
              {
                icon: <GpsFixedOutlinedIcon />,
                title: 'Track vs. intensity',
                body: 'Track forecasts have improved dramatically over 30 years. Intensity forecasts — especially rapid intensification — remain a harder problem.',
              },
              {
                icon: <WavesOutlinedIcon />,
                title: 'Local impacts vary',
                body: 'Storm surge, rainfall totals, and wind impacts can vary significantly from the center track. Always check NHC local advisories.',
              },
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
