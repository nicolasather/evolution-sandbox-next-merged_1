import type { Discovery } from '../types';
import { materialOf, toolKindOf } from './materials';
import { stepDef } from './steps';
import type { CraftOverride, CraftSpec, MaterialId, StepSpec, Tier, ToolKind, ZoneId } from './types';

/* ============================================================================
   SPECS — which physical process a recipe asks for.

   Nothing here touches the engine's answer. A pair still makes what
   data/nodes says it makes; this file only says what the player DOES on the
   way, as data:

     { tier: 'medium', steps: [{ kind: 'align', ... }, { kind: 'wrap', turns: 2 }] }

   Three sources, in order:
     1. CRAFT_OVERRIDES — hand-authored processes for the discoveries that
        deserve one (stone + wood → hafted tool, wheel + axle + frame → cart…).
     2. FAMILIES — rules on the two ingredients' materials ("stone struck on
        stone", "fibre wound round wood", "metal into the fire").
     3. A quiet fallback, so every recipe in the game has a body to act on.

   The hidden difficulty is a tier (quick ≈ 1 s, medium 3–7 s, major 8–15 s)
   and a resistance that scales counts, times and window widths. A pacing
   governor lowers the next tier after a run of heavy ones, and a route the
   player has already done is never made to repeat the work (see Workbench).
   ========================================================================== */

const step = (kind: StepSpec['kind'], p: Record<string, unknown> = {}): StepSpec => ({ ...p, kind });

/** Deterministic 0–1 from a string, so a recipe's difficulty never changes between visits. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/* ── tiers ────────────────────────────────────────────────────────────── */

/** Discoveries that are milestones: a slower, more deliberate process. */
const MAJOR = new Set(`fire controlled_fire pottery smelting bronze iron steel glass cart boat wheel writing paper
  printing gunpowder chemistry electricity steam_engine telegraph computer internet transistor integrated_circuit
  microprocessor cave_art music vaccine antibiotics forging telescope agriculture city civilization
  grand_theft_auto_vi virtual_world`.split(/\s+/));

/** Chance that a non-milestone discovery is a quick one, by how far along the eras it is. */
const QUICK_BY_ERA = [0.62, 0.5, 0.42, 0.36, 0.32, 0.3, 0.26, 0.26, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];

export function tierOf(r: Discovery, eraIndex: number): Tier {
  if (MAJOR.has(r.id)) return 'major';
  let p = QUICK_BY_ERA[Math.min(eraIndex, QUICK_BY_ERA.length - 1)] ?? 0.2;
  if (r.rar === 'common') p += 0.22;
  else if (r.rar === 'rare') p -= 0.16;
  else if (r.rar === 'hidden') p -= 0.3;
  return hash01(`${r.id}|tier`) < p ? 'quick' : 'medium';
}

function resistanceOf(r: Discovery, tier: Tier): number {
  const base = tier === 'quick' ? 0.8 : tier === 'medium' ? 1 : 1.18;
  const depth = Math.min(1, (r.depth ?? 0) / 36) * 0.2;
  const rar = r.rar === 'hidden' ? 0.08 : r.rar === 'rare' ? 0.05 : 0;
  return Math.max(0.7, Math.min(1.5, base + depth + rar));
}

/* ── families: rules on the two ingredients ──────────────────────────── */

interface Ctx {
  a: Discovery; b: Discovery; r: Discovery;
  ma: MaterialId; mb: MaterialId;
  ta: ToolKind | null; tb: ToolKind | null;
  has: (m: MaterialId) => boolean;
  tool: (k: ToolKind) => boolean;
}

interface Family {
  id: string;
  match: (c: Ctx) => boolean;
  build: Record<Tier, (c: Ctx) => StepSpec[]>;
  station?: ZoneId;
  /** Which ingredient acts on the other. */
  tool?: (c: Ctx) => 'a' | 'b' | undefined;
}

const eitherMat = (c: Ctx, ...ms: MaterialId[]) => ms.some(m => c.has(m));
const isAbstract = (m: MaterialId) => m === 'idea' || m === 'signal' || m === 'energy';
const hammerSide = (c: Ctx): 'a' | 'b' | undefined => (c.ta === 'hammer' ? 'a' : c.tb === 'hammer' ? 'b' : undefined);
const bladeSide = (c: Ctx): 'a' | 'b' | undefined => (c.ta === 'blade' ? 'a' : c.tb === 'blade' ? 'b' : undefined);

