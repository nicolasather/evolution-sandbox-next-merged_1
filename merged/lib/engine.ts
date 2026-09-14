/* ============================================================================
   COMBINATION ENGINE — typed port of the vanilla engine.
   Pure logic: no React, no DOM beyond the localStorage guard. The hook in
   lib/useSandbox.ts is the only thing that knows about rendering.

   It is also a tiny external store: every mutation bumps `version` and tells
   subscribers, so React can read it through useSyncExternalStore instead of
   mirroring its state into hooks.

   ========================================================================== */
import type { CombineResult, Db, Discovery, Era, Stats, StoneAgeTier, TierProgress } from './types';

const SAVE_KEY = 'evo.sandbox.v1';

export interface Step { a: string; b: string; r: string }

interface Saved {
  v: number; order: string[]; steps: Step[];
  failed: number; failedPairs: string[]; seen: string[];
}

const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);

export class Engine {
  readonly db: Db;
  readonly byId: Record<string, Discovery> = Object.create(null);
  private readonly pairIndex = new Map<string, string>();
  private readonly eraIndex: Record<string, number> = Object.create(null);
  private readonly tierRecipeIndex: Record<StoneAgeTier, Set<string>> = {
    olduvai: new Set(),
    middle: new Set(),
    late: new Set(),
  };

  found: Set<string>;
  order: string[];
  steps: Step[] = [];
  failed = 0;
  private failedPairs = new Set<string>();
  private seen = new Set<string>();
  private fresh = new Set<string>();

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
    db.nodes.forEach(n => { this.byId[n.id] = n; });
    db.nodes.forEach(n => n.rec?.forEach(([a, b]) => this.pairIndex.set(pairKey(a, b), n.id)));
    db.eras.forEach((e, i) => { this.eraIndex[e.id] = i; });

    // Build tier recipe index
    db.nodes.forEach(n => {
      if (n.rec && n.stone_age_tier) {
        this.tierRecipeIndex[n.stone_age_tier].add(n.id);
      }
    });

