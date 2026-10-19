/** Twelve distinct vault door mechanisms. The scene draws each one differently (dial, gear train, prism, rotor …) — not recoloured rectangles. */
import type { L10n } from '../types';
export type DoorMech = 'dial' | 'geartrain' | 'prism' | 'rotor' | 'pins' | 'plates' | 'cardslot' | 'clockwork' | 'pressure' | 'levers' | 'hinge' | 'rings';
export const DOORS: { id: DoorMech; name: L10n }[] = [
  { id: 'dial', name: { en: 'Dial wheel' } }, { id: 'geartrain', name: { en: 'Gear train' } },
  { id: 'prism', name: { en: 'Prism lock' } }, { id: 'rotor', name: { en: 'Rotor drum' } },
  { id: 'pins', name: { en: 'Pin tumbler' } }, { id: 'plates', name: { en: 'Sliding plates' } },
  { id: 'cardslot', name: { en: 'Card slot' } }, { id: 'clockwork', name: { en: 'Clockwork latch' } },
  { id: 'pressure', name: { en: 'Pressure plates' } }, { id: 'levers', name: { en: 'Lever bank' } },
  { id: 'hinge', name: { en: 'Twin hinge' } }, { id: 'rings', name: { en: 'Combination rings' } },
];
export const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'hex', 'star'] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_LABEL: Record<Shape, L10n> = {
  circle: { en: 'Circle key' }, triangle: { en: 'Triangle key' }, square: { en: 'Square key' },
  diamond: { en: 'Diamond key' }, hex: { en: 'Hexagon key' }, star: { en: 'Practice star' },
};
