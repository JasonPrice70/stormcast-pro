/**
 * CycloTrak Analytics Service
 *
 * Single source of truth for all event tracking.
 * All other files import from here — never from posthog-js directly.
 *
 * PostHog project key is read from VITE_POSTHOG_KEY at build time.
 * If the key is absent (local dev without a key), all calls are no-ops.
 */
import posthog from 'posthog-js';

// ─── Initialisation ──────────────────────────────────────────────────────────

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined
  ?? 'https://us.i.posthog.com';

let initialised = false;

export function initAnalytics(): void {
  if (initialised || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Don't track pageviews automatically — we do it manually so we can attach
    // storm-context properties.
    capture_pageview: false,
    // Respect Do Not Track browser setting
    respect_dnt: true,
    // Session recording off by default — enable in PostHog UI if desired
    disable_session_recording: true,
    // Persistence: use localStorage so identity survives page reloads
    persistence: 'localStorage',
  });

  initialised = true;
}

/** Returns true only when PostHog is live (key present + init ran). */
export function isAnalyticsEnabled(): boolean {
  return initialised;
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/**
 * Call once when the user logs in or is identified.
 * For the current anonymous-user model, we use the PostHog anonymous ID.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (!initialised) return;
  posthog.identify(userId, properties);
}

// ─── Typed Event Catalogue ───────────────────────────────────────────────────
//
// Every event we track is defined here as a strongly-typed function.
// This makes it trivial to search for all usages and keeps the event
// schema in one place.

// ── Page views ────────────────────────────────────────────────────────────────

export function trackPageView(page: 'tracker' | 'advanced' | 'forecast' | 'about' | 'analytics'): void {
  if (!initialised) return;
  posthog.capture('$pageview', { page });
}

// ── Storm interactions ────────────────────────────────────────────────────────

export interface StormProperties {
  stormId: string;
  stormName: string;
  basin: string;
  category: string;       // "TD" | "TS" | "Cat1" … "Cat5" | "Post-Tropical"
  maxWindsKnots: number;
  pressureMb: number | null;
}

export function trackStormSelected(storm: StormProperties): void {
  if (!initialised) return;
  posthog.capture('storm_selected', storm);
}

export function trackInvestSelected(investId: string, prob48h: number, prob7d: number): void {
  if (!initialised) return;
  posthog.capture('invest_selected', { investId, prob48h, prob7d });
}

// ── Layer toggles ─────────────────────────────────────────────────────────────

export type LayerName =
  | 'forecast_cone'
  | 'wind_probability_34kt'
  | 'wind_probability_50kt'
  | 'wind_probability_64kt'
  | 'wind_arrival_likely'
  | 'wind_arrival_earliest'
  | 'storm_surge'
  | 'gefs_spaghetti'
  | 'hwrf_windfield'
  | 'hmon_windfield';

export function trackLayerToggled(layer: LayerName, enabled: boolean, activeStormId?: string): void {
  if (!initialised) return;
  posthog.capture('layer_toggled', { layer, enabled, activeStormId });
}

// ── Model track views ─────────────────────────────────────────────────────────

export type ModelId =
  | 'OFCL' | 'HWRF' | 'HMON' | 'HAFS' | 'GFS' | 'ECMW' | 'CMC'
  | 'AEMN' | 'GEFS' | 'UKM' | string;

export function trackModelViewed(modelId: ModelId, stormId: string): void {
  if (!initialised) return;
  posthog.capture('model_track_viewed', { modelId, stormId });
}

// ── Data refresh ──────────────────────────────────────────────────────────────

export function trackManualRefresh(): void {
  if (!initialised) return;
  posthog.capture('manual_refresh');
}

export function trackAutoRefresh(dataType: 'storms' | 'invests'): void {
  if (!initialised) return;
  posthog.capture('auto_refresh', { dataType });
}

// ── API health events (called from nhcApi / hooks) ────────────────────────────

export interface ApiCallProperties {
  endpoint: string;
  proxyUsed: 'lambda' | 'allorigins' | 'codetabs' | 'cors-anywhere' | 'thingproxy' | 'direct' | string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}

export function trackApiCall(props: ApiCallProperties): void {
  if (!initialised) return;
  posthog.capture('api_call', props);
}

export function trackProxyFallback(
  endpoint: string,
  failedProxy: string,
  nextProxy: string,
): void {
  if (!initialised) return;
  posthog.capture('proxy_fallback', { endpoint, failedProxy, nextProxy });
}

// ── Session summary (fire on unload) ─────────────────────────────────────────

export interface SessionSummary {
  layersEnabled: LayerName[];
  stormsViewed: string[];
  modelsViewed: ModelId[];
  refreshCount: number;
  durationSeconds: number;
}

export function trackSessionEnd(summary: SessionSummary): void {
  if (!initialised) return;
  posthog.capture('session_end', summary);
}

// ── Monetisation funnel events ────────────────────────────────────────────────

export function trackUpgradePromptShown(trigger: string): void {
  if (!initialised) return;
  posthog.capture('upgrade_prompt_shown', { trigger });
}

export function trackUpgradeClicked(plan: 'pro' | 'professional' | 'enterprise'): void {
  if (!initialised) return;
  posthog.capture('upgrade_clicked', { plan });
}
