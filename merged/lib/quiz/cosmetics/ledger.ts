/** Cosmetic progress ledger (items 112-120, 126, 130). A separate, non-spendable record: quiz points are the only in-game currency.
 *  Events are produced by the SERVER from verified sessions; each carries a unique id, so applying the same event twice changes nothing. Pure. */
import { ICONS, ALL_FRAMES, type Criterion } from './catalog';
import { qualifyingSession, type SessionFact } from '../learning';

export type LedgerEvent =
  | { id: string; kind: 'session'; at: string; fact: SessionFact; accuracy: number; mastery?: number }
  | { id: string; kind: 'review'; at: string; sessionId: string }
  | { id: string; kind: 'correction'; at: string; concept: string }
  | { id: string; kind: 'format'; at: string; format: string; sessionId: string }
  | { id: string; kind: 'explore'; at: string; quizId: string }
  | { id: string; kind: 'create'; at: string; quizId: string };
export type Ledger = { v: 1; events: Record<string, LedgerEvent>; flagged: string[]; unlocked: Record<string, string> /* itemId → ISO time */ };
export const emptyLedger = (): Ledger => ({ v: 1, events: {}, flagged: [], unlocked: {} });

/** Caps for repeatable progress (116): the same quiz counts at most 3 times in total toward sessions, and the same concept only once for corrections. */
export const CAPS = { sameQuizSessions: 3 } as const;

const FREE_IDS = [...ICONS.filter((i) => i.free).map((i) => i.id), ...ALL_FRAMES.filter((f) => f.free).map((f) => f.id)];
export const freeItems = () => FREE_IDS.slice();

export function applyEvent(ledger: Ledger, ev: LedgerEvent, optedOut = false): { ledger: Ledger; counted: boolean; reason?: string } {
  if (optedOut) return { ledger, counted: false, reason: 'cosmetic progress is switched off for this session' };
  if (ledger.events[ev.id]) return { ledger, counted: false, reason: 'already recorded' }; // idempotent
  let flagged = ledger.flagged;
  if (ev.kind === 'session') {
    const previous = Object.values(ledger.events).filter((e): e is Extract<LedgerEvent, { kind: 'session' }> => e.kind === 'session').map((e) => e.fact);
    const q = qualifyingSession(ev.fact, previous);
    if (!q.ok) {
      // suspicious fast repetition is *flagged*, not punished: nothing is removed from the person, the event just does not add progress
      if (/faster than a person|same quiz/.test(q.reason ?? '')) flagged = [...flagged, ev.id];
      return { ledger: { ...ledger, flagged }, counted: false, reason: q.reason };
    }
    const sameQuiz = previous.filter((p) => p.quizId === ev.fact.quizId).length;
    if (sameQuiz >= CAPS.sameQuizSessions) return { ledger: { ...ledger, flagged }, counted: false, reason: 'this quiz has already counted three times' };
  }
  if (ev.kind === 'correction' && Object.values(ledger.events).some((e) => e.kind === 'correction' && e.concept === ev.concept)) return { ledger, counted: false, reason: 'this idea was already corrected' };
  if (ev.kind === 'explore' && Object.values(ledger.events).some((e) => e.kind === 'explore' && e.quizId === ev.quizId)) return { ledger, counted: false, reason: 'you already tried this quiz' };
  if (ev.kind === 'create' && Object.values(ledger.events).some((e) => e.kind === 'create' && e.quizId === ev.quizId)) return { ledger, counted: false, reason: 'this quiz already counted' };
  const next: Ledger = { ...ledger, events: { ...ledger.events, [ev.id]: ev }, flagged };
  return { ledger: refreshUnlocks(next, ev.at), counted: true };
}

const events = <K extends LedgerEvent['kind']>(l: Ledger, k: K) => Object.values(l.events).filter((e): e is Extract<LedgerEvent, { kind: K }> => e.kind === k);

