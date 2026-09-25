import type { Quality } from '../perf';
import type { Engine } from '../engine';
import type { EraId } from '../types';
import type { Anchor, PlanInput } from './choreography';
import type { Moment } from './director';
import type { Playback } from './prefs';
import type { Major, WorldEvent } from './types';

/* ============================================================================
   MOMENTS — turn what the engine announces into something the globe can play.

   No DOM here. A moment carries the words and numbers for its card (its
   payload) and a `build` that is called at the instant it starts, so the plan
   sees the visitor's settings and the size of the backlog *then*, not when
   the invention was made.
   ========================================================================== */

/** What the card of a major invention shows. */
export interface MajorPayload {
  kind: 'major';
  major: Major;
  previous: Major | null;
  tier: 'A' | 'B';
  first: boolean;
  /** Looking again from the archive: lighter, no journey arc. */
  inspect: boolean;
  /** No globe at all (the visitor turned it off) — only used by era moments in that mode. */
  flat: boolean;
  /** This major's position among the majors found, and how many exist. */
  registered: number;
  total: number;
  /** The era's required set at the instant this was found. `null` for a major no era waits on. */
  eraRequired: { done: number; required: number; eraName: string } | null;
  /** Everything found so far, quietly, as dots on the globe. */
  foundBefore: Major[];
}

export interface EraPayload {
  kind: 'era';
  era: EraId;
  eraName: string;
  blurb: string;
  next: { id: EraId; name: string } | null;
  points: Major[];
  required: number;
  optionalFound: number;
  regionsRepresented: number;
  regionsTotal: number;
  flat: boolean;
}

export type WorldPayload = MajorPayload | EraPayload;

/** What the settings and the device say at the moment a plan is built. */
export interface MomentEnv {
  playback: () => Playback;
  quality: () => Quality;
  narrow: () => boolean;
}

const anchorOf = (m: Major | null): Anchor | null =>
  m ? { lat: m.lat, lon: m.lon, precision: m.precision } : null;

let seq = 0;

/** A major invention found in play (`event.tier` A or B). Returns null for a repeat (tier C) — that is only a chip pulse. */
export function majorMoment(engine: Engine, ev: Extract<WorldEvent, { kind: 'major' }>, env: MomentEnv): Moment<WorldPayload> | null {
  if (ev.tier === 'C') return null;
  const major = engine.world.get(ev.id);
  if (!major) return null;
  const previous = ev.previousId ? engine.world.get(ev.previousId) ?? null : null;
  const order = engine.majorsFound();
  const at = order.findIndex(m => m.id === ev.id);
  const upto = at < 0 ? order : order.slice(0, at + 1);
  const eraDone = upto.filter(m => m.era === major.era && m.required).length;
  const eraReq = engine.world.required.get(major.era)?.length ?? 0;
  const payload: MajorPayload = {
    kind: 'major', major, previous, tier: ev.tier, first: ev.first, inspect: false, flat: false,
    registered: at < 0 ? order.length : at + 1,
    total: engine.world.size,
    eraRequired: major.required && eraReq > 0 ? { done: eraDone, required: eraReq, eraName: engine.world.eraName(major.era) } : null,
    foundBefore: at < 0 ? order : order.slice(0, at),
  };
  return {
    id: ++seq, payload,
    build: (backlog): PlanInput => {
      const pb = env.playback();
      return {
        kind: 'major',
        // the very first major teaches what this is: it always gets the whole journey
        tier: !ev.first && (ev.tier === 'B' || pb.shorten || backlog > 0) ? 'B' : 'A',
        from: ev.first ? null : anchorOf(previous),
        to: anchorOf(major)!,
        others: major.alsoAt?.map(a => ({ lat: a.lat, lon: a.lon })),
        motion: pb.motion, quality: env.quality(), narrow: env.narrow(),
      };
    },
  };
}

/** Look at a major again from the archive: the lighter version of its reveal. */
export function inspectMoment(engine: Engine, id: string, env: MomentEnv): Moment<WorldPayload> | null {
  const major = engine.world.get(id);
  if (!major || !engine.has(id)) return null;
  const order = engine.majorsFound();
  const at = order.findIndex(m => m.id === id);
  const previous = engine.world.previousOf(id, engine.order);
  const payload: MajorPayload = {
    kind: 'major', major, previous, tier: 'B', first: !previous, inspect: true, flat: false,
    registered: at + 1, total: engine.world.size,
    eraRequired: major.required ? {
      done: order.slice(0, at + 1).filter(m => m.era === major.era && m.required).length,
      required: engine.world.required.get(major.era)?.length ?? 0,
      eraName: engine.world.eraName(major.era),
    } : null,
    foundBefore: order.slice(0, at),
  };
  return {
    id: ++seq, payload,
    build: (): PlanInput => {
      const pb = env.playback();
      return {
        kind: 'major', tier: 'B', inspect: true,
        from: anchorOf(previous), to: anchorOf(major)!,
        others: major.alsoAt?.map(a => ({ lat: a.lat, lon: a.lon })),
        // in the archive the visitor asked to look: show it even if cinematics are off, but gently
        motion: pb.enabled ? pb.motion : 'reduced', quality: env.quality(), narrow: env.narrow(),
      };
    },
  };
}

/** An era has been finished. */
export function eraMoment(engine: Engine, ev: Extract<WorldEvent, { kind: 'era_complete' }>, env: MomentEnv): Moment<WorldPayload> {
  const era = engine.db.eras.find(e => e.id === ev.era);
  const nextEra = ev.next ? engine.db.eras.find(e => e.id === ev.next) : undefined;
  const inEra = (engine.world.inEra.get(ev.era) ?? []).map(id => engine.world.get(id)!).filter(Boolean);
  const order = engine.majorsFound().filter(m => m.era === ev.era);
  const p = engine.eraProgress(ev.era);
  const sum = engine.worldSummary();
  const payload: EraPayload = {
    kind: 'era', era: ev.era, eraName: era?.name ?? ev.era, blurb: era?.blurb ?? '',
    next: nextEra ? { id: nextEra.id, name: nextEra.name } : null,
    points: order.length ? order : inEra.filter(m => engine.has(m.id)),
    required: p.required, optionalFound: p.optionalDone + p.hiddenDone,
    regionsRepresented: sum.regionsRepresented, regionsTotal: sum.regionsTotal,
    flat: false,
  };
  return {
    id: ++seq, payload,
    build: (): PlanInput => {
      const pb = env.playback();
      payload.flat = !pb.enabled;
      return {
        kind: 'era',
        // unlocated majors (language, say) have no place to light
        points: payload.points.filter(m => m.precision !== 'unlocated').map(m => ({ lat: m.lat, lon: m.lon })),
        motion: pb.motion, quality: env.quality(), narrow: env.narrow(),
      };
    },
  };
}
