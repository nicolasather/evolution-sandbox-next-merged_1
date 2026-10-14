import type { Discovery } from '../types';
import { materialOf, propsOf } from './materials';
import type { CraftSpec, MaterialId, SoundId, StepKind } from './types';

/* ============================================================================
   MOTION PLAN — reusable animation PARAMETERS per material family.

   A new item never needs a new effect or new JSX: its materials and the steps
   of its derived CraftSpec choose a family, and the family fixes the timeline,
   easing, particles and sound. Particle counts are capped; reduced-motion gets
   a still, short variant with the same meaning.

   This layer only describes motion. What a craft MAKES stays the engine's call.
   ========================================================================== */

export type MotionFamilyId =
  | 'percussive' | 'binding' | 'abrasive' | 'thermal' | 'fluid' | 'carving' | 'assembly' | 'signal' | 'insight' | 'organic' | 'gentle';

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

export interface MotionPhase { id: 'approach' | 'contact' | 'work' | 'settle' | 'reveal'; ms: number; easing: Easing; amplitude: number }

export interface MotionPlan {
  schemaVersion: 1;
  family: MotionFamilyId;
  phases: MotionPhase[];
  particles: { dust: ReturnType<typeof propsOf>['dust']; count: number; spread: number; gravity: number };
  sounds: SoundId[];
  shake: number;
  /** same story, no movement: used when the player prefers reduced motion */
  reduced: { phases: MotionPhase[]; particles: 0; shake: 0 };
}

export const MAX_PARTICLES = 48;
export const MAX_TOTAL_MS = 2400;

interface FamilyDef {
  id: MotionFamilyId;
  phases: [number, Easing, number][]; // [ms, easing, amplitude] for approach, contact, work, settle, reveal
  particles: { count: number; spread: number; gravity: number };
  shake: number;
}
const D = (id: MotionFamilyId, ph: FamilyDef['phases'], count: number, spread: number, gravity: number, shake: number): FamilyDef =>
  ({ id, phases: ph, particles: { count, spread, gravity }, shake });

export const MOTION_FAMILIES: Record<MotionFamilyId, FamilyDef> = {
  percussive: D('percussive', [[160, 'ease-in', 0.6], [70, 'linear', 1], [260, 'spring', 0.9], [200, 'ease-out', 0.3], [260, 'ease-out', 0.5]], 30, 1.0, 1, 0.9),
  binding:    D('binding',    [[220, 'ease-out', 0.4], [120, 'ease-in-out', 0.5], [600, 'ease-in-out', 0.7], [220, 'ease-out', 0.2], [260, 'ease-out', 0.5]], 6, 0.3, 0.2, 0.1),
  abrasive:   D('abrasive',   [[180, 'ease-out', 0.4], [100, 'linear', 0.8], [700, 'linear', 0.8], [200, 'ease-out', 0.2], [240, 'ease-out', 0.5]], 40, 0.5, 0.6, 0.3),
  thermal:    D('thermal',    [[240, 'ease-out', 0.4], [160, 'ease-in', 0.7], [800, 'ease-in-out', 1], [300, 'ease-out', 0.4], [320, 'ease-out', 0.7]], 44, 0.8, -0.5, 0.15),
  fluid:      D('fluid',      [[220, 'ease-out', 0.5], [120, 'ease-in', 0.6], [600, 'ease-in-out', 0.8], [260, 'ease-out', 0.3], [240, 'ease-out', 0.5]], 24, 0.7, 0.8, 0.05),
  carving:    D('carving',    [[160, 'ease-out', 0.5], [90, 'linear', 0.9], [520, 'linear', 0.7], [180, 'ease-out', 0.2], [240, 'ease-out', 0.5]], 18, 0.4, 0.7, 0.2),
  assembly:   D('assembly',   [[240, 'ease-out', 0.5], [140, 'ease-in-out', 0.6], [520, 'spring', 0.8], [220, 'ease-out', 0.3], [300, 'ease-out', 0.6]], 14, 0.4, 0.4, 0.25),
  signal:     D('signal',     [[200, 'ease-out', 0.4], [100, 'linear', 0.5], [420, 'ease-in-out', 0.6], [180, 'ease-out', 0.2], [320, 'ease-out', 0.8]], 20, 0.9, -0.1, 0),
  insight:    D('insight',    [[260, 'ease-out', 0.3], [100, 'ease-in', 0.4], [380, 'ease-in-out', 0.5], [200, 'ease-out', 0.2], [380, 'ease-out', 0.9]], 16, 1.1, -0.2, 0),
  organic:    D('organic',    [[220, 'ease-out', 0.4], [120, 'ease-in-out', 0.4], [560, 'ease-in-out', 0.5], [240, 'ease-out', 0.2], [280, 'ease-out', 0.6]], 12, 0.5, 0.3, 0.05),
  gentle:     D('gentle',     [[200, 'ease-out', 0.3], [100, 'ease-in-out', 0.3], [360, 'ease-in-out', 0.4], [180, 'ease-out', 0.2], [240, 'ease-out', 0.5]], 8, 0.4, 0.4, 0.05),
};

