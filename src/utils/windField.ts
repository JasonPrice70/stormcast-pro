// Wind field computation using modified Rankine vortex with quadrant interpolation

const DEG = Math.PI / 180

// ─── Geography ────────────────────────────────────────────────────────────────

export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065
  const dLat = (lat2 - lat1) * DEG
  const dLon = (lon2 - lon1) * DEG
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Bearing in degrees (0 = N, 90 = E, 180 = S, 270 = W)
export function bearingDeg(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const dLon = (toLon - fromLon) * DEG
  const y = Math.sin(dLon) * Math.cos(toLat * DEG)
  const x =
    Math.cos(fromLat * DEG) * Math.sin(toLat * DEG) -
    Math.sin(fromLat * DEG) * Math.cos(toLat * DEG) * Math.cos(dLon)
  return ((Math.atan2(y, x) / DEG) + 360) % 360
}

// ─── Wind model ───────────────────────────────────────────────────────────────

// Radius of max winds in nm using Willoughby et al. (2006) regression
export function rmaxFromVmax(vmaxKt: number, lat: number): number {
  const vmaxMs = vmaxKt * 0.514444
  const lnRmax = 3.015 - 6.291e-5 * vmaxMs * vmaxMs + 0.0058 * Math.abs(lat)
  return Math.exp(lnRmax) / 1.852 // km → nm
}

// Smooth cosine² blending between quadrant radii
// radii order: [NE, SE, SW, NW]; 0 = not reported
export function quadrantInterp(bearing: number, radii: [number, number, number, number]): number {
  const centers = [45, 135, 225, 315]
  let weighted = 0
  let total = 0
  for (let i = 0; i < 4; i++) {
    if (radii[i] <= 0) continue
    let delta = Math.abs(bearing - centers[i])
    if (delta > 180) delta = 360 - delta
    if (delta >= 90) continue
    const w = Math.cos(delta * DEG) ** 2
    weighted += w * radii[i]
    total += w
  }
  return total > 0 ? weighted / total : 0
}

// Modified Rankine vortex with per-quadrant outer decay exponent.
// Inner: linear ramp 0→Vmax over [0, Rmax]
// Outer: power law Vmax × (Rmax/r)^n, n fitted from available radii
export function windSpeedKt(
  gridLat: number,
  gridLon: number,
  cLat: number,
  cLon: number,
  vmaxKt: number,
  rmaxNm: number,
  r34: [number, number, number, number],
  r50: [number, number, number, number] | null,
  _r64: [number, number, number, number] | null,
): number {
  const dist = haversineNm(gridLat, gridLon, cLat, cLon)
  if (dist > 650) return 0

  const bearing = bearingDeg(cLat, cLon, gridLat, gridLon)

  const q34 = quadrantInterp(bearing, r34)
  const q50 = r50 ? quadrantInterp(bearing, r50) : 0

  // Fit Rankine decay exponent from available outer radii
  let n: number
  if (q50 > 0 && q34 > q50 && q50 > rmaxNm) {
    n = Math.log(50 / 34) / Math.log(q34 / q50)
  } else if (q34 > 0 && q34 > rmaxNm) {
    n = Math.log(vmaxKt / 34) / Math.log(q34 / rmaxNm)
  } else {
    n = 0.6
  }
  n = Math.max(0.3, Math.min(2.0, n))

  if (dist <= rmaxNm) {
    return vmaxKt * (dist / rmaxNm)
  }

  return Math.max(0, vmaxKt * Math.pow(rmaxNm / dist, n))
}

// ─── Color mapping ────────────────────────────────────────────────────────────

// Returns [r, g, b, a] using Saffir-Simpson wind speed thresholds
export function windToRGBA(kt: number): [number, number, number, number] {
  if (kt < 18) return [0, 0, 0, 0]

  // Alpha: ramp from 60 at 18kt to 210 at 64kt, hold at 210+
  const alpha = Math.min(210, Math.round(60 + ((kt - 18) / 46) * 150))

  if (kt < 34)  return [130, 220, 255, Math.min(alpha, 80)]  // sub-TS: faint blue
  if (kt < 50)  return [80,  210, 100, alpha]                // TS: green
  if (kt < 64)  return [255, 235, 0,   alpha]                // near-HU: yellow
  if (kt < 83)  return [255, 155, 0,   alpha]                // Cat 1: orange
  if (kt < 96)  return [255, 70,  0,   alpha]                // Cat 2: red-orange
  if (kt < 113) return [220, 0,   0,   alpha]                // Cat 3: red
  if (kt < 137) return [175, 0,   90,  alpha]                // Cat 4: dark red/magenta
  return              [140, 0,   210, alpha]                 // Cat 5: purple
}

// Human-readable category label
export function categoryLabel(kt: number): string {
  if (kt >= 137) return 'Cat 5'
  if (kt >= 113) return 'Cat 4'
  if (kt >= 96)  return 'Cat 3'
  if (kt >= 83)  return 'Cat 2'
  if (kt >= 64)  return 'Cat 1'
  if (kt >= 34)  return 'TS'
  return 'TD'
}

export function categoryColor(kt: number): string {
  if (kt >= 137) return '#8c00d2'
  if (kt >= 113) return '#af005a'
  if (kt >= 96)  return '#dc0000'
  if (kt >= 83)  return '#ff4600'
  if (kt >= 64)  return '#ff9b00'
  if (kt >= 34)  return '#50d264'
  return '#82dcff'
}
