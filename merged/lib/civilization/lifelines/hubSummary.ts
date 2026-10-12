import { CAMPAIGN_KEY, SAVE_KEY } from './schema';

const LEGACY_KEY = 'evo.civilization.v1';

/* ============================================================================
   HUB SUMMARY — a tiny, content-free read for the Mode Hub card.
   Reads only the envelope's meta and the campaign counts, so the 400 KB
   database is never imported just to draw the hub.
   ========================================================================== */

export interface HubSummary {
  kind: 'lifelines' | 'legacy' | 'none';
  /** One short line for the hub, never a fabricated year. */
  line: string;
  completed: number;
  chapterTitle: string | null;
  turn: number | null;
}


const listeners = new Set<() => void>();
let version = 0;
export const subscribeHubSummary = (cb: () => void): (() => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === SAVE_KEY || e.key === CAMPAIGN_KEY || e.key === LEGACY_KEY) refreshHubSummary(); };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage); };
};
export const hubSummaryVersion = (): number => version;
export const NONE_SUMMARY: HubSummary = { kind: 'none', line: 'Keep a settlement\'s lifelines working', completed: 0, chapterTitle: null, turn: null };
/** Stable string snapshot for useSyncExternalStore (server and first client render use NONE_SUMMARY). */
export const hubSummarySnapshot = (): string => JSON.stringify(readHubSummary());
export const hubSummaryServerSnapshot = (): string => JSON.stringify(NONE_SUMMARY);
export function refreshHubSummary(): void { version++; listeners.forEach(cb => cb()); }

function read(key: string): unknown {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function readHubSummary(): HubSummary {
  const run = read(SAVE_KEY) as { meta?: { chapterTitle?: unknown; turn?: unknown } } | null;
  const camp = read(CAMPAIGN_KEY) as { completions?: Record<string, unknown> } | null;
  const completed = camp?.completions && typeof camp.completions === 'object' ? new Set(Object.values(camp.completions).map(c => (c as { chapterId?: string })?.chapterId)).size : 0;
  const title = typeof run?.meta?.chapterTitle === 'string' ? run.meta.chapterTitle : null;
  const turn = typeof run?.meta?.turn === 'number' ? run.meta.turn : null;
  if (title !== null) return { kind: 'lifelines', line: `${title} · season ${turn ?? 0}`, completed, chapterTitle: title, turn };
  if (completed > 0) return { kind: 'lifelines', line: `${completed} of 24 chapters completed`, completed, chapterTitle: null, turn: null };
  const legacy = read(LEGACY_KEY) as { active?: unknown; dioramas?: unknown[] } | null;
  if (legacy && (legacy.active || (Array.isArray(legacy.dioramas) && legacy.dioramas.length > 0))) {
    const n = Array.isArray(legacy.dioramas) ? legacy.dioramas.length : 0;
    return { kind: 'legacy', line: legacy.active ? 'A saved settlement is waiting' : `${n} preserved settlement${n === 1 ? '' : 's'}`, completed: 0, chapterTitle: null, turn: null };
  }
  return NONE_SUMMARY;
}
