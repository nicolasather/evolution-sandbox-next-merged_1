/* Quality / performance tiers for the procedural 3D preview (package 048).
   Pure function of the environment so it is testable without a GPU. Order of precedence:
   no WebGL, reduced motion, data saver or very low memory  →  flat SVG (no 3D code is even imported);
   otherwise the tier sets the mesh LOD and the particle budget. */

export type Lod = 0 | 1 | 2;
export type QualityTier = 'high' | 'medium' | 'low' | 'svg';

export interface QualityEnv {
  webgl: boolean;
  reducedMotion: boolean;
  saveData?: boolean;
  /** navigator.deviceMemory in GB (Chromium only; undefined elsewhere) */
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  /** viewport narrower than ~640 px */
  narrow?: boolean;
}

export interface QualityChoice {
  tier: QualityTier;
  render: 'webgl' | 'svg';
  lod: Lod;
  particleBudget: number;
  spin: boolean;
  reason: string;
}

export const PARTICLE_BUDGET: Record<QualityTier, number> = { high: 48, medium: 24, low: 8, svg: 0 };
const LOD_OF: Record<QualityTier, Lod> = { high: 0, medium: 1, low: 2, svg: 2 };

export function chooseQuality(env: QualityEnv): QualityChoice {
  const mk = (tier: QualityTier, reason: string, spin = tier !== 'svg'): QualityChoice =>
    ({ tier, render: tier === 'svg' ? 'svg' : 'webgl', lod: LOD_OF[tier], particleBudget: PARTICLE_BUDGET[tier], spin, reason });
  if (!env.webgl) return mk('svg', 'no WebGL');
  if (env.reducedMotion) return mk('svg', 'reduced motion');
  if (env.saveData) return mk('svg', 'data saver');
  const mem = env.deviceMemoryGb, cores = env.hardwareConcurrency;
  if (mem !== undefined && mem <= 1) return mk('svg', 'low memory');
  if ((mem !== undefined && mem <= 2) || (env.narrow && cores !== undefined && cores <= 4)) return mk('low', 'constrained device');
  if (env.narrow || (mem !== undefined && mem <= 4)) return mk('medium', 'mobile or mid-range device');
  return mk('high', 'desktop');
}

/** Reads the real browser; every property is optional and guarded. */
export function detectEnv(webgl: boolean): QualityEnv {
  if (typeof window === 'undefined') return { webgl: false, reducedMotion: true };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: nav.connection?.saveData === true,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    narrow: window.matchMedia?.('(max-width: 640px)').matches ?? false,
  };
}
