import { generateCamp } from '@/lib/survival/generate';
import { advanceTick } from '@/lib/survival/simulate';
import { nearestTileOfKind } from '@/lib/survival/spatial';
import type { CampState, Task } from '@/lib/survival/types';
import { generateSettlement } from '@/lib/civilization/generate';
import { advanceTurn } from '@/lib/civilization/simulate';
import type { Allocation } from '@/lib/civilization/types';
import { generateSite } from '@/lib/archaeology/generate';
import { applyAction, isFindRevealed } from '@/lib/archaeology/simulate';
import { generatePuzzle, validateSolvable } from '@/lib/decipher/generate';
import { generateSite as generateAlien } from '@/lib/alienarchaeology/generate';
import { EPISODES } from '@/lib/escaperoom/registry';
import { applyAction as escapeApply, blankState, type EscapeAction } from '@/lib/escaperoom/simulate';

/* Tickets 094–096 — INDEPENDENT solvers. Each one plays the mode's own pure generator with its own pure rules, using only
   the data the mode produced, and answers "is this reachable, and in how many steps?". None of them reads anything a model
   wrote: a model can influence neither the seeds nor the rules. A solver returning false rejects the packet outright. */

export interface SolveResult { ok: boolean; steps?: number; detail: string }

/* ── survival: a greedy care policy must reach the objective day for every seed ─────────────────────────────────── */
function survivalPolicy(s: CampState): Record<string, Task> {
  const water = nearestTileOfKind(s.terrain, 'water'), wood = nearestTileOfKind(s.terrain, 'woodland');
  const open = nearestTileOfKind(s.terrain, 'open') ?? wood;
  const live = s.members.filter(m => !m.injured);
  const out: Record<string, Task> = {};
  live.forEach((m, i) => {
    let t: Task = { kind: 'idle', x: s.terrain.campX, y: s.terrain.campY };
    if (m.energy < 0.3) t = { kind: 'rest', x: s.terrain.campX, y: s.terrain.campY };
    else if (i === 0 && water && s.resources.water < 3) t = { kind: 'fetch-water', ...water };
    else if (i === 1 && open && s.resources.food < 3 && s.period !== 'night') t = { kind: 'gather-food', ...open };
    else if (s.resources.wood < 1.2 && wood) t = { kind: 'gather-wood', ...wood };
    else if (s.shelter.level < 2) t = { kind: 'build-shelter', x: s.terrain.campX, y: s.terrain.campY };
    else if (!s.fire.lit || s.fire.fuel < 0.5) t = { kind: 'tend-fire', x: s.terrain.campX, y: s.terrain.campY };
    else if (water && s.resources.water < 5) t = { kind: 'fetch-water', ...water };
    else t = { kind: 'rest', x: s.terrain.campX, y: s.terrain.campY };
    out[m.id] = t;
  });
  return out;
}
export function solveSurvival(seed: string): SolveResult {
  let s = generateCamp(seed);
  const t = s.terrain.tiles.flat();
  if (!t.includes('water') || t.filter(k => k === 'woodland').length < 2) return { ok: false, detail: 'terrain lacks water or woodland' };
  let ticks = 0;
  while (s.ending === 'ongoing' && ticks < 200) { s = advanceTick(s, survivalPolicy(s)).state; ticks++; }
  return s.ending === 'success' ? { ok: true, steps: ticks, detail: `survived ${s.objective.targetDay} days in ${ticks} periods` } : { ok: false, steps: ticks, detail: `policy ended ${s.ending}` };
}

/* ── civilization: some allocation policy must end resilient ────────────────────────────────────────────────────── */
const POLICIES: Allocation[] = [
  { food: 0.6, construction: 0.2, knowledge: 0.2 }, { food: 0.5, construction: 0.25, knowledge: 0.25 },
  { food: 0.7, construction: 0.15, knowledge: 0.15 }, { food: 0.4, construction: 0.3, knowledge: 0.3 },
];
export function solveCivilization(seed: string): SolveResult {
  for (const p of POLICIES) {
    let s = generateSettlement(seed), n = 0;
    while (s.ending === 'ongoing' && n < 100) { s = advanceTurn(s, p).state; n++; }
    if (s.ending === 'resilient') return { ok: true, steps: n, detail: `resilient in ${n} turns` };
  }
  return { ok: false, detail: 'no tested allocation reaches resilience' };
}

