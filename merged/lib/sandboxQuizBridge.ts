/**
 * Sandbox <-> Quiz bridge.
 *  - Auto-generates quizzes from the Sandbox discovery database (data/db.json) with three question templates and
 *    same-tier distractors, so options cannot be guessed from word length or an obvious era mismatch.
 *  - Reads the player's unlocked discoveries ("My Unlocked Discoveries Boss Quiz") and keeps the small shared state
 *    (XP, badges, revealed catalyst hints) used by both /sandbox and /quiz.
 *
 * The generator takes the node list as a parameter instead of importing db.json, so the (large) dataset stays on the
 * server and the client bundle only pulls in the tiny storage helpers.
 */

export type DbNode = {
  id: string; n: string; era: string; cat: string; ev: string; l1?: string; l3?: string;
  rec?: [string, string][]; uses?: string[]; hidden?: boolean; date?: string; stone_age_tier?: string;
};
export type DbEra = { id: string; name: string };
export type Dataset = { nodes: DbNode[]; eras: DbEra[] };

export type Template = 'formula' | 'evidence' | 'milestone';
export type EvidenceCard = { discoveryId: string; name: string; era: string; evidence: string; detail: string; deepLink: string };
export type RemixQuestion = {
  id: string; template: Template; prompt: string; options: string[]; answerIndex: number;
  /** One contextual sentence per option (used for the Cognitive Trap warning). */
  why: string[]; evidenceCard: EvidenceCard; discoveryId: string;
};
/** What the browser may see: no answerIndex, no `why`/evidence (revealed only after grading). */
export type PublicRemixQuestion = Pick<RemixQuestion, 'id' | 'template' | 'prompt' | 'options'> & { index: number };

export function toPublic(q: RemixQuestion, index: number): PublicRemixQuestion {
  return { id: q.id, template: q.template, prompt: q.prompt, options: q.options, index };
}

/* ── seeded RNG ───────────────────────────────────────────────────────────────────────────────────────────────────── */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/* ── generation ───────────────────────────────────────────────────────────────────────────────────────────────────── */
const usable = (n: DbNode) => !n.hidden && !!n.ev && !!n.rec?.length;
const pairKey = (p: readonly [string, string]) => [...p].sort().join('+');

export type Pools = { all: DbNode[]; byId: Map<string, DbNode>; eraName: Map<string, string>; byTier: Map<string, DbNode[]>; byEra: Map<string, DbNode[]> };
export function buildPools(ds: Dataset): Pools {
  const all = ds.nodes.filter(usable);
  const byId = new Map(ds.nodes.map((n) => [n.id, n] as const));
  const eraName = new Map(ds.eras.map((e) => [e.id, e.name] as const));
  const byTier = new Map<string, DbNode[]>(); const byEra = new Map<string, DbNode[]>();
  for (const n of all) {
    const t = `${n.era}|${n.cat}`;
    (byTier.get(t) ?? byTier.set(t, []).get(t)!).push(n);
    (byEra.get(n.era) ?? byEra.set(n.era, []).get(n.era)!).push(n);
  }
  return { all, byId, eraName, byTier, byEra };
}

/** Three wrong candidates from the SAME era+category tier; widens to the same era, then adjacent eras, only if the tier is too small. */
export function pickDistractors(target: DbNode, pools: Pools, rnd: () => number, accept: (n: DbNode) => boolean, count = 3): DbNode[] {
  const out: DbNode[] = [];
  const seen = new Set<string>([target.id]);
  const take = (list: readonly DbNode[]) => {
    for (const n of shuffle(list, rnd)) {
      if (out.length >= count) return;
      if (seen.has(n.id) || !accept(n)) continue;
      seen.add(n.id); out.push(n);
    }
  };
  take(pools.byTier.get(`${target.era}|${target.cat}`) ?? []);
  if (out.length < count) take(pools.byEra.get(target.era) ?? []);
  if (out.length < count) {
    const eras = [...pools.byEra.keys()]; const i = eras.indexOf(target.era);
    for (const d of [1, -1, 2, -2]) { const e = eras[i + d]; if (e && out.length < count) take(pools.byEra.get(e) ?? []); }
  }
  return out;
}

