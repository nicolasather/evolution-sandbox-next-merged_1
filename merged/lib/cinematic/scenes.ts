/* ============================================================================
   CINEMATIC SCENES — one entry per thing the player can open.

   Every scene owns:
     • a title (the ONLY word on screen until the player presses Space),
     • 1–3 cinematic sentences (shown once, during the ~10 s opening),
     • a palette of 12 colours (k0–k11) that drives the 2.5D stage, the
       extruded lettering and the panel skin while the scene is open.

   The palette is generated, not hand-typed, so every scene gets a genuinely
   different set of 12 distinct colours (3 deep grounds, 6 accents spread round
   the wheel, 2 light tints, 1 glow) without 12 × 16 hex codes to maintain.
   ========================================================================== */

export type SceneId =
  | 'work' | 'graph' | 'arch' | 'time' | 'hub' | 'museum' | 'minpath'
  | 'journal' | 'world' | 'trade' | 'lab'
  | 'survival' | 'civilization' | 'archaeology' | 'escape-room' | 'decipher'
  | 'alien-archaeology' | 'reverse-evolution';

export interface Scene {
  id: SceneId;
  /** The single word (or two) that stays on screen. */
  title: string;
  /** 1–3 sentences. Kept short: they are spoken by the camera, not read. */
  lines: [string] | [string, string] | [string, string, string];
  /** Base hue, 0–359. The whole 12-colour palette is derived from it. */
  hue: number;
  /** Which centrepiece the 2.5D stage builds (see _cinematic.css `.cg-shape-*`). */
  shape: 'cube' | 'ring' | 'prism' | 'orbit';
}

export const SCENES: Record<SceneId, Scene> = {
  work: {
    id: 'work', title: 'Merging', hue: 28, shape: 'orbit',
    lines: ['Two things meet in your hands.', 'Something that never existed begins.'],
  },
  graph: {
    id: 'graph', title: 'Graph', hue: 196, shape: 'ring',
    lines: ['Every idea leans on another.', 'Follow the threads back to the first spark.'],
  },
  arch: {
    id: 'arch', title: 'Archive', hue: 42, shape: 'cube',
    lines: ['Everything you have kept is still here.', 'Nothing was ever truly lost.'],
  },
  time: {
    id: 'time', title: 'Timeline', hue: 268, shape: 'prism',
    lines: ['Ten thousand years, drawn as one line.', 'Walk it slowly.'],
  },
  hub: {
    id: 'hub', title: 'Modes', hue: 322, shape: 'orbit',
    lines: ['Every story has another door.', 'Choose the one that calls you.'],
  },
  museum: {
    id: 'museum', title: 'Museum', hue: 12, shape: 'prism',
    lines: ['Everything humanity learned, gathered in one building.', 'It grows as you move through time.'],
  },
  minpath: {
    id: 'minpath', title: 'Minimum Path', hue: 160, shape: 'ring',
    lines: ['The shortest road is never the obvious one.', 'Find it.'],
  },
  journal: {
    id: 'journal', title: 'Journal', hue: 52, shape: 'cube',
    lines: ['You have been changing the world.', 'Read what you left behind.'],
  },
  world: {
    id: 'world', title: 'World', hue: 212, shape: 'orbit',
    lines: ['The map remembers where you have been.', 'It is larger than you think.'],
  },
  trade: {
    id: 'trade', title: 'Trade', hue: 96, shape: 'prism',
    lines: ['Ideas travel further than people ever did.', 'Follow the routes.'],
  },
  lab: {
    id: 'lab', title: 'Laboratory', hue: 300, shape: 'ring',
    lines: ['Change one thing. Watch what breaks.', 'That is how anything is learned.'],
  },
  survival: {
    id: 'survival', title: 'Survival', hue: 20, shape: 'cube',
    lines: ['The cold does not negotiate.', 'Keep them alive.'],
  },
  civilization: {
    id: 'civilization', title: 'Civilization', hue: 38, shape: 'prism',
    lines: ['Every solution plants the next problem.', 'Build anyway.'],
  },
  archaeology: {
    id: 'archaeology', title: 'Archaeologist', hue: 30, shape: 'cube',
    lines: ['Dust hides the truth in layers.', 'Dig carefully.'],
  },
  'escape-room': {
    id: 'escape-room', title: 'Escape Room', hue: 350, shape: 'ring',
    lines: ['The door is older than the lock.', 'Understand it, and it opens.'],
  },
  decipher: {
    id: 'decipher', title: 'Decipher', hue: 232, shape: 'orbit',
    lines: ['A voice no one has heard for thousands of years.', 'Learn to listen.'],
  },
  'alien-archaeology': {
    id: 'alien-archaeology', title: 'Alien Ruins', hue: 284, shape: 'prism',
    lines: ['They built this, and no one remembers why.', 'Begin with the silence.'],
  },
  'reverse-evolution': {
    id: 'reverse-evolution', title: 'Reverse', hue: 178, shape: 'ring',
    lines: ['Hold a smartphone in your hand.', 'Now follow it all the way back to a stone.'],
  },
};

/** ViewId → the scene that opens with it. */
export const VIEW_SCENE: Record<string, SceneId | undefined> = {
  work: 'work', graph: 'graph', arch: 'arch', time: 'time', hub: 'hub', museum: 'museum', minpath: 'minpath',
};

const wrap = (h: number) => ((h % 360) + 360) % 360;

/** 12 distinct colours (k0–k11) from one base hue. */
export function paletteOf(hue: number): string[] {
  const h = hue;
  return [
    `hsl(${wrap(h + 8)} 55% 4%)`,     // k0  deepest ground
    `hsl(${wrap(h + 4)} 50% 8%)`,     // k1  ground
    `hsl(${wrap(h)} 46% 13%)`,        // k2  raised ground
    `hsl(${wrap(h)} 90% 58%)`,        // k3  primary accent
    `hsl(${wrap(h + 32)} 92% 62%)`,   // k4  warm neighbour
    `hsl(${wrap(h - 32)} 88% 60%)`,   // k5  cool neighbour
    `hsl(${wrap(h + 64)} 85% 66%)`,   // k6  far warm
    `hsl(${wrap(h - 64)} 82% 62%)`,   // k7  far cool
    `hsl(${wrap(h + 180)} 78% 64%)`,  // k8  complement
    `hsl(${wrap(h + 12)} 100% 88%)`,  // k9  bright tint
    `hsl(${wrap(h - 12)} 60% 96%)`,   // k10 paper white
    `hsl(${wrap(h + 150)} 95% 70%)`,  // k11 glow
  ];
}

/** Inline style object carrying --k0…--k11 for a scene. */
export function paletteVars(scene: Scene): Record<string, string> {
  const out: Record<string, string> = {};
  paletteOf(scene.hue).forEach((c, i) => { out[`--k${i}`] = c; });
  return out;
}

/** Total length of the opening, in milliseconds. */
export const INTRO_MS = 10000;
