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
    id: 'clockwork_leviathan', name: { en: 'Clockwork Leviathan', vi: 'Thủy quái đồng hồ' },
    blurb: { en: 'A brass sea-engine with a spinning gear core.', vi: 'Cỗ máy biển bằng đồng với lõi bánh răng quay.' },
    forms: [{ en: 'Armored hull', vi: 'Vỏ giáp' }, { en: 'Pressure barrier', vi: 'Lá chắn áp suất' }, { en: 'Exposed gear core', vi: 'Lõi bánh răng lộ ra' }],
    moves: [['attack', 'weakness', 'attack', 'attack'], ['barrier', 'attack', 'weakness', 'attack', 'surge'], ['attack', 'surge', 'attack', 'weakness', 'attack']],
  },
  library_colossus: {
    id: 'library_colossus', name: { en: 'Library Colossus', vi: 'Khổng lồ thư viện' },
    blurb: { en: 'A stone giant built from stacked shelves and lantern eyes.', vi: 'Tượng đá khổng lồ xếp từ giá sách và đèn lồng.' },
    forms: [{ en: 'Shelf plating', vi: 'Tấm giá sách' }, { en: 'Index barrier', vi: 'Lá chắn mục lục' }, { en: 'Lantern core', vi: 'Lõi đèn lồng' }],
    moves: [['weakness', 'attack', 'attack', 'weakness'], ['barrier', 'weakness', 'attack', 'attack', 'surge'], ['attack', 'attack', 'surge', 'weakness', 'attack']],
  },
  storm_engine: {
    id: 'storm_engine', name: { en: 'Storm Engine', vi: 'Động cơ bão' },
    blurb: { en: 'A tower of coils and turbines that crackles with static.', vi: 'Tháp cuộn dây và tuabin phóng tĩnh điện.' },
    forms: [{ en: 'Insulated casing', vi: 'Vỏ cách điện' }, { en: 'Static barrier', vi: 'Lá chắn tĩnh điện' }, { en: 'Open coil', vi: 'Cuộn dây hở' }],
    moves: [['attack', 'attack', 'weakness', 'surge'], ['barrier', 'attack', 'surge', 'attack', 'weakness'], ['surge', 'attack', 'attack', 'weakness', 'attack']],
  },
};
export const BOSS_IDS = Object.keys(BOSSES) as BossId[];
