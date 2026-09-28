import { createRng } from '../seed';
import type { CampState, Member, Terrain, TileKind, Trait } from './types';

/* ============================================================================
   SCENARIO GENERATION — deterministic (lib/seed.ts), and validated so a
   generated camp is never unwinnable outright: at least one water tile and
   two woodland tiles are always placed within reach before anything else is
   randomised, per the brief's "ensure starting regions always contain a
   viable survival path."
   ========================================================================== */

const WIDTH = 7;
const HEIGHT = 5;
const TRAITS: Trait[] = ['observant', 'patient-craftsperson', 'strong-carrier', 'quick-learner', 'cautious-explorer'];
const NAME_SYLLABLES = ['ka', 'ri', 'sen', 'ta', 'mo', 'lu', 'vi', 'ne', 'do', 'ash', 'ren', 'iko'];

function generateName(rng: ReturnType<typeof createRng>): string {
  const parts = 2 + (rng.chance(0.3) ? 1 : 0);
  let name = '';
  for (let i = 0; i < parts; i++) name += rng.pick(NAME_SYLLABLES);
  return name[0].toUpperCase() + name.slice(1);
}

function generateTerrain(rng: ReturnType<typeof createRng>): Terrain {
  const tiles: TileKind[][] = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => 'open' as TileKind));
  const campX = Math.floor(WIDTH / 2);
  const campY = Math.floor(HEIGHT / 2);

  const allCells: [number, number][] = [];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (x !== campX || y !== campY) allCells.push([x, y]);
  const shuffled = rng.shuffle(allCells);

  // Guarantee at least one water and two woodland tiles exist before anything
  // else is randomised, so a run is never unwinnable from the start.
  const [waterCell, ...restA] = shuffled;
  const [wood1, wood2, ...restB] = restA;
  tiles[waterCell[1]][waterCell[0]] = 'water';
  tiles[wood1[1]][wood1[0]] = 'woodland';
  tiles[wood2[1]][wood2[0]] = 'woodland';

  for (const [x, y] of restB) {
    const roll = rng.next();
    tiles[y][x] = roll < 0.28 ? 'woodland' : roll < 0.4 ? 'rock' : roll < 0.5 ? 'water' : 'open';
  }
  tiles[campY][campX] = 'camp';

  return { width: WIDTH, height: HEIGHT, tiles, campX, campY };
}

export function generateCamp(seed: string): CampState {
  const rng = createRng(seed);
  const terrain = generateTerrain(rng);
  const traitPool = rng.shuffle(TRAITS);
  const members: Member[] = Array.from({ length: 3 }, (_, i) => ({
    id: `m${i}`,
    name: generateName(rng),
    trait: traitPool[i],
    energy: 0.8,
    warmth: 0.7,
    morale: 0.7,
    injured: false,
    task: null,
  }));

  return {
    seed,
    day: 1,
    period: 'morning',
    terrain,
    members,
    resources: { food: 2, water: 2, wood: 1 },
    fire: { lit: false, fuel: 0 },
    shelter: { level: 0 },
    objective: { kind: 'survive-days', targetDay: 6 },
    ending: 'ongoing',
    milestones: {},
    log: [{ day: 1, period: 'morning', text: 'The group arrives, carrying little.' }],
  };
}
