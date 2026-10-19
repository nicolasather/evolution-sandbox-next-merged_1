/** Fifteen distinguishable ledges in three visual bands (ground → cliff → summit). Each has its own silhouette in the scene. */
import type { L10n } from '../types';
export type LedgeShape = 'camp' | 'rope' | 'watch' | 'steps' | 'pennant' | 'lift' | 'gear' | 'cloud' | 'signal' | 'span' | 'gate' | 'ice' | 'beacon' | 'sky' | 'summit';
export const LEDGES: { shape: LedgeShape; band: 1 | 2 | 3; name: L10n }[] = [
  { shape: 'camp', band: 1, name: { en: 'Base camp' } }, { shape: 'rope', band: 1, name: { en: 'Rope bridge' } },
  { shape: 'watch', band: 1, name: { en: 'Watch post' } }, { shape: 'steps', band: 1, name: { en: 'Stone steps' } },
  { shape: 'pennant', band: 1, name: { en: 'Pennant terrace' } }, { shape: 'lift', band: 2, name: { en: 'Cable lift' } },
  { shape: 'gear', band: 2, name: { en: 'Gear ledge' } }, { shape: 'cloud', band: 2, name: { en: 'Cloud deck' } },
  { shape: 'signal', band: 2, name: { en: 'Signal tower' } }, { shape: 'span', band: 2, name: { en: 'Iron span' } },
  { shape: 'gate', band: 3, name: { en: 'Wind gate' } }, { shape: 'ice', band: 3, name: { en: 'Ice stair' } },
  { shape: 'beacon', band: 3, name: { en: 'Beacon mast' } }, { shape: 'sky', band: 3, name: { en: 'Sky ledge' } },
  { shape: 'summit', band: 3, name: { en: 'Summit mechanism' } },
];
