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
import { ACTIONS, capabilityNote, refusal } from './processing/actions';
import { assess as assessSet, probe as probeSet, type AssessCtx, type Pull, type RecipeRow } from './processing/assess';
import { multiKey } from './processing/overlay';
import { actionLine, behaviourLine, coachLine, level2Form, likeLine } from './processing/coach';
import { insightFor } from './processing/insights';
import { physicsOf } from './processing/physics';
import { rolePhrase, sayRoles, tagsOf } from './processing/tags';
import { TECHNIQUES, TECH_BY_ID, ruleHolds, type Family } from './processing/techniques';
import type { Capability, Processing, TransformDef } from './processing/types';
import type {
  ActionId, CombineResult, Db, Discovery, Era, FailInfo, HintLevel, HintView, Potential, ProcessResult,
  ProcessRoute, Stats, StoneAgeTier, TierGate, TierProgress,
} from './types';

const SAVE_KEY = 'evo.sandbox.v1';
const TIERS: StoneAgeTier[] = ['olduvai', 'middle', 'late'];
/** Tries (combinations that did not solve the hint) before the next hint level opens. */
export const HINT_TRIES = 2;
/** Consecutive misses before the bench offers a nudge on its own. */
export const STUCK_AFTER = 4;

/** One thing that was done: assemble `a`, `b` (+ `x`) into `r`, or work `a` with action `p`. */
export interface Step { a: string; b: string; r: string; x?: string[]; p?: ActionId }

/** Every ingredient of a step, in the order they were put down. */
export const stepItems = (s: Step): string[] => (s.p ? [s.a] : [s.a, s.b, ...(s.x ?? [])]);

interface HintState { target: string | null; level: HintLevel; tries: number; custom: boolean }

/** A technique the player has just learned — the interface announces it once. */
export interface Reveal {
  kind: 'technique';
  action: ActionId;
  label: string;
  family: Family;
  /** One line on what it is, never a recipe. */
  message: string;
  /** How many things already held could react to it (never which). */
  affects: number;
  /** How it came: by holding what it needs, or by answering a question. */
  via: 'found' | 'question';
}

interface Saved {
  v: number; order: string[]; steps: Step[];
  failed: number; failedPairs: string[]; seen: string[];
  /** v2 */
  lockedPairs?: string[]; hint?: HintState; streak?: number; coached?: number;
  /** ISO time each entry was first found, by id. */
  when?: Record<string, number>;
  /** v3: everything held in the order it came (discoveries and worked states). */
  bag?: string[];
  /** For the personal journal — discoveries made total, and how many leant on an escalated hint. Additive; older saves simply lack them. */
  discoveredCount?: number; hintedCount?: number;
  /** v4: techniques known, in the order learned. */
  known?: ActionId[];
  /** v4: small things noticed while working (see processing/insights.ts). */
  insights?: string[];
}

export const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);
const routeKey = (r: string, a: string, b: string) => `${r}|${pairKey(a, b)}`;
const setKey = (r: string, ids: readonly string[]) => `${r}|${multiKey(ids)}`;
const viaKey = (r: string, v: ProcessRoute) => `${r}|@${v.from}:${v.action}`;
/** Longest hint ladder: conceptual, directional, kind of work, how many, what kind of pieces. */
export const MAX_HINT: HintLevel = 5;

/** One way in, as the exhibit and the graph show it. */
export interface RecipeView {
  items: Discovery[];
  /** First two, for callers that still speak in pairs. */
  a: Discovery; b: Discovery;
  ready: boolean;
  found: boolean;
  /** Set for a way of working one thing. */
  action: ActionId | null;
}
const NO_HINT: HintState = { target: null, level: 0, tries: 0, custom: false };

export class Engine {
  readonly db: Db;
  readonly byId: Record<string, Discovery> = Object.create(null);
  readonly proc: Processing | undefined;
  /** multiset key → the entry it makes (first declaration wins). */
  private readonly pairIndex = new Map<string, string>();
  /** Every recipe, flat: the table assess() and probe() read. */
  private readonly rows: RecipeRow[] = [];
  /** id → ids of the results it is an ingredient for (derived from recipes, not trusted from data). */
  private readonly usesIndex = new Map<string, Set<string>>();
  private readonly eraIndex: Record<string, number> = Object.create(null);
  private readonly primitives: Set<string>;
  private readonly tierMembers: Record<StoneAgeTier, string[]> = { olduvai: [], middle: [], late: [] };

