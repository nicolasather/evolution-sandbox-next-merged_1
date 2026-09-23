/* ============================================================================
   COMBINATION ENGINE — pure game logic: no React, no DOM beyond the
   localStorage guard. The hook in lib/useSandbox.ts is the only thing that
   knows about rendering.

   It is also a tiny external store: every mutation bumps `version` and tells
   subscribers, so React can read it through useSyncExternalStore instead of
   mirroring its state into hooks.

   Design rules for the "I figured it out" feeling:
   - every unordered pair yields at most one result (tools/rework_recipes.py
     and the validator keep the data that way);
   - a failed pair never reveals a recipe, but it does say which of the two
     items still has something to give (the "nudge");
   - hints are progressive and escalate only while the player stays stuck,
     and the strongest hint names ONE ingredient, never both;
   - undiscovered names, routes and uses are never shown before they are found.
   ========================================================================== */
import type {
  CombineResult, Db, Discovery, Era, HintView, Potential, Stats, StoneAgeTier, TierGate, TierProgress,
} from './types';

const SAVE_KEY = 'evo.sandbox.v1';
const TIERS: StoneAgeTier[] = ['olduvai', 'middle', 'late'];
/** Tries (combinations that did not solve the hint) before the next hint level opens. */
export const HINT_TRIES = 2;
/** Consecutive misses before the bench offers a nudge on its own. */
export const STUCK_AFTER = 4;

export interface Step { a: string; b: string; r: string }

interface HintState { target: string | null; level: 0 | 1 | 2 | 3; tries: number; custom: boolean }

interface Saved {
  v: number; order: string[]; steps: Step[];
  failed: number; failedPairs: string[]; seen: string[];
  /** v2 */
  lockedPairs?: string[]; hint?: HintState; streak?: number; coached?: number;
  /** ISO time each entry was first found, by id. */
  when?: Record<string, number>;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);
const routeKey = (r: string, a: string, b: string) => `${r}|${pairKey(a, b)}`;
const NO_HINT: HintState = { target: null, level: 0, tries: 0, custom: false };

export class Engine {
  readonly db: Db;
  readonly byId: Record<string, Discovery> = Object.create(null);
  private readonly pairIndex = new Map<string, string>();
  /** id → ids of the results it is an ingredient for (derived from recipes, not trusted from data). */
  private readonly usesIndex = new Map<string, Set<string>>();
  private readonly eraIndex: Record<string, number> = Object.create(null);
  private readonly primitives: Set<string>;
  private readonly tierMembers: Record<StoneAgeTier, string[]> = { olduvai: [], middle: [], late: [] };

  found: Set<string>;
  order: string[];
  steps: Step[] = [];
  failed = 0;
  private failedPairs = new Set<string>();
  private lockedPairs = new Set<string>();
  private routes = new Set<string>();
  private seen = new Set<string>();
  private fresh = new Set<string>();
  private when: Record<string, number> = Object.create(null);
  private hint: HintState = { ...NO_HINT };
  /** Consecutive combinations that produced nothing new. */
  streak = 0;
  /** Onboarding stage: 0 = never combined, 1 = has combined, 2 = has discovered something. */
  coached = 0;

  /** True once saved progress has been restored into this engine. */
  resumed = false;
  /** Increments on every change; the snapshot React subscribes to. */
  version = 0;
  private listeners = new Set<() => void>();