function card(n: DbNode, pools: Pools): EvidenceCard {
  return { discoveryId: n.id, name: n.n, era: pools.eraName.get(n.era) ?? n.era, evidence: n.ev, detail: (n.l3 ?? n.l1 ?? '').slice(0, 420), deepLink: `/sandbox?inspect=${encodeURIComponent(n.id)}` };
}
const nm = (id: string, pools: Pools) => pools.byId.get(id)?.n ?? id;

function assemble(id: string, template: Template, prompt: string, correct: { text: string; why: string }, wrong: { text: string; why: string }[], target: DbNode, pools: Pools, rnd: () => number): RemixQuestion | null {
  const items = [{ ...correct, ok: true }, ...wrong.map((w) => ({ ...w, ok: false }))];
  if (new Set(items.map((i) => i.text.toLowerCase())).size !== items.length || items.length < 4) return null;
  const order = shuffle(items, rnd);
  return { id, template, prompt, options: order.map((o) => o.text), answerIndex: order.findIndex((o) => o.ok), why: order.map((o) => o.why), evidenceCard: card(target, pools), discoveryId: target.id };
}

export function makeQuestion(target: DbNode, template: Template, pools: Pools, rnd: () => number): RemixQuestion | null {
  const era = pools.eraName.get(target.era) ?? target.era;
  if (template === 'formula') {
    const pair = target.rec![0]!; const key = pairKey(pair);
    const d = pickDistractors(target, pools, rnd, (n) => !n.rec!.some((p) => pairKey(p) === key));
    return assemble(`${target.id}:f`, 'formula', `Combining ${nm(pair[0], pools)} + ${nm(pair[1], pools)} produces which discovery?`,
      { text: target.n, why: `Correct: ${target.n} is built from ${nm(pair[0], pools)} + ${nm(pair[1], pools)}.` },
      d.map((x) => ({ text: x.n, why: `${x.n} belongs to the same stage (${era}) but is made from ${x.rec![0]!.map((i) => nm(i, pools)).join(' + ')}, not ${nm(pair[0], pools)} + ${nm(pair[1], pools)}.` })), target, pools, rnd);
  }
  if (template === 'evidence') {
    const d = pickDistractors(target, pools, rnd, (n) => n.ev.toLowerCase() !== target.ev.toLowerCase());
    return assemble(`${target.id}:e`, 'evidence', `Which scientific evidence validates the existence/emergence of ${target.n}?`,
      { text: target.ev, why: `Correct: this is the evidence recorded for ${target.n}.` },
      d.map((x) => ({ text: x.ev, why: `That is the evidence for ${x.n} (${pools.eraName.get(x.era) ?? x.era}), a different discovery, not for ${target.n}.` })), target, pools, rnd);
  }
  // milestone: what does unlocking the target directly feed into?
  const feeds = (target.uses ?? []).map((u) => pools.byId.get(u)).filter((u): u is DbNode => !!u && usable(u));
  if (!feeds.length) return null;
  const next = feeds[Math.floor(rnd() * feeds.length)]!;
  const usesSet = new Set(target.uses);
  const d = pickDistractors(next, pools, rnd, (n) => !usesSet.has(n.id));
  const nextEra = pools.eraName.get(next.era) ?? next.era;
  return assemble(`${target.id}:m`, 'milestone', `Unlocking ${target.n} directly enables which evolutionary stage?`,
    { text: next.n, why: `Correct: ${target.n} is a direct ingredient of ${next.n} (${nextEra}).` },
    d.map((x) => ({ text: x.n, why: `${x.n} sits in the same tier as ${next.n}, but ${target.n} is not one of its direct ingredients.` })), target, pools, rnd);
}

