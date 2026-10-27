/**
 * Builds a past + forecast intensity timeline for a storm from the parsed NHC
 * KMZ tracks, and derives a plain-English summary from it.
 */
import type { ProcessedStorm } from '../types/nhc';
import { knotsToMph } from './windSpeed';
import { isPointOnLand, type LandIndex } from './landMask';

export interface TimelinePoint {
  time: Date | null;
  windKt: number;
  pressure: number | null;
  lat: number;
  lon: number;
  kind: 'past' | 'now' | 'forecast';
  stormType: string;
}

export interface IntensityLevel {
  rank: number;       // 0 = TD … 6 = Cat 5
  short: string;      // "TD", "TS", "1" … "5"
  label: string;      // "Tropical Storm", "Category 3 Hurricane"
  color: string;      // Saffir-Simpson fill
}

const LEVELS: IntensityLevel[] = [
  { rank: 0, short: 'TD', label: 'Tropical Depression', color: '#5ebaff' },
  { rank: 1, short: 'TS', label: 'Tropical Storm', color: '#00faf4' },
  { rank: 2, short: '1', label: 'Category 1 Hurricane', color: '#ffffcc' },
  { rank: 3, short: '2', label: 'Category 2 Hurricane', color: '#ffe775' },
  { rank: 4, short: '3', label: 'Category 3 Hurricane', color: '#ffc140' },
  { rank: 5, short: '4', label: 'Category 4 Hurricane', color: '#ff8f20' },
  { rank: 6, short: '5', label: 'Category 5 Hurricane', color: '#ff6060' },
];

// Saffir-Simpson thresholds in knots
export const getIntensityLevel = (knots: number): IntensityLevel => {
  if (knots >= 137) return LEVELS[6];
  if (knots >= 113) return LEVELS[5];
  if (knots >= 96) return LEVELS[4];
  if (knots >= 83) return LEVELS[3];
  if (knots >= 64) return LEVELS[2];
  if (knots >= 34) return LEVELS[1];
  return LEVELS[0];
};

const TZ_OFFSETS: Record<string, number> = {
  UTC: 0, GMT: 0, Z: 0,
  AST: -4, ADT: -3, EDT: -4, EST: -5, CDT: -5, CST: -6,
  MDT: -6, MST: -7, PDT: -7, PST: -8, HDT: -9, HST: -10,
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Parse the date strings found in NHC KMZ placemarks, e.g.
 * "5:00 AM AST August 12, 2025", "2025081206" (DTG) or ISO strings.
 */
export const parseNhcDateTime = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const s = value.trim();

  const text = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*([A-Z]{1,4})?\s+(?:[A-Za-z]{3},?\s+)?([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})/i);
  if (text) {
    const [, h, m, ampm, tz, monthName, day, year] = text;
    const month = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase());
    if (month >= 0) {
      let hour = parseInt(h, 10) % 12;
      if (ampm.toUpperCase() === 'PM') hour += 12;
      const offset = TZ_OFFSETS[(tz || 'UTC').toUpperCase()] ?? 0;
      return new Date(Date.UTC(+year, month, +day, hour - offset, +m));
    }
  }

  const dtg = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})$/);
  if (dtg) {
    const [, y, mo, d, h] = dtg;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h));
  }

  const parsed = Date.parse(s);
  return isNaN(parsed) ? null : new Date(parsed);
};

const pointsFrom = (collection: any, kind: 'past' | 'forecast'): TimelinePoint[] => {
  if (!collection?.features) return [];
  return collection.features
    .filter((f: any) => f?.geometry?.type === 'Point')
    .map((f: any) => {
      const p = f.properties || {};
      const [lon, lat] = f.geometry.coordinates;
      const isNow = kind === 'forecast' && (p.category === 'NOW' || p.forecastHour === 0);
      return {
        time: parseNhcDateTime(p.datetime),
        windKt: Number(p.intensity) || 0,
        pressure: Number(p.minSeaLevelPres) || null,
        lat,
        lon,
        kind: isNow ? 'now' : kind,
        stormType: String(p.stormType || p.category || ''),
      } as TimelinePoint;
    })
    .filter((pt: TimelinePoint) => pt.windKt > 0);
};

export const buildStormTimeline = (storm: ProcessedStorm): TimelinePoint[] => {
  const past = pointsFrom(storm.track, 'past');
  const forecast = pointsFrom(storm.forecastTrack, 'forecast');
  const all = [...past, ...forecast];
  // Keep the original order for points without a parseable time
  return all.every(p => p.time)
    ? all.sort((a, b) => a.time!.getTime() - b.time!.getTime())
    : all;
};

export const formatDayTime = (date: Date): string =>
  date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: date.getMinutes() ? '2-digit' : undefined }).replace(',', '');

// "a tropical storm", "a Category 3 hurricane"
const describeLevel = (level: IntensityLevel) =>
  `a ${level.label.replace(/^Tropical/, 'tropical').replace(/Storm|Depression|Hurricane/, w => w.toLowerCase())}`;

const isPostTropical = (stormType: string) =>
  /^(EX|PT|PTC|LO|DB|WV|RM)$/i.test(stormType) || /post|remnant|extratropical|low/i.test(stormType);

