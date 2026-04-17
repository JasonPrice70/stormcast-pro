import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import SimpleHeader from '../components/SimpleHeader'
import { windSpeedKt, rmaxFromVmax, windToRGBA, categoryLabel, categoryColor } from '../utils/windField'
import { buildLandMask, isLand, type LandMask } from '../utils/landMask'
import './WindFieldPage.css'

// ─── Ian Advisory 12 data ─────────────────────────────────────────────────────
// Source: https://www.nhc.noaa.gov/archive/2022/al09/al092022.fstadv.012.shtml
// 0300 UTC 26 SEP 2022

export interface ForecastPoint {
  label: string
  lat: number
  lon: number
  vmax: number
  r34: [number, number, number, number]
  r50: [number, number, number, number] | null
  r64: [number, number, number, number] | null
  inland?: boolean
}

const ADVISORY: ForecastPoint[] = [
  {
    label: 'ADV 12\n26/03Z',
    lat: 17.3, lon: -81.4, vmax: 55,
    r34: [60, 30, 0, 30],
    r50: [30, 0, 0, 0],
    r64: null,
  },
  {
    label: '+12h\n26/12Z',
    lat: 18.7, lon: -82.3, vmax: 65,
    r34: [90,  90,  30,  70],
    r50: [40,  30,  0,   0],
    r64: [20,  0,   0,   0],
  },
  {
    label: '+24h\n27/00Z',
    lat: 20.8, lon: -83.5, vmax: 85,
    r34: [120, 100, 60,  90],
    r50: [40,  30,  20,  30],
    r64: [20,  10,  0,   10],
  },
  {
    label: '+36h\n27/12Z',
    lat: 22.7, lon: -84.0, vmax: 100,
    r34: [130, 100, 80,  90],
    r50: [50,  50,  40,  40],
    r64: [30,  20,  20,  20],
  },
  {
    label: '+48h\n28/00Z',
    lat: 24.7, lon: -84.1, vmax: 105,
    r34: [150, 130, 90,  110],
    r50: [70,  60,  50,  50],
    r64: [35,  35,  30,  30],
  },
  {
    label: '+60h\n28/12Z',
    lat: 26.2, lon: -83.8, vmax: 115,
    r34: [180, 130, 100, 130],
    r50: [80,  70,  60,  70],
    r64: null,
  },
  {
    label: '+72h\n29/00Z',
    lat: 27.6, lon: -83.5, vmax: 105,
    r34: [200, 150, 120, 150],
    r50: [90,  70,  60,  80],
    r64: null,
  },
  {
    label: '+96h\n30/00Z',
    lat: 29.0, lon: -83.2, vmax: 80,
    r34: [180, 120, 90,  120],
    r50: [70,  50,  40,  60],
    r64: null,
  },
  {
    label: '+120h\n01/00Z',
    lat: 32.0, lon: -82.5, vmax: 40,
    r34: [120, 90,  60,  90],
    r50: null,
    r64: null,
    inland: true,
  },
]

const BASEMAPS = [
  {
    id: 'satellite',
    label: 'Satellite',
    tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
  },
  {
    id: 'light',
    label: 'Light',
    tiles: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    labels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    tiles: 'https://tiles.stadiamaps.com/tiles/stamen_terrain_background/{z}/{x}/{y}{r}.png',
    labels: 'https://tiles.stadiamaps.com/tiles/stamen_terrain_labels/{z}/{x}/{y}{r}.png',
  },
  {
    id: 'dark',
    label: 'Dark',
    tiles: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
  },
]

// Land mask domain covers Gulf + Atlantic
const MASK_DOMAIN = { south: 5, north: 52, west: -115, east: -50, step: 0.1 }

// ─── Canvas wind field layer ──────────────────────────────────────────────────

interface WindLayerProps {
  fc: ForecastPoint
  mask: LandMask | null
  opacity: number
}