/* ── archaeology: every find must be reachable by the mode's own dig + analyse rules ──────────────────────────────── */
export function solveArchaeology(seed: string): SolveResult {
  const s0 = generateSite(seed);
  if (!s0.finds.length) return { ok: false, detail: 'site has no finds' };
  // reachability only: with unlimited budget every find is revealed by digging its square to its context
  let s = { ...s0, budgets: { survey: 99, excavate: 999, analyze: 99 } };
  let steps = 0;
  for (let y = 0; y < s.gridSize; y++) for (let x = 0; x < s.gridSize; x++) for (let k = 0; k < 4; k++) { s = applyAction(s, { kind: 'excavate', x, y }).state; steps++; }
  const missing = s.finds.filter(f => !isFindRevealed(s, f));
  return missing.length ? { ok: false, detail: `${missing.length} finds unreachable` } : { ok: true, steps, detail: `${s.finds.length} finds reachable; truth stays hidden` };
}

/* ── decipher: the mode's own checker must find exactly one solution ───────────────────────────────────────────────── */
export function solveDecipher(seed: string): SolveResult {
  const p = generatePuzzle(seed);
  const v = validateSolvable(p);
  return v.solvable ? { ok: true, detail: 'unique solution confirmed by the mode checker' } : { ok: false, detail: 'puzzle is not uniquely solvable' };
}

/* ── alien: generated deterministically with ambiguity kept (the mode has no "answer" to leak) ────────────────────── */
export function solveAlien(seed: string): SolveResult {
  const a = generateAlien(seed), b = generateAlien(seed);
  const same = JSON.stringify(a.specimens) === JSON.stringify(b.specimens);
  return a.specimens.length >= 6 && same && a.ending === 'ongoing' ? { ok: true, detail: `${a.specimens.length} specimens, deterministic, no verdict pre-set` } : { ok: false, detail: 'site not deterministic or too small' };
}

/* ── escape room: the fixed authored episode must be completable from its own data ─────────────────────────────────── */
export function solveEscape(episodeId: string): SolveResult {
  const ep = EPISODES.find(e => e.id === episodeId);
  if (!ep) return { ok: false, detail: 'unknown episode' };
  let st = blankState(ep), steps = 0;
  const order = [...ep.puzzles.filter(p => p.kind !== 'code'), ...ep.puzzles.filter(p => p.kind === 'code')];
  for (const p of order) {
    const act: EscapeAction = p.kind === 'ratio' ? { kind: 'submitRatio', puzzleId: p.id, value: p.correctValue }
      : p.kind === 'sequence' ? { kind: 'submitSequence', puzzleId: p.id, order: p.correctOrder }
      : p.kind === 'match' ? { kind: 'submitMatch', puzzleId: p.id, matches: p.correctMatch }
      : { kind: 'submitCode', puzzleId: p.id, code: p.correctCode };
    st = escapeApply(ep, st, act).state;
    steps++;
  }
  return st.completed ? { ok: true, steps, detail: 'authored solution completes the episode' } : { ok: false, steps, detail: 'authored solution does not complete the episode' };
}

/** Strings a hint/flavour text must never contain for this episode (answers, fragments, code). */
export function escapeSecrets(episodeId: string): string[] {
  const ep = EPISODES.find(e => e.id === episodeId);
  if (!ep) return [];
  const out: string[] = [];
  for (const p of ep.puzzles) {
    if (p.kind === 'ratio') out.push(String(p.correctValue), p.unlockFragment);
    if (p.kind === 'sequence') out.push(p.unlockFragment);
    if (p.kind === 'match') out.push(p.unlockFragment);
    if (p.kind === 'code') out.push(p.correctCode);
  }
  return [...new Set(out.filter(x => x.length > 0).map(x => x.toLowerCase()))];
}
