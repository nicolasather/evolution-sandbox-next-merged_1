/** Twelve distinct vault door mechanisms. The scene draws each one differently (dial, gear train, prism, rotor …) — not recoloured rectangles. */
import type { L10n } from '../types';
export type DoorMech = 'dial' | 'geartrain' | 'prism' | 'rotor' | 'pins' | 'plates' | 'cardslot' | 'clockwork' | 'pressure' | 'levers' | 'hinge' | 'rings';
export const DOORS: { id: DoorMech; name: L10n }[] = [
  { id: 'dial', name: { en: 'Dial wheel', vi: 'Bánh mặt số' } }, { id: 'geartrain', name: { en: 'Gear train', vi: 'Hệ bánh răng' } },
  { id: 'prism', name: { en: 'Prism lock', vi: 'Khóa lăng kính' } }, { id: 'rotor', name: { en: 'Rotor drum', vi: 'Trống xoay' } },
  { id: 'pins', name: { en: 'Pin tumbler', vi: 'Khóa chốt' } }, { id: 'plates', name: { en: 'Sliding plates', vi: 'Tấm trượt' } },
  { id: 'cardslot', name: { en: 'Card slot', vi: 'Khe thẻ' } }, { id: 'clockwork', name: { en: 'Clockwork latch', vi: 'Chốt đồng hồ' } },
  { id: 'pressure', name: { en: 'Pressure plates', vi: 'Tấm áp lực' } }, { id: 'levers', name: { en: 'Lever bank', vi: 'Dãy cần gạt' } },
  { id: 'hinge', name: { en: 'Twin hinge', vi: 'Bản lề đôi' } }, { id: 'rings', name: { en: 'Combination rings', vi: 'Vòng tổ hợp' } },
];
export const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'hex', 'star'] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_LABEL: Record<Shape, L10n> = {
  circle: { en: 'Circle key', vi: 'Chìa tròn' }, triangle: { en: 'Triangle key', vi: 'Chìa tam giác' }, square: { en: 'Square key', vi: 'Chìa vuông' },
  diamond: { en: 'Diamond key', vi: 'Chìa thoi' }, hex: { en: 'Hexagon key', vi: 'Chìa lục giác' }, star: { en: 'Practice star', vi: 'Sao luyện tập' },
};