const whenPhrase = (date: Date | null) => (date ? ` by ${formatDayTime(date)}` : '');

export type LandContact =
  | { kind: 'over-land' }
  | { kind: 'landfall'; time: Date | null; lat: number; lon: number }
  | { kind: 'none' };

// Sampling step along the forecast track, in degrees (~10 km)
const LAND_SAMPLE_STEP = 0.1;

/**
 * Walk the forecast track from the current position and report where the
 * center first crosses onto land. Times between forecast points are linearly
 * interpolated.
 */
export const findLandContact = (timeline: TimelinePoint[], land: LandIndex): LandContact => {
  const startIndex = timeline.findIndex(p => p.kind === 'now');
  const fallbackStart = timeline.findIndex(p => p.kind === 'forecast') - 1;
  const from = startIndex >= 0 ? startIndex : fallbackStart;
  const path = from >= 0 ? timeline.slice(from).filter(p => p.kind !== 'past' || p === timeline[from]) : [];
  if (path.length < 2) return { kind: 'none' };

  if (isPointOnLand(path[0].lat, path[0].lon, land)) return { kind: 'over-land' };

  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    let dLon = b.lon - a.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = b.lat - a.lat;
    const steps = Math.max(1, Math.ceil(Math.hypot(dLat, dLon) / LAND_SAMPLE_STEP));
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const lat = a.lat + dLat * f;
      const lon = a.lon + dLon * f;
      if (isPointOnLand(lat, lon, land)) {
        const time = a.time && b.time
          ? new Date(a.time.getTime() + (b.time.getTime() - a.time.getTime()) * f)
          : null;
        return { kind: 'landfall', time, lat, lon };
      }
    }
  }
  return { kind: 'none' };
};

const formatApproxTime = (date: Date) => {
  // Round to the nearest hour; interpolated times are not minute-accurate
  const rounded = new Date(Math.round(date.getTime() / 3_600_000) * 3_600_000);
  return formatDayTime(rounded);
};

/**
 * Rule-based summary of what the official forecast says. Deliberately
 * conservative: it only restates the NHC forecast points, never extrapolates.
 */
export const summarizeStorm = (storm: ProcessedStorm, timeline: TimelinePoint[], land?: LandContact): string[] => {
  const current = getIntensityLevel(storm.maxWinds);
  const sentences = [
    `${storm.name} is ${describeLevel(current)} with maximum sustained winds of ${knotsToMph(storm.maxWinds)} mph, moving ${storm.movement}.`,
  ];

  const forecast = timeline.filter(p => p.kind === 'forecast');
  if (forecast.length === 0) {
    sentences.push('Forecast track details are not available for this advisory yet.');
    return sentences;
  }

  const peak = forecast.reduce((best, p) => (p.windKt > best.windKt ? p : best), forecast[0]);
  const end = forecast[forecast.length - 1];
  const peakLevel = getIntensityLevel(peak.windKt);

  if (peakLevel.rank > current.rank) {
    const target = peak.windKt >= 96 && storm.maxWinds < 96
      ? `a major hurricane (Category ${peakLevel.short})`
      : describeLevel(peakLevel);
    sentences.push(`It is forecast to strengthen into ${target}${whenPhrase(peak.time)}, with peak winds near ${knotsToMph(peak.windKt)} mph.`);
  } else if (peak.windKt - storm.maxWinds >= 10) {
    sentences.push(`Some strengthening is forecast, with winds peaking near ${knotsToMph(peak.windKt)} mph${peak.time ? ` around ${formatDayTime(peak.time)}` : ''}.`);
  } else if (storm.maxWinds - end.windKt >= 15) {
    sentences.push(`Weakening is forecast, to about ${knotsToMph(end.windKt)} mph${whenPhrase(end.time)}.`);
  } else {
    const days = end.time ? Math.round((end.time.getTime() - Date.now()) / 86_400_000) : null;
    sentences.push(`Little change in strength is forecast${days && days > 0 ? ` over the next ${days} day${days === 1 ? '' : 's'}` : ''}.`);
  }

  if (land?.kind === 'over-land') {
    sentences.push('The center is currently over land.');
  } else if (land?.kind === 'landfall') {
    sentences.push(land.time
      ? `The center is forecast to reach land around ${formatApproxTime(land.time)}.`
      : 'The center is forecast to reach land during the forecast period.');
  }

  const transition = forecast.find(p => isPostTropical(p.stormType));
  if (transition) {
    sentences.push(`It is expected to become post-tropical${whenPhrase(transition.time)}.`);
  }

  return sentences;
};

/**
 * NHC issues full advisories at 03, 09, 15 and 21 UTC. Returns the next
 * scheduled slot after the given issuance time.
 */
export const nextScheduledAdvisory = (issued: Date): Date => {
  const next = new Date(issued);
  next.setUTCMinutes(0, 0, 0);
  do {
    next.setUTCHours(next.getUTCHours() + 1);
  } while (next.getUTCHours() % 6 !== 3 || next <= issued);
  return next;
};
