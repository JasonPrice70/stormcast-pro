import { useState, useEffect, useCallback } from 'react'
import SimpleHeader from '../components/SimpleHeader'
import './SatellitePage.css'

// ─── Config ────────────────────────────────────────────────────────────────────

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
const REFRESH_INTERVAL = 10 * 60 * 1000

type Product = { id: string; label: string; desc: string }
type Sector  = { id: string; label: string; bbox: string; width: number; height: number }
type Sensor  = { id: string; label: string; eyebrow: string; products: Product[]; sectors: Sector[] }

const SENSORS: Sensor[] = [
  {
    id: 'goes-east',
    label: 'GOES-East',
    eyebrow: 'GOES-EAST (GOES-16) · NASA GIBS',
    products: [
      { id: 'GOES-East_ABI_GeoColor',              label: 'GeoColor',  desc: 'True-color by day, simulated IR by night. Best overall view of storms and cloud structure.' },
      { id: 'GOES-East_ABI_Band13_Clean_Infrared', label: 'Infrared',  desc: 'Longwave infrared shows cloud-top temperatures. Cold = high = tall convective towers.' },
      { id: 'GOES-East_ABI_Air_Mass',              label: 'Air Mass',  desc: 'Highlights airmass boundaries, jet streams, and upper-level dynamics. Great for tracking storm steering.' },
      { id: 'GOES-East_ABI_Band2_Red_Visible_1km', label: 'Visible',   desc: 'High-resolution visible (daytime only). Best for seeing fine cloud and storm structure.' },
    ],
    sectors: [
      { id: 'atlantic',  label: 'Atlantic Basin',  bbox: '-100,0,-10,65',  width: 1800, height: 780 },
      { id: 'conus',     label: 'CONUS',           bbox: '-130,20,-55,55', width: 1800, height: 760 },
      { id: 'gulf',      label: 'Gulf of Mexico',  bbox: '-100,15,-75,35', width: 1200, height: 800 },
      { id: 'caribbean', label: 'Caribbean',       bbox: '-90,8,-55,30',   width: 1400, height: 760 },
    ],
  },
  {
    id: 'goes-west',
    label: 'GOES-West',
    eyebrow: 'GOES-WEST (GOES-18) · NASA GIBS',
    products: [
      { id: 'GOES-West_ABI_GeoColor',              label: 'GeoColor',  desc: 'True-color by day, simulated IR by night. Covers the eastern and central Pacific basins.' },
      { id: 'GOES-West_ABI_Band13_Clean_Infrared', label: 'Infrared',  desc: 'Longwave infrared from GOES-West. Excellent coverage of eastern Pacific hurricanes.' },
      { id: 'GOES-West_ABI_Air_Mass',              label: 'Air Mass',  desc: 'Upper-level airmass analysis for the Pacific. Useful for steering flow diagnosis.' },
      { id: 'GOES-West_ABI_Band2_Red_Visible_1km', label: 'Visible',   desc: 'High-resolution daytime visible over the eastern and central Pacific.' },
    ],
    sectors: [
      { id: 'epacific',   label: 'E. Pacific',     bbox: '-160,0,-80,60',  width: 1800, height: 780 },
      { id: 'cpacific',   label: 'C. Pacific',     bbox: '-180,0,-140,45', width: 1200, height: 780 },
      { id: 'conus-west', label: 'Western US',     bbox: '-130,20,-90,55', width: 1400, height: 760 },
    ],
  },
  {
    id: 'himawari',
    label: 'Himawari',
    eyebrow: 'HIMAWARI-9 (JMA) · NASA GIBS',
    products: [
      { id: 'Himawari_AHI_Band13_Clean_Infrared', label: 'Infrared', desc: 'Longwave infrared from Japan\'s Himawari-9. Covers western Pacific, Australia, and South Asia.' },
      { id: 'Himawari_AHI_Air_Mass',              label: 'Air Mass', desc: 'Airmass RGB product highlighting upper-level features and typhoon-steering patterns.' },
      { id: 'Himawari_AHI_Band3_Red_Visible_1km', label: 'Visible',  desc: 'High-resolution visible from Himawari-9. Daytime only. Covers the western Pacific typhoon belt.' },
    ],
    sectors: [
      { id: 'wpacific',  label: 'W. Pacific',    bbox: '100,-20,180,50',  width: 1800, height: 780 },
      { id: 'australia', label: 'Australia',      bbox: '100,-50,180,-10', width: 1800, height: 760 },
      { id: 'japan',     label: 'Japan / Korea',  bbox: '120,20,160,55',   width: 1200, height: 760 },
    ],
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getGIBSTime(): string {
  const d = new Date()
  d.setUTCMinutes(d.getUTCMinutes() - 30)
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 10) * 10, 0, 0)
  return d.toISOString().slice(0, 19) + 'Z'
}

