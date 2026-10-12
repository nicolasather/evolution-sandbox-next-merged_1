import db from '@/data/civilization/lifelines.v1.json';
import { buildContentIndex } from '../content';
import { queueBlockReason, reduce } from '../engine';
import { remediesFor, pressures, suggestedProject } from '../selectors';
import { GATHER_RESOURCES } from '../rules';
import type { Command, ContentIndex, LifelinesState, ResourceId } from '../schema';

export const ix: ContentIndex = buildContentIndex(db);
export const variantId = (chapterId: string, biomeId?: string): string => {
  const ch = ix.chapters.get(chapterId)!;
  return `${chapterId}--${biomeId ?? ch.recommendedBiome}`;
};

export function step(s: LifelinesState, c: Command): LifelinesState { return reduce(ix, s, c).state; }
export function tryStep(s: LifelinesState, c: Command): LifelinesState {
  try { return reduce(ix, s, c).state; } catch { return s; }
}

/** Free (or cheapest affordable) response, as a cautious player would pick. */
export function respond(s: LifelinesState): LifelinesState {
  if (!s.pendingEventId) return s;
  const ev = ix.events.get(s.pendingEventId)!;
  const order = [...ev.choices].sort((a, b) => Object.keys(a.cost).length - Object.keys(b.cost).length);
  for (const c of order) { const n = tryStep(s, { type: 'resolve-event', choiceId: c.id }); if (n !== s) return n; }
  return s;
}

export type Plan = (s: LifelinesState) => Command[];

/** Plan the chapter's target programme (and prerequisites); gather what is short; otherwise just tend. */
export const focusedGrowth: Plan = s => {
  const p = suggestedProject(ix, s);
  if (!p) return [];
  for (const d of s.layout.districts) {
    if (queueBlockReason(ix, s, p.id, d.id) === null) return [{ type: 'queue-programme', projectId: p.id, districtId: d.id }];
  }
  if (s.queue.some(q => q.projectId === p.id)) return [];
  const short = (Object.keys(p.cost) as ResourceId[]).filter(r => s.stocks[r] < (p.cost[r] ?? 0) * 1000);
  const g = short.find(r => (GATHER_RESOURCES as readonly string[]).includes(r));
  return g ? [{ type: 'gather', resource: g as 'food' }] : [];
};

/** Like focusedGrowth, but keeps the essential reserves topped up first. */
export const cautiousReserve: Plan = s => {
  const low = (['food', 'water'] as const).find(r => s.stocks[r] < 30_000);
  const base = focusedGrowth(s);
  return low && s.actionsLeft > 0 && base.length === 0 ? [{ type: 'gather', resource: low }] : base;
};

/** Reads the top pressure and takes the first legal remedy. */
export const recoveryFromShortage: Plan = s => {
  const top = pressures(s)[0];
  if (!top) return focusedGrowth(s);
  const r = remediesFor(ix, s, top).find(x => x.legal);
  return r ? [r.command] : focusedGrowth(s);
};

export function runBot(start: LifelinesState, plan: Plan, maxSeasons: number): LifelinesState {
  let s = start;
  for (let i = 0; i < maxSeasons && s.completion.completedAtTurn === null; i++) {
    s = respond(s);
    for (const c of plan(s)) s = tryStep(s, c);
    s = tryStep(respond(s), { type: 'advance' });
  }
  return s;
}