/** Idea recipes are varied by the result's own hash, so they do not all feel the same. */
const ideaKind = (c: Ctx) => Math.floor(hash01(`${c.r.id}|idea`) * 4);
const SHAPES = ['circle', 'wave', 'symbol', 'arc', 'zigzag', 'cross'] as const;
const shapeFor = (c: Ctx) => SHAPES[Math.floor(hash01(`${c.r.id}|shape`) * SHAPES.length)];

const FAMILIES: Family[] = [
  {
    // wood set across stone or a tool: haft it
    id: 'haft',
    match: c => (c.ma === 'wood' && (c.mb === 'stone' || c.mb === 'bone' || c.mb === 'tool'))
      || (c.mb === 'wood' && (c.ma === 'stone' || c.ma === 'bone' || c.ma === 'tool')),
    build: {
      quick: () => [step('hold', { time: 0.5 })],
      medium: () => [step('align', { angle: 90 }), step('hold', { time: 0.9 })],
      major: () => [step('align', { angle: 90 }), step('wrap', { turns: 3 }), step('hold', { time: 1.4 })],
    },
  },
  {
    // a cord bound round something
    id: 'bind',
    match: c => eitherMat(c, 'fibre') && !(c.ma === 'fibre' && c.mb === 'fibre') && !(c.ta === 'needle' || c.tb === 'needle')
      && !eitherMat(c, 'fire') && !isAbstract(c.ma === 'fibre' ? c.mb : c.ma),
    build: {
      quick: () => [step('hold', { time: 0.5 })],
      medium: () => [step('wrap', { turns: 2 }), step('hold', { time: 0.8 })],
      major: () => [step('align'), step('wrap', { turns: 3 }), step('hold', { time: 1.3 })],
    },
  },
  {
    // fibre with fibre: twist it
    id: 'twist',
    match: c => c.ma === 'fibre' && c.mb === 'fibre',
    build: {
      quick: () => [step('stretch', { len: 0.7 })],
      medium: () => [step('grind', { variant: 'twist', amount: 300 }), step('stretch', { len: 0.9 })],
      major: () => [step('grind', { variant: 'twist', amount: 420 }), step('stretch', { len: 1 }), step('hold', { time: 1 })],
    },
  },
  {
    // a needle drawn through fibre or cloth
    id: 'stitch',
    match: c => (c.ta === 'needle' || c.tb === 'needle') && (eitherMat(c, 'fibre', 'bone')),
    build: {
      quick: () => [step('touch')],
      medium: () => [step('trace', { shape: 'stitch' }), step('hold', { time: 0.6 })],
      major: () => [step('align'), step('trace', { shape: 'stitch', laps: 2 }), step('hold', { time: 0.9 })],
    },
  },
  {
    // an edge drawn through something
    id: 'cut',
    match: c => !!bladeSide(c) && (eitherMat(c, 'wood', 'fibre', 'bone', 'life')) && !eitherMat(c, 'fire'),
    tool: bladeSide,
    build: {
      quick: () => [step('cut', { cuts: 1 })],
      medium: () => [step('cut', { cuts: 1 }), step('hold', { time: 0.6 })],
      major: () => [step('align'), step('cut', { cuts: 2 }), step('hold', { time: 0.9 })],
    },
  },
  {
    // fire and something: keep it in the flame
    id: 'flame',
    match: c => eitherMat(c, 'fire') && !eitherMat(c, 'metal'),
    station: 'hearth',
    build: {
      quick: () => [step('hold', { time: 0.6 })],
      medium: () => [step('heat', { hold: 1.3, band: [0.4, 0.75] }), step('hold', { time: 0.5 })],
      major: () => [step('place', { zone: 'hearth' }), step('heat', { hold: 2.2, band: [0.45, 0.72] }), step('timing', { hits: 2 })],
    },
  },
  {
    // metal: heat it, work it, cool it
    id: 'metalwork',
    match: c => eitherMat(c, 'metal') && !isAbstract(c.ma === 'metal' ? c.mb : c.ma),
    station: 'hearth',
    tool: hammerSide,
    build: {
      quick: () => [step('hold', { time: 0.6 })],
      medium: () => [step('heat', { hold: 1.2, band: [0.5, 0.8], quench: true }), step('strike', { hits: 3 })],
      major: () => [step('place', { zone: 'hearth' }), step('heat', { hold: 2, band: [0.55, 0.8], quench: true }),
        step('place', { zone: 'anvil' }), step('strike', { hits: 5 }), step('timing', { hits: 2 })],
    },
  },
  {
    // a hammer on something
    id: 'pound',
    match: c => !!hammerSide(c),
    tool: hammerSide,
    build: {
      quick: () => [step('impact', { force: 0.5 })],
      medium: () => [step('strike', { hits: 3 })],
      major: () => [step('strike', { hits: 4 }), step('timing', { hits: 2 })],
    },
  },
  {
    // stone on stone, stone on bone: knapping
    id: 'knap',
    match: c => (c.ma === 'stone' && (c.mb === 'stone' || c.mb === 'bone')) || (c.mb === 'stone' && c.ma === 'bone')
      || (c.ma === 'bone' && c.mb === 'bone'),
    build: {
      quick: () => [step('impact', { force: 0.5 })],
      medium: () => [step('strike', { hits: 3 }), step('hold', { time: 0.4 })],
      major: () => [step('impact', { force: 0.6 }), step('strike', { hits: 5 }), step('timing', { hits: 2 })],
    },
  },
  {
    // liquids: pour and mix
    id: 'liquid',
    match: c => eitherMat(c, 'liquid'),
    build: {
      quick: () => [step('shake', { energy: 0.5 })],
      medium: () => [step('pour', { liquid: 'water' }), step('shake', { energy: 0.6 })],
      major: () => [step('pour', { liquid: 'water' }), step('shake', { energy: 0.8 }), step('timing', { hits: 2 })],
    },
  },
  {
    id: 'glass',
    match: c => eitherMat(c, 'glass'),
    station: 'hearth',
    build: {
      quick: () => [step('touch')],
      medium: () => [step('heat', { hold: 1.2, band: [0.55, 0.85] }), step('align')],
      major: () => [step('heat', { hold: 1.8, band: [0.6, 0.85] }), step('trace', { shape: 'circle' }), step('timing', { hits: 2 })],
    },
  },
  {
    // clay, ash, lime, brick: shape and set
    id: 'earth',
    match: c => eitherMat(c, 'earth'),
    build: {
      quick: () => [step('hold', { time: 0.6 })],
      medium: () => [step('trace', { shape: 'circle' }), step('hold', { time: 0.7 })],
      major: () => [step('trace', { shape: 'circle', laps: 2 }), step('hold', { time: 1 }), step('heat', { hold: 1.4, band: [0.4, 0.7] })],
    },
  },
  {
    // things built up out of parts
    id: 'build',
    match: c => eitherMat(c, 'structure') || (eitherMat(c, 'wood', 'stone') && (c.r.cat === 'engineering' || c.r.cat === 'society')),
    build: {
      quick: () => [step('touch')],
      medium: () => [step('stack', { n: 3 }), step('hold', { time: 0.6 })],
      major: () => [step('assemble', { layout: 'row', n: 4 }), step('stack', { n: 3 }), step('hold', { time: 1 })],
    },
  },
  {
    // machines: assemble, then set running
    id: 'machine',
    match: c => eitherMat(c, 'machine'),
    build: {
      quick: () => [step('align')],
      medium: () => [step('assemble', { layout: 'gears', n: 3 }), step('timing', { hits: 2 })],
      major: () => [step('assemble', { layout: 'gears', n: 4 }), step('connect', { links: 2 }), step('keep', { mode: 'balance', time: 2 }), step('timing', { hits: 2 })],
    },
  },
  {
    // circuits and signals
    id: 'signal',
    match: c => eitherMat(c, 'signal', 'energy') && (c.r.cat === 'computing' || c.r.cat === 'media' || c.r.cat === 'energy' || c.r.cat === 'engineering' || c.r.cat === 'technology'),
    build: {
      quick: () => [step('connect', { links: 1 })],
      medium: () => [step('connect', { links: 2 }), step('timing', { hits: 2 })],
      major: () => [step('connect', { links: 3 }), step('route', { path: 'wave' }), step('keep', { mode: 'zone', time: 2 }), step('timing', { hits: 3 })],
    },
  },
  {
    // two ideas: bring them into relation
    id: 'idea',
    match: c => isAbstract(c.ma) || isAbstract(c.mb) || c.r.cat === 'culture' || c.r.cat === 'society' || c.r.cat === 'knowledge' || c.r.cat === 'economy' || c.r.cat === 'science',
    build: {
      quick: c => [ideaKind(c) % 2 ? step('connect', { links: 1 }) : step('touch')],
      medium: c => {
        switch (ideaKind(c)) {
          case 0: return [step('connect', { links: 1 }), step('hold', { time: 0.9 })];
          case 1: return [step('trace', { shape: shapeFor(c) }), step('hold', { time: 0.6 })];
          case 2: return [step('keep', { mode: 'zone', time: 1.6 }), step('timing', { hits: 1 })];
          default: return [step('timing', { hits: 2 }), step('connect', { links: 1 })];
        }
      },
      major: c => [step('connect', { links: 2 }), step('trace', { shape: shapeFor(c) }), step('keep', { mode: 'zone', time: 1.8 }), step('timing', { hits: 2 })],
    },
  },
  {
    // whatever is left: two things brought together and held
    id: 'fallback',
    match: () => true,
    build: {
      quick: () => [step('touch')],
      medium: () => [step('hold', { time: 1 }), step('timing', { hits: 1 })],
      major: () => [step('align'), step('hold', { time: 1.2 }), step('timing', { hits: 2 })],
    },
  },
];

