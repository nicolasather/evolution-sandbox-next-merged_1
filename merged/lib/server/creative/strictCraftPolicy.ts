import { ACTIONS_LIST } from '@/lib/content/actionList';
import type { CreativeCatalog, Profile } from './catalog';
import type { HardReject } from './types';

/* Ticket 073 — the deterministic impossibility filter. TypeScript port of tools/content/causal.py (role
   predicates, action needs): it reads GAME DATA (tags, capabilities, families), never names, never word
   similarity, never a probability. Anything clearly impossible is refused here, before any database write or
   model call. */

const has = (p: Profile, ...t: string[]) => t.some(x => p.tags.has(x));
const cap = (p: Profile, ...c: string[]) => c.some(x => p.capabilities.has(x));
const physical = (p: Profile) => p.family !== 'abstract';

export const ROLE_PRED: Record<string, (p: Profile) => boolean> = {
  edge: p => cap(p, 'edged', 'metalblade'),
  binding: p => cap(p, 'cord') || (has(p, 'fibrous') && p.family === 'fibre'),
  fibre_stock: p => has(p, 'fibrous'),
  striker: p => cap(p, 'hammer') || (p.family === 'stone' && has(p, 'hard')),
  abrasive: p => (p.family === 'stone' && has(p, 'hard')) || (has(p, 'glassy') && has(p, 'loose')),
  plastic_body: p => has(p, 'plastic'),
  heat_source: p => cap(p, 'flame') || p.family === 'flame',
  liquid_medium: p => has(p, 'fluid'),
  haft: p => has(p, 'woody') && p.family === 'wood',
  tool: p => p.family === 'made' || p.capabilities.size > 0,
};

/** action → any ONE of these roles must be provided by some ingredient. */
export const ACTION_NEEDS: Record<string, readonly string[]> = {
  tie: ['binding'], twist: ['fibre_stock'], pull: ['fibre_stock'], stretch: ['fibre_stock'],
  heat: ['heat_source'], burn: ['heat_source'],
  hammer: ['striker'], split: ['striker'], chisel: ['edge', 'striker'],
  cut: ['edge'], saw: ['edge'], carve: ['edge'], scrape: ['edge'],
  grind: ['abrasive'], polish: ['abrasive'],
  mix: ['liquid_medium', 'plastic_body', 'fibre_stock'], pour: ['liquid_medium'],
  shape: ['plastic_body', 'fibre_stock', 'haft'], dig: ['tool'],
};

export type Gate =
  | { ok: true; profiles: Profile[] }
  | { ok: false; code: HardReject; detail: string };

export function hardGate(cat: CreativeCatalog, ids: readonly string[], actionId: string | null): Gate {
  const profiles: Profile[] = [];
  for (const id of ids) {
    const p = cat.profiles.get(id);
    if (!p) return { ok: false, code: 'UNKNOWN_ITEM', detail: id };
    if (p.status === 'placeholder') return { ok: false, code: 'UNVERIFIED_INGREDIENT', detail: id };
    profiles.push(p);
  }
  if (actionId !== null && !ACTIONS_LIST.includes(actionId)) return { ok: false, code: 'ACTION_NOT_ALLOWED', detail: actionId };

  const abstractN = profiles.filter(p => !physical(p)).length;
  if (abstractN === profiles.length) return { ok: false, code: 'NO_PHYSICAL_PROCESS', detail: 'only abstract inputs' };
  if (abstractN > 0) return { ok: false, code: 'MATERIAL_IMPOSSIBLE', detail: 'abstract input cannot be physically worked' };
  if (profiles.every(p => p.family === 'liquid' || p.family === 'flame')) return { ok: false, code: 'NO_PHYSICAL_PROCESS', detail: 'no solid workpiece' };

  if (actionId === null || actionId === 'assemble') {
    const joinable = profiles.some(p => ROLE_PRED.binding(p) || p.family === 'made');
    if (!joinable) return { ok: false, code: 'NO_PHYSICAL_PROCESS', detail: 'nothing to join the parts with' };
  } else {
    const needs = ACTION_NEEDS[actionId];
    if (needs && !needs.some(r => profiles.some(ROLE_PRED[r]))) return { ok: false, code: 'MISSING_REQUIRED_COMPONENT', detail: `${actionId} needs ${needs.join(' or ')}` };
  }
  return { ok: true, profiles };
}