  /* ── store protocol (arrow functions: stable identities for React) ──── */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getVersion = (): number => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach(fn => fn());
  }

  constructor(db: Db) {
    this.db = db;
    this.primitives = new Set(db.primitives);
    db.nodes.forEach(n => { this.byId[n.id] = n; });
    db.nodes.forEach(n => n.rec?.forEach(([a, b]) => {
      const k = pairKey(a, b);
      // first declaration wins; the validator (E3) keeps this from ever mattering
      if (!this.pairIndex.has(k)) this.pairIndex.set(k, n.id);
      for (const ing of [a, b]) {
        if (!this.usesIndex.has(ing)) this.usesIndex.set(ing, new Set());
        this.usesIndex.get(ing)!.add(n.id);
      }
    }));
    db.eras.forEach((e, i) => { this.eraIndex[e.id] = i; });
    db.nodes.forEach(n => {
      if (n.stone_age_tier && !this.primitives.has(n.id)) this.tierMembers[n.stone_age_tier].push(n.id);
    });

    this.found = new Set(db.primitives);
    this.order = db.primitives.slice();
  }

  /* ── tier system ────────────────────────────────────────────────────── */
  tierName(t: StoneAgeTier): string { return this.db.stone_age_tiers?.[t]?.name ?? t; }

  getTierProgress(): TierProgress {
    const out = {} as TierProgress;
    for (const t of TIERS) {
      const ids = this.tierMembers[t];
      out[t] = { unlocked: ids.filter(id => this.found.has(id)).length, total: ids.length };
    }
    return out;
  }

  private gateCache = new Map<StoneAgeTier, TierGate>();
  private gateCacheSize = -1;

  /** Whether recipes producing entries of `tier` fire yet, and what it takes to open it. */
  gate(tier: StoneAgeTier): TierGate {
    // `found` only grows between resets, so its size is a sound cache key
    if (this.gateCacheSize !== this.found.size) { this.gateCache.clear(); this.gateCacheSize = this.found.size; }
    const hit = this.gateCache.get(tier);
    if (hit) return hit;
    const g = this.computeGate(tier);
    this.gateCache.set(tier, g);
    return g;
  }

  private computeGate(tier: StoneAgeTier): TierGate {
    const name = this.tierName(tier);
    if (tier === 'olduvai') return { tier, name, open: true, have: 0, need: 0, prevTier: null, prevName: '' };
    const prevTier: StoneAgeTier = tier === 'middle' ? 'olduvai' : 'middle';
    const pct = this.db.stone_age_tiers?.[tier]?.unlock_percentage ?? 25;
    const ids = this.tierMembers[prevTier];
    const need = Math.ceil(ids.length * (pct / 100));
    const have = ids.filter(id => this.found.has(id)).length;
    const prevOpen = this.gate(prevTier).open;
    return { tier, name, open: prevOpen && have >= need, have, need, prevTier, prevName: this.tierName(prevTier) };
  }

  isRecipeUnlocked(resultId: string): boolean {
    const t = this.byId[resultId]?.stone_age_tier;
    return !t || this.gate(t).open;
  }

  getUnlockedTiers(): StoneAgeTier[] { return TIERS.filter(t => this.gate(t).open); }

  /* ── failure copy ───────────────────────────────────────────────────── */
  private static readonly NEAR = [
    'Nothing yet.',
    'No. But not an unreasonable guess.',
    'Plausible. Just not how it went.',
    'These two never met.',
    'Close enough to be interesting. Still nothing.',
  ];
  private static readonly MISSING = [
    'Something is missing between these.',
    'There is a step you have not found yet.',
    'Not on their own.',
  ];

  private failMessage(A: Discovery, B: Discovery): string {
    const eraGap = Math.abs((this.eraIndex[A.era] ?? 0) - (this.eraIndex[B.era] ?? 0));
    const depthGap = Math.abs((A.depth || 0) - (B.depth || 0));
    if (A.id === B.id) return 'Two of the same thing is still one thing.';
    if (eraGap >= 6) return 'Separated by most of human history.';
    if (eraGap >= 3) return Engine.MISSING[(A.no + B.no) % Engine.MISSING.length];
    if (depthGap >= 8) return 'One of these is a long way ahead of the other.';
    return Engine.NEAR[(A.no + B.no) % Engine.NEAR.length];
  }

  /** What an item still has to give. `ready`: something new can be made with it
   *  right now. `later`: it will matter once more is found. `done`: nothing left. */
  potential(id: string): Potential {
    let later = false;
    for (const rid of this.usesIndex.get(id) ?? []) {
      if (this.found.has(rid)) continue;
      const r = this.byId[rid];
      const open = this.isRecipeUnlocked(rid);
      for (const [a, b] of r.rec) {
        if (a !== id && b !== id) continue;
        const other = a === id ? b : a;
        if (open && this.found.has(other)) return 'ready';
        later = true;
      }
    }
    return later ? 'later' : 'done';
  }

  private nudge(A: Discovery, B: Discovery): string | null {
    const pa = this.potential(A.id), pb = A.id === B.id ? pa : this.potential(B.id);
    if (A.id === B.id) {
      if (pa === 'ready') return `${A.n} can still make something new — with a different partner.`;
      if (pa === 'later') return `Hold on to ${A.n}. It matters later.`;
      return `${A.n} has nothing left to give.`;
    }
    if (pa === 'ready' && pb === 'ready') return 'Both still have more to give — just not together.';
    if (pa === 'ready') return `${A.n} can still make something new — just not with ${B.n}.`;
    if (pb === 'ready') return `${B.n} can still make something new — just not with ${A.n}.`;
    if (pa === 'later' || pb === 'later') {
      const x = pa === 'later' ? A : B;
      return `Hold on to ${x.n}. It matters later.`;
    }
    return `${A.n} and ${B.n} have nothing left to give. Look elsewhere.`;
  }

  /* ── the core action ────────────────────────────────────────────────── */
  combine(aId: string, bId: string): CombineResult {
    const A = this.byId[aId], B = this.byId[bId];
    if (!A || !B || !this.found.has(aId) || !this.found.has(bId)) return { status: 'error' };
    const pk = pairKey(aId, bId);
    if (!this.coached) this.coached = 1;

    const rid = this.pairIndex.get(pk);
    if (!rid) {
      const repeat = this.failedPairs.has(pk);
      if (!repeat) { this.failedPairs.add(pk); this.failed++; }
      this.streak++;
      this.hintTry();
      this.save(); this.emit();
      return {
        status: 'fail', repeat, a: A, b: B,
        message: repeat ? 'You tried this pair before. Still nothing.' : this.failMessage(A, B),
        nudge: this.nudge(A, B),
      };
    }

    const node = this.byId[rid];
    if (!this.found.has(rid) && !this.isRecipeUnlocked(rid)) {
      const g = this.gate(node.stone_age_tier!);
      this.lockedPairs.add(pk);
      this.streak = 0; // a right answer, just early: never counts as being stuck
      this.save(); this.emit();
      const left = Math.max(1, g.need - g.have);
      return {
        status: 'tier_locked', a: A, b: B, requiredTier: g.tier, gate: g,
        message: `Right idea — too early. It opens with the ${g.name} stage: ${left} more ${g.prevName} ` +
          `discover${left === 1 ? 'y' : 'ies'} to go. Remember this pair.`,
      };
    }

    const opensBefore = this.getUnlockedTiers();
    const isNew = !this.found.has(rid);
    const rk = routeKey(rid, aId, bId);
    const newRoute = !this.routes.has(rk);
    this.routes.add(rk);
    if (isNew) {
      this.found.add(rid); this.order.push(rid); this.fresh.add(rid);
      this.when[rid] = Date.now();
      this.coached = 2;
      this.streak = 0;
    } else if (newRoute) {
      this.streak = 0;
    } else {
      this.streak++;
    }
    this.steps.push({ a: aId, b: bId, r: rid });
    this.lockedPairs.delete(pk);

    // a solved hint clears itself; any other result is one more try
    let solvedHint = false;
    if (this.hint.target && isNew && this.hint.target === rid) {
      solvedHint = this.hint.level > 0;
      this.hint = { ...NO_HINT };
    } else if (this.hint.target && this.found.has(this.hint.target)) {
      this.hint = { ...NO_HINT };
    } else {
      this.hintTry();
    }

    const opened = this.getUnlockedTiers().filter(t => !opensBefore.includes(t));
    // pairs the player got right too early, which work now
    const reopened: [string, string][] = [];
    if (opened.length) {
      for (const k of this.lockedPairs) {
        const r = this.pairIndex.get(k);
        if (r && !this.found.has(r) && this.isRecipeUnlocked(r)) {
          const [x, y] = k.split(' ');
          reopened.push([x, y]);
        }
      }
    }

    this.save();
    this.emit();
    const rt = this.routeCount(rid);
    return {
      status: isNew ? 'new' : 'known', node, a: A, b: B,
      newRoute: !isNew && newRoute, routes: rt, opened, solvedHint, reopened,
    };
  }

  /* ── routes ─────────────────────────────────────────────────────────── */
  routeCount(id: string): { found: number; total: number } {
    const n = this.byId[id];
    const total = n?.rec?.length ?? 0;
    let found = 0;
    n?.rec?.forEach(([a, b]) => { if (this.routes.has(routeKey(id, a, b))) found++; });
    return { found, total };
  }
  hasRoute(id: string, a: string, b: string) { return this.routes.has(routeKey(id, a, b)); }
  routeTotals() {
    let found = 0, total = 0;
    this.db.nodes.forEach(n => { total += n.rec?.length ?? 0; });
    found = this.routes.size;
    return { found, total };
  }

  /* ── what is within reach ───────────────────────────────────────────── */
  /** Undiscovered entries that some held pair makes right now (tier permitting). */
  withinReach(includeHidden = true): Discovery[] {
    const out: Discovery[] = [];
    for (const n of this.db.nodes) {
      if (this.found.has(n.id) || (!includeHidden && n.hidden)) continue;
      if (!this.isRecipeUnlocked(n.id)) continue;
      if (n.rec?.some(([a, b]) => this.found.has(a) && this.found.has(b))) out.push(n);
    }
    return out;
  }

  /** Fewest undiscovered ingredients between the player and `id` along any single route (0 = ready). */
  distance(id: string): number {
    const n = this.byId[id];
    if (!n || this.found.has(id)) return 0;
    let best = Infinity;
    n.rec?.forEach(([a, b]) => {
      const missing = (this.found.has(a) ? 0 : 1) + (this.found.has(b) || a === b ? 0 : 1);
      best = Math.min(best, missing);
    });
    return best;
  }

  /* ── hints ──────────────────────────────────────────────────────────── */
  private hintTry() {
    if (this.hint.target) this.hint.tries++;
  }

  private pickTarget(): string | null {
    const ready = this.withinReach(false);
    if (!ready.length) return null;
    ready.sort((x, y) => (x.depth || 0) - (y.depth || 0) || (this.eraIndex[x.era] ?? 0) - (this.eraIndex[y.era] ?? 0) || x.no - y.no);
    return ready[0].id;
  }

  /** The ingredient a level-3 hint names: from a ready route, the less obvious (deeper) of the two. */
  private hintIngredient(target: Discovery): Discovery | null {
    const routes = target.rec.filter(([a, b]) => this.found.has(a) && this.found.has(b));
    if (!routes.length) return null;
    const [a, b] = routes[0];
    const A = this.byId[a], B = this.byId[b];
    return (B.depth || 0) > (A.depth || 0) ? B : A;
  }

  /** A description of the target with its own name taken out. */
  riddle(target: Discovery): string {
    let t = target.l1;
    const words = target.n.split(/[\s-]+/).filter(w => w.length > 2);
    for (const w of [target.n, ...words]) {
      t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi'), '…');
    }
    return t;
  }

  private hintText(target: Discovery, level: number): { text: string; highlight: string | null } {
    const era = this.db.eras.find(e => e.id === target.era)?.name ?? '';
    if (level <= 1) {
      const ing = this.hintIngredient(target);
      const from = ing ? this.db.eras.find(e => e.id === ing.era)?.name : era;
      const cat = target.cat === 'technique' ? 'a way of doing something'
        : target.cat === 'material' ? 'a material'
        : ['culture', 'society', 'knowledge', 'economy'].includes(target.cat) ? 'an idea'
        : 'a thing you could hold';
      return { text: `Something new is hiding among your ${from} finds. Think of ${cat}.`, highlight: null };
    }
    if (level === 2) return { text: `Picture this: “${this.riddle(target)}”`, highlight: null };
    const ing = this.hintIngredient(target);
    return {
      text: ing ? `One half of it is ${ing.n}. The other half is yours to find.` : 'Keep experimenting.',
      highlight: ing?.id ?? null,
    };
  }

  /** The current hint, without changing anything. */
  hintView(): HintView {
    const h = this.hint;
    const base = { stuck: this.streak >= STUCK_AFTER };
    if (!h.target || this.found.has(h.target)) {
      return { ...base, targetId: null, level: 0, text: '', highlightId: null, canEscalate: true, triesNeeded: 0, custom: false };
    }
    const target = this.byId[h.target];
    const { text, highlight } = h.level ? this.hintText(target, h.level) : { text: '', highlight: null };
    const triesNeeded = h.level === 0 ? 0 : Math.max(0, HINT_TRIES - h.tries);
    return {
      ...base, targetId: h.target, level: h.level, text, highlightId: highlight,
      canEscalate: h.level < 3 && triesNeeded === 0, triesNeeded: h.level >= 3 ? 0 : triesNeeded, custom: h.custom,
    };
  }

  /** Ask for a hint: opens level 1, or the next level once the player has tried a little more. */
  requestHint(targetId?: string): HintView | { error: string } {
    if (targetId) {
      const t = this.byId[targetId];
      if (!t || this.found.has(targetId)) return { error: 'You already have that one.' };
      if (!this.isRecipeUnlocked(targetId)) {
        const g = this.gate(t.stone_age_tier!);
        return { error: `That one opens with the ${g.name} stage — ${Math.max(1, g.need - g.have)} more ${g.prevName} discoveries first.` };
      }
      const d = this.distance(targetId);
      if (d > 0) return { error: d === 1 ? 'Not within reach yet — one piece is still missing.' : `Not within reach yet — ${d} pieces are still missing.` };
      if (this.hint.target !== targetId) this.hint = { target: targetId, level: 1, tries: 0, custom: true };
    } else if (!this.hint.target || this.found.has(this.hint.target)) {
      const t = this.pickTarget();
      if (!t) return { error: 'Nothing is within reach right now — every held pair has been used up. Try the Archive.' };
      this.hint = { target: t, level: 1, tries: 0, custom: false };
    } else if (this.hint.level < 3 && this.hint.tries >= HINT_TRIES) {
      this.hint = { ...this.hint, level: (this.hint.level + 1) as 1 | 2 | 3, tries: 0 };
    }
    this.save(); this.emit();
    return this.hintView();
  }

  dropHint() { this.hint = { ...NO_HINT }; this.save(); this.emit(); }

  /* ── queries ────────────────────────────────────────────────────────── */
  has(id: string) { return this.found.has(id); }
  get(id: string): Discovery | undefined { return this.byId[id]; }
  recipeFor(a: string, b: string) { return this.pairIndex.get(pairKey(a, b)) ?? null; }
  triedPair(a: string, b: string) { return this.failedPairs.has(pairKey(a, b)); }
  usesOf(id: string): string[] { return [...(this.usesIndex.get(id) ?? [])]; }
  foundAt(id: string): number | null { return this.when[id] ?? null; }

  inventory(filter?: { era?: string; q?: string }): Discovery[] {
    let list = this.order.map(id => this.byId[id]).filter(Boolean);
    if (filter?.era) list = list.filter(n => n.era === filter.era);
    if (filter?.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(n => n.n.toLowerCase().includes(q) || n.tags?.some(t => t.includes(q)));
    }
    return list;
  }

  /** Search the player's own collection. Undiscovered entries are counted, never named. */
  search(q: string, limit = 20): { hits: Discovery[]; hiddenMatches: number } {
    const query = (q || '').trim().toLowerCase();
    if (!query) return { hits: [], hiddenMatches: 0 };
    const out: { node: Discovery; score: number }[] = [];
    let hiddenMatches = 0;
    for (const n of this.db.nodes) {
      const name = n.n.toLowerCase();
      let score = 0;
      if (name === query) score = 100;
      else if (name.startsWith(query)) score = 70;
      else if (name.includes(query)) score = 50;
      else if (n.tags?.some(t => t.includes(query))) score = 30;
      if (!score) continue;
      if (this.found.has(n.id)) out.push({ node: n, score });
      else hiddenMatches++;
    }
    out.sort((x, y) => y.score - x.score || x.node.no - y.node.no);
    return { hits: out.slice(0, limit).map(o => o.node), hiddenMatches };
  }

  availableRecipes(id: string) {
    const n = this.byId[id];
    if (!n) return [];
    return (n.rec || []).map(([a, b]) => ({
      a: this.byId[a], b: this.byId[b], ready: this.found.has(a) && this.found.has(b), found: this.hasRoute(id, a, b),
    }));
  }

  path(): Discovery[] { return this.order.map(id => this.byId[id]); }

  /** The recorded steps that actually fed `id`, oldest first. */
  lineage(id: string): Step[] {
    const want = new Set([id]);
    const chain: Step[] = [];
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const s = this.steps[i];
      if (want.has(s.r)) { chain.push(s); want.add(s.a); want.add(s.b); }
    }
    chain.reverse();
    const seen = new Set<string>();
    return chain.filter(s => (seen.has(s.r) ? false : (seen.add(s.r), true)));
  }

  /** The first step that produced each discovery, in the order they were made. */
  history(): Step[] {
    const seen = new Set<string>();
    return this.steps.filter(s => (seen.has(s.r) ? false : (seen.add(s.r), true)));
  }

  erasReached(): Era[] {
    const set = new Set<string>();
    this.found.forEach(id => set.add(this.byId[id].era));
    return this.db.eras.filter(e => set.has(e.id));
  }

  currentEra(): Era {
    let best = this.db.eras[0], bestI = -1;
    this.found.forEach(id => {
      const i = this.eraIndex[this.byId[id].era];
      if (i > bestI) { bestI = i; best = this.db.eras[i]; }
    });
    return best;
  }

  stats(): Stats {
    let core = 0, hidden = 0, rare = 0;
    this.db.nodes.forEach(n => {
      if (!this.found.has(n.id)) return;
      if (n.hidden) hidden++; else core++;
      if (n.rar === 'rare') rare++;
    });
    // the deepest thing held, a raw material at the start
    const deepest = this.path().reduce<Discovery>(
      (m, n) => ((n.depth || 0) > (m.depth || 0) ? n : m), this.byId[this.db.primitives[0]]);
    const rt = this.routeTotals();
    return {
      core, hidden, rare,
      coreTotal: this.db.counts.core, hiddenTotal: this.db.counts.hidden,
      combos: this.steps.length, failed: this.failed,
      eras: this.erasReached().length, eraTotal: this.db.eras.length,
      percent: Math.round((core / this.db.counts.core) * 100),
      deepest, routesFound: rt.found, routesTotal: rt.total,
    };
  }

  /* ── persistence (best-effort; never load-bearing) ───────────────────── */
  save() {
    if (typeof window === 'undefined') return;
    try {
      const payload: Saved = {
        v: 2, order: this.order, steps: this.steps, failed: this.failed,
        failedPairs: [...this.failedPairs], seen: [...this.seen],
        lockedPairs: [...this.lockedPairs], hint: this.hint, streak: this.streak,
        coached: this.coached, when: this.when,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch { /* private mode or blocked storage — play continues in memory */ }
  }

  load(): boolean {
    if (typeof window === 'undefined') return false;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch { return false; }
    if (!raw) return false;
    try {
      const d = JSON.parse(raw) as Saved;
      if (!d || (d.v !== 1 && d.v !== 2) || !Array.isArray(d.order)) return false;
      const valid = d.order.filter(id => this.byId[id]);
      if (d.v === 1 && valid.length <= this.db.primitives.length) return false;
      for (const p of this.db.primitives) if (!valid.includes(p)) valid.unshift(p);
      this.gateCacheSize = -1;
      this.found = new Set(valid);
      this.order = valid;
      this.steps = (d.steps || []).filter(s => this.byId[s.r] && this.byId[s.a] && this.byId[s.b]);
      // routes are re-derived from the steps, keeping only ones the current data still has
      this.routes = new Set(this.steps
        .filter(s => this.pairIndex.get(pairKey(s.a, s.b)) === s.r)
        .map(s => routeKey(s.r, s.a, s.b)));
      this.failed = d.failed || 0;
      this.failedPairs = new Set(d.failedPairs || []);
      this.lockedPairs = new Set(d.lockedPairs || []);
      this.seen = new Set(d.seen || []);
      this.when = Object.assign(Object.create(null), d.when || {});
      const h = d.hint;
      this.hint = h && (h.target === null || this.byId[h.target]) ? { ...NO_HINT, ...h } : { ...NO_HINT };
      this.streak = d.streak || 0;
      this.coached = d.coached ?? (valid.length > this.db.primitives.length ? 2 : 0);
      this.fresh = new Set();
      this.resumed = valid.length > this.db.primitives.length;
      this.emit();
      return true;
    } catch { return false; }
  }

  reset() {
    this.gateCacheSize = -1;
    this.found = new Set(this.db.primitives);
    this.order = this.db.primitives.slice();
    this.steps = []; this.failed = 0;
    this.failedPairs = new Set(); this.lockedPairs = new Set(); this.routes = new Set();
    this.seen = new Set(); this.fresh = new Set(); this.when = Object.create(null);
    this.hint = { ...NO_HINT }; this.streak = 0;
    this.resumed = false;
    this.emit();
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }

  markSeen(id: string) {
    const wasFresh = this.fresh.delete(id);
    this.seen.add(id);
    this.save();
    if (wasFresh) this.emit();   // only the NEW badge is visible; nothing else to redraw
  }
  isFresh(id: string) { return this.fresh.has(id); }
}

export function createEngine(db: Db) { return new Engine(db); }