  /** Discoveries held (counted, numbered, shown in the archive). */
  found: Set<string>;
  /** Discoveries in the order they were made. */
  order: string[];
  /** Worked and offered forms held: Stick, Clay… Never counted. */
  states = new Set<string>();
  /** Everything held, discoveries and states, in the order it came. */
  bag: string[];
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
  /** Techniques known, in the order learned. */
  known: ActionId[] = [];
  private knownSet = new Set<ActionId>();
  private reveals: Reveal[] = [];
  /** Learned this session and not yet used: the rail lets these pulse. */
  private newTech = new Set<ActionId>();
  /** Small observations already made. */
  private insights = new Set<string>();
  /** What has been tried on each piece this session — the coach reads it; it is never a verdict. */
  private tried = new Map<string, Set<ActionId>>();
  /** Onboarding stage: 0 = never combined, 1 = has combined, 2 = has discovered something. */
  coached = 0;
  /** For the personal journal (never shown as a live counter, only a recap): discoveries made, and how many were made while a hint past level 0 was open on them. */
  discoveredCount = 0;
  private hintedCount = 0;

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
    this.syncTechniques();
    this.version++;
    this.listeners.forEach(fn => fn());
  }

  constructor(db: Db) {
    this.db = db;
    this.proc = db.proc;
    this.primitives = new Set(db.primitives);
    db.nodes.forEach(n => { this.byId[n.id] = n; });
    db.states?.forEach(n => { this.byId[n.id] = n; });
    const use = (ing: string, result: string) => {
      if (!this.usesIndex.has(ing)) this.usesIndex.set(ing, new Set());
      this.usesIndex.get(ing)!.add(result);
    };
    db.nodes.forEach(n => n.rec?.forEach(r => {
      const k = multiKey(r);
      // first declaration wins; the validator (E3) keeps this from ever mattering
      if (!this.pairIndex.has(k)) this.pairIndex.set(k, n.id);
      this.rows.push({ result: n.id, ing: r.slice().sort(), key: k });
      r.forEach(ing => use(ing, n.id));
    }));
    [...db.nodes, ...(db.states ?? [])].forEach(n => n.via?.forEach(v => use(v.from, n.id)));
    db.eras.forEach((e, i) => { this.eraIndex[e.id] = i; });
    db.nodes.forEach(n => {
      if (n.stone_age_tier && !this.primitives.has(n.id)) this.tierMembers[n.stone_age_tier].push(n.id);
    });

    this.found = new Set(db.primitives);
    this.order = db.primitives.slice();
    this.bag = db.primitives.slice();
    this.syncTechniques(true);
  }

  /* ── techniques ─────────────────────────────────────────────────────── */
  /** Whether the player has learned this technique yet. */
  knows(a: ActionId): boolean { return this.knownSet.has(a); }

  /** How many held resources have something to give to this action (never which). */
  affectedBy(a: ActionId): number {
    const proc = this.proc;
    if (!proc) return 0;
    let n = 0;
    for (const id of this.bag) if (proc.byFrom.get(id)?.some(t => t.action === a)) n++;
    return n;
  }

  /** How many held things still have a known technique worth trying on them, never tried yet
   *  (each item counted once even if several of its ways are still open) — for the "welcome
   *  back" recap. Never which, and never a live counter during play. */
  openWork(): number {
    const proc = this.proc;
    if (!proc) return 0;
    let n = 0;
    for (const id of this.bag) {
      const ts = proc.byFrom.get(id);
      if (!ts) continue;
      const done = this.tried.get(id);
      for (const t of ts) {
        if (!this.knownSet.has(t.action)) continue;
        if (done?.has(t.action)) continue;
        if (t.needs && !this.hasCap(t.needs)) continue;
        n++;
        break;
      }
    }
    return n;
  }

  private learn(a: ActionId, via: 'found' | 'question', silent: boolean): boolean {
    if (this.knownSet.has(a)) return false;
    this.knownSet.add(a); this.known.push(a);
    if (!silent) {
      this.newTech.add(a);
      const t = TECH_BY_ID[a];
      this.reveals.push({ kind: 'technique', action: a, label: t.label, family: t.family, message: t.reveal, affects: this.affectedBy(a), via });
    }
    return true;
  }

  /** Learn every technique whose condition now holds. `silent`: restoring a save, nothing to announce. */
  private syncTechniques(silent = false): void {
    for (const t of TECHNIQUES) {
      if (this.knownSet.has(t.id)) continue;
      if (ruleHolds(t.unlock, id => this.holds(id), c => this.hasCap(c))) this.learn(t.id, 'found', silent);
    }
  }

  /** A correct answer can teach a technique early. Returns whether it was new. */
  teach(a: ActionId): boolean {
    if (!TECH_BY_ID[a]) return false;
    const fresh = this.learn(a, 'question', false);
    if (fresh) { this.save(); this.emit(); }
    return fresh;
  }

  /** Learned this session and not yet picked up. */
  isNewTech(a: ActionId): boolean { return this.newTech.has(a); }
  /** The player has taken it up: it stops pulsing. */
  usedTech(a: ActionId): void { if (this.newTech.delete(a)) this.emit(); }

  /** Techniques learned since the interface last looked. */
  takeReveals(): Reveal[] { const r = this.reveals; this.reveals = []; return r; }
  peekReveals(): number { return this.reveals.length; }

  /** Techniques still unknown that could act on something held once learned, as a count — for a foreshadowing line. */
  lockedCount(): number { return TECHNIQUES.length - this.knownSet.size; }

  /* ── holding ────────────────────────────────────────────────────────── */
  /** In hand: a discovery or a worked state. */
  holds(id: string): boolean { return this.found.has(id) || this.states.has(id); }

  /** Whether the player holds something that gives their hands this ability. */
  hasCap(cap: Capability): boolean {
    const set = this.proc?.capSet[cap];
    if (!set) return false;
    for (const id of set) if (this.holds(id)) return true;
    return false;
  }

  /** The states held, in order. */
  heldStates(): Discovery[] { return this.bag.filter(id => this.states.has(id)).map(id => this.byId[id]); }

  private addState(id: string) {
    if (this.states.has(id)) return false;
    this.states.add(id); this.bag.push(id); this.fresh.add(id);
    this.when[id] = Date.now();
    return true;
  }

  /** The world offers a new material once its condition is met (Soil after the first Stick). */
  private runUnlocks(): Discovery[] {
    const out: Discovery[] = [];
    const proc = this.proc;
    if (!proc) return out;
    let again = true;
    while (again) {
      again = false;
      for (const u of proc.unlocks) {
        if (this.holds(u.give)) continue;
        const ok = u.any ? u.when.some(w => this.holds(w)) : u.when.every(w => this.holds(w));
        if (ok && this.byId[u.give] && this.addState(u.give)) { out.push(this.byId[u.give]); again = true; }
      }
    }
    return out;
  }

  /** The line to say when the world offers `id`. */
  unlockNote(id: string): string | null { return this.proc?.unlocks.find(u => u.give === id)?.say ?? null; }

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
      if (this.holds(rid)) continue;
      const r = this.byId[rid];
      const open = this.isRecipeUnlocked(rid);
      for (const rec of r.rec) {
        const at = rec.indexOf(id);
        if (at < 0) continue;
        const others = rec.filter((_, i) => i !== at);
        if (open && others.every(o => this.holds(o))) return 'ready';
        later = true;
      }
      for (const v of r.via ?? []) {
        if (v.from !== id) continue;
        if (open && this.canWork(v)) return 'ready';
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

  /* ── reading a set of pieces without committing to it ────────────────── */
  private ctx: AssessCtx = {
    rows: this.rows,
    live: id => !this.found.has(id) && this.isRecipeUnlocked(id),
    holds: id => this.holds(id),
    get: id => this.byId[id],
    proc: undefined,
    eraGap: (a, b) => Math.abs((this.eraIndex[a.era] ?? 0) - (this.eraIndex[b.era] ?? 0)),
    plain: items => {
      let A = items[0], B = items[1] ?? items[0];
      let best = -1;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const gap = Math.abs((this.eraIndex[items[i].era] ?? 0) - (this.eraIndex[items[j].era] ?? 0));
        if (gap > best) { best = gap; A = items[i]; B = items[j]; }
      }
      return this.failMessage(A, B);
    },
  };

  private probeMemo = new Map<string, { pull: Pull; missing: number }>();
  private probeStamp = '';

  /** What the bench should feel for these pieces (pull toward each other, near-complete wobble). */
  probe(ids: string[]): { pull: Pull; missing: number } {
    const stamp = `${this.found.size}|${this.states.size}`;
    if (stamp !== this.probeStamp) { this.probeMemo.clear(); this.probeStamp = stamp; }
    const key = multiKey(ids);
    const hit = this.probeMemo.get(key);
    if (hit) return hit;
    if (!this.ctx.proc) this.ctx.proc = this.proc;
    const r = ids.length < 2 ? { pull: 'none' as Pull, missing: 0 } : probeSet(this.ctx, ids);
    this.probeMemo.set(key, r);
    return r;
  }

  /** Why these pieces made nothing, without naming what they might have made. */
  assess(ids: string[]): FailInfo {
    if (!this.ctx.proc) this.ctx.proc = this.proc;
    const info = assessSet(this.ctx, ids);
    // the count of missing pieces is a level-4 fact
    if (info.kind === 'incomplete') {
      const n = info.missing;
      if (this.hint.level >= 4) info.message = `You are on the right road. It needs ${n === 1 ? 'one more piece' : `${n} more pieces`}.`;
      else info.missing = 0;
    }
    return info;
  }

  /* ── the core action ────────────────────────────────────────────────── */
  combine(aId: string, bId: string): CombineResult { return this.combineMany([aId, bId]); }

  /** Put 2–5 pieces together. Order never matters; repeats are allowed. */
  combineMany(ids: string[]): CombineResult {
    if (ids.length < 2 || ids.length > 5) return { status: 'error' };
    const items = ids.map(i => this.byId[i]);
    if (items.some(x => !x) || ids.some(i => !this.holds(i))) return { status: 'error' };
    const A = items[0], B = items[1];
    const pk = multiKey(ids);
    if (!this.coached) this.coached = 1;

    const rid = this.pairIndex.get(pk);
    if (!rid) {
      const repeat = this.failedPairs.has(pk);
      if (!repeat) { this.failedPairs.add(pk); this.failed++; }
      this.streak++;
      this.hintTry();
      const info = this.assess(ids);
      this.save(); this.emit();
      return {
        status: 'fail', repeat, a: A, b: B, items, info,
        message: repeat ? `You tried this ${ids.length === 2 ? 'pair' : 'combination'} before. Still nothing.` : info.message,
        nudge: ids.length === 2 ? this.nudge(A, B) : null,
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
        status: 'tier_locked', a: A, b: B, items, requiredTier: g.tier, gate: g,
        message: `Right idea — too early. It opens with the ${g.name} stage: ${left} more ${g.prevName} ` +
          `discover${left === 1 ? 'y' : 'ies'} to go. Remember this pair.`,
      };
    }

    this.lockedPairs.delete(pk);
    const [a, b, ...x] = ids;
    const made = this.commit(rid, ids, setKey(rid, ids), x.length ? { a, b, r: rid, x } : { a, b, r: rid });
    this.save();
    this.emit();
    return made;
  }

  /** Record that `rid` was made — new, or by a way already known — and settle hints, tiers and world offers. */
  private commit(rid: string, itemIds: string[], rk: string, step: Step, via?: ProcessRoute):
    Extract<CombineResult, { status: 'new' | 'known' }> {
    const node = this.byId[rid];
    const opensBefore = this.getUnlockedTiers();
    const isNew = !this.found.has(rid);
    let firstOfEra = false;
    if (isNew) { firstOfEra = true; for (const f of this.found) if (this.byId[f].era === node.era) { firstOfEra = false; break; } }
    const newRoute = !this.routes.has(rk);
    this.routes.add(rk);
    if (isNew) {
      this.found.add(rid); this.order.push(rid); this.bag.push(rid); this.fresh.add(rid);
      this.when[rid] = Date.now();
      this.coached = 2;
      this.streak = 0;
    } else if (newRoute) {
      this.streak = 0;
    } else {
      this.streak++;
    }
    this.steps.push(step);

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
    if (isNew) { this.discoveredCount++; if (solvedHint) this.hintedCount++; }

    const unlocked = this.runUnlocks();
    const opened = this.getUnlockedTiers().filter(t => !opensBefore.includes(t));
    // pairs the player got right too early, which work now
    const reopened: string[][] = [];
    if (opened.length) {
      for (const k of this.lockedPairs) {
        const r = this.pairIndex.get(k);
        if (r && !this.found.has(r) && this.isRecipeUnlocked(r)) reopened.push(k.split(' '));
      }
    }
    const items = itemIds.map(i => this.byId[i]);
    return {
      status: isNew ? 'new' : 'known', node, items, a: items[0], b: items[1] ?? items[0], process: via,
      newRoute: !isNew && newRoute, routes: this.routeCount(rid), opened, solvedHint, reopened, unlocked, firstOfEra,
    };
  }

  /* ── working one resource with a hand action ─────────────────────────── */
  /** The capability an action on `from` asks for, if any. */
  needsOf(from: string, action: ActionId): Capability | undefined {
    return this.proc?.byFrom.get(from)?.find(t => t.action === action)?.needs;
  }

  /** Could this way of working be done right now (piece held, capability held)? */
  canWork(v: ProcessRoute): boolean {
    if (!this.holds(v.from) || !this.knows(v.action)) return false;
    const n = this.needsOf(v.from, v.action);
    return !n || this.hasCap(n);
  }

  private bareHands(action: ActionId, n: Discovery): string {
    if (action === 'cut') return `Bare hands will not cut ${n.n}.`;
    if (action === 'dig') return `Bare hands will not get far into ${n.n}.`;
    return `Not with bare hands.`;
  }

  /** Smash, cut, brush, separate or dig ONE resource. Materials answer by what they are made of. */
  process(id: string, action: ActionId): ProcessResult {
    const from = this.byId[id];
    const proc = this.proc;
    if (!from || !proc || !this.holds(id) || !ACTIONS[action]) return { status: 'error' };
    if (!this.coached) this.coached = 1;
    this.noteTried(id, action);

    const nothing = (reason: 'material' | 'tool' | 'spent' | 'locked', message: string, note: string | null = null,
      kind?: 'impossible' | 'close' | 'wrong_action'): ProcessResult => {
      this.streak++;
      if (reason !== 'spent') this.hintTry();
      this.save(); this.emit();
      const k = reason === 'material' ? (kind ?? 'impossible') : reason;
      const insight = reason === 'spent' || reason === 'locked' ? undefined : this.notice(id, action, 'nothing');
      return { status: 'nothing', action, from, reason, kind: k, message, note, ...(insight ? { insight } : {}) };
    };

    const ts = (proc.byFrom.get(id) ?? []).filter((t: TransformDef) => t.action === action);
    if (!ts.length) {
      // right material, wrong way? the refusal says so without saying which way is right
      const others = proc.byFrom.get(id) ?? [];
      const oneStepOff = others.some(o => o.out.some(out => proc.byFrom.get(out)?.some(t2 => t2.action === action)));
      if (oneStepOff) {
        return nothing('material', `${from.n} is not ready for that yet. Something has to be done to it first.`,
          null, 'close');
      }
      const text = refusal(action, from, tagsOf(proc, from));
      if (others.length) return nothing('material', text, `${from.n} does respond to work — just not like this.`, 'wrong_action');
      return nothing('material', text, null, 'impossible');
    }
    const t = ts[0];
    if (t.needs && !this.hasCap(t.needs)) return nothing('tool', this.bareHands(action, from), capabilityNote(t.needs));
    if (!this.knows(action)) return nothing('locked', 'You have not learned how to do that yet.');

    // outputs the tier still holds back
    const outs = t.out.map(o => this.byId[o]).filter(Boolean);
    const open = outs.filter(o => o.state || this.found.has(o.id) || this.isRecipeUnlocked(o.id));
    if (!open.length) {
      const g = this.gate(outs[0].stone_age_tier!);
      this.streak = 0;
      this.save(); this.emit();
      return {
        status: 'tier_locked', action, from, gate: g,
        message: `Right idea — too early. It opens with the ${g.name} stage.`,
      };
    }

    // nothing here the player does not already have
    const isSpent = open.every(o => (o.state ? this.states.has(o.id)
      : this.found.has(o.id) && this.routes.has(viaKey(o.id, { from: id, action }))));
    if (isSpent) return nothing('spent', 'Nothing more comes of it. You have already made everything this gives.');

    const outputs: Discovery[] = [], fresh: Discovery[] = [];
    const discoveries: Extract<CombineResult, { status: 'new' | 'known' }>[] = [];
    let unlocked: Discovery[] = [];
    for (const o of open) {
      outputs.push(o);
      if (o.state) {
        if (this.addState(o.id)) {
          fresh.push(o);
          this.steps.push({ a: id, b: id, r: o.id, p: action });
          this.streak = 0;
        }
      } else {
        const via = { from: id, action };
        const made = this.commit(o.id, [id], viaKey(o.id, via), { a: id, b: id, r: o.id, p: action }, via);
        discoveries.push(made);
      }
    }
    unlocked = [...unlocked, ...this.runUnlocks(), ...discoveries.flatMap(d => d.unlocked)];
    unlocked = unlocked.filter((u, i, arr) => arr.findIndex(z => z.id === u.id) === i);
    // work that made a state is one more try at any hint, unless it was the hint's own answer
    if (!discoveries.length && this.hint.target && !this.holds(this.hint.target)) this.hintTry();
    const insight = this.notice(id, action, 'done');
    this.save(); this.emit();
    return {
      status: 'done', action, from, outputs, discoveries, fresh, unlocked,
      message: t.say ?? `${from.n}, worked.`,
      ...(insight ? { insight } : {}),
    };
  }

  private noteTried(id: string, action: ActionId) {
    let set = this.tried.get(id);
    if (!set) { set = new Set(); this.tried.set(id, set); }
    set.add(action);
  }

  /** A small thing about what the material is like, noticed once. */
  private notice(from: string, action: ActionId, on: 'done' | 'nothing') {
    const ins = insightFor(from, action, on);
    if (!ins || this.insights.has(ins.id)) return undefined;
    this.insights.add(ins.id);
    return { id: ins.id, text: ins.text, property: ins.property };
  }

  /** Observations made so far (for the questions and the coach). */
  insightsSeen(): string[] { return [...this.insights]; }

  /** Whether the player has tried working anything with their hands yet. */
  triedAnyWork(): boolean { return this.tried.size > 0 || this.steps.some(s => !!s.p); }

  /* ── routes ─────────────────────────────────────────────────────────── */
  routeCount(id: string): { found: number; total: number } {
    const n = this.byId[id];
    const total = (n?.rec?.length ?? 0) + (n?.via?.length ?? 0);
    let found = 0;
    n?.rec?.forEach(r => { if (this.routes.has(setKey(id, r))) found++; });
    n?.via?.forEach(v => { if (this.routes.has(viaKey(id, v))) found++; });
    return { found, total };
  }
  hasRoute(id: string, a: string, b: string) { return this.routes.has(routeKey(id, a, b)); }
  hasRouteOf(id: string, ids: readonly string[]) { return this.routes.has(setKey(id, ids)); }
  hasViaRoute(id: string, v: ProcessRoute) { return this.routes.has(viaKey(id, v)); }
  routeTotals() {
    let total = 0, found = 0;
    this.db.nodes.forEach(n => { total += (n.rec?.length ?? 0) + (n.via?.length ?? 0); });
    this.db.nodes.forEach(n => { found += this.routeCount(n.id).found; });
    return { found, total };
  }

  /* ── what is within reach ───────────────────────────────────────────── */
  /** Undiscovered entries that something held makes right now (tier permitting). */
  withinReach(includeHidden = true): Discovery[] {
    const out: Discovery[] = [];
    for (const n of this.db.nodes) {
      if (this.found.has(n.id) || (!includeHidden && n.hidden)) continue;
      if (!this.isRecipeUnlocked(n.id)) continue;
      if (n.rec?.some(r => r.every(i => this.holds(i))) || n.via?.some(v => this.canWork(v))) out.push(n);
    }
    return out;
  }

  /** Fewest missing pieces between the player and `id` along any single route (0 = ready). */
  distance(id: string): number {
    const n = this.byId[id];
    if (!n || this.found.has(id)) return 0;
    let best = Infinity;
    n.rec?.forEach(r => {
      const missing = new Set(r.filter(i => !this.holds(i))).size;
      best = Math.min(best, missing);
    });
    n.via?.forEach(v => {
      const cap = this.needsOf(v.from, v.action);
      best = Math.min(best, (this.holds(v.from) ? 0 : 1) + (cap && !this.hasCap(cap) ? 1 : 0));
    });
    return best;
  }

  /* ── hints ──────────────────────────────────────────────────────────── */
  private hintTry() {
    if (!this.hint.target) return;
    this.hint.tries++;
    // stuck for long enough: the next rung opens by itself
    if (this.hint.level > 0 && this.hint.level < MAX_HINT && this.hint.tries >= HINT_TRIES * 2) {
      this.hint = { ...this.hint, level: (this.hint.level + 1) as HintLevel, tries: 0 };
    }
  }

  private pickTarget(): string | null {
    const ready = this.withinReach(false);
    if (!ready.length) return null;
    ready.sort((x, y) => (x.depth || 0) - (y.depth || 0) || (this.eraIndex[x.era] ?? 0) - (this.eraIndex[y.era] ?? 0) || x.no - y.no);
    return ready[0].id;
  }

  /** The way in a hint leans on: a ready assembly, else a ready piece of work. */
  private readyRoute(target: Discovery): { via: ProcessRoute } | { set: string[] } | null {
    const set = target.rec.filter(r => r.every(i => this.holds(i)))
      .sort((p, q) => p.length - q.length)[0];
    const via = target.via?.find(v => this.canWork(v));
    // prefer the plainer road
    if (via && (!set || set.length > 1)) return { via };
    if (set) return { set };
    return via ? { via } : null;
  }

  /** The ingredient a level-5 hint marks: from a ready route, the less obvious (deeper) piece. */
  private hintIngredient(target: Discovery): Discovery | null {
    const r = this.readyRoute(target);
    if (!r) return null;
    if ('via' in r) return this.byId[r.via.from];
    return r.set.map(i => this.byId[i]).reduce((m, x) => ((x.depth || 0) > (m.depth || 0) ? x : m));
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

  private hintText(target: Discovery, level: number):
    { text: string; highlight: string | null; action: ActionId | null; ghost: { action: ActionId; from: string } | null } {
    const era = this.db.eras.find(e => e.id === target.era)?.name ?? '';
    const none = { highlight: null, action: null, ghost: null };
    if (level <= 1) {
      const ing = this.hintIngredient(target);
      const from = ing ? this.db.eras.find(e => e.id === ing.era)?.name : era;
      const cat = target.cat === 'technique' ? 'a way of doing something'
        : target.cat === 'material' ? 'a material'
        : ['culture', 'society', 'knowledge', 'economy'].includes(target.cat) ? 'an idea'
        : 'a thing you could hold';
      return { text: `Something new is hiding among your ${from} finds. Think of ${cat}.`, ...none };
    }
    if (level === 2) {
      // three shapes of the same rung, stable per target: what a piece is like, a riddle, or how a piece behaves
      const ing = this.hintIngredient(target);
      const form = level2Form(target.id);
      if (ing && form !== 1) {
        const ph = physicsOf(this.proc, ing);
        const text = (form === 2 ? behaviourLine(ph) : null) ?? likeLine(ph, !!ing.state);
        return { text, ...none };
      }
      return { text: `Picture this: “${this.riddle(target)}”`, ...none };
    }

    const route = this.readyRoute(target);
    if (level === 3) {
      if (route && 'via' in route) {
        const tried = [...(this.tried.get(route.via.from) ?? [])].filter(a => a !== route.via.action).map(a => ACTIONS[a].label);
        return { text: actionLine(ACTIONS[route.via.action].label, tried), highlight: null, action: route.via.action, ghost: null };
      }
      const stateIn = route && 'set' in route ? route.set.find(i => this.states.has(i)) : undefined;
      if (stateIn) {
        const act = this.proc?.byOut.get(stateIn)?.[0]?.action ?? null;
        return { text: 'It is put together — but one of the pieces has been worked first.', highlight: null, action: act, ghost: null };
      }
      return { text: 'It is put together from pieces. No working needed.', ...none };
    }
    if (level === 4) {
      if (route && 'via' in route) {
        // a faint hand shows the gesture on the piece, if it is on the bench
        return {
          text: 'Watch the hand. This is how it is done — on one piece.',
          highlight: route.via.from, action: route.via.action, ghost: { action: route.via.action, from: route.via.from },
        };
      }
      const n = route && 'set' in route ? route.set.length : 2;
      const dup = route && 'set' in route && new Set(route.set).size < route.set.length ? ', one of them twice' : '';
      return { text: `It takes ${['', '', 'two', 'three', 'four', 'five'][n] ?? n} pieces${dup}.`, ...none };
    }
    // 5 — direct: one piece named (never both), and the action; the rest by role
    const ing = this.hintIngredient(target);
    if (route && 'via' in route) {
      const from = this.byId[route.via.from];
      return {
        text: `Try ${ACTIONS[route.via.action].label} on ${from.n}.`, highlight: ing?.id ?? null, action: route.via.action,
        ghost: { action: route.via.action, from: route.via.from },
      };
    }
    if (route && 'set' in route && ing) {
      const rest = [...route.set];
      rest.splice(rest.indexOf(ing.id), 1);
      const phrases = rest.map(i => rolePhrase(this.proc, this.byId[i]));
      return { text: `Start with ${ing.n}. It wants ${sayRoles(phrases)} beside it.`, highlight: ing.id, action: null, ghost: null };
    }
    return { text: 'Keep experimenting.', ...none };
  }

  /** The current hint, without changing anything. */
  hintView(): HintView {
    const h = this.hint;
    const base = { stuck: this.streak >= STUCK_AFTER };
    if (!h.target || this.found.has(h.target)) {
      const coach = coachLine({ triedAnyWork: this.triedAnyWork(), lockedLeft: this.lockedCount(), failedInARow: this.streak, stuckAfter: STUCK_AFTER });
      return { ...base, targetId: null, level: 0, text: '', highlightId: null, canEscalate: true, triesNeeded: 0, custom: false, action: null, ghost: null, coach };
    }
    const target = this.byId[h.target];
    const shown = h.level ? this.hintText(target, h.level) : { text: '', highlight: null, action: null, ghost: null };
    const triesNeeded = h.level === 0 ? 0 : Math.max(0, HINT_TRIES - h.tries);
    return {
      ...base, targetId: h.target, level: h.level, text: shown.text, highlightId: shown.highlight,
      canEscalate: h.level < MAX_HINT && triesNeeded === 0, triesNeeded: h.level >= MAX_HINT ? 0 : triesNeeded,
      custom: h.custom, action: shown.action, ghost: shown.ghost, coach: null,
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
      if (!t) return { error: 'Nothing is within reach right now — every held way in has been used up. Try the Archive.' };
      this.hint = { target: t, level: 1, tries: 0, custom: false };
    } else if (this.hint.level < MAX_HINT && this.hint.tries >= HINT_TRIES) {
      this.hint = { ...this.hint, level: (this.hint.level + 1) as HintLevel, tries: 0 };
    }
    this.save(); this.emit();
    return this.hintView();
  }

  dropHint() { this.hint = { ...NO_HINT }; this.save(); this.emit(); }

  /* ── queries ────────────────────────────────────────────────────────── */
  has(id: string) { return this.found.has(id); }
  get(id: string): Discovery | undefined { return this.byId[id]; }
  recipeFor(a: string, b: string) { return this.pairIndex.get(pairKey(a, b)) ?? null; }
  recipeOf(ids: string[]) { return this.pairIndex.get(multiKey(ids)) ?? null; }
  triedPair(a: string, b: string) { return this.failedPairs.has(pairKey(a, b)); }
  triedSet(ids: string[]) { return this.failedPairs.has(multiKey(ids)); }
  usesOf(id: string): string[] { return [...(this.usesIndex.get(id) ?? [])]; }
  foundAt(id: string): number | null { return this.when[id] ?? null; }
  tagsOf(id: string): ReadonlySet<string> { return tagsOf(this.proc, this.byId[id]); }

  /** Everything held, in the order it came. Pass `states: false` for discoveries alone. */
  inventory(filter?: { era?: string; q?: string; states?: boolean }): Discovery[] {
    let list = (filter?.states === false ? this.order : this.bag).map(id => this.byId[id]).filter(Boolean);
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

  /** Every way in to `id`: assemblies first, then work with the hands. */
  availableRecipes(id: string): RecipeView[] {
    const n = this.byId[id];
    if (!n) return [];
    const sets: RecipeView[] = (n.rec || []).map(r => {
      const items = r.map(i => this.byId[i]);
      return { items, a: items[0], b: items[1] ?? items[0], ready: r.every(i => this.holds(i)), found: this.hasRouteOf(id, r), action: null };
    });
    const works: RecipeView[] = (n.via || []).map(v => {
      const from = this.byId[v.from];
      return { items: [from], a: from, b: from, ready: this.canWork(v), found: this.hasViaRoute(id, v), action: v.action };
    });
    return [...sets, ...works];
  }

  path(): Discovery[] { return this.order.map(id => this.byId[id]); }

  /** The recorded steps that actually fed `id`, oldest first. */
  lineage(id: string): Step[] {
    const want = new Set([id]);
    const chain: Step[] = [];
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const s = this.steps[i];
      if (want.has(s.r)) { chain.push(s); stepItems(s).forEach(x => want.add(x)); }
    }
    chain.reverse();
    const seen = new Set<string>();
    return chain.filter(s => (seen.has(s.r) ? false : (seen.add(s.r), true)));
  }

  /** The first step that produced each discovery, in the order they were made. */
  history(): Step[] {
    const seen = new Set<string>();
    return this.steps.filter(s => !this.byId[s.r]?.state && (seen.has(s.r) ? false : (seen.add(s.r), true)));
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

  /** A personal history of how THIS game went — "the history of their civilisation", not a
   *  scoreboard. Reads what is already kept; adds nothing to the save but the two counters
   *  above. Never which discovery is "hardest", only the deepest one actually reached. */
  journal(): { first: Discovery | null; deepest: Discovery; mostUsedAction: ActionId | null; noHintPercent: number | null } {
    const firstId = this.order.find(id => !this.db.primitives.includes(id));
    const tally = new Map<ActionId, number>();
    for (const s of this.steps) if (s.p) tally.set(s.p, (tally.get(s.p) ?? 0) + 1);
    let mostUsedAction: ActionId | null = null, best = 0;
    for (const [a, n] of tally) if (n > best) { best = n; mostUsedAction = a; }
    const noHintPercent = this.discoveredCount > 0
      ? Math.round(((this.discoveredCount - this.hintedCount) / this.discoveredCount) * 100) : null;
    return { first: firstId ? this.byId[firstId] : null, deepest: this.stats().deepest, mostUsedAction, noHintPercent };
  }

  /* ── persistence (best-effort; never load-bearing) ───────────────────── */
  save() {
    if (typeof window === 'undefined') return;
    try {
      const payload: Saved = {
        v: 4, order: this.order, known: this.known, insights: [...this.insights], bag: this.bag, steps: this.steps, failed: this.failed,
        failedPairs: [...this.failedPairs], seen: [...this.seen],
        lockedPairs: [...this.lockedPairs], hint: this.hint, streak: this.streak,
        coached: this.coached, when: this.when,
        discoveredCount: this.discoveredCount, hintedCount: this.hintedCount,
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
      if (!d || (d.v !== 1 && d.v !== 2 && d.v !== 3 && d.v !== 4) || !Array.isArray(d.order)) return false;
      const valid = d.order.filter(id => this.byId[id] && !this.byId[id].state);
      if (d.v === 1 && valid.length <= this.db.primitives.length) return false;
      for (const p of this.db.primitives) if (!valid.includes(p)) valid.unshift(p);
      this.gateCacheSize = -1;
      this.found = new Set(valid);
      this.order = valid;
      // v3 keeps states in the bag; older saves hold discoveries only
      const stateIds = (d.bag ?? []).filter(id => this.byId[id]?.state);
      this.states = new Set(stateIds);
      this.bag = d.bag ? d.bag.filter(id => this.found.has(id) || this.states.has(id)) : valid.slice();
      for (const id of valid) if (!this.bag.includes(id)) this.bag.push(id);
      this.steps = (d.steps || []).filter(s => this.byId[s.r] && stepItems(s).every(i => this.byId[i]));
      // routes are re-derived from the steps, keeping only ones the current data still has
      this.routes = new Set();
      for (const s of this.steps) {
        if (s.p) {
          const r = this.byId[s.r];
          if (r?.via?.some(v => v.from === s.a && v.action === s.p)) this.routes.add(viaKey(s.r, { from: s.a, action: s.p }));
        } else if (this.pairIndex.get(multiKey(stepItems(s))) === s.r) {
          this.routes.add(setKey(s.r, stepItems(s)));
        }
      }
      this.failed = d.failed || 0;
      this.failedPairs = new Set(d.failedPairs || []);
      this.lockedPairs = new Set(d.lockedPairs || []);
      this.seen = new Set(d.seen || []);
      this.when = Object.assign(Object.create(null), d.when || {});
      const h = d.hint;
      this.hint = h && (h.target === null || this.byId[h.target]) ? { ...NO_HINT, ...h } : { ...NO_HINT };
      this.streak = d.streak || 0;
      this.coached = d.coached ?? (valid.length > this.db.primitives.length ? 2 : 0);
      this.discoveredCount = d.discoveredCount ?? 0;
      this.hintedCount = d.hintedCount ?? 0;
      this.runUnlocks();
      // techniques: what was learned, plus whatever the holdings already earn — a returning player is told nothing twice
      this.knownSet = new Set((d.known ?? []).filter(a => TECH_BY_ID[a]));
      this.known = [...this.knownSet];
      this.reveals = [];
      this.insights = new Set(d.insights ?? []);
      this.tried = new Map();
      this.syncTechniques(true);
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
    this.bag = this.db.primitives.slice();
    this.states = new Set();
    this.steps = []; this.failed = 0;
    this.failedPairs = new Set(); this.lockedPairs = new Set(); this.routes = new Set();
    this.seen = new Set(); this.fresh = new Set(); this.when = Object.create(null);
    this.hint = { ...NO_HINT }; this.streak = 0;
    this.knownSet = new Set(); this.known = []; this.reveals = []; this.newTech = new Set(); this.insights = new Set(); this.tried = new Map();
    this.discoveredCount = 0; this.hintedCount = 0;
    this.syncTechniques(true);
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
