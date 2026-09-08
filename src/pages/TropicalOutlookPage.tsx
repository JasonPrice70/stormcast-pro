import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import SimpleHeader from '../components/SimpleHeader'
import { useInvestData } from '../hooks/useInvestData'
import { cartoTileUrl } from '../config/mapTiles'
import './TropicalOutlookPage.css'

// ─── Types ──────────────────────────────────────────────────────────────────

type Basin = 'atlantic' | 'epacific' | 'cpacific'
type ForecastDays = '2' | '7'

interface BasinConfig {
  id: Basin
  label: string
  gtwoBasin: string // Used in NHC image URL
  imageBasin: string // Used in NHC image URL
  textUrl: string
  center: [number, number]
  zoom: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BASINS: BasinConfig[] = [
  {
    id: 'atlantic',
    label: 'Atlantic',
    gtwoBasin: 'atlc',
    imageBasin: 'atl',
    textUrl: 'https://www.nhc.noaa.gov/text/MIATWOAT.shtml',
    center: [20, -55],
    zoom: 3,
  },
  {
    id: 'epacific',
    label: 'E. Pacific',
    gtwoBasin: 'epac',
    imageBasin: 'pac',
    textUrl: 'https://www.nhc.noaa.gov/text/MIATWOEP.shtml',
    center: [15, -115],
    zoom: 3,
  },
  {
    id: 'cpacific',
    label: 'C. Pacific',
    gtwoBasin: 'cpac',
    imageBasin: 'cpac',
    textUrl: 'https://www.nhc.noaa.gov/text/HFOTWOCP.shtml',
    center: [18, -165],
    zoom: 4,
  },
]

// NHC GTWO image URLs (served directly – no CORS issue)
// Pattern: https://www.nhc.noaa.gov/xgtwo/resize/xgtwo_{basin}_{days}d0_w1920.png
function getGtwoImageUrl(basin: BasinConfig, days: ForecastDays): string {
  return `https://www.nhc.noaa.gov/xgtwo/resize/xgtwo_${basin.imageBasin}_${days}d0_w1920.png`
}

// ─── Probability helpers ────────────────────────────────────────────────────

function getProbColor(pct: number): string {
  if (pct >= 60) return '#ff4444'   // high – red
  if (pct >= 30) return '#ff9900'   // medium – orange
  return '#ffdd00'                   // low – yellow
}

function getProbLabel(pct: number): string {
  if (pct >= 60) return 'High'
  if (pct >= 30) return 'Medium'
  return 'Low'
}

// ─── CORS proxy text fetcher ─────────────────────────────────────────────────

const PROXIES = [
  'https://api.allorigins.win/get?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
]

async function fetchOutlookText(url: string): Promise<string | null> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) continue
      const json = await res.json().catch(() => null)
      const text: string = json?.contents ?? (await res.text?.() ?? '')
      if (text && text.length > 100) return text
    } catch {
      // try next proxy
    }
  }
  return null
}

