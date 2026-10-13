/* ============================================================================
   UNLOCKS — nothing but the workbench is there when a new visitor arrives.
   Everything else (the views, the corner buttons, the quiz, the puzzles and
   every other mode) opens up as the player moves through history, in the
   order humanity reached it.

   The rules are pure data + one pure function, so they are easy to test and
   to tune: change a number here and the whole site follows. Nothing in this
   file touches a save: an unlock is DERIVED from how far the engine has got
   (discoveries made, furthest era reached), so it can never drift from the
   real progress and a "Start over" relocks everything by itself.
   ========================================================================== */

import type { ModeId } from '@/lib/modes/types';

export type FeatureId =
  | 'archive' | 'graph' | 'quiz' | 'journal' | 'timeline' | 'hub' | 'puzzles'
  | 'museum' | 'world' | 'trade' | 'lab' | 'minpath'
  | 'mode:survival' | 'mode:archaeology' | 'mode:civilization' | 'mode:decipher'
  | 'mode:escape-room' | 'mode:reverse-evolution' | 'mode:alien-archaeology';

/** What the player has done so far — the only input to the rules. */
export interface Progress {
  /** Discoveries made by the player (the four raw materials do not count). */
  made: number;
  /** Index (in db.eras) of the furthest era reached. 0 = the first era. */
  eraIndex: number;
}

export interface Rule {
  /** Discoveries made. */
  made?: number;
  /** Furthest era reached, as an id from data/db.json `eras`. */
  era?: string;
}

export interface Feature {
  id: FeatureId;
  /** Shown in the "unlocked" notice and in the Hub. */
  label: string;
  /** One line, what it is for. */
  line: string;
  /** Where to look for it (the glowing control). */
  where: string;
  rule: Rule;
}

/** Era ids in the order of data/db.json. Kept here (not read from the db) so the rules stay pure. */
export const ERA_IDS = [
  'origins', 'fire', 'settlement', 'agriculture', 'civilization', 'trade', 'metallurgy',
  'science', 'industry', 'electric', 'computing', 'network', 'games', 'simulation',
] as const;

const eraRank = (id: string) => ERA_IDS.indexOf(id as (typeof ERA_IDS)[number]);

/**
 * THE ORDER. Listed oldest → newest, the way the game itself moves:
 * first the player's own bench fills up (archive, graph, the questions, the
 * journal), then each door opens with an era of history.
 */
export const FEATURES: Feature[] = [
  { id: 'archive',  label: 'Archive',  line: 'Everything you have kept, in one place.',                where: 'the Archive tab, top bar',   rule: { made: 3 } },
  { id: 'graph',    label: 'Graph',    line: 'See how every idea leans on another.',                   where: 'the Graph tab, top bar',     rule: { made: 6 } },
  { id: 'quiz',     label: 'Questions', line: 'Small questions will appear in the corner. Answer them to learn new ways of working things.', where: 'the corner of the workspace', rule: { made: 8 } },
  { id: 'journal',  label: 'Journal',  line: 'A recap of the journey you are making.',                 where: 'the Journal button, top bar', rule: { made: 12 } },
  { id: 'hub',      label: 'Modes',    line: 'Other ways to live this history. Survival is the first door.', where: 'the Modes button, top bar', rule: { made: 20 } },
  { id: 'mode:survival', label: 'Survival', line: 'Keep a small prehistoric group alive.',            where: 'the Modes hub',              rule: { made: 20 } },
  { id: 'timeline', label: 'Timeline', line: 'Your finds, oldest to newest.',                          where: 'the Timeline tab, top bar',  rule: { era: 'settlement' } },
  { id: 'museum',   label: 'Museum',   line: 'Everything humanity learned, gathered in one building.', where: 'the Museum button, top bar', rule: { era: 'agriculture' } },
  { id: 'world',    label: 'World',    line: 'The map of where each invention happened.',              where: 'the World chip, top bar',    rule: { era: 'agriculture' } },
  { id: 'mode:archaeology', label: 'Archaeologist', line: 'Excavate a site and justify what you find.', where: 'the Modes hub',             rule: { era: 'civilization' } },
  { id: 'mode:civilization', label: 'Civilization', line: 'Keep a settlement working.',               where: 'the Modes hub',             rule: { era: 'civilization' } },
  { id: 'trade',    label: 'Trade',    line: 'Ideas travel further than people ever did.',             where: 'the Trade button, top bar',  rule: { era: 'trade' } },
  { id: 'mode:decipher', label: 'Decipher', line: 'Read a writing system nobody has seen.',            where: 'the Modes hub',              rule: { era: 'trade' } },
  { id: 'mode:escape-room', label: 'Escape Room', line: 'Reason through how a historical mechanism worked.', where: 'the Modes hub',       rule: { era: 'metallurgy' } },
  { id: 'lab',      label: 'Laboratory', line: 'Change one thing. Watch what breaks.',                 where: 'the Laboratory button, top bar', rule: { era: 'science' } },
  { id: 'puzzles',  label: 'Puzzles',  line: 'A daily Tech Sudoku and a weekly Mega Challenge.',       where: 'the Modes hub',              rule: { era: 'science' } },
  { id: 'mode:reverse-evolution', label: 'Reverse Evolution', line: 'Descend from a smartphone to a stone.', where: 'the Modes hub',     rule: { era: 'industry' } },
  { id: 'minpath',  label: 'Minimum Path', line: 'Find the shortest road through the recipes.',         where: 'the Minimum Path button, top bar', rule: { era: 'electric' } },
  { id: 'mode:alien-archaeology', label: 'Alien Archaeology', line: 'Reconstruct a civilization that is not ours.', where: 'the Modes hub', rule: { era: 'computing' } },
];

const BY_ID: Record<string, Feature> = Object.fromEntries(FEATURES.map(f => [f.id, f]));
export const featureOf = (id: FeatureId): Feature => BY_ID[id];

/** Does a rule hold for this progress? An empty rule is always true. */
export function ruleHolds(rule: Rule, p: Progress): boolean {
  if (rule.made !== undefined && p.made < rule.made) return false;
  if (rule.era !== undefined) {
    const need = eraRank(rule.era);
    if (need < 0 || p.eraIndex < need) return false;
  }
  return true;
}

/** Every feature unlocked by this progress. */
export function unlockedFor(p: Progress): Set<FeatureId> {
  const out = new Set<FeatureId>();
  for (const f of FEATURES) if (ruleHolds(f.rule, p)) out.add(f.id);
  return out;
}

/** A short, human sentence for what is still needed ("Make 6 discoveries", "Reach Agriculture"). */
export function requirementText(f: Feature, eraName: (id: string) => string): string {
  const parts: string[] = [];
  if (f.rule.made !== undefined) parts.push(`make ${f.rule.made} discoveries`);
  if (f.rule.era !== undefined) parts.push(`reach ${eraName(f.rule.era)}`);
  const s = parts.join(' and ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The Hub card of a mode is a feature called `mode:<id>`; Main Evolution and Minimum Path are special. */
export function featureOfMode(m: ModeId): FeatureId | null {
  if (m === 'main-evolution') return null;
  if (m === 'minimum-path') return 'minpath';
  return `mode:${m}` as FeatureId;
}

/** Everything open: used by tests and by any caller that does not take part in the unlock system. */
export const ALL_UNLOCKED: ReadonlySet<FeatureId> = new Set(FEATURES.map(f => f.id));