export function progressFor(l: Ledger, c: Criterion): { current: number; target: number; done: boolean } {
  switch (c.type) {
    case 'free': return { current: 1, target: 1, done: true };
    case 'sessions': { const n = events(l, 'session').length; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'reviews': { const n = events(l, 'review').length; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'corrections': { const n = events(l, 'correction').length; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'formats': { const n = new Set(events(l, 'format').map((e) => e.format)).size; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'explore': { const n = events(l, 'explore').length; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'create': { const n = events(l, 'create').length; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'days': { const n = new Set(events(l, 'session').map((e) => e.at.slice(0, 10))).size; return { current: Math.min(n, c.n), target: c.n, done: n >= c.n }; }
    case 'mastery': { const n = events(l, 'session').filter((e) => (e.mastery ?? 0) >= c.percent).length; return { current: Math.min(n, c.sessions), target: c.sessions, done: n >= c.sessions }; }
  }
}
const ITEMS = [...ICONS, ...ALL_FRAMES].map((i) => ({ id: i.id, criterion: i.criterion }));
export function refreshUnlocks(l: Ledger, at: string): Ledger {
  const unlocked = { ...l.unlocked };
  for (const it of ITEMS) if (!unlocked[it.id] && progressFor(l, it.criterion).done) unlocked[it.id] = at;
  return { ...l, unlocked };
}
/** Ownership: free items always, everything else only when the ledger says so. Newcomers see the same catalogue as veterans (118). */
export function owns(l: Ledger, id: string): boolean { return FREE_IDS.includes(id) || !!l.unlocked[id]; }
export function recentlyUnlocked(l: Ledger, limit = 8): string[] { return Object.entries(l.unlocked).sort((a, b) => b[1].localeCompare(a[1])).slice(0, limit).map(([id]) => id); }
export function collectionProgress(l: Ledger, collection: string): { owned: number; total: number } {
  const items = ICONS.filter((i) => i.collection === collection);
  return { owned: items.filter((i) => owns(l, i.id)).length, total: items.length };
}

/* ── Equipment and where it is shown (126, 130) ───────────────────────────────────────────────────────────────────────── */
export type Equipped = { icon?: string; border?: string; nameplate?: string; banner?: string; wheel?: string[] };
export type HostIdentitySettings = { showIdentity: boolean; cosmeticsEnabled: boolean };
/** Hosts may switch every visible identity cosmetic off; teacher opt-out also removes awarding (120). */
export function visibleIdentity(eq: Equipped, host: HostIdentitySettings, l: Ledger): Equipped {
  if (!host.showIdentity || !host.cosmeticsEnabled) return {};
  const keep = (id?: string) => (id && owns(l, id) ? id : undefined);
  return { icon: keep(eq.icon), border: keep(eq.border), nameplate: keep(eq.nameplate), banner: keep(eq.banner) };
}
export function equip(eq: Equipped, l: Ledger, id: string): { eq: Equipped; error?: string } {
  if (!owns(l, id)) return { eq, error: 'You have not unlocked this yet.' };
  const slot = id.startsWith('border.') ? 'border' : id.startsWith('nameplate.') ? 'nameplate' : id.startsWith('banner.') ? 'banner' : ICONS.some((i) => i.id === id) ? 'icon' : null;
  return slot ? { eq: { ...eq, [slot]: id } } : { eq, error: 'Unknown item.' };
}
export function lockerSearch(opts: { query?: string; theme?: string; favoritesOnly?: boolean; favorites?: string[]; recentOnly?: boolean }, l: Ledger) {
  const q = (opts.query ?? '').trim().toLowerCase();
  let items = ICONS.filter((i) => (!q || `${i.name} ${i.label} ${i.theme}`.toLowerCase().includes(q)) && (!opts.theme || i.theme === opts.theme));
  if (opts.favoritesOnly) items = items.filter((i) => opts.favorites?.includes(i.id));
  if (opts.recentOnly) { const r = new Set(recentlyUnlocked(l, 16)); items = items.filter((i) => r.has(i.id)); }
  return items.map((i) => ({ ...i, owned: owns(l, i.id), progress: progressFor(l, i.criterion) }));
}
