/** Fifteen distinguishable ledges in three visual bands (ground → cliff → summit). Each has its own silhouette in the scene. */
import type { L10n } from '../types';
export type LedgeShape = 'camp' | 'rope' | 'watch' | 'steps' | 'pennant' | 'lift' | 'gear' | 'cloud' | 'signal' | 'span' | 'gate' | 'ice' | 'beacon' | 'sky' | 'summit';
export const LEDGES: { shape: LedgeShape; band: 1 | 2 | 3; name: L10n }[] = [
  { shape: 'camp', band: 1, name: { en: 'Base camp', vi: 'Trại chân núi' } }, { shape: 'rope', band: 1, name: { en: 'Rope bridge', vi: 'Cầu dây' } },
  { shape: 'watch', band: 1, name: { en: 'Watch post', vi: 'Chòi canh' } }, { shape: 'steps', band: 1, name: { en: 'Stone steps', vi: 'Bậc đá' } },
  { shape: 'pennant', band: 1, name: { en: 'Pennant terrace', vi: 'Sân cờ hiệu' } }, { shape: 'lift', band: 2, name: { en: 'Cable lift', vi: 'Cáp treo' } },
  { shape: 'gear', band: 2, name: { en: 'Gear ledge', vi: 'Gờ bánh răng' } }, { shape: 'cloud', band: 2, name: { en: 'Cloud deck', vi: 'Sàn mây' } },
  { shape: 'signal', band: 2, name: { en: 'Signal tower', vi: 'Tháp tín hiệu' } }, { shape: 'span', band: 2, name: { en: 'Iron span', vi: 'Nhịp sắt' } },
  { shape: 'gate', band: 3, name: { en: 'Wind gate', vi: 'Cổng gió' } }, { shape: 'ice', band: 3, name: { en: 'Ice stair', vi: 'Thang băng' } },
  { shape: 'beacon', band: 3, name: { en: 'Beacon mast', vi: 'Cột đèn hiệu' } }, { shape: 'sky', band: 3, name: { en: 'Sky ledge', vi: 'Gờ trời' } },
  { shape: 'summit', band: 3, name: { en: 'Summit mechanism', vi: 'Cơ cấu đỉnh' } },
];
