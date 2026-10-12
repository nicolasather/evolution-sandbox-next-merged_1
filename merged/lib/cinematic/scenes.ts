/* ============================================================================
   CINEMATIC SCENES — one entry per thing the player can open.

   Every scene owns:
     • a title (the ONLY word on screen until the player presses Space),
     • 1–3 cinematic sentences (shown once, during the ~10 s opening),
     • a palette of 12 colours (k0–k11) that drives the 2.5D stage, the
       extruded lettering and the panel skin while the scene is open.

   The palette is generated, not hand-typed: near-black grounds, neutral grey
   hairlines and one accent — the same quiet blueprint look as the workbench.
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
    lines: ['A settlement is more than the things it builds.', 'Keep its lifelines working.'],
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

/** 12 colours (k0–k11) for a scene — a quiet blueprint palette, not a rainbow.
 *  k0–k2 are near-black grounds (tinted only a few percent by the scene hue),
 *  k3–k8 are six steps of neutral grey for hairlines and outlines, k9–k10 are
 *  the two text tones, and k11 is the single accent (the site's own ochre). */
export function paletteOf(hue: number): string[] {
  const h = wrap(hue);
  return [
    `hsl(${h} 6% 4%)`,     // k0  deepest ground
    `hsl(${h} 5% 7%)`,     // k1  ground
    `hsl(${h} 4% 11%)`,    // k2  raised ground
    'hsl(0 0% 64%)',       // k3  line, brightest
    'hsl(0 0% 56%)',       // k4
    'hsl(0 0% 49%)',       // k5
    'hsl(0 0% 42%)',       // k6
    'hsl(0 0% 36%)',       // k7
    'hsl(0 0% 30%)',       // k8  line, faintest
    'hsl(40 6% 76%)',      // k9  secondary text
    'hsl(40 10% 90%)',     // k10 primary text
    'var(--ochre)',        // k11 the one accent
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
