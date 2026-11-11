import type { Period, TaskKind } from './types';

/* ============================================================================
   SURVIVAL PLATE ART — hand-drawn line figures for the camp, drawn in the same
   language as a discovery plate: a 100x100 box of strokes that components/Plate3D
   extrudes into a floating wireframe (`data-z` pushes a limb forward or back;
   a filled circle becomes a glowing spark). Only trusted constants live here.

   Two drawings:
     - a PERSON in one of five poses, chosen from what that person is doing;
     - the SKY for the current part of the day (sunrise, noon, sunset, night).
   ========================================================================== */

export type Pose = 'stand' | 'carry' | 'work' | 'raise' | 'rest';
export type SkyArt = 'sunrise' | 'noon' | 'sunset' | 'moon';

/** The pose a person takes, from the task they were given. Injured people lie down to rest. */
export function poseFor(task: TaskKind | undefined, injured = false): Pose {
  if (injured) return 'rest';
  switch (task) {
    case 'fetch-water': return 'carry';
    case 'gather-food':
    case 'tend-fire': return 'work';
    case 'gather-wood':
    case 'build-shelter': return 'raise';
    case 'rest': return 'rest';
    default: return 'stand';
  }
}

const GROUND = '<path d="M26 97 L74 97" opacity=".45"/>';

const PERSON: Record<Pose, string> = {
  stand: [
    '<g data-z="-3"><path d="M50 60 L60 80 L62 96"/><path d="M50 36 L62 52 L60 66" /></g>',
    '<circle cx="50" cy="22" r="8"/>',
    '<path d="M50 30 L50 60"/>',
    '<g data-z="3"><path d="M50 60 L40 80 L38 96"/><path d="M50 36 L38 52 L40 66"/></g>',
    GROUND,
  ].join(''),
  carry: [
    '<g data-z="-3"><path d="M50 60 L60 80 L62 96"/></g>',
    '<circle cx="50" cy="22" r="8"/>',
    '<path d="M50 30 L50 60"/>',
    '<g data-z="3"><path d="M50 60 L40 80 L38 96"/><path d="M50 36 L38 46 L44 54"/></g>',
    '<path d="M50 36 L64 46 L58 54"/>',
    '<path d="M50 52 L70 52 L66 68 L54 68 Z"/><path d="M52 52 Q60 40 68 52"/>',
    GROUND,
  ].join(''),
  work: [
    '<g data-z="-3"><path d="M46 60 L58 80 L60 96"/></g>',
    '<circle cx="56" cy="30" r="7"/>',
    '<path d="M52 38 L46 60"/>',
    '<g data-z="3"><path d="M46 60 L34 80 L32 96"/><path d="M52 42 L64 56 L60 70"/></g>',
    GROUND,
  ].join(''),
  raise: [
    '<g data-z="-3"><path d="M50 60 L60 80 L62 96"/><path d="M50 36 L40 26"/></g>',
    '<circle cx="50" cy="22" r="8"/>',
    '<path d="M50 30 L50 60"/>',
    '<g data-z="3"><path d="M50 60 L40 80 L38 96"/><path d="M50 36 L62 24"/><path d="M62 24 L74 12"/><path d="M70 8 L80 14 L74 22 Z"/></g>',
    GROUND,
  ].join(''),
  rest: [
    '<g data-z="-3"><path d="M46 60 L66 62 L66 84"/></g>',
    '<circle cx="46" cy="24" r="8"/>',
    '<path d="M46 32 L46 60"/>',
    '<g data-z="3"><path d="M46 40 L58 52 L66 50"/><path d="M46 60 L60 60"/></g>',
    '<path d="M60 86 L74 86" opacity=".45"/>',
  ].join(''),
};

export function personSvg(pose: Pose): string {
  return PERSON[pose];
}

/** The part of the day as a drawing. */
export function skyFor(period: Period): { art: SkyArt; label: string; line: string } {
  switch (period) {
    case 'morning': return { art: 'sunrise', label: 'Morning', line: 'The sun is low. Warmth comes back slowly.' };
    case 'day': return { art: 'noon', label: 'Day', line: 'High sun. The best time to gather.' };
    case 'evening': return { art: 'sunset', label: 'Evening', line: 'Light fades. Gather what you can before dark.' };
    case 'night': return { art: 'moon', label: 'Night', line: 'No gathering. The cold bites hardest now.' };
  }
}

const SKY: Record<SkyArt, string> = {
  sunrise: [
    '<path d="M8 80 L92 80" opacity=".6"/>',
    '<path d="M32 80 A18 18 0 0 1 68 80"/>',
    '<path d="M50 56 L50 50"/><path d="M28 64 L24 60"/><path d="M72 64 L76 60"/><path d="M18 80 L12 80"/><path d="M82 80 L88 80"/>',
    '<circle cx="50" cy="90" r="1.4"/>',
  ].join(''),
  noon: [
    '<circle cx="50" cy="44" r="14"/>',
    '<path d="M50 20 L50 24"/><path d="M50 64 L50 68"/><path d="M26 44 L30 44"/><path d="M70 44 L74 44"/>',
    '<path d="M32 26 L35 29"/><path d="M68 26 L65 29"/><path d="M32 62 L35 59"/><path d="M68 62 L65 59"/>',
    '<path d="M10 84 L90 84" opacity=".6"/>',
  ].join(''),
  sunset: [
    '<path d="M8 80 L92 80" opacity=".6"/>',
    '<path d="M32 80 A18 18 0 0 1 68 80"/>',
    '<path d="M50 56 L50 50"/><path d="M28 64 L24 60"/><path d="M72 64 L76 60"/>',
    '<path d="M14 92 L86 92" opacity=".35"/><path d="M26 98 L74 98" opacity=".25"/>',
  ].join(''),
  moon: [
    '<path d="M60 22 A24 24 0 1 0 78 62 A19 19 0 1 1 60 22 Z"/>',
    '<circle cx="22" cy="24" r="1.4"/><circle cx="34" cy="44" r="1.2"/><circle cx="80" cy="18" r="1.4"/>',
    '<circle cx="18" cy="60" r="1.2"/><circle cx="84" cy="50" r="1.2"/><circle cx="46" cy="12" r="1"/>',
    '<path d="M10 86 L90 86" opacity=".6"/>',
  ].join(''),
};

export function skySvg(art: SkyArt): string {
  return SKY[art];
}
