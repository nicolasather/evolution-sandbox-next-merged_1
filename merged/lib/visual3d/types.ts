/* Procedural 3D — types. A spec is DATA: enumerated archetypes + bounded numbers.
   No HTML/SVG/script/URL/texture fields exist, so nothing a model returns can carry code. */

export const ARCHETYPES = [
  'blade', 'hafted_tool', 'axe', 'stone_fragment', 'polished_stone', 'wood_rod', 'woven_fibre', 'vessel',
  'brick', 'metal_ingot', 'wheel', 'bone_tool', 'bead', 'circuit', 'plant', 'abstract_diagram',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export type PartShape = 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'lathe' | 'wedge';

export interface Part {
  shape: PartShape;
  /** half extents / radii, normalised units (item fits in ±1) */
  size: [number, number, number];
  offset: [number, number, number];
  /** euler radians */
  rot?: [number, number, number];
  /** lathe only: [radius, y] profile points */
  profile?: [number, number][];
  tint?: 0 | 1 | 2;
}

export interface Visual3DSpec {
  schemaVersion: 1;
  archetype: Archetype;
  /** 0..1 bounded knobs the archetype interprets (length, taper, thickness, ...) */
  params: { length: number; width: number; taper: number; roughness: number; wear: number };
  material: MaterialDescriptor['id'];
  /** the picture is a reconstruction, not a claim about the real object's shape */
  stylized: true;
}

export interface MaterialDescriptor {
  id: 'stone' | 'wood' | 'bone' | 'fibre' | 'clay' | 'metal' | 'glass' | 'organic' | 'circuit';
  colors: [string, string, string];
  roughness: number;
  metalness: number;
}

export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  /** per-vertex tint index 0..2 into MaterialDescriptor.colors */
  tint: Uint8Array;
}

export type Lod = 0 | 1 | 2;