/* ── hand-authored processes ──────────────────────────────────────────── */

/** Keyed by the discovery that results. */
export const CRAFT_OVERRIDES: Record<string, CraftOverride> = {
  sharp_stone: { tier: 'quick', steps: [step('impact', { force: 0.5 })] },
  stone_flake: { tier: 'medium', steps: [step('strike', { hits: 3, tool: 'auto' }), step('hold', { time: 0.4 })] },
  stone_tool: { tier: 'medium', steps: [step('align', { angle: 90 }), step('hold', { time: 0.8 })] },
  cordage: { tier: 'medium', steps: [step('grind', { variant: 'twist', amount: 300 }), step('stretch', { len: 0.9 })] },
  binding: { tier: 'medium', steps: [step('wrap', { turns: 2 }), step('hold', { time: 0.8 })] },

  // Stone + Wood → hafted tool. The worked example: drag, align, wrap, tighten.
  hafted_tool: {
    tier: 'medium', resistance: 1,
    steps: [step('align', { angle: 90, dx: 0, dy: -1.05 }), step('wrap', { turns: 2 }), step('hold', { time: 0.9 })],
  },
  axe: { tier: 'medium', steps: [step('align', { angle: 90 }), step('wrap', { turns: 3 }), step('hold', { time: 1.1 })] },
  spear: { tier: 'medium', steps: [step('align', { angle: 0, dx: 0, dy: -1.2 }), step('wrap', { turns: 2 }), step('hold', { time: 0.8 })] },
  composite_tool: { tier: 'medium', steps: [step('align', { angle: 90 }), step('wrap', { turns: 3 }), step('hold', { time: 1 })] },

  fire: {
    tier: 'major', resistance: 1.1,
    steps: [step('align', { angle: 90, dx: 0, dy: 0.2 }), step('grind', { variant: 'ember', amount: 560, heat: true }), step('hold', { time: 1.1, variant: 'blow' })],
  },
  campfire: { tier: 'medium', station: 'hearth', steps: [step('stack', { n: 3 }), step('heat', { hold: 1.2, band: [0.4, 0.75] })] },
  hearth: { tier: 'medium', steps: [step('stack', { n: 3 }), step('heat', { hold: 1, band: [0.4, 0.75] })], station: 'hearth' },
  controlled_fire: {
    tier: 'major', station: 'hearth',
    steps: [step('place', { zone: 'hearth' }), step('heat', { hold: 2.4, band: [0.45, 0.72] }), step('keep', { mode: 'balance', time: 1.6 })],
  },
  cooking: { tier: 'medium', station: 'hearth', steps: [step('heat', { hold: 1.4, band: [0.35, 0.7] }), step('timing', { hits: 2 })] },
  smoke: { tier: 'medium', station: 'hearth', steps: [step('heat', { hold: 1, band: [0.3, 0.6] }), step('shake', { energy: 0.5 })] },

  lumber: { tier: 'medium', tool: 'a', steps: [step('strike', { hits: 4, on: 'b', prep: 'chop' }), step('cut', { on: 'b', prep: 'logs' })] },
  kindling: { tier: 'medium', steps: [step('cut', { cuts: 2, on: 'b' })] },
  peg: { tier: 'medium', steps: [step('cut', { cuts: 1, on: 'b' }), step('grind', { amount: 180 })] },
  ladder: { tier: 'medium', steps: [step('assemble', { layout: 'ladder', n: 5 }), step('wrap', { turns: 2 })] },
  shelter: { tier: 'medium', steps: [step('assemble', { layout: 'tent', n: 3 }), step('wrap', { turns: 2 })] },
  palisade: { tier: 'medium', steps: [step('assemble', { layout: 'row', n: 4 }), step('hold', { time: 0.6 })] },
  fence: { tier: 'medium', steps: [step('assemble', { layout: 'row', n: 4 }), step('wrap', { turns: 1 })] },
  raft: { tier: 'medium', steps: [step('assemble', { layout: 'row', n: 3 }), step('wrap', { turns: 2 }), step('hold', { time: 0.8 })] },
  boat: { tier: 'major', steps: [step('assemble', { layout: 'hull', n: 4 }), step('wrap', { turns: 3 }), step('hold', { time: 1 }), step('timing', { hits: 2 })] },
  needle: { tier: 'medium', steps: [step('grind', { amount: 260 }), step('align', { angle: 0 })] },

  pottery: {
    tier: 'major', station: 'hearth',
    steps: [step('trace', { shape: 'circle', laps: 2 }), step('hold', { time: 1 }), step('place', { zone: 'hearth' }), step('heat', { hold: 1.6, band: [0.4, 0.7] })],
  },
  brick: { tier: 'medium', station: 'hearth', steps: [step('hold', { time: 1 }), step('heat', { hold: 1.2, band: [0.4, 0.75] })] },
  smelting: {
    tier: 'major', station: 'hearth',
    steps: [step('place', { zone: 'hearth' }), step('heat', { hold: 2.6, band: [0.6, 0.85] }), step('shake', { energy: 0.6 }), step('timing', { hits: 2 })],
  },
  copper: { tier: 'medium', station: 'hearth', steps: [step('heat', { hold: 1.4, band: [0.5, 0.8] }), step('strike', { hits: 3 })] },
  bronze: {
    tier: 'major', station: 'hearth',
    steps: [step('place', { zone: 'hearth' }), step('heat', { hold: 2.2, band: [0.55, 0.8], quench: true }), step('place', { zone: 'anvil' }), step('strike', { hits: 5 })],
  },
  iron: {
    tier: 'major', station: 'hearth',
    steps: [step('place', { zone: 'hearth' }), step('heat', { hold: 2.6, band: [0.6, 0.85], quench: true }), step('place', { zone: 'anvil' }), step('strike', { hits: 6 })],
  },
  steel: {
    tier: 'major', station: 'hearth',
    steps: [step('place', { zone: 'hearth' }), step('heat', { hold: 2.8, band: [0.65, 0.85], quench: true }), step('strike', { hits: 5 }), step('timing', { hits: 3 })],
  },
  forging: { tier: 'medium', station: 'anvil', steps: [step('heat', { hold: 1.2, band: [0.5, 0.8], quench: true }), step('strike', { hits: 4 })] },
  casting: { tier: 'medium', station: 'hearth', steps: [step('heat', { hold: 1.4, band: [0.55, 0.85] }), step('pour', { liquid: 'metal' })] },

  wheel: { tier: 'major', steps: [step('cut', { cuts: 1, on: 'b' }), step('trace', { shape: 'circle' }), step('hold', { time: 0.9 })] },
  axle: { tier: 'medium', steps: [step('align', { angle: 0, dx: 0, dy: 0 }), step('hold', { time: 0.8 })] },
  // Wheel + Axle + Wheel + Frame → Cart
  cart: {
    tier: 'major', resistance: 1.1,
    steps: [
      step('assemble', { layout: 'cart' }),
      step('hold', { time: 0.9, variant: 'press' }),
      step('timing', { hits: 2 }),
    ],
  },
  lever: { tier: 'medium', steps: [step('align', { angle: 0 }), step('keep', { mode: 'balance', time: 1.4 })] },
  pulley: { tier: 'medium', steps: [step('wrap', { turns: 2 }), step('route', { path: 's' })] },
  gear: { tier: 'medium', steps: [step('assemble', { layout: 'gears', n: 3 }), step('timing', { hits: 2 })] },
  mechanism: { tier: 'medium', steps: [step('assemble', { layout: 'gears', n: 3 }), step('timing', { hits: 2 })] },

  art: { tier: 'medium', steps: [step('trace', { shape: 'symbol' })] },
  cave_art: { tier: 'major', steps: [step('trace', { shape: 'symbol', laps: 1 }), step('keep', { mode: 'zone', time: 2 }), step('timing', { hits: 1 })] },
  music: { tier: 'major', steps: [step('trace', { shape: 'wave' }), step('timing', { hits: 3, speed: 1.15 })] },
  writing: { tier: 'major', steps: [step('trace', { shape: 'script' }), step('hold', { time: 0.8 }), step('timing', { hits: 2 })] },
  paper: { tier: 'major', steps: [step('grind', { amount: 320 }), step('pour', { liquid: 'water' }), step('hold', { time: 1.2, variant: 'press' })] },
  printing: { tier: 'major', steps: [step('align', { angle: 0 }), step('hold', { time: 1.4, variant: 'press' }), step('timing', { hits: 2 })] },
  glass: { tier: 'major', station: 'hearth', steps: [step('place', { zone: 'hearth' }), step('heat', { hold: 2, band: [0.65, 0.88] }), step('shake', { energy: 0.5 }), step('timing', { hits: 2 })] },
  gunpowder: { tier: 'major', steps: [step('grind', { amount: 320 }), step('shake', { energy: 0.7 }), step('timing', { hits: 1 })] },
  chemistry: { tier: 'major', steps: [step('pour', { liquid: 'acid' }), step('heat', { hold: 1.4, band: [0.4, 0.7] }), step('shake', { energy: 0.6 })] },
  vaccine: { tier: 'major', steps: [step('pour', { liquid: 'medicine' }), step('shake', { energy: 0.7 }), step('timing', { hits: 2 })] },
  antibiotics: { tier: 'major', steps: [step('pour', { liquid: 'medicine' }), step('shake', { energy: 0.7 }), step('timing', { hits: 2 })] },
  irrigation: { tier: 'medium', steps: [step('route', { path: 'channel' }), step('pour', { liquid: 'water' })] },
  telescope: { tier: 'major', steps: [step('align', { angle: 0 }), step('keep', { mode: 'zone', time: 1.8 }), step('timing', { hits: 2 })] },
  agriculture: { tier: 'major', steps: [step('route', { path: 'zigzag' }), step('pour', { liquid: 'water' }), step('keep', { mode: 'zone', time: 1.6 })] },

  electricity: { tier: 'major', steps: [step('connect', { links: 2 }), step('keep', { mode: 'zone', time: 1.8 }), step('timing', { hits: 2 })] },
  electric_light: { tier: 'medium', steps: [step('connect', { links: 2 }), step('keep', { mode: 'balance', time: 1.4 })] },
  telegraph: { tier: 'major', steps: [step('connect', { links: 2 }), step('timing', { hits: 4, speed: 1.2 })] },
  steam_engine: { tier: 'major', station: 'hearth', steps: [step('assemble', { layout: 'gears', n: 4 }), step('heat', { hold: 1.8, band: [0.5, 0.78] }), step('timing', { hits: 3 })] },
  transistor: { tier: 'major', steps: [step('trace', { shape: 'circuit' }), step('connect', { links: 3 }), step('timing', { hits: 2 })] },
  integrated_circuit: { tier: 'major', steps: [step('trace', { shape: 'circuit' }), step('connect', { links: 3 }), step('timing', { hits: 2 })] },
  microprocessor: { tier: 'major', steps: [step('trace', { shape: 'circuit', laps: 2 }), step('connect', { links: 3 }), step('timing', { hits: 3 })] },
  computer: { tier: 'major', steps: [step('connect', { links: 3 }), step('route', { path: 'zigzag' }), step('timing', { hits: 3 })] },
  internet: { tier: 'major', steps: [step('connect', { links: 3 }), step('route', { path: 'wave' }), step('keep', { mode: 'zone', time: 2 })] },
  grand_theft_auto_vi: {
    tier: 'major', resistance: 1.25,
    steps: [step('connect', { links: 3 }), step('route', { path: 'loop' }), step('keep', { mode: 'zone', time: 2.4 }), step('timing', { hits: 4 })],
  },
  virtual_world: {
    tier: 'major', resistance: 1.2,
    steps: [step('connect', { links: 3 }), step('trace', { shape: 'circuit' }), step('keep', { mode: 'zone', time: 2.2 }), step('timing', { hits: 3 })],
  },
};