const PHASE_IDS: MotionPhase['id'][] = ['approach', 'contact', 'work', 'settle', 'reveal'];
const HARD = new Set<MaterialId>(['stone', 'metal', 'tool']);

/** Which family a pair of materials and the process's steps point to. Order matters: first match wins. */
export function familyFor(mats: readonly MaterialId[], kinds: readonly StepKind[]): MotionFamilyId {
  const has = (...m: MaterialId[]) => m.some(x => mats.includes(x));
  const step = (...k: StepKind[]) => k.some(x => kinds.includes(x));
  if (has('idea')) return 'insight';
  if (has('signal', 'energy') && !has('stone', 'wood', 'bone', 'fibre', 'earth')) return 'signal';
  if (has('machine', 'structure') && step('assemble', 'stack', 'connect', 'place')) return 'assembly';
  if (has('fire') || (step('heat') && has('earth', 'metal', 'glass'))) return 'thermal';
  if (has('liquid') || step('pour')) return 'fluid';
  if (step('grind')) return 'abrasive';
  if (step('cut') && has('wood', 'bone', 'stone')) return 'carving';
  if (step('wrap', 'align') && has('fibre')) return 'binding';
  if (has('fibre') && mats.length >= 2 && !mats.every(m => m === 'fibre')) return 'binding';
  if ((step('impact', 'strike', 'separate') || mats.every(m => HARD.has(m))) && mats.some(m => HARD.has(m))) return 'percussive';
  if (has('life')) return 'organic';
  if (has('machine', 'structure')) return 'assembly';
  return 'gentle';
}

export function planFromMaterials(mats: readonly MaterialId[], kinds: readonly StepKind[]): MotionPlan {
  const fam = MOTION_FAMILIES[familyFor(mats, kinds)];
  // the heaviest material sets how hard it lands; the first material sets the dust colour and sounds
  const lead = mats[0] ?? 'stone';
  const props = propsOf(lead);
  const mass = Math.max(...mats.map(m => propsOf(m).mass), 0.4);
  const scale = Math.min(1.3, 0.7 + mass / 6);
  const phases: MotionPhase[] = fam.phases.map(([ms, easing, amplitude], i) => ({ id: PHASE_IDS[i], ms, easing, amplitude: round(amplitude * scale) }));
  const total = phases.reduce((t, p) => t + p.ms, 0);
  const k = total > MAX_TOTAL_MS ? MAX_TOTAL_MS / total : 1;
  const capped = phases.map(p => ({ ...p, ms: Math.round(p.ms * k) }));
  const sounds = Array.from(new Set<SoundId>(mats.slice(0, 3).map(m => propsOf(m).sound)));
  return {
    schemaVersion: 1,
    family: fam.id,
    phases: capped,
    particles: { dust: props.dust, count: Math.min(MAX_PARTICLES, Math.round(fam.particles.count * scale)), spread: fam.particles.spread, gravity: fam.particles.gravity },
    sounds,
    shake: round(Math.min(1, fam.shake * scale)),
    reduced: {
      phases: [{ id: 'work', ms: 120, easing: 'linear', amplitude: 0 }, { id: 'reveal', ms: 240, easing: 'ease-out', amplitude: 0.3 }],
      particles: 0, shake: 0,
    },
  };
}

/** The plan for a real craft: every ingredient's material plus the steps its CraftSpec already names. */
export function motionPlanFor(ingredients: readonly Pick<Discovery, 'id' | 'cat' | 'era'>[], spec: Pick<CraftSpec, 'steps'>): MotionPlan {
  return planFromMaterials(ingredients.map(materialOf), spec.steps.map(s => s.kind));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
