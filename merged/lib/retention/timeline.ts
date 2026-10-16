/* ============================================================================
   PERSONAL TIMELINE (#20) — the player's own journey, built only from timestamps that were really recorded.

   Discoveries are dated by Engine.whenFound (null for anything that predates tracking, e.g. an old save's items);
   achievements by the retention store (0 = unlocked from progress that was already there); meetings, secrets and
   scenarios by the time they were recorded. Nothing is back-dated or invented: an undated entry goes into one
   honest group, "Before tracking began".
   ========================================================================== */
import type { Engine } from '../engine';
import { ACHIEVEMENTS } from './catalog';
import { EGG_BY_ID } from './eggs';
import { EVENT_BY_ID } from './events';
import { NPC_BY_ID } from './npc';
import { madeDiscoveries } from './progress';
import { retention } from './store';

export type JourneyKind = 'discovery' | 'achievement' | 'visitor' | 'secret' | 'scenario';
export interface JourneyEntry { key: string; kind: JourneyKind; title: string; sub: string; at: number | null; ref?: string }

export function buildJourney(engine: Engine): JourneyEntry[] {
  const s = retention.get();
  const out: JourneyEntry[] = [];
  for (const n of madeDiscoveries(engine)) {
    out.push({ key: `d:${n.id}`, kind: 'discovery', title: n.n, sub: engine.db.eras.find(e => e.id === n.era)?.name ?? n.era, at: engine.whenFound(n.id), ref: n.id });
  }
  for (const a of ACHIEVEMENTS) {
    const at = s.achievements[a.id];
    if (at !== undefined) out.push({ key: `a:${a.id}`, kind: 'achievement', title: a.name, sub: a.description, at: at > 0 ? at : null });
  }
  for (const [id, r] of Object.entries(s.npcs)) {
    const def = NPC_BY_ID[id]; if (!def) continue;
    out.push({ key: `n:${id}`, kind: 'visitor', title: `Met ${def.name}`, sub: r.quest === 'done' ? 'Their task is finished' : 'A stylised visitor from history', at: r.at > 0 ? r.at : null });
  }
  for (const [id, at] of Object.entries(s.eggs)) {
    const e = EGG_BY_ID[id]; if (!e) continue;
    out.push({ key: `e:${id}`, kind: 'secret', title: 'A secret found', sub: e.note, at: at > 0 ? at : null });
  }
  for (const [key, r] of Object.entries(s.events)) {
    const def = EVENT_BY_ID[key.split('@')[0]]; if (!def || !r.done) continue;
    out.push({ key: `v:${key}`, kind: 'scenario', title: def.name, sub: 'Fictional scenario — challenge finished', at: r.doneAt ?? null });
  }
  return out;
}

/** Dated entries newest-first, undated ones gathered at the end under one honest heading. */
export function groupJourney(list: JourneyEntry[], tz?: string): { label: string; items: JourneyEntry[] }[] {
  const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
  const dated = list.filter(e => e.at !== null).sort((a, b) => (b.at as number) - (a.at as number));
  const groups: { label: string; items: JourneyEntry[] }[] = [];
  for (const e of dated) {
    const label = fmt.format(new Date(e.at as number));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e); else groups.push({ label, items: [e] });
  }
  const undated = list.filter(e => e.at === null);
  if (undated.length) groups.push({ label: 'Before tracking began', items: undated });
  return groups;
}
