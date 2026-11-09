import { ERA_IDS } from './registry';

/* ============================================================================
   TECHNIQUE GATE — advanced techniques reach the rail in historical order.

   A technique the player has LEARNED is never forgotten and never removed from
   the engine. The rail only *shows* a learned technique once the era its band
   belongs to has been reached, so the bench does not open with a long list of
   later techniques. The two earliest bands (foundational actions and first
   tools) are always visible: the basic loop is never hidden.

   Pure data + one function, so the rule is easy to test and to tune.
   ========================================================================== */

/** The era each chronology band (lib/chronology.ts `TECHNIQUE_BANDS`) needs before its learned techniques show. */
export const BAND_ERA: Record<string, string | null> = {
  foundational: null,
  first_tools: null,
  fire_shaping: 'fire',
  fibre_grinding: 'settlement',
  ceramics_binding: 'agriculture',
  metallurgy: 'metallurgy',
};

/** Is a band's learned technique visible, given the index (in ERA_IDS) of the furthest era reached? */
export function bandOpen(bandId: string, eraIndex: number): boolean {
  const era = BAND_ERA[bandId];
  if (era === undefined || era === null) return true;
  const need = ERA_IDS.indexOf(era as (typeof ERA_IDS)[number]);
  return need < 0 || eraIndex >= need;
}
