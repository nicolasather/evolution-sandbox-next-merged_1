import type { MaterialDescriptor } from './types';

/** Deterministic material look per family. Roughness/metalness are fixed per material so snapshots are stable. */
export const MATERIAL_LOOK: Record<MaterialDescriptor['id'], MaterialDescriptor> = {
  stone: { id: 'stone', colors: ['#8d867a', '#6d675d', '#a79f90'], roughness: 0.92, metalness: 0 },
  wood: { id: 'wood', colors: ['#8a5a32', '#6b4426', '#a8744a'], roughness: 0.8, metalness: 0 },
  bone: { id: 'bone', colors: ['#e4dcc6', '#cfc5a8', '#f0ead8'], roughness: 0.65, metalness: 0 },
  fibre: { id: 'fibre', colors: ['#b79d62', '#9a8250', '#cdb878'], roughness: 0.95, metalness: 0 },
  clay: { id: 'clay', colors: ['#b0623b', '#964d2b', '#c77c52'], roughness: 0.85, metalness: 0 },
  metal: { id: 'metal', colors: ['#b87333', '#8f5a28', '#d49a63'], roughness: 0.38, metalness: 0.9 },
  glass: { id: 'glass', colors: ['#9fd3d6', '#7ab6ba', '#c5ecee'], roughness: 0.1, metalness: 0 },
  organic: { id: 'organic', colors: ['#5f8a45', '#46692f', '#7fae5c'], roughness: 0.8, metalness: 0 },
  circuit: { id: 'circuit', colors: ['#2f5d3a', '#c9a227', '#222'], roughness: 0.5, metalness: 0.3 },
};

/** Catalogue/seed material family → look. Unknown families fall back to stone, never to nothing. */
export function lookFor(family: string): MaterialDescriptor['id'] {
  const m: Record<string, MaterialDescriptor['id']> = {
    stone: 'stone', wood: 'wood', bone: 'bone', fibre: 'fibre', fiber: 'fibre', earth: 'clay', ceramic: 'clay',
    metal: 'metal', glass: 'glass', organic: 'organic', living: 'organic', composite: 'wood', abstract: 'circuit',
  };
  return m[family] ?? 'stone';
}