function buildImageUrl(productId: string, sector: Sector, time: string): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: productId,
    CRS: 'CRS:84',
    BBOX: sector.bbox,
    WIDTH: String(sector.width),
    HEIGHT: String(sector.height),
    FORMAT: 'image/jpeg',
    TIME: time,
  })
  return `${GIBS_WMS}?${params.toString()}`
}

function formatTime(isoTime: string): string {
  const d = new Date(isoTime)
  return d.toUTCString().replace(' GMT', ' UTC')
}

// ─── Component ─────────────────────────────────────────────────────────────────

const SatellitePage = () => {
  const [sensorIdx,  setSensorIdx]  = useState(0)
  const [productIdx, setProductIdx] = useState(0)
  const [sectorIdx,  setSectorIdx]  = useState(0)
  const [imageTime,  setImageTime]  = useState(getGIBSTime)
  const [imgSrc,     setImgSrc]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)
  const [countdown,  setCountdown]  = useState(REFRESH_INTERVAL / 1000)

  const sensor  = SENSORS[sensorIdx]
  const product = sensor.products[productIdx]
  const sector  = sensor.sectors[sectorIdx]

  // Reset product and sector when sensor changes
  const handleSensorChange = (idx: number) => {
    setSensorIdx(idx)
    setProductIdx(0)
    setSectorIdx(0)
  }

  const refresh = useCallback(() => {
    setImageTime(getGIBSTime())
    setCountdown(REFRESH_INTERVAL / 1000)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    setImgSrc(buildImageUrl(product.id, sector, imageTime))
  }, [product.id, sector.id, imageTime])

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0')
  const secs = String(countdown % 60).padStart(2, '0')

  return (
    <div className="satellite-page">
      <SimpleHeader />

      {/* ── Page header ── */}
      <div className="sat-header">
        <div className="sat-header-inner">
          <div className="sat-title-group">
            <p className="sat-eyebrow">{sensor.eyebrow}</p>
            <h1 className="sat-title">Satellite Imagery</h1>
          </div>
          <div className="sat-meta">
            <div className="sat-timestamp">
              <span className="sat-meta-label">IMAGE TIME</span>
              <span className="sat-meta-value">{formatTime(imageTime)}</span>
            </div>
            <div className="sat-refresh">
              <span className="sat-meta-label">NEXT REFRESH</span>
              <span className="sat-meta-value sat-countdown">{mins}:{secs}</span>
              <button className="sat-refresh-btn" onClick={refresh} title="Refresh now">
                ↻
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="sat-controls">
        <div className="sat-controls-inner">
          <div className="sat-tab-group">
            <span className="sat-tab-label">SENSOR</span>
            <div className="sat-tabs">
              {SENSORS.map((s, i) => (
                <button
                  key={s.id}
                  className={`sat-tab${sensorIdx === i ? ' active' : ''}`}
                  onClick={() => handleSensorChange(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sat-tab-group">
            <span className="sat-tab-label">PRODUCT</span>
            <div className="sat-tabs">
              {sensor.products.map((p, i) => (
                <button
                  key={p.id}
                  className={`sat-tab${productIdx === i ? ' active' : ''}`}
                  onClick={() => setProductIdx(i)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sat-tab-group">
            <span className="sat-tab-label">SECTOR</span>
            <div className="sat-tabs">
              {sensor.sectors.map((s, i) => (
                <button
                  key={s.id}
                  className={`sat-tab${sectorIdx === i ? ' active' : ''}`}
                  onClick={() => setSectorIdx(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Image ── */}
      <div className="sat-image-wrap">
        {loading && !error && (
          <div className="sat-loading">
            <div className="sat-spinner" />
            <span>Loading satellite imagery…</span>
          </div>
        )}
        {error && (
          <div className="sat-error">
            <span>⚠️</span>
            <p>Imagery unavailable for this product/sector combination.</p>
            <button className="sat-retry-btn" onClick={refresh}>Try again</button>
          </div>
        )}
        {imgSrc && (
          <img
            key={imgSrc}
            src={imgSrc}
            alt={`${sensor.label} ${product.label} — ${sector.label}`}
            className={`sat-image${loading ? ' loading' : ''}`}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true) }}
          />
        )}
      </div>

      {/* ── Product description ── */}
      <div className="sat-desc-bar">
        <p><strong>{product.label}:</strong> {product.desc}</p>
        <p className="sat-attribution">
          Imagery courtesy <a href="https://www.star.nesdis.noaa.gov/GOES/" target="_blank" rel="noopener noreferrer">NOAA/NESDIS</a> &amp;{' '}
          <a href="https://www.data.jma.go.jp/mscweb/en/himawari89/" target="_blank" rel="noopener noreferrer">JMA</a> via{' '}
          <a href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener noreferrer">NASA GIBS</a>. Updates every 10 minutes.
        </p>
      </div>
    </div>
  )
}

export default SatellitePage
