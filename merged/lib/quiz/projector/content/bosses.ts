/** Three original mechanical bosses (no faces). Each has its own silhouette in the scene; the data here drives rules and labels. */
import type { BossId, L10n } from '../types';

export type TelegraphKind = 'attack' | 'surge' | 'barrier' | 'weakness';
export type BossDef = {
  id: BossId; name: L10n; blurb: L10n; forms: [L10n, L10n, L10n];
  /** sequence the boss follows in each phase (index by bossActs) */
  moves: [TelegraphKind[], TelegraphKind[], TelegraphKind[]];
};

export const BOSSES: Record<BossId, BossDef> = {
  clockwork_leviathan: {
    id: 'clockwork_leviathan', name: { en: 'Clockwork Leviathan' },
    blurb: { en: 'A brass sea-engine with a spinning gear core.' },
    forms: [{ en: 'Armored hull' }, { en: 'Pressure barrier' }, { en: 'Exposed gear core' }],
    moves: [['attack', 'weakness', 'attack', 'attack'], ['barrier', 'attack', 'weakness', 'attack', 'surge'], ['attack', 'surge', 'attack', 'weakness', 'attack']],
  },
  library_colossus: {
    id: 'library_colossus', name: { en: 'Library Colossus' },
    blurb: { en: 'A stone giant built from stacked shelves and lantern eyes.' },
    forms: [{ en: 'Shelf plating' }, { en: 'Index barrier' }, { en: 'Lantern core' }],
    moves: [['weakness', 'attack', 'attack', 'weakness'], ['barrier', 'weakness', 'attack', 'attack', 'surge'], ['attack', 'attack', 'surge', 'weakness', 'attack']],
  },
  storm_engine: {
    id: 'storm_engine', name: { en: 'Storm Engine' },
    blurb: { en: 'A tower of coils and turbines that crackles with static.' },
    forms: [{ en: 'Insulated casing' }, { en: 'Static barrier' }, { en: 'Open coil' }],
    moves: [['attack', 'attack', 'weakness', 'surge'], ['barrier', 'attack', 'surge', 'attack', 'weakness'], ['surge', 'attack', 'attack', 'weakness', 'attack']],
  },
};
export const BOSS_IDS = Object.keys(BOSSES) as BossId[];