/** Strip HTML tags and collapse whitespace for clean display */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Extract the "meat" of the TWO text product (ZCZC … NNNN block) */
function extractTwoProduct(raw: string): string {
  const stripped = stripHtml(raw)
  // Try to pull out the WMO-style block
  const match = stripped.match(/ZCZC\s+MIAT[^]*?NNNN/i)
  if (match) return match[0].trim()
  // Fallback: everything between "Tropical Weather Outlook" and "Forecaster"
  const fallback = stripped.match(
    /Tropical Weather Outlook[\s\S]*?(?=Quick Links|$)/i
  )
  return fallback ? fallback[0].trim() : stripped.substring(0, 1500)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TropicalOutlookPage() {
  const [activeBasin, setActiveBasin] = useState<BasinConfig>(BASINS[0])
  const [forecastDays, setForecastDays] = useState<ForecastDays>('7')
  const [outlookText, setOutlookText] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const { invests, loading: investsLoading } = useInvestData({ autoRefresh: false })

  // Filter invests by active basin
  const basinInvests = invests.filter(i => i.basin === activeBasin.id)

  // ── Fetch text product whenever basin changes ─────────────────────────────
  const loadText = useCallback(async (basin: BasinConfig) => {
    setTextLoading(true)
    setOutlookText(null)
    try {
      const raw = await fetchOutlookText(basin.textUrl)
      if (raw) {
        setOutlookText(extractTwoProduct(raw))
      } else {
        setOutlookText('Text outlook unavailable at this time. Visit nhc.noaa.gov for the latest.')
      }
    } catch {
      setOutlookText('Unable to load text outlook.')
    } finally {
      setTextLoading(false)
    }
  }, [])

  useEffect(() => {
    setImgLoaded(false)
    setImgError(false)
    loadText(activeBasin)
  }, [activeBasin, loadText])

  const imageUrl = getGtwoImageUrl(activeBasin, forecastDays)
  const nhcPageUrl = `https://www.nhc.noaa.gov/gtwo.php?basin=${activeBasin.gtwoBasin}&fdays=${forecastDays}`

  return (
    <div className="to-page">
      <SimpleHeader />

      <div className="to-content">
        {/* ── Page title ── */}
        <div className="to-header">
          <div className="to-title-row">
            <h1 className="to-title">Tropical Weather Outlook</h1>
            <a
              href={nhcPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="to-nhc-link"
            >
              View on NHC ↗
            </a>
          </div>
          <p className="to-subtitle">
            National Hurricane Center — Graphical Tropical Weather Outlook (GTWO)
          </p>
        </div>

        {/* ── Controls row ── */}
        <div className="to-controls">
          {/* Basin tabs */}
          <div className="to-tabs" role="tablist">
            {BASINS.map(b => (
              <button
                key={b.id}
                role="tab"
                aria-selected={activeBasin.id === b.id}
                className={`to-tab${activeBasin.id === b.id ? ' active' : ''}`}
                onClick={() => setActiveBasin(b)}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* 2-day / 7-day toggle */}
          <div className="to-period-toggle">
            <button
              className={`to-period-btn${forecastDays === '2' ? ' active' : ''}`}
              onClick={() => setForecastDays('2')}
            >
              2-Day
            </button>
            <button
              className={`to-period-btn${forecastDays === '7' ? ' active' : ''}`}
              onClick={() => setForecastDays('7')}
            >
              7-Day
            </button>
          </div>
        </div>

        {/* ── Main content: image + sidebar ── */}
        <div className="to-main">

          {/* ── Graphical GTWO Image ── */}
          <div className="to-graphic-panel">
            <div className="to-graphic-wrapper">
              {!imgLoaded && !imgError && (
                <div className="to-img-placeholder">
                  <div className="to-spinner" />
                  <span>Loading graphical outlook…</span>
                </div>
              )}
              {imgError && (
                <div className="to-img-placeholder">
                  <span className="to-img-error">
                    Graphic unavailable.{' '}
                    <a href={nhcPageUrl} target="_blank" rel="noopener noreferrer">
                      View on NHC ↗
                    </a>
                  </span>
                </div>
              )}
              <img
                key={imageUrl}
                src={imageUrl}
                alt={`NHC ${forecastDays}-day Graphical Tropical Weather Outlook — ${activeBasin.label}`}
                className={`to-gtwo-img${imgLoaded ? ' loaded' : ''}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => { setImgError(true); setImgLoaded(false) }}
              />
              {imgLoaded && (
                <div className="to-img-caption">
                  Source: National Hurricane Center ·{' '}
                  <a href={nhcPageUrl} target="_blank" rel="noopener noreferrer">
                    nhc.noaa.gov ↗
                  </a>
                </div>
              )}
            </div>

            {/* ── Probability legend ── */}
            <div className="to-legend">
              <span className="to-legend-title">Formation Probability</span>
              <div className="to-legend-items">
                <div className="to-legend-item">
                  <span className="to-legend-dot" style={{ background: '#ffdd00' }} />
                  Low (&lt; 30%)
                </div>
                <div className="to-legend-item">
                  <span className="to-legend-dot" style={{ background: '#ff9900' }} />
                  Medium (30–60%)
                </div>
                <div className="to-legend-item">
                  <span className="to-legend-dot" style={{ background: '#ff4444' }} />
                  High (&gt; 60%)
                </div>
              </div>
            </div>
          </div>

          {/* ── Sidebar: disturbance list ── */}
          <div className="to-sidebar">
            <h2 className="to-sidebar-title">
              Active Disturbances
              {!investsLoading && (
                <span className="to-disturbance-count">
                  {basinInvests.length === 0 ? 'None' : basinInvests.length}
                </span>
              )}
            </h2>

            {investsLoading && (
              <div className="to-sidebar-loading">
                <div className="to-spinner" />
                <span>Loading…</span>
              </div>
            )}

            {!investsLoading && basinInvests.length === 0 && (
              <div className="to-no-disturbances">
                <div className="to-no-disturbances-icon">✓</div>
                <p>No active disturbances in the {activeBasin.label} basin.</p>
                <p className="to-no-disturbances-sub">
                  Tropical cyclone formation is not expected at this time.
                </p>
              </div>
            )}

            {basinInvests.map(invest => {
              const prob = forecastDays === '2'
                ? invest.formationChance48hr
                : invest.formationChance7day
              const color = getProbColor(prob)
              const label = getProbLabel(prob)

              return (
                <div key={invest.id} className="to-disturbance-card">
                  <div className="to-disturbance-header">
                    <span
                      className="to-disturbance-badge"
                      style={{ background: color, color: prob >= 60 ? '#fff' : '#111' }}
                    >
                      {label}
                    </span>
                    <span className="to-disturbance-id">{invest.name}</span>
                  </div>
                  <p className="to-disturbance-location">{invest.location}</p>
                  <div className="to-disturbance-probs">
                    <div className="to-prob-row">
                      <span>2-Day</span>
                      <div className="to-prob-bar-wrap">
                        <div
                          className="to-prob-bar"
                          style={{
                            width: `${invest.formationChance48hr}%`,
                            background: getProbColor(invest.formationChance48hr),
                          }}
                        />
                      </div>
                      <span className="to-prob-pct">{invest.formationChance48hr}%</span>
                    </div>
                    <div className="to-prob-row">
                      <span>7-Day</span>
                      <div className="to-prob-bar-wrap">
                        <div
                          className="to-prob-bar"
                          style={{
                            width: `${invest.formationChance7day}%`,
                            background: getProbColor(invest.formationChance7day),
                          }}
                        />
                      </div>
                      <span className="to-prob-pct">{invest.formationChance7day}%</span>
                    </div>
                  </div>
                  {invest.description && (
                    <p className="to-disturbance-desc">{invest.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Interactive map with invest markers ── */}
        {basinInvests.length > 0 && (
          <div className="to-map-section">
            <h2 className="to-section-title">Interactive Map</h2>
            <div className="to-map-wrapper">
              <MapContainer
                center={activeBasin.center}
                zoom={activeBasin.zoom}
                scrollWheelZoom
                className="to-map"
              >
                <TileLayer
                  url={cartoTileUrl('dark_nolabels')}
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                {basinInvests.map(invest => {
                  const prob = forecastDays === '2'
                    ? invest.formationChance48hr
                    : invest.formationChance7day
                  const color = getProbColor(prob)

                  return (
                    <CircleMarker
                      key={invest.id}
                      center={invest.position}
                      radius={14}
                      pathOptions={{
                        color,
                        fillColor: color,
                        fillOpacity: 0.45,
                        weight: 2,
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -12]}>
                        <strong>{invest.name}</strong>
                        <br />
                        {getProbLabel(prob)} development chance
                        <br />
                        2-Day: {invest.formationChance48hr}% · 7-Day: {invest.formationChance7day}%
                      </Tooltip>
                      <Popup>
                        <div style={{ minWidth: 200 }}>
                          <strong style={{ fontSize: '1rem' }}>{invest.name}</strong>
                          <p style={{ margin: '4px 0' }}>{invest.location}</p>
                          <hr style={{ margin: '6px 0' }} />
                          <div>2-Day formation chance: <strong>{invest.formationChance48hr}%</strong></div>
                          <div>7-Day formation chance: <strong>{invest.formationChance7day}%</strong></div>
                          {invest.description && (
                            <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#555' }}>
                              {invest.description}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            </div>
          </div>
        )}

        {/* ── Text outlook ── */}
        <div className="to-text-section">
          <div className="to-section-header">
            <h2 className="to-section-title">Tropical Weather Outlook Text</h2>
            <a
              href={activeBasin.textUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="to-text-nhc-link"
            >
              View on NHC ↗
            </a>
          </div>
          <div className="to-text-box">
            {textLoading && (
              <div className="to-text-loading">
                <div className="to-spinner" />
                <span>Fetching outlook text…</span>
              </div>
            )}
            {!textLoading && outlookText && (
              <pre className="to-text-pre">{outlookText}</pre>
            )}
            {!textLoading && !outlookText && (
              <p className="to-text-unavailable">
                Text outlook could not be loaded.{' '}
                <a href={activeBasin.textUrl} target="_blank" rel="noopener noreferrer">
                  Read it directly on the NHC website ↗
                </a>
              </p>
            )}
          </div>
        </div>

        {/* ── Attribution footer ── */}
        <div className="to-attribution">
          Data provided by the{' '}
          <a href="https://www.nhc.noaa.gov" target="_blank" rel="noopener noreferrer">
            National Hurricane Center (NHC)
          </a>
          . Graphical outlooks update several times daily during hurricane season.
        </div>
      </div>
    </div>
  )
}
