import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import SimpleHeader from '../components/SimpleHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StormSnapshot {
  stormId: string;
  stormName: string;
  season: number;
  basin: string;
  classification: string;
  category: number;
  maxWindsKnots: number;
  pressureMb: number | null;
  positionLat: number | null;
  positionLon: number | null;
  advisoryTimestamp: string;
  forecastPoints?: Array<{
    hour: number;
    lat: number;
    lon: number;
    maxWindsKnots: number;
    pressureMb: number;
  }>;
}

interface InvestSnapshot {
  investId: string;
  name: string;
  season: number;
  basin: string;
  formationChance48hr: number;
  formationChance7day: number;
  positionLat: number | null;
  positionLon: number | null;
  snapshotTimestamp: string;
  developed: boolean;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const LAMBDA_BASE = 'https://v7z3sx0ee9.execute-api.us-east-1.amazonaws.com/dev';

async function fetchSeasonStorms(season: number): Promise<StormSnapshot[]> {
  const res = await fetch(`${LAMBDA_BASE}/archive-season-storms?season=${season}`);
  const json = await res.json();
  return json.storms ?? [];
}

async function fetchSeasonInvests(season: number): Promise<InvestSnapshot[]> {
  const res = await fetch(`${LAMBDA_BASE}/archive-season-invests?season=${season}`);
  const json = await res.json();
  return json.invests ?? [];
}

async function fetchStormHistory(stormId: string): Promise<StormSnapshot[]> {
  const res = await fetch(`${LAMBDA_BASE}/archive-storm-history?stormId=${stormId}&limit=500`);
  const json = await res.json();
  return json.items ?? [];
}

interface ModelTrackPoint {
  forecastHour: number;
  lat: number;
  lon: number;
  maxWindsKnots: number | null;
}

interface ModelRunItem {
  stormId: string;
  modelId: string;
  runCycle: string;       // yyyymmddhh
  runTimestamp: string;   // ISO8601
  fetchedAt: string;
  trackPoints: ModelTrackPoint[];
}

async function fetchModelRuns(stormId: string, modelId?: string): Promise<ModelRunItem[]> {
  const params = new URLSearchParams({ stormId });
  if (modelId) params.set('modelId', modelId);
  const res = await fetch(`${LAMBDA_BASE}/archive-model-runs?${params}`);
  const json = await res.json();
  return json.items ?? [];
}

// ─── Mock data (shown when archive is empty, e.g. off-season) ────────────────

const MOCK_STORMS: StormSnapshot[] = [
  { stormId: 'AL052025', stormName: 'HELENE',   season: 2025, basin: 'AL', classification: 'HU', category: 4, maxWindsKnots: 120, pressureMb: 921, positionLat: 30.1, positionLon: -84.2, advisoryTimestamp: '2025-09-27T00:00:00Z' },
  { stormId: 'AL062025', stormName: 'MILTON',   season: 2025, basin: 'AL', classification: 'HU', category: 5, maxWindsKnots: 165, pressureMb: 897, positionLat: 27.6, positionLon: -82.5, advisoryTimestamp: '2025-10-09T00:00:00Z' },
  { stormId: 'AL022025', stormName: 'BERYL',    season: 2025, basin: 'AL', classification: 'HU', category: 1, maxWindsKnots:  75, pressureMb: 969, positionLat: 29.5, positionLon: -95.1, advisoryTimestamp: '2025-07-08T00:00:00Z' },
  { stormId: 'AL032025', stormName: 'CHRIS',    season: 2025, basin: 'AL', classification: 'TS', category: 0, maxWindsKnots:  50, pressureMb: 992, positionLat: 35.0, positionLon: -70.0, advisoryTimestamp: '2025-07-22T00:00:00Z' },
  { stormId: 'AL042025', stormName: 'DEBBY',    season: 2025, basin: 'AL', classification: 'HU', category: 1, maxWindsKnots:  80, pressureMb: 965, positionLat: 30.2, positionLon: -83.0, advisoryTimestamp: '2025-08-05T00:00:00Z' },
  { stormId: 'AL072025', stormName: 'NADINE',   season: 2025, basin: 'AL', classification: 'HU', category: 3, maxWindsKnots: 115, pressureMb: 953, positionLat: 25.0, positionLon: -75.0, advisoryTimestamp: '2025-10-18T00:00:00Z' },
  { stormId: 'AL082025', stormName: 'OSCAR',    season: 2025, basin: 'AL', classification: 'TS', category: 0, maxWindsKnots:  65, pressureMb: 985, positionLat: 22.3, positionLon: -79.0, advisoryTimestamp: '2025-10-22T00:00:00Z' },
  { stormId: 'EP032025', stormName: 'CARLOTTA', season: 2025, basin: 'EP', classification: 'HU', category: 2, maxWindsKnots:  95, pressureMb: 960, positionLat: 18.0, positionLon: -110.0, advisoryTimestamp: '2025-09-01T00:00:00Z' },
  { stormId: 'AL012025', stormName: 'ALBERTO',  season: 2025, basin: 'AL', classification: 'TS', category: 0, maxWindsKnots:  45, pressureMb: 997, positionLat: 23.5, positionLon: -97.5, advisoryTimestamp: '2025-06-20T00:00:00Z' },
];

const MOCK_INVESTS: InvestSnapshot[] = [
  { investId: 'AL902025', name: 'Invest 90L', season: 2025, basin: 'AL', formationChance48hr: 80, formationChance7day: 90, positionLat: 16.0, positionLon: -55.0, snapshotTimestamp: '2025-09-20T12:00:00Z', developed: true },
  { investId: 'AL922025', name: 'Invest 92L', season: 2025, basin: 'AL', formationChance48hr: 40, formationChance7day: 60, positionLat: 20.0, positionLon: -70.0, snapshotTimestamp: '2025-10-01T12:00:00Z', developed: false },
  { investId: 'AL942025', name: 'Invest 94L', season: 2025, basin: 'AL', formationChance48hr: 20, formationChance7day: 40, positionLat: 28.0, positionLon: -80.0, snapshotTimestamp: '2025-10-15T12:00:00Z', developed: false },
  { investId: 'AL962025', name: 'Invest 96L', season: 2025, basin: 'AL', formationChance48hr: 60, formationChance7day: 70, positionLat: 14.5, positionLon: -45.0, snapshotTimestamp: '2025-10-19T06:00:00Z', developed: true },
  { investId: 'EP902025', name: 'Invest 90E', season: 2025, basin: 'EP', formationChance48hr: 30, formationChance7day: 50, positionLat: 12.0, positionLon: -100.0, snapshotTimestamp: '2025-08-25T00:00:00Z', developed: true },
];

// Advisory snapshots for MILTON — hourly intensity trace
const MOCK_STORM_HISTORY: StormSnapshot[] = (() => {
  const base = new Date('2025-10-06T00:00:00Z');
  const profile = [
    35,40,45,55,65,70,75,80,90,100,115,130,150,165,160,145,130,110,95,80,70,60,50,45,40
  ];
  return profile.map((kt, i) => ({
    stormId: 'AL062025', stormName: 'MILTON', season: 2025, basin: 'AL',
    classification: kt >= 96 ? 'HU' : kt >= 64 ? 'HU' : 'TS',
    category: kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0,
    maxWindsKnots: kt,
    pressureMb: Math.round(1013 - (kt - 35) * 1.15),
    positionLat: 20 + i * 0.4,
    positionLon: -(105 - i * 1.1),
    advisoryTimestamp: new Date(base.getTime() + i * 6 * 3600 * 1000).toISOString(),
  }));
})();

// Model runs for MILTON across 8 cycles — each model with a T+120 track
const MOCK_MODEL_RUNS: ModelRunItem[] = (() => {
  const models = ['OFCL','HWRF','GFS','ECMW','HAFS','HMON','CMC','AEMN'];
  const cycles = ['2025100600','2025100606','2025100612','2025100618','2025100700','2025100706','2025100712','2025100718'];
  // T+120 wind progression per model (knots) across cycles — shows convergence on Cat 5
  const t120Profile: Record<string, number[]> = {
    OFCL: [80, 95,110,130,150,160,165,160],
    HWRF: [85,100,120,140,158,165,168,162],
    GFS:  [75, 90,105,125,145,155,160,155],
    ECMW: [70, 88,108,128,148,158,162,158],
    HAFS: [82, 98,115,135,152,162,166,160],
    HMON: [78, 92,112,132,150,160,164,158],
    CMC:  [65, 80, 98,118,138,148,152,148],
    AEMN: [72, 86,104,124,144,152,156,150],
  };
  const runs: ModelRunItem[] = [];
  for (const modelId of models) {
    for (let ci = 0; ci < cycles.length; ci++) {
      const runCycle = cycles[ci];
      const t120kt = t120Profile[modelId][ci];
      runs.push({
        stormId: 'AL062025',
        modelId,
        runCycle,
        runTimestamp: `${runCycle.slice(0,4)}-${runCycle.slice(4,6)}-${runCycle.slice(6,8)}T${runCycle.slice(8,10)}:00:00Z`,
        fetchedAt: new Date(`${runCycle.slice(0,4)}-${runCycle.slice(4,6)}-${runCycle.slice(6,8)}T${runCycle.slice(8,10)}:00:00Z`).toISOString(),
        trackPoints: [0,6,12,24,48,72,96,120].map((tau, ti) => ({
          forecastHour: tau,
          lat: 20 + ti * 0.5,
          lon: -(105 - ti * 1.2),
          maxWindsKnots: Math.round(35 + (t120kt - 35) * (ti / 7)),
        })),
      });
    }
  }
  return runs;
})();

// ─── Colour helpers ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<number, string> = {
  0: '#74b9ff',  // TD / TS
  1: '#fdcb6e',
  2: '#e17055',
  3: '#d63031',
  4: '#6c5ce7',
  5: '#2d3436',
};

