/* ============================================================================
   GLOBAL EVENTS (#8) — fourteen short, clearly FICTIONAL scenarios that dress the world for twenty minutes.

   They are ambience plus one gentle challenge inside content the player already has: look closely (the Inspect
   button) at a couple of things from a field the scenario is about. They never change crafting, recipes, the
   engine, or what can be discovered; nothing runs on a server; there is no streak and nothing is lost by missing
   one. "Global" only means everyone's clock agrees on which scenario is up (the same shared rotation seed), not
   that anything is shared online.
   ========================================================================== */
import events from '../../data/retention/global-events.json';
import type { Category, EraId } from '../types';
import { eraIndex } from './catalog';
import { createRng } from '../seed';

export type EventArt =
  | 'meteors' | 'frost' | 'cracks' | 'shore' | 'lanterns' | 'inkmarks' | 'caravan' | 'sparks'
  | 'starlines' | 'steam' | 'branches' | 'pulses' | 'pixels' | 'glitch';

export interface EventDef {
  id: string; name: string; minEra: EraId; description: string; minutes: number;
  art: EventArt; cats: readonly Category[]; need: number; goal: string;
}

const CHALLENGE: Record<string, { art: EventArt; cats: Category[]; need: number; goal: string }> = {
  'meteor-shower': { art: 'meteors', cats: ['material', 'science', 'knowledge'], need: 2, goal: 'Look closely at two materials or ideas you hold while the sky streaks.' },
  'cold-snap': { art: 'frost', cats: ['technology', 'technique', 'society'], need: 2, goal: 'Look closely at two things that keep people warm or sheltered.' },
  'dry-season': { art: 'cracks', cats: ['technology', 'engineering', 'biology'], need: 2, goal: 'Look closely at two things about water or growing food.' },
  'river-flood': { art: 'shore', cats: ['engineering', 'society', 'technology'], need: 2, goal: 'Look closely at two things people build for shelter.' },
  'harvest-festival': { art: 'lanterns', cats: ['biology', 'culture', 'economy'], need: 2, goal: 'Look closely at two things about plants, grain or feasting.' },
  'library-night': { art: 'inkmarks', cats: ['knowledge', 'media', 'culture'], need: 2, goal: 'Look closely at two records, writings or exchanges of ideas.' },
  'caravan-arrival': { art: 'caravan', cats: ['economy', 'society', 'technology'], need: 2, goal: 'Look closely at two things that travel or are traded.' },
  'forge-night': { art: 'sparks', cats: ['material', 'engineering', 'technique'], need: 2, goal: 'Look closely at two metals, alloys or smithing techniques.' },
  'telescope-night': { art: 'starlines', cats: ['science', 'knowledge', 'technology'], need: 2, goal: 'Look closely at two instruments or ideas about light and the sky.' },
  'industrial-fog': { art: 'steam', cats: ['engineering', 'energy', 'technology'], need: 2, goal: 'Look closely at two machines or energy sources.' },
  'electric-storm': { art: 'branches', cats: ['energy', 'science', 'engineering'], need: 2, goal: 'Look closely at two discoveries about electricity.' },
  'first-transmission': { art: 'pulses', cats: ['media', 'computing', 'engineering'], need: 2, goal: 'Look closely at two ways messages travel.' },
  'pixel-parade': { art: 'pixels', cats: ['media', 'computing', 'culture'], need: 2, goal: 'Look closely at two discoveries about digital play or display.' },
  'simulation-glitch': { art: 'glitch', cats: ['computing', 'science', 'knowledge'], need: 2, goal: 'Look closely at two discoveries about computation and models.' },
};

export const EVENTS: readonly EventDef[] = (events as unknown as Array<Record<string, unknown>>).map(e => {
  const c = CHALLENGE[String(e.id)];
  return {
    id: String(e.id), name: String(e.name), minEra: e.minEra as EraId, description: String(e.description),
    minutes: Number(e.durationMinutes) || 20, art: c.art, cats: c.cats, need: c.need, goal: c.goal,
  };
});
export const EVENT_BY_ID: Readonly<Record<string, EventDef>> = Object.fromEntries(EVENTS.map(e => [e.id, e]));
export const eventEligible = (e: EventDef, eraIdx: number) => eraIndex(e.minEra) <= eraIdx;

const SLOT_MS = 60 * 60_000;
export interface ActiveEvent { def: EventDef; slot: number; endsAt: number }

/** The rotation: in every shared hour the first `minutes` belong to one scenario drawn from those the player's era allows.
 *  Same date + hour → same scenario for everyone; no streak, nothing to miss. `forced` (the Hub's "Watch now") overrides it. */
export function activeEvent(eraIdx: number, now = Date.now(), forced?: { id: string; until: number } | null): ActiveEvent | null {
  if (forced && forced.until > now) {
    const def = EVENT_BY_ID[forced.id];
    if (def) return { def, slot: Math.floor(forced.until / SLOT_MS), endsAt: forced.until };
  }
  const elig = EVENTS.filter(e => eventEligible(e, eraIdx));
  if (!elig.length) return null;
  const slot = Math.floor(now / SLOT_MS);
  const into = now - slot * SLOT_MS;
  const rng = createRng(`evo-event-${slot}`);
  const def = rng.pick(elig);
  if (into >= def.minutes * 60_000) return null;
  return { def, slot, endsAt: slot * SLOT_MS + def.minutes * 60_000 };
}
export const eventKey = (id: string, day: string) => `${id}@${day}`;
