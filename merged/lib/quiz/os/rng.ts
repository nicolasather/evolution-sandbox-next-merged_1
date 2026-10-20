/** Deterministic seeded pseudo-random source for map variation and tie-breaks only. Never used for security tokens. */
export function hashSeed(seed: string): number { let h = 2166136261 >>> 0; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0; return h >>> 0; }
export function seeded(seed: string): () => number {
  let n = hashSeed(seed);
  return () => { n = (n + 0x6d2b79f5) >>> 0; let t = n; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function bounded(seed: string, max: number): number { if (!Number.isInteger(max) || max < 1) throw new Error('bad bound'); return Math.floor(seeded(seed)() * max); }
