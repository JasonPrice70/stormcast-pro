import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { GeoJSON } from 'geojson'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LandMask {
  data: Uint8Array
  south: number
  west: number
  step: number
  rows: number
  cols: number
}

// ─── Build land mask from topojson ────────────────────────────────────────────

let cachedMask: LandMask | null = null
let ringsPromise: Promise<[number, number][][]> | null = null

// Fetch Natural Earth 50m land once and extract all polygon rings as [lon, lat][] arrays
export function loadLandRings(): Promise<[number, number][][]> {
  if (!ringsPromise) {
    ringsPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json')
      .then(res => res.json() as Promise<Topology>)
      .then(topo => {
        const geo = feature(topo, (topo.objects as any).land) as unknown as GeoJSON.FeatureCollection
        const rings: [number, number][][] = []
        for (const feat of geo.features) {
          extractRings(feat.geometry as GeoJSON.Geometry, rings)
        }
        return rings
      })
      .catch(err => {
        ringsPromise = null // allow a retry later
        throw err
      })
  }
  return ringsPromise
}

export async function buildLandMask(
  south: number, north: number,
  west: number, east: number,
  step = 0.1,
): Promise<LandMask> {
  if (cachedMask) return cachedMask

  const rings = await loadLandRings()

  const rows = Math.round((north - south) / step) + 1
  const cols = Math.round((east - west) / step) + 1
  const data = new Uint8Array(rows * cols)

  // Pre-filter rings to those whose bbox overlaps domain
  const domainRings = rings.filter(ring => {
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
    }
    return maxLon > west && minLon < east && maxLat > south && minLat < north
  })

  // Scanline rasterization (even-odd fill rule)
  for (const ring of domainRings) {
    rasterizeRing(ring, data, south, west, step, rows, cols)
  }

  cachedMask = { data, south, west, step, rows, cols }
  return cachedMask
}

function extractRings(geom: GeoJSON.Geometry, out: [number, number][][]) {
  if (!geom) return
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) out.push(ring as [number, number][])
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates)
      for (const ring of poly) out.push(ring as [number, number][])
  }
}

// Scanline polygon fill — toggles cells that are inside the ring
function rasterizeRing(
  ring: [number, number][],
  data: Uint8Array,
  south: number, west: number,
  step: number, rows: number, cols: number,
) {
  for (let ri = 0; ri < rows; ri++) {
    const lat = south + ri * step
    const xHits: number[] = []

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [lon1, lat1] = ring[i]
      const [lon2, lat2] = ring[j]
      if ((lat1 <= lat && lat < lat2) || (lat2 <= lat && lat < lat1)) {
        xHits.push(lon1 + ((lat - lat1) * (lon2 - lon1)) / (lat2 - lat1))
      }
    }

    xHits.sort((a, b) => a - b)

    for (let k = 0; k + 1 < xHits.length; k += 2) {
      const ci1 = Math.max(0, Math.round((xHits[k] - west) / step))
      const ci2 = Math.min(cols - 1, Math.round((xHits[k + 1] - west) / step))
      for (let ci = ci1; ci <= ci2; ci++) {
        data[ri * cols + ci] ^= 1
      }
    }
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

export function isLand(lat: number, lon: number, mask: LandMask): boolean {
  const ri = Math.round((lat - mask.south) / mask.step)
  const ci = Math.round((lon - mask.west) / mask.step)
  if (ri < 0 || ri >= mask.rows || ci < 0 || ci >= mask.cols) return false
  return mask.data[ri * mask.cols + ci] === 1
}

// ─── Exact point-in-land test (any basin, no grid) ────────────────────────────

export interface LandIndex {
  rings: [number, number][][]
  boxes: Float64Array // minLon, minLat, maxLon, maxLat per ring
}

export function buildLandIndex(rings: [number, number][][]): LandIndex {
  const boxes = new Float64Array(rings.length * 4)
  rings.forEach((ring, r) => {
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
    }
    boxes.set([minLon, minLat, maxLon, maxLat], r * 4)
  })
  return { rings, boxes }
}

// Even-odd rule across all rings, matching rasterizeRing above
export function isPointOnLand(lat: number, lon: number, index: LandIndex): boolean {
  const x = ((lon + 540) % 360) - 180
  let inside = false
  for (let r = 0; r < index.rings.length; r++) {
    const b = r * 4
    if (x < index.boxes[b] || x > index.boxes[b + 2] || lat < index.boxes[b + 1] || lat > index.boxes[b + 3]) continue
    const ring = index.rings[r]
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [lon1, lat1] = ring[i]
      const [lon2, lat2] = ring[j]
      if ((lat1 > lat) !== (lat2 > lat) && x < lon1 + ((lat - lat1) * (lon2 - lon1)) / (lat2 - lat1)) {
        inside = !inside
      }
    }
  }
  return inside
}