const BASIN_COLORS: Record<string, string> = {
  AL: '#0984e3',
  EP: '#00b894',
  CP: '#fd79a8',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
  <div style={{
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '20px 24px',
    minWidth: 140,
    flex: '1 1 140px',
  }}>
    <div style={{ color: '#a0aec0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
      {value}
    </div>
    {sub && <div style={{ color: '#a0aec0', fontSize: 12, marginTop: 4 }}>{sub}</div>}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const currentYear = new Date().getUTCFullYear();
  const [season, setSeason]           = useState(currentYear);
  const [storms, setStorms]           = useState<StormSnapshot[]>([]);
  const [invests, setInvests]         = useState<InvestSnapshot[]>([]);
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  const [stormHistory, setStormHistory]       = useState<StormSnapshot[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Model track state
  const [modelRuns, setModelRuns]           = useState<ModelRunItem[]>([]);
  const [modelRunsLoading, setModelRunsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId]   = useState<string | null>(null);

  const [usingMock, setUsingMock] = useState(false);

  // Fetch season summary
  const loadSeason = useCallback(async (yr: number) => {
    setLoading(true);
    setError(null);
    setSelectedStormId(null);
    setStormHistory([]);
    setModelRuns([]);
    setUsingMock(false);
    try {
      const [s, i] = await Promise.all([fetchSeasonStorms(yr), fetchSeasonInvests(yr)]);
      if (s.length === 0 && yr === 2025) {
        // Archive not yet populated — show mock data so the UI is visible
        setStorms(MOCK_STORMS);
        setInvests(MOCK_INVESTS);
        setUsingMock(true);
      } else {
        setStorms(s);
        setInvests(i);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load season data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSeason(season); }, [season, loadSeason]);

  // Fetch storm detail
  const loadStormHistory = useCallback(async (stormId: string) => {
    setHistoryLoading(true);
    try {
      const items = await fetchStormHistory(stormId);
      if (items.length === 0 && stormId === 'AL062025') {
        setStormHistory(MOCK_STORM_HISTORY);
      } else {
        setStormHistory(items);
      }
    } catch {
      setStormHistory(stormId === 'AL062025' ? MOCK_STORM_HISTORY : []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStormId) loadStormHistory(selectedStormId);
  }, [selectedStormId, loadStormHistory]);

  // Fetch model runs whenever a storm is selected
  const loadModelRuns = useCallback(async (stormId: string) => {
    setModelRunsLoading(true);
    setSelectedModelId(null);
    try {
      const items = await fetchModelRuns(stormId);
      if (items.length === 0 && stormId === 'AL062025') {
        setModelRuns(MOCK_MODEL_RUNS);
      } else {
        setModelRuns(items);
      }
    } catch {
      setModelRuns(stormId === 'AL062025' ? MOCK_MODEL_RUNS : []);
    } finally {
      setModelRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStormId) loadModelRuns(selectedStormId);
    else { setModelRuns([]); setSelectedModelId(null); }
  }, [selectedStormId, loadModelRuns]);

  // ── Derived metrics ─────────────────────────────────────────────────────────

  const namedStormCount   = storms.length;
  const hurricaneCount    = storms.filter(s => s.category >= 1).length;
  const majorCount        = storms.filter(s => s.category >= 3).length;
  const peakCat5          = storms.filter(s => s.category === 5).length;
  const investCount       = invests.length;
  const investDevelopRate = invests.length > 0
    ? Math.round((invests.filter(i => i.developed).length / invests.length) * 100)
    : 0;

  // Category distribution for pie chart
  const categoryDist = [0, 1, 2, 3, 4, 5].map(cat => ({
    name: cat === 0 ? 'TD/TS' : `Cat ${cat}`,
    value: storms.filter(s => s.category === cat).length,
    color: CATEGORY_COLORS[cat],
  })).filter(d => d.value > 0);

  // Basin distribution
  const basinDist = ['AL', 'EP', 'CP'].map(b => ({
    name: b,
    storms: storms.filter(s => s.basin === b).length,
    fill: BASIN_COLORS[b],
  })).filter(d => d.storms > 0);

  // Storm intensity timeline (sorted by max winds)
  const stormIntensityData = [...storms]
    .sort((a, b) => b.maxWindsKnots - a.maxWindsKnots)
    .map(s => ({
      name: s.stormName,
      windsMph: Math.round(s.maxWindsKnots * 1.15078),
      windsKt:  s.maxWindsKnots,
      pressure: s.pressureMb ?? 0,
      category: s.category,
    }));

  // Selected storm wind/pressure history
  const historyChartData = stormHistory
    .slice()
    .sort((a, b) => a.advisoryTimestamp.localeCompare(b.advisoryTimestamp))
    .map(h => ({
      time: new Date(h.advisoryTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
      winds: Math.round(h.maxWindsKnots * 1.15078),
      pressure: h.pressureMb ?? 0,
      category: h.category,
    }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0f1b2d', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <SimpleHeader layersPanelOpen={false} onLayersToggle={() => {}} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Season Analytics</h1>

          {/* Season picker */}
          <select
            value={season}
            onChange={e => setSeason(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              padding: '6px 12px',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(yr => (
              <option key={yr} value={yr} style={{ background: '#1a2a3a' }}>{yr} Season</option>
            ))}
          </select>

          {loading && <span style={{ color: '#a0aec0', fontSize: 13 }}>Loading…</span>}
          {error && <span style={{ color: '#fc8181', fontSize: 13 }}>{error}</span>}
          {usingMock && (
            <span style={{
              background: 'rgba(253,203,110,0.15)',
              border: '1px solid rgba(253,203,110,0.4)',
              borderRadius: 6,
              color: '#fdcb6e',
              fontSize: 12,
              padding: '4px 10px',
            }}>
              Demo data — live archive fills automatically once storm season begins
            </span>
          )}
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard label="Named Storms"  value={namedStormCount} />
          <StatCard label="Hurricanes"    value={hurricaneCount}  sub="Cat 1–5" />
          <StatCard label="Major Hurr."   value={majorCount}      sub="Cat 3–5" />
          <StatCard label="Cat 5"         value={peakCat5}        />
          <StatCard label="Invest Areas"  value={investCount}     />
          <StatCard label="Invest Dev. Rate" value={`${investDevelopRate}%`} sub="Named" />
        </div>

        {/* ── Row 1: intensity bar + category pie ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>

          {/* Peak intensity by storm */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#a0aec0' }}>
              Peak Intensity — All Storms (mph)
            </h3>
            {stormIntensityData.length === 0
              ? <p style={{ color: '#4a5568', textAlign: 'center', padding: 40 }}>
                  No storm data archived yet. Data is captured automatically each time the tracker loads during an active season.
                </p>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stormIntensityData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#a0aec0', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" mph" />
                    <Tooltip
                      contentStyle={{ background: '#1a2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      formatter={(v: any, name: string) => [
                        name === 'windsMph' ? `${v} mph` : `${v} mb`,
                        name === 'windsMph' ? 'Max Winds' : 'Min Pressure'
                      ]}
                    />
                    <Bar dataKey="windsMph" name="Max Winds" radius={[4, 4, 0, 0]}>
                      {stormIntensityData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.category] ?? '#74b9ff'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Category distribution pie */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#a0aec0' }}>Category Breakdown</h3>
            {categoryDist.length === 0
              ? <p style={{ color: '#4a5568', textAlign: 'center', padding: 60 }}>No data</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                    >
                      {categoryDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {categoryDist.map(d => (
                <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#a0aec0' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 2: basin bar ── */}
        {basinDist.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#a0aec0' }}>Storms by Basin</h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={basinDist} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#a0aec0', fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#a0aec0', fontSize: 12 }} width={32} />
                <Tooltip
                  contentStyle={{ background: '#1a2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                />
                <Bar dataKey="storms" radius={[0, 4, 4, 0]}>
                  {basinDist.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Row 3: storm table + detail chart ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, marginBottom: 32 }}>

          {/* Storm list */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#a0aec0' }}>
              {season} Storms ({namedStormCount})
            </h3>
            {storms.length === 0
              ? <p style={{ color: '#4a5568', fontSize: 13 }}>No archived storms for this season.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...storms].sort((a, b) => b.maxWindsKnots - a.maxWindsKnots).map(s => (
                    <button
                      key={s.stormId}
                      onClick={() => setSelectedStormId(s.stormId === selectedStormId ? null : s.stormId)}
                      style={{
                        background: selectedStormId === s.stormId
                          ? 'rgba(79,195,247,0.2)'
                          : 'rgba(255,255,255,0.04)',
                        border: selectedStormId === s.stormId
                          ? '1px solid #4FC3F7'
                          : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#fff',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>{s.stormName}</span>
                        <span style={{ color: '#a0aec0', fontSize: 11, marginLeft: 8 }}>{s.stormId}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {s.category >= 1 && (
                          <span style={{
                            background: CATEGORY_COLORS[s.category],
                            borderRadius: 4,
                            padding: '1px 6px',
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            Cat {s.category}
                          </span>
                        )}
                        <span style={{ color: '#a0aec0', fontSize: 12 }}>
                          {Math.round(s.maxWindsKnots * 1.15078)} mph
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            }
          </div>

          {/* Storm detail chart */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20 }}>
            {!selectedStormId
              ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 32 }}>↑</span>
                  <span>Select a storm to see its intensity history</span>
                </div>
              )
              : historyLoading
              ? <p style={{ color: '#a0aec0' }}>Loading history…</p>
              : historyChartData.length === 0
              ? <p style={{ color: '#4a5568' }}>No history snapshots for this storm yet.</p>
              : (
                <>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#a0aec0' }}>
                    {storms.find(s => s.stormId === selectedStormId)?.stormName} — Intensity Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={historyChartData} margin={{ top: 4, right: 20, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: '#a0aec0', fontSize: 10 }}
                        angle={-35}
                        textAnchor="end"
                        interval="preserveStartEnd"
                      />
                      <YAxis yAxisId="wind" tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" mph" />
                      <YAxis yAxisId="pres" orientation="right" tick={{ fill: '#a0aec0', fontSize: 11 }} unit=" mb" domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ background: '#1a2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      />
                      <Legend wrapperStyle={{ color: '#a0aec0', fontSize: 12 }} />
                      <Line
                        yAxisId="wind"
                        type="monotone"
                        dataKey="winds"
                        name="Max Winds (mph)"
                        stroke="#4FC3F7"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="pres"
                        type="monotone"
                        dataKey="pressure"
                        name="Min Pressure (mb)"
                        stroke="#f39c12"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )
            }
          </div>
        </div>

        {/* ── Invest table ── */}
        {invests.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#a0aec0' }}>
              Invest Areas ({investCount})
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#a0aec0', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '8px 12px' }}>ID</th>
                    <th style={{ padding: '8px 12px' }}>Name</th>
                    <th style={{ padding: '8px 12px' }}>Basin</th>
                    <th style={{ padding: '8px 12px' }}>48hr %</th>
                    <th style={{ padding: '8px 12px' }}>7day %</th>
                    <th style={{ padding: '8px 12px' }}>Developed?</th>
                    <th style={{ padding: '8px 12px' }}>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {[...invests].sort((a, b) => b.formationChance7day - a.formationChance7day).map(inv => (
                    <tr
                      key={inv.investId}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{inv.investId}</td>
                      <td style={{ padding: '8px 12px' }}>{inv.name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          background: BASIN_COLORS[inv.basin] ?? '#555',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}>{inv.basin}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: inv.formationChance48hr >= 60 ? '#f39c12' : '#a0aec0' }}>
                          {inv.formationChance48hr}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: inv.formationChance7day >= 60 ? '#e74c3c' : '#a0aec0' }}>
                          {inv.formationChance7day}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {inv.developed
                          ? <span style={{ color: '#00b894' }}>Yes</span>
                          : <span style={{ color: '#a0aec0' }}>No</span>
                        }
                      </td>
                      <td style={{ padding: '8px 12px', color: '#a0aec0', fontSize: 11 }}>
                        {new Date(inv.snapshotTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Model Track Archive ── */}
        {selectedStormId && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#a0aec0' }}>
              Model Track Archive — {storms.find(s => s.stormId === selectedStormId)?.stormName}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#4a5568' }}>
              Every model run captured from the spaghetti track fetches. Each row is one model × one cycle run.
            </p>

            {modelRunsLoading && <p style={{ color: '#a0aec0' }}>Loading model runs…</p>}

            {!modelRunsLoading && modelRuns.length === 0 && (
              <p style={{ color: '#4a5568', fontSize: 13 }}>
                No model runs archived yet for this storm. They populate automatically when a user loads the spaghetti track layer.
              </p>
            )}

            {!modelRunsLoading && modelRuns.length > 0 && (() => {
              // Unique models seen
              const models = Array.from(new Set(modelRuns.map(r => r.modelId))).sort();
              // Unique run cycles (newest first)
              const cycles = Array.from(new Set(modelRuns.map(r => r.runCycle))).sort().reverse();

              // For the detail chart: all runs of the selected model, track endpoint wind at T+120
              const MODEL_PALETTE = [
                '#4FC3F7','#f39c12','#00b894','#e74c3c','#a29bfe',
                '#fd79a8','#fdcb6e','#55efc4','#74b9ff','#b2bec3',
              ];
              const modelColor = (m: string) =>
                MODEL_PALETTE[models.indexOf(m) % MODEL_PALETTE.length];

              // Build intensity evolution chart:
              // X = run cycle (time), Y = max winds at T+120 for each model
              const cyclesSorted = [...cycles].reverse(); // oldest → newest for left→right
              const intensityEvolution = cyclesSorted.map(cycle => {
                const entry: Record<string, any> = {
                  cycle: `${cycle.slice(4,6)}/${cycle.slice(6,8)} ${cycle.slice(8,10)}z`,
                };
                for (const run of modelRuns.filter(r => r.runCycle === cycle)) {
                  const t120 = run.trackPoints.find(p => p.forecastHour === 120)
                    ?? run.trackPoints[run.trackPoints.length - 1];
                  if (t120?.maxWindsKnots != null) {
                    entry[run.modelId] = Math.round(t120.maxWindsKnots * 1.15078); // → mph
                  }
                }
                return entry;
              });

              // Track count per model
              const runsPerModel = models.map(m => ({
                model: m,
                runs: modelRuns.filter(r => r.modelId === m).length,
                fill: modelColor(m),
              }));

              return (
                <>
                  {/* Summary row */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 16px' }}>
                      <div style={{ color: '#a0aec0', fontSize: 11, textTransform: 'uppercase' }}>Models Seen</div>
                      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{models.length}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 16px' }}>
                      <div style={{ color: '#a0aec0', fontSize: 11, textTransform: 'uppercase' }}>Total Runs Archived</div>
                      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{modelRuns.length}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 16px' }}>
                      <div style={{ color: '#a0aec0', fontSize: 11, textTransform: 'uppercase' }}>Unique Cycles</div>
                      <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{cycles.length}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 16px' }}>
                      <div style={{ color: '#a0aec0', fontSize: 11, textTransform: 'uppercase' }}>First Run</div>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                        {cycles.length ? `${cycles[cycles.length-1].slice(4,6)}/${cycles[cycles.length-1].slice(6,8)}` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Two-col: runs-per-model bar + T+120 intensity evolution */}
                  <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, marginBottom: 20 }}>

                    {/* Runs per model */}
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#a0aec0' }}>Runs per Model</h4>
                      <ResponsiveContainer width="100%" height={Math.max(160, runsPerModel.length * 28)}>
                        <BarChart data={runsPerModel} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#a0aec0', fontSize: 10 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="model" tick={{ fill: '#a0aec0', fontSize: 11 }} width={46} />
                          <Tooltip contentStyle={{ background: '#1a2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                          <Bar dataKey="runs" radius={[0, 4, 4, 0]}>
                            {runsPerModel.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* T+120 intensity evolution across cycles */}
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#a0aec0' }}>
                        T+120h Wind Forecast Evolution (mph) — how each model changed its intensity prediction over time
                      </h4>
                      {intensityEvolution.length < 2
                        ? <p style={{ color: '#4a5568', fontSize: 12 }}>Needs at least 2 archived cycles to show evolution.</p>
                        : (
                          <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={intensityEvolution} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="cycle" tick={{ fill: '#a0aec0', fontSize: 10 }} angle={-35} textAnchor="end" interval="preserveStartEnd" />
                              <YAxis tick={{ fill: '#a0aec0', fontSize: 10 }} unit=" mph" />
                              <Tooltip contentStyle={{ background: '#1a2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                              <Legend wrapperStyle={{ color: '#a0aec0', fontSize: 11, paddingTop: 8 }} />
                              {models.map(m => (
                                <Line
                                  key={m}
                                  type="monotone"
                                  dataKey={m}
                                  name={m}
                                  stroke={modelColor(m)}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        )
                      }
                    </div>
                  </div>

                  {/* Detail table — all runs, newest first */}
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#a0aec0' }}>All Archived Runs</h4>
                  <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#0f1b2d' }}>
                        <tr style={{ color: '#a0aec0', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '6px 10px' }}>Model</th>
                          <th style={{ padding: '6px 10px' }}>Run Cycle (UTC)</th>
                          <th style={{ padding: '6px 10px' }}>Track Points</th>
                          <th style={{ padding: '6px 10px' }}>T+0 Winds</th>
                          <th style={{ padding: '6px 10px' }}>T+120 Winds</th>
                          <th style={{ padding: '6px 10px' }}>Captured At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...modelRuns]
                          .sort((a, b) => b.runCycle.localeCompare(a.runCycle))
                          .map((run, i) => {
                            const t0   = run.trackPoints.find(p => p.forecastHour === 0);
                            const t120 = run.trackPoints.find(p => p.forecastHour === 120)
                              ?? run.trackPoints[run.trackPoints.length - 1];
                            const toMph = (kt: number | null) => kt != null ? `${Math.round(kt * 1.15078)} mph` : '—';
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '5px 10px' }}>
                                  <span style={{
                                    background: modelColor(run.modelId),
                                    borderRadius: 4,
                                    padding: '1px 7px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#000',
                                  }}>
                                    {run.modelId}
                                  </span>
                                </td>
                                <td style={{ padding: '5px 10px', fontFamily: 'monospace', color: '#e2e8f0' }}>
                                  {`${run.runCycle.slice(0,4)}-${run.runCycle.slice(4,6)}-${run.runCycle.slice(6,8)} ${run.runCycle.slice(8,10)}:00z`}
                                </td>
                                <td style={{ padding: '5px 10px', color: '#a0aec0' }}>{run.trackPoints.length}</td>
                                <td style={{ padding: '5px 10px', color: '#a0aec0' }}>{toMph(t0?.maxWindsKnots ?? null)}</td>
                                <td style={{ padding: '5px 10px', color: '#4FC3F7' }}>{toMph(t120?.maxWindsKnots ?? null)}</td>
                                <td style={{ padding: '5px 10px', color: '#4a5568', fontSize: 11 }}>
                                  {new Date(run.fetchedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            );
                          })
                        }
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Footer note */}
        <p style={{ color: '#4a5568', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Data is captured automatically from NHC on each advisory cycle. Archive begins from the date this version was deployed.
        </p>
      </div>
    </div>
  );
};

export default Analytics;
