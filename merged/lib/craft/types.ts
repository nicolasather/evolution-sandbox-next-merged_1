/* ============================================================================
   CRAFT — shared types.

   The craft system turns "A + B → C" into a short physical process. Three
   layers, all data-driven:

     materials.ts  what things are made of and how they behave on the bench
     specs.ts      which physical process a recipe asks for (data + rules)
     steps/*       the reusable interaction kinds a process is built from

   The engine (lib/engine.ts) still decides WHAT a pair makes. This system only
   decides HOW the player gets there, and never changes the answer.
   ========================================================================== */

/** What a thing is made of, for physics and for choosing a fitting action. */
export type MaterialId =
  | 'stone' | 'wood' | 'bone' | 'fibre' | 'metal' | 'earth' | 'glass' | 'liquid'
  | 'fire' | 'tool' | 'structure' | 'machine' | 'energy' | 'signal' | 'idea' | 'life';

/** How much doing it asks of the player. Chosen by the recipe, never shown as a number. */
export type Tier = 'quick' | 'medium' | 'major';

export type ZoneId = 'hearth' | 'anvil' | 'basin';

export type ToolKind = 'hammer' | 'blade' | 'drill' | 'needle' | 'saw' | 'pick';

export interface MaterialProps {
  /** Heavier things lag behind the pointer, hit harder and push others around. */
  mass: number;
  /** 0 – dead, 1 – rubbery. Used for walls and for other bodies. */
  bounce: number;
  /** Surface drag while sliding, 1/s. */
  drag: number;
  /** Hardness 0–1: what can mark or break what. Also brightens the impact spark. */
  hard: number;
  /** How much it flattens on impact (0 = rigid, 1 = squashy). */
  squash: number;
  /** Radius scale on the bench. */
  size: number;
  /** Sound family used for impacts and friction. */
  sound: SoundId;
  /** Particle colour token: one of the palette keys. */
  dust: 'bone' | 'ochre' | 'ink' | 'spark' | 'water';
  /** Actions that make thematic sense for this material (used by the rule fallbacks). */
  natural: StepKind[];
}

export type SoundId =
  | 'clack' | 'knock' | 'click' | 'rustle' | 'ring' | 'splash' | 'hiss' | 'thud'
  | 'chime' | 'snap' | 'tick' | 'whoosh' | 'crackle' | 'hum' | 'scrape' | 'pop'
  /* the scenery answering a click: a drop of water, a puff of dust */
  | 'plip' | 'puff';

/** Every interaction a recipe step can name. New kinds register in steps/index.ts. */
export type StepKind =
  | 'touch' | 'impact' | 'hold' | 'strike' | 'grind' | 'shake' | 'stretch' | 'separate'
  | 'align' | 'wrap' | 'pour' | 'heat' | 'trace' | 'connect' | 'route' | 'keep'
  | 'timing' | 'assemble' | 'stack' | 'cut' | 'place';

/** One step of a process, as written in recipe data. Extra keys are that kind's parameters. */
export interface StepSpec { kind: StepKind; [param: string]: unknown }

/** A recipe's physical process. */
export interface CraftSpec {
  tier: Tier;
  steps: StepSpec[];
  /** Where it happens; the bodies are carried there. Omit for the open bench. */
  station?: ZoneId;
  /** Which of the two ingredients acts on the other, when one does. */
  tool?: 'a' | 'b';
  /** Hidden difficulty scale, 0.6 – 1.6. Multiplies counts, times and narrows windows. */
  resistance: number;
}

/** What a recipe author writes: everything but the resistance is optional. */
export interface CraftOverride {
  tier?: Tier;
  steps: StepSpec[];
  station?: ZoneId;
  tool?: 'a' | 'b';
  resistance?: number;
}

/* ── runtime ─────────────────────────────────────────────────────────── */

export interface Body {
  uid: number;
  itemId: string;
  material: MaterialId;
  props: MaterialProps;
  /** Radius in world px. */
  r: number;
  mass: number;
  x: number; y: number;
  vx: number; vy: number;
  angle: number; av: number;
  /** Height above the bench: a lifted or dropped item. */
  z: number; vz: number;
  /** Squash and stretch, applied on top of the pose. */
  sx: number; sy: number;
  /** Impact deformation: a damped spring; sx and sy are derived from it. */
  q: number; qv: number;
  /** Where on the body the pointer took hold. */
  gx: number; gy: number;
  /** Non-rotating name tag under the body. */
  lbl: HTMLElement | null;
  /** Display name. */
  name: string;
  /** Extra offset that decays: shakes and jitter. */
  ox: number; oy: number;
  /** 0–1: how hot it is. Tints the body. */
  heat: number;
  /** 0–1 glow used by ideas and energy. */
  glow: number;
  held: boolean;
  /** Under a session's control: physics leaves it alone. */
  locked: boolean;
  /** Real physics on (collisions, drag); false for parts driven by a step. */
  solid: boolean;
  /** Pointer-events on: can be grabbed. */
  grabbable: boolean;
  /** Preparation already done to this body on the bench (cut, ground, split…). */
  prepared: Set<string>;
  zone: ZoneId | null;
  /** Steps set these to draw custom things on the element. */
  el: HTMLElement;
  /** A copy that only exists for a step (an extra wheel, a peg…). */
  temp: boolean;
  /** Where the held body wants to be (world px). */
  tx: number; ty: number;
  /** Rotation the player asked for while held. */
  targetAngle: number;
  /** Seconds this body has been at rest. */
  rest: number;
  /** Seconds it has been alive; for the pop-in. */
  age: number;
  /** Generic-part label ("peg", "rod", "plank"…) for temp bodies without an item. */
  part?: string;
  /** Low z-order for parts that sit under others. */
  layer: number;
}