const TEMPLATES: Template[] = ['formula', 'evidence', 'milestone'];
export type GenerateOptions = { count?: number; seed: number; only?: readonly string[] };
/** Builds a quiz of up to `count` questions, cycling the three templates and never reusing a discovery. */
export function generateQuiz(ds: Dataset, opts: GenerateOptions): RemixQuestion[] {
  const pools = buildPools(ds); const rnd = mulberry32(opts.seed);
  const count = Math.max(1, Math.min(opts.count ?? 10, 25));
  const only = opts.only ? new Set(opts.only) : null;
  const candidates = shuffle(pools.all.filter((n) => !only || only.has(n.id)), rnd);
  const out: RemixQuestion[] = []; const used = new Set<string>();
  let t = 0;
  for (const n of candidates) {
    if (out.length >= count) break;
    if (used.has(n.id)) continue;
    for (let k = 0; k < TEMPLATES.length; k++) {
      const q = makeQuestion(n, TEMPLATES[(t + k) % TEMPLATES.length]!, pools, rnd);
      if (q) { out.push(q); used.add(n.id); t++; break; }
    }
  }
  return out;
}

/* ── shared Sandbox <-> Quiz state (browser only; every access guarded) ───────────────────────────────────────────── */
export const SANDBOX_SAVE_KEY = 'evo.sandbox.v1';
export const SHARED_KEY = 'evo.quiz.shared.v1';
export const MASTERY_THRESHOLD = 0.8;
export const CATALYST_COST_XP = 60;
export const VERIFIED_SCIENTIST = '🌟 Verified Scientist';

export type SharedState = { xp: number; spent: number; badges: string[]; hints: { a: string; b: string }[] };
const EMPTY: SharedState = { xp: 0, spent: 0, badges: [], hints: [] };

function store(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export function readUnlockedIds(): string[] {
  try { const raw = store()?.getItem(SANDBOX_SAVE_KEY); const d = raw ? JSON.parse(raw) as { order?: unknown } : null; return Array.isArray(d?.order) ? d.order.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}
export function readShared(): SharedState {
  try {
    const raw = store()?.getItem(SHARED_KEY); if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw) as Partial<SharedState>;
    return { xp: Math.max(0, Number(d.xp) || 0), spent: Math.max(0, Number(d.spent) || 0), badges: Array.isArray(d.badges) ? d.badges.filter((b) => typeof b === 'string') : [], hints: Array.isArray(d.hints) ? d.hints.filter((h) => h && typeof h.a === 'string' && typeof h.b === 'string') : [] };
  } catch { return { ...EMPTY }; }
}
function writeShared(s: SharedState) { try { store()?.setItem(SHARED_KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }
export const availableXp = (s: SharedState) => Math.max(0, s.xp - s.spent);
export function addXp(amount: number): SharedState { const s = readShared(); s.xp += Math.max(0, Math.floor(amount)); writeShared(s); return s; }
export function masteryEarned(correct: number, total: number): boolean { return total > 0 && correct / total >= MASTERY_THRESHOLD; }
export function awardBadge(badge: string): SharedState { const s = readShared(); if (!s.badges.includes(badge)) s.badges.push(badge); writeShared(s); return s; }

/** A recipe pair the player can already combine (both ingredients unlocked) whose result is not yet unlocked and not yet revealed. */
export function findCatalystHint(nodes: readonly DbNode[], unlocked: readonly string[], revealed: readonly { a: string; b: string }[]): { a: string; b: string; resultId: string } | null {
  const have = new Set(unlocked); const seen = new Set(revealed.map((h) => pairKey([h.a, h.b])));
  const sorted = nodes.filter((n) => !n.hidden && !have.has(n.id) && n.rec?.length).sort((x, y) => x.id.localeCompare(y.id));
  for (const n of sorted) for (const [a, b] of n.rec!) if (have.has(a) && have.has(b) && !seen.has(pairKey([a, b]))) return { a, b, resultId: n.id };
  return null;
}
/** Spends XP and records the revealed pair. Returns null if XP is short. */
export function spendXpOnHint(pair: { a: string; b: string }): SharedState | null {
  const s = readShared(); if (availableXp(s) < CATALYST_COST_XP) return null;
  s.spent += CATALYST_COST_XP; s.hints.push({ a: pair.a, b: pair.b }); writeShared(s); return s;
}
