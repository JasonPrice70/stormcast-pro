import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import type { ProcessedStorm } from '../types/nhc';
import { knotsToMph } from '../utils/windSpeed';
import { buildLandIndex, loadLandRings, type LandIndex } from '../utils/landMask';
import {
  buildStormTimeline,
  findLandContact,
  formatDayTime,
  getIntensityLevel,
  nextScheduledAdvisory,
  summarizeStorm,
} from '../utils/stormTimeline';
import './StormDetailPanel.css';

export interface WatchWarningAlert {
  label: string;
  color: string;
}

interface StormDetailPanelProps {
  storm: ProcessedStorm;
  storms: ProcessedStorm[];
  alerts: WatchWarningAlert[];
  onSelectStorm: (id: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

// Advisory is considered late once this long past its scheduled time
const STALE_GRACE_MS = 45 * 60 * 1000;

const formatCountdown = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

// Land polygons load in the background; the summary gains a landfall line once ready
let landIndexCache: LandIndex | null = null;
const useLandIndex = () => {
  const [index, setIndex] = useState<LandIndex | null>(landIndexCache);
  useEffect(() => {
    if (index) return;
    let cancelled = false;
    loadLandRings()
      .then(rings => {
        landIndexCache ??= buildLandIndex(rings);
        if (!cancelled) setIndex(landIndexCache);
      })
      .catch(err => console.warn('Land data unavailable for landfall check:', err));
    return () => { cancelled = true; };
  }, [index]);
  return index;
};

const StormDetailPanel = ({ storm, storms, alerts, onSelectStorm, onClose, onRefresh }: StormDetailPanelProps) => {
  const [expanded, setExpanded] = useState(() => !window.matchMedia('(max-width: 768px)').matches);
  const now = useNow(60_000);
  const landIndex = useLandIndex();
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const level = getIntensityLevel(storm.maxWinds);
  const timeline = useMemo(() => buildStormTimeline(storm), [storm]);
  const landContact = useMemo(() => (landIndex ? findLandContact(timeline, landIndex) : undefined), [timeline, landIndex]);
  const summary = useMemo(() => summarizeStorm(storm, timeline, landContact), [storm, timeline, landContact]);

  useEffect(() => {
    if (shareStatus === 'idle') return;
    const id = setTimeout(() => setShareStatus('idle'), 2500);
    return () => clearTimeout(id);
  }, [shareStatus]);

  const share = async () => {
    const url = window.location.href;
    const title = `${storm.name} · ${level.label}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: summary[0], url });
      } catch {
        // User dismissed the share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('failed');
    }
  };

  const chartData = useMemo(() => {
    const timed = timeline.filter(p => p.time);
    return timed.map((p, i) => {
      const mph = knotsToMph(p.windKt);
      // The "now" point belongs to both lines so they join
      const isJoin = p.kind === 'now' || (p.kind === 'past' && timed[i + 1]?.kind !== 'past');
      return {
        t: p.time!.getTime(),
        observed: p.kind !== 'forecast' ? mph : undefined,
        forecast: p.kind !== 'past' || isJoin ? mph : undefined,
      };
    });
  }, [timeline]);

  const issued = storm.advisoryIssued ?? storm.lastUpdate;
  const nextAdvisory = nextScheduledAdvisory(issued);
  const msUntilNext = nextAdvisory.getTime() - now;
  const isStale = msUntilNext < -STALE_GRACE_MS;

  const otherStorms = storms.filter(s => s.id !== storm.id);

  return (
    <aside
      className={`storm-panel${expanded ? ' expanded' : ''}`}
      aria-label={`${storm.name} details`}
      style={{ ['--storm-color' as string]: level.color }}
    >
      <header className="storm-panel-header">
        <button
          className="storm-panel-handle"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse storm details' : 'Expand storm details'}
        />
        <div className="storm-panel-badge" aria-hidden="true">{level.short}</div>
        <div className="storm-panel-title">
          <h2>{storm.name}</h2>
          <span>{level.label}</span>
        </div>
        <div className="storm-panel-actions">
          <button
            className="storm-panel-icon-btn"
            onClick={share}
            aria-label={`Share ${storm.name}`}
            title="Share link"
          >
            <IosShareOutlinedIcon fontSize="small" />
          </button>
          <button
            className="storm-panel-icon-btn"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse storm details' : 'Expand storm details'}
          >
            {expanded ? <ExpandLessOutlinedIcon fontSize="small" /> : <ExpandMoreOutlinedIcon fontSize="small" />}
          </button>
          <button className="storm-panel-icon-btn" onClick={onClose} aria-label="Close storm details">
            <CloseOutlinedIcon fontSize="small" />
          </button>
        </div>
        <span className="storm-panel-toast" role="status" aria-live="polite">
          {shareStatus === 'copied' ? 'Link copied' : shareStatus === 'failed' ? 'Could not copy link' : ''}
        </span>
      </header>

      <dl className="storm-panel-stats">
        <div>
          <dt>Winds</dt>
          <dd>{knotsToMph(storm.maxWinds)}<small> mph</small></dd>
          <span className="storm-panel-sub">{storm.maxWinds} kt</span>
        </div>
        <div>
          <dt>Pressure</dt>
          <dd>{storm.pressure || '—'}<small> mb</small></dd>
        </div>
        <div>
          <dt>Moving</dt>
          <dd className="storm-panel-movement">{storm.movement}</dd>
        </div>
      </dl>

      {expanded && (
        <div className="storm-panel-body">
          {alerts.length > 0 && (
            <ul className="storm-panel-alerts" aria-label="Active watches and warnings">
              {alerts.map(a => (
                <li key={a.label} style={{ ['--alert-color' as string]: a.color }}>
                  <WarningAmberOutlinedIcon fontSize="inherit" aria-hidden="true" />
                  {a.label}
                </li>
              ))}
            </ul>
          )}

          <section className="storm-panel-summary">
            {summary.map(s => <p key={s}>{s}</p>)}
            <span className="storm-panel-source">Based on the official NHC forecast</span>
          </section>

          {chartData.length >= 2 && (
            <section className="storm-panel-chart">
              <h3>Max sustained winds (mph)</h3>
              <div className="storm-panel-chart-legend" aria-hidden="true">
                <span className="observed">Observed</span>
                <span className="forecast">Forecast</span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={t => new Date(t).toLocaleDateString('en-US', { weekday: 'short' })}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={[0, (max: number) => Math.max(80, Math.ceil(max / 20) * 20)]}
                  />
                  <ReferenceLine y={74} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 3"
                    label={{ value: 'Hurricane', position: 'insideTopLeft', fill: 'rgba(255,255,255,0.45)', fontSize: 9 }} />
                  <ReferenceLine y={111} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 3"
                    label={{ value: 'Major', position: 'insideTopLeft', fill: 'rgba(255,255,255,0.45)', fontSize: 9 }} />
                  <ReferenceLine x={now} stroke="rgba(0,212,255,0.5)"
                    label={{ value: 'Now', position: 'insideTopRight', fill: 'rgba(0,212,255,0.8)', fontSize: 9 }} />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.3)' }}
                    contentStyle={{ background: '#0b1a2e', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    itemStyle={{ color: '#fff' }}
                    labelFormatter={t => formatDayTime(new Date(t as number))}
                    formatter={(value, name) => [`${value} mph`, name === 'observed' ? 'Observed' : 'Forecast']}
                  />
                  <Line dataKey="observed" stroke="#00d4ff" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  <Line dataKey="forecast" stroke="#00d4ff" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}

          <section className={`storm-panel-advisory${isStale ? ' stale' : ''}`}>
            <div>
              <span className="storm-panel-label">
                Advisory {storm.advisoryNumber ?? ''} · issued {formatDayTime(issued)}
              </span>
              {isStale ? (
                <span className="storm-panel-next">
                  Next advisory was expected {formatDayTime(nextAdvisory)}. This data may be out of date.
                </span>
              ) : (
                <span className="storm-panel-next">
                  Next advisory {formatDayTime(nextAdvisory)} · in {formatCountdown(msUntilNext)}
                </span>
              )}
            </div>
            {isStale && (
              <button className="storm-panel-refresh" onClick={onRefresh}>
                <RefreshOutlinedIcon fontSize="inherit" /> Refresh
              </button>
            )}
          </section>

          <div className="storm-panel-links">
            {storm.advisoryUrl && (
              <a href={storm.advisoryUrl} target="_blank" rel="noopener noreferrer">Public advisory</a>
            )}
            {storm.discussionUrl && (
              <a href={storm.discussionUrl} target="_blank" rel="noopener noreferrer">Forecast discussion</a>
            )}
          </div>

          {otherStorms.length > 0 && (
            <nav className="storm-panel-switcher" aria-label="Other active storms">
              <span className="storm-panel-label">Also active</span>
              <div>
                {otherStorms.map(s => {
                  const l = getIntensityLevel(s.maxWinds);
                  return (
                    <button key={s.id} onClick={() => onSelectStorm(s.id)}>
                      <span className="dot" style={{ background: l.color }} aria-hidden="true" />
                      {s.name}
                      <span className="storm-panel-sub">{l.short}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      )}
    </aside>
  );
};

export default StormDetailPanel;