export interface Pointer {
  /** World coordinates. */
  x: number; y: number;
  /** Where the current press began. */
  x0: number; y0: number;
  down: boolean;
  /** Smoothed velocity, world px/s. */
  vx: number; vy: number;
  speed: number;
  /** Seconds the press has been held. */
  held: number;
  /** True once a press has started this frame (edge). */
  pressed: boolean;
  released: boolean;
  type: 'mouse' | 'touch' | 'pen';
  /** Present while a body is grabbed by the pointer. */
  grab: Body | null;
  /** True after the first move event. */
  seen: boolean;
}

export interface Palette {
  bone: string; bone2: string; bone3: string; line: string; line3: string;
  ochre: string; ink: string; good: string; hot: string; water: string;
}

export interface FxApi {
  burst(x: number, y: number, o?: BurstOpts): void;
  ring(x: number, y: number, r: number, o?: { color?: string; life?: number; width?: number }): void;
  spark(x: number, y: number, o?: BurstOpts): void;
  stream(x0: number, y0: number, x1: number, y1: number, o?: { color?: string; n?: number }): void;
  shake(amount: number): void;
  flash(amount: number): void;
  sound(id: SoundId, o?: { vol?: number; rate?: number; pan?: number }): void;
}

export interface BurstOpts {
  n?: number; color?: keyof Palette | string; speed?: number; life?: number;
  size?: number; spread?: number; angle?: number; gravity?: number; drag?: number;
}

export interface StepCtx {
  world: import('./world').World;
  /** Seconds since the session began. */
  t: number;
  /** Size of the work area (the play box) in px — not of the whole screen. */
  w: number; h: number;
  /** Top-left corner of the work area, in world px. */
  x0: number; y0: number;
  /** Centre of the work area. */
  cx: number; cy: number;
  a: Body; b: Body;
  /** Pieces added by a step; cleaned up by the session. */
  temp: Body[];
  ptr: Pointer;
  keys: ReadonlySet<string>;
  fx: FxApi;
  pal: Palette;
  rnd: () => number;
  /** 0 – 1: grows with failed attempts. Widens windows so nobody is ever stuck. */
  assist: number;
  /** Scales counts and times; from the recipe's hidden resistance. */
  res: number;
  reduced: boolean;
  /** Called by a step on a miss, a spill, an overheat: nudges `assist`. */
  fail(weight?: number): void;
  spawnPart(src: 'a' | 'b' | string, x: number, y: number, opts?: { r?: number; solid?: boolean }): Body;
  removePart(b: Body): void;
  zoneRect(id: ZoneId): { x: number; y: number; w: number; h: number };
  /** Which zone the point is inside, if any. */
  zoneAt(x: number, y: number): ZoneId | null;
  setZoneLit(id: ZoneId | null): void;
  /** Push a body to a target with a spring, ignoring physics. */
  moveTo(b: Body, x: number, y: number, k?: number): void;
  /** Short verb for screen readers and the first-time cue. */
  say(text: string): void;
}

export interface StepRuntime {
  readonly kind: StepKind;
  /** 0–1 progress of this step. */
  progress: number;
  done: boolean;
  /** The step wants free grabbing of bodies (align, assemble, route). */
  grabs?: boolean;
  update(dt: number, c: StepCtx): void;
  draw(g: CanvasRenderingContext2D, c: StepCtx): void;
  down?(c: StepCtx): void;
  move?(c: StepCtx): void;
  up?(c: StepCtx): void;
  /** Space, E and R. */
  key?(k: 'primary' | 'interact' | 'rotate', c: StepCtx, shift?: boolean): void;
  wheel?(dy: number, c: StepCtx): void;
  cleanup?(c: StepCtx): void;
}

export interface StepDef<P = Record<string, unknown>> {
  kind: StepKind;
  /** Rough seconds an average player needs, at resistance 1. Used to check pacing. */
  estimate(p: P): number;
  /** One or two words for the first-time cue. */
  verb: string;
  create(p: P, c: StepCtx): StepRuntime;
}

export type ContactInfo = {
  a: Body; b: Body;
  /** Closing speed along the contact normal, px/s. */
  speed: number;
  /** Speed × reduced mass: what the impact step measures. */
  force: number;
  fromDrop: boolean;
};