/* ── deriving a spec ─────────────────────────────────────────────────── */

export interface DeriveOpts {
  /** Era index of the result (0 = origins). */
  eraIndex: number;
  /** After two heavy runs in a row, the next ordinary one is quick. */
  relax?: boolean;
}

function deriveRaw(a: Discovery, b: Discovery, r: Discovery, o: DeriveOpts): CraftSpec {
  const ma = materialOf(a), mb = materialOf(b);
  const c: Ctx = {
    a, b, r, ma, mb, ta: toolKindOf(a.id), tb: toolKindOf(b.id),
    has: m => ma === m || mb === m,
    tool: k => toolKindOf(a.id) === k || toolKindOf(b.id) === k,
  };
  const over = CRAFT_OVERRIDES[r.id];
  let tier: Tier = over?.tier ?? tierOf(r, o.eraIndex);
  if (o.relax && tier === 'medium' && !over?.tier) tier = 'quick';
  // an override keeps its own tier, but a relaxed run may still trim a medium one to its first step
  const fam = FAMILIES.find(f => f.match(c)) ?? FAMILIES[FAMILIES.length - 1];
  if (over && !(o.relax && over.tier === 'medium' && !MAJOR.has(r.id) && hash01(`${r.id}|relax`) < 0.5)) {
    return {
      tier: over.tier ?? tier,
      steps: over.steps,
      station: over.station ?? fam.station,
      tool: over.tool ?? fam.tool?.(c),
      resistance: over.resistance ?? resistanceOf(r, over.tier ?? tier),
    };
  }
  const t: Tier = over && o.relax ? 'quick' : tier;
  return {
    tier: t,
    steps: fam.build[t](c),
    station: t === 'quick' ? undefined : fam.station,
    tool: fam.tool?.(c),
    resistance: resistanceOf(r, t),
  };
}

