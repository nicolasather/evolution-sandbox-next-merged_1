import { FAMILIES } from './families';
import { MATERIAL_LOOK, lookFor } from './materials';
import { buildMesh } from './geometry';
import { ARCHETYPES, type Archetype, type Lod, type Mesh, type Visual3DSpec } from './types';

/* A plan is what a model (or the Python compiler) may suggest; this file is the only thing that
   turns it into geometry. Anything outside the enumerations/ranges is rejected or clamped to a safe default. */

export const LOD_SEGMENTS: Record<Lod, number> = { 0: 14, 1: 8, 2: 4 };

const clamp01 = (n: unknown, d = 0.5) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

/** FNV-1a — stable, tiny, no deps. Seeds the per-item variation of the knobs. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export interface PlanError { field: string; problem: string }

/** Strict parse of an untrusted spec: unknown keys / values are errors, not silently dropped. */
export function parseSpec(raw: unknown): { ok: true; spec: Visual3DSpec } | { ok: false; errors: PlanError[] } {
  const errors: PlanError[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: [{ field: '$', problem: 'not an object' }] };
  const o = raw as Record<string, unknown>;
  const allowed = new Set(['schemaVersion', 'archetype', 'params', 'material', 'stylized']);
  for (const k of Object.keys(o)) if (!allowed.has(k)) errors.push({ field: k, problem: 'unexpected field (no html/svg/url/script/texture fields exist)' });
  if (o.schemaVersion !== 1) errors.push({ field: 'schemaVersion', problem: 'must be 1' });
  if (!ARCHETYPES.includes(o.archetype as Archetype)) errors.push({ field: 'archetype', problem: 'not an enumerated archetype' });
  if (!(o.material as string in MATERIAL_LOOK)) errors.push({ field: 'material', problem: 'unknown material' });
  if (o.stylized !== true) errors.push({ field: 'stylized', problem: 'must be true: this is a reconstruction, not a measured shape' });
  const p = (o.params ?? {}) as Record<string, unknown>;
  for (const k of ['length', 'width', 'taper', 'roughness', 'wear']) {
    const v = p[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) errors.push({ field: `params.${k}`, problem: 'must be a number in 0..1' });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, spec: o as unknown as Visual3DSpec };
}

/** Deterministic spec from verified-brief data. Same input ⇒ same spec, always. */
export function planFor(input: { itemId: string; archetype: string; family: string }): Visual3DSpec {
  const arch: Archetype = (ARCHETYPES as readonly string[]).includes(input.archetype) ? (input.archetype as Archetype) : 'abstract_diagram';
  const h = hash32(`${input.itemId}|${arch}`);
  const f = (shift: number) => ((h >>> shift) & 0xff) / 255;
  return {
    schemaVersion: 1, archetype: arch, material: lookFor(input.family), stylized: true,
    params: { length: 0.3 + 0.5 * f(0), width: 0.3 + 0.5 * f(8), taper: 0.2 + 0.6 * f(16), roughness: clamp01(f(24)), wear: clamp01(f(4)) },
  };
}

export function meshFor(spec: Visual3DSpec, lod: Lod = 0): Mesh {
  const parts = FAMILIES[spec.archetype](spec.params);
  return buildMesh(parts, LOD_SEGMENTS[lod]);
}
