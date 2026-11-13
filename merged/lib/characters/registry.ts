/* The three original creatures: identity, unlock rules, retargeting profile and relationships. */
import type { CharacterId, CharacterMode } from './types';

export interface UnlockRule {
  /** 'start' = present from the first playable moment; otherwise a pure function of real progress. */
  kind: 'start' | 'made' | 'era';
  made?: number;
  era?: string;
}

export interface Retarget {
  /** horizontal / vertical travel multiplier */
  ax: number; ay: number;
  /** rotation multiplier */
  ar: number;
  /** deviation-from-1 multiplier for scales */
  as: number;
  /** duration multiplier (>1 = slower) */
  speed: number;
  easing: string;
  /** a constant offset added to the root pose (Orra floats) */
  base: { y: number };
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  role: string;
  tagline: string;
  unlock: UnlockRule;
  retarget: Retarget;
  /** a stage anchor (fraction of stage width) where it prefers to stand */
  home: number;
  /** relative weight when the director picks a lead for a given tone family */
  affinity: Partial<Record<string, number>>;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  kip: {
    id: 'kip', name: 'Kip', role: 'Workshop helper', tagline: 'Eager, clumsy, always helping.',
    unlock: { kind: 'start' }, home: 0.18,
    retarget: { ax: 0.95, ay: 1.1, ar: 1.15, as: 1.1, speed: 1, easing: 'cubic-bezier(.34,1.45,.64,1)', base: { y: 0 } },
    affinity: { celebrate: 1.3, big: 1.4, pickup: 1.4, work: 1.3, hint: 1.2, greet: 1.2, poke: 1.2, fail: 1 },
  },
  vex: {
    id: 'vex', name: 'Vex', role: 'Trickster', tagline: 'Fast, theatrical, denies everything.',
    unlock: { kind: 'made', made: 20 }, home: 0.5,
    retarget: { ax: 1.3, ay: 1.25, ar: 1.4, as: 1.25, speed: 0.8, easing: 'cubic-bezier(.2,.9,.1,1.15)', base: { y: 0 } },
    affinity: { fail: 1.4, 'crew-compete': 1.5, 'crew-steal': 1.6, hover: 1.5, idle: 1.2, question: 1.3, special: 1.3, worry: 0.6 },
  },
  orra: {
    id: 'orra', name: 'Orra', role: 'Archivist', tagline: 'Patient, precise, quietly amused.',
    unlock: { kind: 'era', era: 'civilization' }, home: 0.82,
    retarget: { ax: 0.7, ay: 0.7, ar: 0.6, as: 0.7, speed: 1.35, easing: 'cubic-bezier(.45,0,.2,1)', base: { y: -4 } },
    affinity: { observe: 1.5, think: 1.5, hint: 1.5, complete: 1.3, locked: 1.2, look: 1.2, 'crew-help': 1.4, progress: 1.2 },
  },
};

export const CREW: readonly CharacterDef[] = [CHARACTERS.kip, CHARACTERS.vex, CHARACTERS.orra];

/** Era ids in the order of data/db.json (same list as lib/unlocks/registry.ts — kept local so the rules stay pure). */
export const ERA_ORDER = [
  'origins', 'fire', 'settlement', 'agriculture', 'civilization', 'trade', 'metallurgy',
  'science', 'industry', 'electric', 'computing', 'network', 'games', 'simulation',
] as const;

export interface CrewProgress { made: number; eraIndex: number }

export function ruleHolds(rule: UnlockRule, p: CrewProgress): boolean {
  if (rule.kind === 'start') return true;
  if (rule.kind === 'made') return p.made >= (rule.made ?? Infinity);
  const need = ERA_ORDER.indexOf((rule.era ?? '') as (typeof ERA_ORDER)[number]);
  return need >= 0 && p.eraIndex >= need;
}

/** Which creatures real progress has earned. Kip always; Vex at 20 discoveries; Orra on reaching the Civilization era. */
export function earnedCrew(p: CrewProgress): CharacterId[] {
  return CREW.filter(c => ruleHolds(c.unlock, p)).map(c => c.id);
}

/** Mode → does the main bench exist (Main Evolution and the legacy merge-style Civilization). */
export const hasBench = (mode: CharacterMode) => mode === 'main-evolution' || mode === 'civilization';