/* ── pacing ──────────────────────────────────────────────────────────── */

/** Seconds a tier may ask of an average player, at the recipe's resistance. Never shown. */
export const BUDGET: Record<Tier, number> = { quick: 2, medium: 9, major: 15 };
/** Fewest steps a tier is made of. */
const MIN_STEPS: Record<Tier, number> = { quick: 1, medium: 2, major: 2 };
/** What can be dropped first when a process runs long: the trimmings, never the heart of it. */
const TRIM_ORDER: StepSpec['kind'][] = ['hold', 'timing', 'keep', 'shake', 'wrap', 'stack', 'trace', 'connect'];

/** Estimated seconds for a list of steps. */
export function estimateSteps(steps: StepSpec[], resistance: number): number {
  return steps.reduce((t, st) => t + (stepDef(st.kind)?.estimate(st) ?? 1.5) * resistance, 0);
}

/**
 * The pacing governor. A medium process is at least two steps (a lone strike is
 * a chore, so it gets a settling press after); and no process may run past its
 * tier's budget: the least essential trailing steps are dropped until it fits.
 */
function govern(spec: CraftSpec): CraftSpec {
  let steps = spec.steps.slice();
  if (spec.tier === 'medium' && steps.length < 2) steps = [...steps, step('hold', { time: 0.7 })];
  const budget = BUDGET[spec.tier];
  while (steps.length > MIN_STEPS[spec.tier] && estimateSteps(steps, spec.resistance) > budget) {
    let cut = -1;
    for (const k of TRIM_ORDER) {
      for (let i = steps.length - 1; i >= 0; i--) if (steps[i].kind === k) { cut = i; break; }
      if (cut >= 0) break;
    }
    if (cut < 0) break;
    steps = steps.filter((_, i) => i !== cut);
  }
  return steps.length === spec.steps.length && steps.every((x, i) => x === spec.steps[i]) ? spec : { ...spec, steps };
}

/** The physical process for a recipe: what the hands do to get from these two to that. */
export function deriveSpec(a: Discovery, b: Discovery, r: Discovery, o: DeriveOpts): CraftSpec {
  return govern(deriveRaw(a, b, r, o));
}

export const FAMILY_IDS = FAMILIES.map(f => f.id);