function WindFieldLayer({ fc, mask, opacity }: WindLayerProps) {
  const map = useMap()
  const overlayRef = useRef<L.ImageOverlay | null>(null)

  const draw = useCallback(() => {
    const bounds = map.getBounds()
    const size = map.getSize()
    if (size.x === 0 || size.y === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = size.x
    canvas.height = size.y
    const ctx = canvas.getContext('2d')!

    const rmaxNm = rmaxFromVmax(fc.vmax, fc.lat)
    const STEP = 0.04 // degree grid step

    const south = Math.floor(bounds.getSouth() / STEP) * STEP
    const west  = Math.floor(bounds.getWest()  / STEP) * STEP
    const north = north_clamp(bounds.getNorth(), STEP)
    const east  = Math.ceil( bounds.getEast()   / STEP) * STEP

    function north_clamp(v: number, s: number) { return Math.ceil(v / s) * s }

    for (let lat = south; lat <= north; lat += STEP) {
      for (let lon = west; lon <= east; lon += STEP) {
        let kt = windSpeedKt(lat, lon, fc.lat, fc.lon, fc.vmax, rmaxNm, fc.r34, fc.r50, fc.r64)
        if (kt < 16) continue

        // Land friction: ~25% reduction over land (surface roughness effect)
        if (mask && isLand(lat, lon, mask)) kt *= 0.75

        const [r, g, b, a] = windToRGBA(kt)
        if (a < 10) continue

        const p0 = map.latLngToContainerPoint(L.latLng(lat,        lon))
        const p1 = map.latLngToContainerPoint(L.latLng(lat + STEP, lon + STEP))
        const pw = Math.ceil(Math.abs(p1.x - p0.x)) + 1
        const ph = Math.ceil(Math.abs(p0.y - p1.y)) + 1

        ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255) * opacity})`
        ctx.fillRect(
          Math.round(Math.min(p0.x, p1.x)),
          Math.round(Math.min(p1.y, p0.y)),
          pw, ph,
        )
      }
    }

    const dataUrl = canvas.toDataURL('image/png')

    if (overlayRef.current) {
      overlayRef.current.remove()
      overlayRef.current = null
    }
    overlayRef.current = L.imageOverlay(dataUrl, bounds, { zIndex: 400 }).addTo(map)
  }, [map, fc, mask, opacity])

  useEffect(() => {
    draw()
    map.on('moveend zoomend', draw)
    return () => {
      map.off('moveend zoomend', draw)
      overlayRef.current?.remove()
    }
  }, [map, draw])

  return null
}

// ─── Storm track layer ────────────────────────────────────────────────────────

function StormTrackLayer({ points, activeIdx }: { points: ForecastPoint[]; activeIdx: number }) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (layerRef.current) { layerRef.current.clearLayers() }
    else { layerRef.current = L.layerGroup().addTo(map) }

    const group = layerRef.current

    // Track polyline
    const coords = points.map(p => L.latLng(p.lat, p.lon))
    L.polyline(coords, { color: 'rgba(255,255,255,0.45)', weight: 1.5, dashArray: '4 4' }).addTo(group)

    // Forecast circles
    points.forEach((p, i) => {
      const color = categoryColor(p.vmax)
      const isActive = i === activeIdx

      L.circleMarker(L.latLng(p.lat, p.lon), {
        radius: isActive ? 9 : 6,
        fillColor: color,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
        weight: isActive ? 2 : 1,
        fillOpacity: isActive ? 1 : 0.7,
      }).bindTooltip(
        `<b>${categoryLabel(p.vmax)} — ${p.vmax}kt</b><br>${p.label.replace('\n', ' ')}`,
        { direction: 'top', offset: [0, -8] }
      ).addTo(group)
    })

    return () => { layerRef.current?.clearLayers() }
  }, [map, points, activeIdx])

  return null
}

// ─── Main page ────────────────────────────────────────────────────────────────

const WindFieldPage = () => {
  const [activeIdx, setActiveIdx] = useState(4) // default: +48h (near peak)
  const [mask, setMask] = useState<LandMask | null>(null)
  const [maskLoading, setMaskLoading] = useState(true)
  const [opacity, setOpacity] = useState(0.85)
  const [basemapId, setBasemapId] = useState('satellite')

  const basemap = BASEMAPS.find(b => b.id === basemapId) ?? BASEMAPS[0]

  const fc = ADVISORY[activeIdx]
  const initialCenter: [number, number] = [22, -83]

  useEffect(() => {
    buildLandMask(
      MASK_DOMAIN.south, MASK_DOMAIN.north,
      MASK_DOMAIN.west,  MASK_DOMAIN.east,
      MASK_DOMAIN.step,
    ).then(m => { setMask(m); setMaskLoading(false) })
      .catch(() => setMaskLoading(false))
  }, [])

  return (
    <div className="wf-page">
      <SimpleHeader />

      {/* ── Controls bar ── */}
      <div className="wf-controls">
        <div className="wf-controls-inner">

          <div className="wf-title-group">
            <span className="wf-eyebrow">WIND FIELD</span>
            <span className="wf-storm-name">Hurricane Ian — Advisory 12</span>
          </div>

          <div className="wf-tab-group">
            <span className="wf-tab-label">FORECAST TIME</span>
            <div className="wf-tabs">
              {ADVISORY.map((p, i) => (
                <button
                  key={i}
                  className={`wf-tab${activeIdx === i ? ' active' : ''}`}
                  style={activeIdx === i ? { borderColor: categoryColor(p.vmax), color: categoryColor(p.vmax) } : {}}
                  onClick={() => setActiveIdx(i)}
                >
                  <span className="wf-tab-line1">{p.label.split('\n')[0]}</span>
                  <span className="wf-tab-line2">{p.vmax}kt · {categoryLabel(p.vmax)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="wf-tab-group">
            <span className="wf-tab-label">BASEMAP</span>
            <div className="wf-tabs">
              {BASEMAPS.map(b => (
                <button
                  key={b.id}
                  className={`wf-tab${basemapId === b.id ? ' active' : ''}`}
                  onClick={() => setBasemapId(b.id)}
                >
                  <span className="wf-tab-line1">{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="wf-opacity-group">
            <span className="wf-tab-label">OPACITY</span>
            <input
              type="range" min={0.3} max={1} step={0.05}
              value={opacity}
              onChange={e => setOpacity(Number(e.target.value))}
              className="wf-slider"
            />
          </div>

        </div>
      </div>

      {/* ── Map ── */}
      <div className="wf-map-wrap">
        {maskLoading && (
          <div className="wf-loading-overlay">
            <div className="wf-spinner" />
            <span>Building land mask…</span>
          </div>
        )}

        <MapContainer
          center={initialCenter}
          zoom={5}
          zoomControl={true}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer key={basemap.tiles} url={basemap.tiles} />
          <WindFieldLayer fc={fc} mask={mask} opacity={opacity} />
          <StormTrackLayer points={ADVISORY} activeIdx={activeIdx} />
          <TileLayer key={basemap.labels} url={basemap.labels} zIndex={600} />
        </MapContainer>

        {/* Wind speed legend */}
        <div className="wf-legend">
          <p className="wf-legend-title">WIND SPEED</p>
          {[
            { color: '#82dcff', label: 'TD  < 34kt' },
            { color: '#50d264', label: 'TS  34–63kt' },
            { color: '#ffeb00', label: 'Cat 1  64–82kt' },
            { color: '#ff9b00', label: 'Cat 2  83–95kt' },
            { color: '#dc0000', label: 'Cat 3  96–112kt' },
            { color: '#af005a', label: 'Cat 4  113–136kt' },
            { color: '#8c00d2', label: 'Cat 5  ≥137kt' },
          ].map(({ color, label }) => (
            <div className="wf-legend-row" key={label}>
              <span className="wf-legend-swatch" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
          <p className="wf-legend-note">Land: −25% friction applied</p>
        </div>

        {/* Active forecast info */}
        <div className="wf-info-badge">
          <span className="wf-info-label">POSITION</span>
          <span className="wf-info-val">{fc.lat}°N {Math.abs(fc.lon)}°W</span>
          <span className="wf-info-label" style={{ marginTop: 6 }}>MAX WINDS</span>
          <span className="wf-info-val" style={{ color: categoryColor(fc.vmax) }}>
            {fc.vmax} kt · {categoryLabel(fc.vmax)}
          </span>
          {fc.inland && <span className="wf-inland-tag">INLAND</span>}
        </div>
      </div>
    </div>
  )
}

export default WindFieldPage
