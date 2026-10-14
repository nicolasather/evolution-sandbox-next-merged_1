import { hash32 } from './plan';
import type { Visual3DSpec } from './types';

/** Cache identity: (itemId, specHash, styleVersion, format). The 2D screenshot shares the 3D identity. */
export const STYLE_VERSION = 'exhibit-1';
export type OutputFormat = 'mesh' | 'svg';

export const specHash = (spec: Visual3DSpec): string => {
  const s = JSON.stringify([spec.archetype, spec.material, ...Object.keys(spec.params).sort().map(k => (spec.params as Record<string, number>)[k].toFixed(4))]);
  return hash32(s).toString(16).padStart(8, '0');
};

export const cacheKey = (itemId: string, spec: Visual3DSpec, format: OutputFormat, style = STYLE_VERSION) =>
  `v3d:${itemId}:${specHash(spec)}:${style}:${format}`;

/** Small LRU so inspection of many items cannot grow memory without bound. */
export class MeshCache<T> {
  private m = new Map<string, T>();
  constructor(private max = 64) {}
  get(k: string) { const v = this.m.get(k); if (v !== undefined) { this.m.delete(k); this.m.set(k, v); } return v; }
  set(k: string, v: T) { this.m.delete(k); this.m.set(k, v); while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string); }
  get size() { return this.m.size; }
}
