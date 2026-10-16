/* ============================================================================
   RETENTION RUNTIME — wires the engine's authoritative state and the bus events
   to the store: achievements, daily objectives and coin awards.

   Every payout is keyed (`ach:<id>`, `daily:<day>:<id>`, …) and the store pays a
   key once, so reloads, repeated clicks and failure spam cannot duplicate a
   reward. Nothing here writes to the Engine; it only reads.
   ========================================================================== */
import type { Engine } from '../engine';
import { personalCount } from './progress';
import { profile } from '../profile/store';
import { retentionBus, type RetentionEvent } from './bus';
import {
  ACHIEVEMENTS, DAILY_BY_ID, ERA_ORDER, eraIndex, type AchievementDef, type DailyKind,
} from './catalog';
import { dailyLine, dailyName, emptyDay, pickForDay, todayKey } from './daily';
import { notices } from './notices';
import { PHYSICAL_GESTURES } from './tactile';
import { retention } from './store';

export interface Snapshot { unique: number; routes: number; eraIdx: number; museum: number; dailyDates: number; eggs: number; npcs: number }

export function snapshot(engine: Engine, routes: number): Snapshot {
  const s = retention.get();
  return {
    unique: personalCount(engine),
    routes,
    eraIdx: Math.max(0, eraIndex(engine.currentEra().id)),
    museum: profile.get().museum.length,
    dailyDates: s.dailyDates.length,
    eggs: Object.keys(s.eggs).length,
    npcs: Object.keys(s.npcs).length,
  };
}

export function achievementProgress(a: AchievementDef, sn: Snapshot): { have: number; need: number; done: boolean } {
  switch (a.trigger) {
    case 'unique_discovery': return { have: sn.unique, need: a.threshold, done: sn.unique >= a.threshold };
    case 'era_reached': { const need = Math.max(0, eraIndex(a.target ?? '')); return { have: Math.min(sn.eraIdx, need) + 1, need: need + 1, done: sn.eraIdx >= need }; }
    case 'unique_route_count': return { have: sn.routes, need: a.threshold, done: sn.routes >= a.threshold };
    case 'museum_unique_exhibits': return { have: sn.museum, need: a.threshold, done: sn.museum >= a.threshold };
    case 'daily_unique_dates_completed': return { have: sn.dailyDates, need: a.threshold, done: sn.dailyDates >= a.threshold };
    case 'easter_unique_count': return { have: sn.eggs, need: a.threshold, done: sn.eggs >= a.threshold };
    case 'npc_unique_encounters': return { have: sn.npcs, need: a.threshold, done: sn.npcs >= a.threshold };
  }
}

class Runtime {
  private engine: Engine | null = null;
  private offs: Array<() => void> = [];
  private busy = false;
  private routeKey = -1;
  private routeVal = 0;
  currentRoutes = 0;

  attach(engine: Engine): () => void {
    this.detach();
    this.engine = engine;
    retention.load();
    this.offs.push(engine.subscribe(() => this.sync()));
    this.offs.push(retention.subscribe(() => this.sync()));
    this.offs.push(profile.subscribe(() => this.sync()));
    this.offs.push(retentionBus.on(e => this.onEvent(e)));
    this.sync();
    return () => this.detach();
  }
  detach() { this.offs.forEach(o => o()); this.offs = []; this.engine = null; }

  private routes(engine: Engine): number {
    const key = engine.steps.length * 1000003 + engine.found.size;
    if (key !== this.routeKey) { this.routeKey = key; this.routeVal = engine.routeTotals().found; }
    this.currentRoutes = this.routeVal;
    return this.routeVal;
  }

  /** Re-derive everything that follows from authoritative state. Idempotent. */
  sync() {
    const engine = this.engine;
    if (!engine || this.busy) return;
    this.busy = true;
    try {
      const first = !retention.get().counters.baseline;
      const sn = snapshot(engine, this.routes(engine));
      const now = Date.now();
      for (const a of ACHIEVEMENTS) {
        if (retention.get().achievements[a.id] !== undefined) continue;
        if (!achievementProgress(a, sn).done) continue;
        // progress that was already there when tracking began has no honest date: 0 = "before tracking began"
        retention.unlockAchievement(a.id, first ? 0 : now);
        const paid = retention.award(`ach:${a.id}`, a.coins, first ? 0 : now);
        if (!first) notices.push({ kind: 'achievement', title: a.name, sub: a.description, coins: paid ? a.coins : undefined });
      }
      if (first) retention.bump('baseline', 1);
      this.ensureDay(engine);
    } finally { this.busy = false; }
  }

  private ensureDay(engine: Engine) {
    const day = todayKey();
    if (retention.get().daily[day]) return;
    if (engine.order.length <= engine.db.primitives.length) return; // not before the first real step
    retention.setDay(day, emptyDay(pickForDay(day, engine)));
  }

  private bump(kind: DailyKind, key?: string, by = 1) {
    const day = todayKey();
    const st = retention.get().daily[day];
    if (!st) return;
    const nextSeen = key ? [...st.seen] : st.seen;
    if (key) { if (st.seen.includes(key)) return; nextSeen.push(key); }
    const progress = { ...st.progress };
    const done = [...st.done];
    let changed = !!key;
    for (const id of st.picks) {
      const def = DAILY_BY_ID[id];
      if (!def || def.kind !== kind || done.includes(id)) continue;
      progress[id] = Math.min(def.target, (progress[id] ?? 0) + by);
      changed = true;
      if (progress[id] >= def.target) {
        done.push(id);
        if (retention.award(`daily:${day}:${id}`, def.coins)) {
          notices.push({ kind: 'daily', title: dailyName(def), sub: dailyLine(def), coins: def.coins });
        }
        retention.markDailyDate(day);
      }
    }
    if (changed) retention.setDay(day, { ...st, progress, done, seen: nextSeen });
  }

  private onEvent(e: RetentionEvent) {
    const engine = this.engine;
    if (!engine) return;
    switch (e.t) {
      case 'discovery':
        if (e.status === 'new') this.bump('discover-new');
        else if (e.newRoute) this.bump('new-route');
        break;
      case 'technique': if (e.produced) this.bump('try-technique', `tech:${e.action}:${Math.floor(Date.now() / 1000)}`); break;
      case 'inspect': {
        const era = eraIndex(e.era), cur = eraIndex(engine.currentEra().id);
        if (e.owned && era <= cur) this.bump('inspect-object', `inspect:${e.id}`);
        break;
      }
      case 'study': this.bump('study-history', `study:${e.id}`); break;
      case 'museum': this.bump('visit-museum', `museum:${e.exhibitId}`); break;
      case 'scene': {
        if (e.auto) break;
        if (eraIndex(e.era) === eraIndex(engine.currentEra().id) || ERA_ORDER.indexOf(e.era) >= 0) {
          retention.noteScene(e.id);
          this.bump('change-scene', `scene:${e.id}`);
        }
        break;
      }
      case 'tactile': if (PHYSICAL_GESTURES.has(e.gesture)) this.bump('interact-physics', `gesture:${e.gesture}`); break;
      case 'npc': if (e.stage === 'met') this.bump('inspect-npc', `npc:${e.id}`); break;
      case 'minpath': if (e.solved) this.bump('solve-small-path', `minpath:${Math.floor(Date.now() / 1000)}`); break;
      default: break;
    }
    this.sync();
  }
}

export const runtime = new Runtime();