    this.found = new Set(db.primitives);
    this.order = db.primitives.slice();
  }

  /* ── tier system ────────────────────────────────────────────────────── */
  getTierProgress(): TierProgress {
    const progress: TierProgress = {
      olduvai: { unlocked: 0, total: 0 },
      middle: { unlocked: 0, total: 0 },
      late: { unlocked: 0, total: 0 },
    };

    Object.entries(this.tierRecipeIndex).forEach(([tier, recipeIds]) => {
      const tierKey = tier as StoneAgeTier;
      progress[tierKey].total = recipeIds.size;
      recipeIds.forEach(id => {
        if (this.found.has(id)) progress[tierKey].unlocked++;
      });
    });

    return progress;
  }

  isRecipeUnlocked(resultId: string): boolean {
    const node = this.byId[resultId];
    if (!node || !node.stone_age_tier) return true;

    const tier = node.stone_age_tier;
    if (tier === 'olduvai') return true; // Always available

    const progress = this.getTierProgress();
    const tierInfo = this.db.stone_age_tiers?.[tier];
    if (!tierInfo) return true;

    const prevTier = tier === 'middle' ? 'olduvai' : 'middle';
    const prevProgress = progress[prevTier];
    const requiredUnlocks = Math.ceil(prevProgress.total * (tierInfo.unlock_percentage / 100));

    return prevProgress.unlocked >= requiredUnlocks;
  }

  getUnlockedTiers(): StoneAgeTier[] {
    const tiers: StoneAgeTier[] = ['olduvai'];
    const progress = this.getTierProgress();

    // Check if middle is unlocked (50% of olduvai)
    const middleInfo = this.db.stone_age_tiers?.middle;
    if (middleInfo && progress.olduvai.unlocked >= Math.ceil(progress.olduvai.total * 0.5)) {
      tiers.push('middle');

      // Check if late is unlocked (50% of middle)
      const lateInfo = this.db.stone_age_tiers?.late;
      if (lateInfo && progress.middle.unlocked >= Math.ceil(progress.middle.total * 0.5)) {
        tiers.push('late');
      }
    }

    return tiers;
  }

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

  private static yearGap(a: Discovery, b: Discovery): string | null {
    const d = Math.abs((a.ds || 0) - (b.ds || 0));
    if (d < 200) return null;
    if (d >= 1e6) return `${(d / 1e6).toFixed(1).replace('.0', '')} million years`;
    if (d >= 1000) return `${Math.round(d / 1000).toLocaleString()},000 years`;
    return `${Math.round(d).toLocaleString()} years`;
  }

  private failMessage(A: Discovery, B: Discovery): string {
    const gap = Engine.yearGap(A, B);
    const eraGap = Math.abs((this.eraIndex[A.era] ?? 0) - (this.eraIndex[B.era] ?? 0));
    const depthGap = Math.abs((A.depth || 0) - (B.depth || 0));
    if (eraGap >= 6 && gap) return `Separated by roughly ${gap} of prerequisites.`;
    if (eraGap >= 6) return 'Separated by most of human history.';
    if (eraGap >= 3) return Engine.MISSING[(A.no + B.no) % Engine.MISSING.length];
    if (depthGap >= 8) return 'One of these is a long way ahead of the other.';
    if (A.id === B.id) return 'Two of the same thing is still one thing.';
    return Engine.NEAR[(A.no + B.no) % Engine.NEAR.length];
  }

  /* ── the core action ────────────────────────────────────────────────── */
  combine(aId: string, bId: string): CombineResult {
    const A = this.byId[aId], B = this.byId[bId];
    if (!A || !B || !this.found.has(aId) || !this.found.has(bId)) return { status: 'error' };

    const rid = this.pairIndex.get(pairKey(aId, bId));
    if (!rid) {
      const pk = pairKey(aId, bId);
      if (!this.failedPairs.has(pk)) { this.failedPairs.add(pk); this.failed++; this.emit(); }
      return { status: 'fail', message: this.failMessage(A, B), a: A, b: B };
    }

    // Check tier lock
    const node = this.byId[rid];
    if (!this.isRecipeUnlocked(rid)) {
      const requiredTier = node.stone_age_tier || 'late';
      const tierInfo = this.db.stone_age_tiers?.[requiredTier];
      return {
        status: 'tier_locked',
        message: `Unlock ${tierInfo?.name || requiredTier} era by crafting more discoveries.`,
        a: A,
        b: B,
        requiredTier,
      };
    }

    const isNew = !this.found.has(rid);
    if (isNew) { this.found.add(rid); this.order.push(rid); this.fresh.add(rid); }
    this.steps.push({ a: aId, b: bId, r: rid });
    this.save();
    this.emit();
    return { status: isNew ? 'new' : 'known', node, a: A, b: B };
  }

  /* ── queries ────────────────────────────────────────────────────────── */
  has(id: string) { return this.found.has(id); }
  get(id: string): Discovery | undefined { return this.byId[id]; }
  recipeFor(a: string, b: string) { return this.pairIndex.get(pairKey(a, b)) ?? null; }

  inventory(filter?: { era?: string; q?: string }): Discovery[] {
    let list = this.order.map(id => this.byId[id]).filter(Boolean);
    if (filter?.era) list = list.filter(n => n.era === filter.era);
    if (filter?.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(n => n.n.toLowerCase().includes(q) || n.tags?.some(t => t.includes(q)));
    }
    return list;
  }

  /** Full-text search across the whole database, discovered or not. */
  search(q: string, limit = 20): Discovery[] {
    const query = (q || '').trim().toLowerCase();
    if (!query) return [];
    const out: { node: Discovery; score: number }[] = [];
    for (const n of this.db.nodes) {
      const name = n.n.toLowerCase();
      let score = 0;
      if (name === query) score = 100;
      else if (name.startsWith(query)) score = 70;
      else if (name.includes(query)) score = 50;
      else if (n.tags?.some(t => t.includes(query))) score = 30;
      else if (n.l1?.toLowerCase().includes(query)) score = 12;
      if (score) out.push({ node: n, score: score + (this.found.has(n.id) ? 8 : 0) });
    }
    out.sort((x, y) => y.score - x.score || x.node.no - y.node.no);
    return out.slice(0, limit).map(o => o.node);
  }

  availableRecipes(id: string) {
    const n = this.byId[id];
    if (!n) return [];
    return (n.rec || []).map(([a, b]) => ({
      a: this.byId[a], b: this.byId[b], ready: this.found.has(a) && this.found.has(b),
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
    // same rule as the vanilla engine: the deepest thing held, a raw material at the start
    const deepest = this.path().reduce<Discovery>(
      (m, n) => ((n.depth || 0) > (m.depth || 0) ? n : m), this.byId[this.db.primitives[0]]);
    return {
      core, hidden, rare,
      coreTotal: this.db.counts.core, hiddenTotal: this.db.counts.hidden,
      combos: this.steps.length, failed: this.failed,
      eras: this.erasReached().length, eraTotal: this.db.eras.length,
      percent: Math.round((core / this.db.counts.core) * 100),
      deepest,
    };
  }

  /* ── persistence (best-effort; never load-bearing) ───────────────────── */
  save() {
    if (typeof window === 'undefined') return;
    try {
      const payload: Saved = {
        v: 1, order: this.order, steps: this.steps, failed: this.failed,
        failedPairs: [...this.failedPairs], seen: [...this.seen],
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
      if (!d || d.v !== 1 || !Array.isArray(d.order)) return false;
      const valid = d.order.filter(id => this.byId[id]);
      if (valid.length <= this.db.primitives.length) return false;
      this.found = new Set(valid);
      this.order = valid;
      this.steps = (d.steps || []).filter(s => this.byId[s.r]);
      this.failed = d.failed || 0;
      this.failedPairs = new Set(d.failedPairs || []);
      this.seen = new Set(d.seen || []);
      this.fresh = new Set();
      this.resumed = true;
      this.emit();
      return true;
    } catch { return false; }
  }

  reset() {
    this.found = new Set(this.db.primitives);
    this.order = this.db.primitives.slice();
    this.steps = []; this.failed = 0;
    this.failedPairs = new Set(); this.seen = new Set(); this.fresh = new Set();
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
