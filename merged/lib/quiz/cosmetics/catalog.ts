/** The cosmetics catalogue (items 111-130). Original vector art; no faces, text or real-world brands. Names, rarity and collection are always
 *  real text next to the picture, so nothing depends on colour alone. Cosmetics are NOT a currency and cannot be bought, traded or randomly drawn. */
import { COSMOS, WILDWOOD, DEEPBLUE, type Motif } from './motifs-a';
import { LAB, STORY } from './motifs-b';
import { NUMBER, TIME, STAGE } from './motifs-c';
import { readableOn } from '../a11y';

export type ThemeId = 'cosmos' | 'wildwood' | 'deepblue' | 'lab' | 'story' | 'number' | 'time' | 'stage';
export type Badge = 'circle' | 'hexagon' | 'shield' | 'squircle' | 'pennant' | 'octagon' | 'diamond' | 'starburst';
export type Texture = 'stars' | 'veins' | 'waves' | 'grid' | 'lines' | 'hazard' | 'speckle' | 'confetti';
export type Theme = { id: ThemeId; name: string; blurb: string; main: string; accent: string; light: string; bg: string; badge: Badge; texture: Texture; motifs: Motif[] };

export const THEMES: Theme[] = [
  { id: 'cosmos', name: 'Cosmos', blurb: 'Rockets, rings and far-away light.', main: '#5b3df5', accent: '#ffd52f', light: '#cfc6ff', bg: '#241a5e', badge: 'circle', texture: 'stars', motifs: COSMOS },
  { id: 'wildwood', name: 'Wildwood', blurb: 'Leaves, logs and a campfire path.', main: '#2f9e5a', accent: '#d9822b', light: '#d6f2c2', bg: '#16452c', badge: 'hexagon', texture: 'veins', motifs: WILDWOOD },
  { id: 'deepblue', name: 'Deep Blue', blurb: 'Shells, sails and quiet water.', main: '#1b8fb8', accent: '#ff7a59', light: '#d3f3ff', bg: '#0c3b57', badge: 'shield', texture: 'waves', motifs: DEEPBLUE },
  { id: 'lab', name: 'Lab Bench', blurb: 'Glass, gears and glowing ideas.', main: '#19b6c9', accent: '#b6e23a', light: '#dff9ff', bg: '#0f4a52', badge: 'squircle', texture: 'grid', motifs: LAB },
  { id: 'story', name: 'Story Shelf', blurb: 'Books, quills and old maps.', main: '#a8324e', accent: '#f2b93b', light: '#fbe7d0', bg: '#4a1424', badge: 'pennant', texture: 'lines', motifs: STORY },
  { id: 'number', name: 'Number Garage', blurb: 'Tools, shapes and tidy sums.', main: '#e8741c', accent: '#4f6d8f', light: '#ffe3c7', bg: '#4a2a10', badge: 'octagon', texture: 'hazard', motifs: NUMBER },
  { id: 'time', name: 'Time Machine', blurb: 'Stone, bronze and long journeys.', main: '#b78447', accent: '#3f8f9b', light: '#f6e6c4', bg: '#4a3418', badge: 'diamond', texture: 'speckle', motifs: TIME },
  { id: 'stage', name: 'Sound Stage', blurb: 'Notes, colours and bright lights.', main: '#d4308f', accent: '#27c3b0', light: '#ffd9f0', bg: '#4a123a', badge: 'starburst', texture: 'confetti', motifs: STAGE },
];

const INK = '#1b1230';
const BADGES: Record<Badge, string> = {
  circle: '<circle cx="32" cy="32" r="29"/>',
  hexagon: '<polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"/>',
  shield: '<path d="M10 7 L54 7 L54 34 C54 48 42 56 32 60 C22 56 10 48 10 34Z"/>',
  squircle: '<rect x="4" y="4" width="56" height="56" rx="18"/>',
  pennant: '<path d="M8 5 L56 5 L56 50 L32 61 L8 50Z"/>',
  octagon: '<polygon points="20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20"/>',
  diamond: '<polygon points="32,2 62,32 32,62 2,32"/>',
  starburst: '<polygon points="32,2 38,10 48,6 49,17 59,19 54,28 61,35 52,40 54,51 43,50 38,59 32,52 26,59 21,50 10,51 12,40 3,35 10,28 5,19 15,17 16,6 26,10"/>',
};
const TEXTURES: Record<Texture, (c: string) => string> = {
  stars: (c) => `<g fill="${c}" opacity=".5"><circle cx="14" cy="14" r="1"/><circle cx="50" cy="12" r="1.2"/><circle cx="54" cy="40" r="1"/><circle cx="10" cy="46" r="1.2"/><circle cx="26" cy="56" r="1"/></g>`,
  veins: (c) => `<path d="M12 20 L22 12 M44 12 L54 22 M10 44 L20 54 M44 54 L54 44" stroke="${c}" stroke-width="1.4" opacity=".4"/>`,
  waves: (c) => `<path d="M8 18 C14 14 18 22 24 18 M36 14 C42 10 46 18 52 14 M10 52 C16 48 20 56 26 52 M38 54 C44 50 48 58 54 54" fill="none" stroke="${c}" stroke-width="1.4" opacity=".4"/>`,
  grid: (c) => `<path d="M16 6 L16 58 M32 6 L32 58 M48 6 L48 58 M6 16 L58 16 M6 32 L58 32 M6 48 L58 48" stroke="${c}" stroke-width=".8" opacity=".25"/>`,
  lines: (c) => `<path d="M10 14 L54 14 M10 50 L54 50 M10 58 L40 58" stroke="${c}" stroke-width="1.2" opacity=".35"/>`,
  hazard: (c) => `<path d="M4 14 L14 4 M4 30 L30 4 M4 46 L46 4 M12 60 L60 12 M30 60 L60 30 M46 60 L60 46" stroke="${c}" stroke-width="2.4" opacity=".28"/>`,
  speckle: (c) => `<g fill="${c}" opacity=".4"><circle cx="12" cy="30" r="1"/><circle cx="52" cy="30" r="1.2"/><circle cx="32" cy="8" r="1"/><circle cx="32" cy="56" r="1.2"/><circle cx="20" cy="50" r=".9"/><circle cx="44" cy="14" r=".9"/></g>`,
  confetti: (c) => `<g fill="${c}" opacity=".5"><rect x="10" y="12" width="4" height="2" transform="rotate(30 12 13)"/><rect x="48" y="10" width="4" height="2" transform="rotate(-30 50 11)"/><rect x="52" y="48" width="4" height="2" transform="rotate(40 54 49)"/><rect x="8" y="50" width="4" height="2" transform="rotate(-20 10 51)"/></g>`,
};

/* ── Unlock criteria: public, deterministic, with measurable progress (112, 113, 119) ─────────────────────────────────── */
export type Criterion =
  | { type: 'free' }
  | { type: 'sessions'; n: number } | { type: 'reviews'; n: number } | { type: 'corrections'; n: number } | { type: 'formats'; n: number }
  | { type: 'explore'; n: number } | { type: 'days'; n: number } | { type: 'mastery'; percent: number; sessions: number } | { type: 'create'; n: number };
export function describeCriterion(c: Criterion): string {
  switch (c.type) {
    case 'free': return 'Free for everyone from the start.';
    case 'sessions': return `Finish ${c.n} verified quiz ${c.n === 1 ? 'session' : 'sessions'} (at least 3 questions answered).`;
    case 'reviews': return `Finish Review Mistakes ${c.n} ${c.n === 1 ? 'time' : 'times'}.`;
    case 'corrections': return `Turn ${c.n} missed ${c.n === 1 ? 'idea' : 'ideas'} into correct answers on a retry.`;
    case 'formats': return `Practise ${c.n} different question formats.`;
    case 'explore': return `Try ${c.n} different quizzes from the library.`;
    case 'days': return `Play on ${c.n} different days.`;
    case 'mastery': return `Reach ${c.percent}% mastery in ${c.sessions} separate sessions.`;
    case 'create': return `Publish ${c.n} ${c.n === 1 ? 'quiz' : 'quizzes'}.`;
  }
}
const LADDER: Criterion[] = [
  { type: 'sessions', n: 1 }, { type: 'formats', n: 2 }, { type: 'reviews', n: 1 }, { type: 'sessions', n: 3 }, { type: 'corrections', n: 3 }, { type: 'explore', n: 3 },
  { type: 'formats', n: 4 }, { type: 'days', n: 3 }, { type: 'reviews', n: 5 }, { type: 'corrections', n: 10 }, { type: 'sessions', n: 10 }, { type: 'explore', n: 10 }, { type: 'days', n: 7 }, { type: 'mastery', percent: 80, sessions: 3 },
];
export type Rarity = 'Starter' | 'Common' | 'Uncommon' | 'Rare' | 'Epic';
const rarityFor = (rank: number): Rarity => (rank < 0 ? 'Starter' : rank < 4 ? 'Common' : rank < 8 ? 'Uncommon' : rank < 12 ? 'Rare' : 'Epic');

export type Icon = { id: string; theme: ThemeId; collection: string; name: string; label: string; rarity: Rarity; criterion: Criterion; free: boolean };
/** Free starters: two per theme (16 in all) so a brand-new player already owns a varied set. */
export const ICONS: Icon[] = THEMES.flatMap((t, ti) =>
  t.motifs.map((mo, i) => {
    const free = i < 2;
    const rank = free ? -1 : (i - 2 + ti * 3) % LADDER.length;
    const criterion: Criterion = free ? { type: 'free' } : LADDER[rank]!;
    return { id: `${t.id}.${mo.id}`, theme: t.id, collection: `${t.id}-collection`, name: mo.name, label: mo.label, rarity: rarityFor(rank), criterion, free };
  }),
);
export const iconById = (id: string) => ICONS.find((i) => i.id === id);
export const themeById = (id: ThemeId) => THEMES.find((t) => t.id === id)!;

/** Standalone SVG for an icon. 64×64 viewBox, one ink outline width for every icon. `title` makes it readable by assistive tech. */
export function iconSvg(id: string, opts: { size?: number; locked?: boolean } = {}): string {
  const icon = iconById(id); if (!icon) return '';
  const t = themeById(icon.theme); const mo = t.motifs.find((m) => `${t.id}.${m.id}` === id)!;
  const paint = (s: string) => s.replace(/fill="A"/g, `fill="${t.main}"`).replace(/fill="B"/g, `fill="${t.accent}"`).replace(/fill="C"/g, `fill="${t.light}"`).replace(/stroke="A"/g, `stroke="${t.main}"`).replace(/stroke="B"/g, `stroke="${t.accent}"`).replace(/stroke="C"/g, `stroke="${t.light}"`);
  const size = opts.size ?? 64;
  const badge = BADGES[t.badge].replace('/>', ` fill="${t.bg}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);
  const body = `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${paint(mo.svg)}</g>`;
  const inner = `${badge}${TEXTURES[t.texture](t.light)}<g transform="translate(6.4 6.4) scale(.8)">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${icon.label}"><title>${icon.name}</title>${opts.locked ? `<g style="filter:grayscale(1)" opacity=".55">${inner}</g>` : inner}</svg>`;
}

/* ── Emoji reactions (121, 122, 127, 130) ─────────────────────────────────────────────────────────────────────────────── */
export type ReactionGroup = 'celebration' | 'encouragement' | 'thinking' | 'teamwork' | 'neutral';
export type Reaction = { id: string; glyph: string; label: string; group: ReactionGroup };
const R = (group: ReactionGroup, list: [string, string][]): Reaction[] => list.map(([glyph, label]) => ({ id: `${group}.${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, glyph, label, group }));
export const REACTIONS: Reaction[] = [
  ...R('celebration', [['🎉', 'Party popper'], ['👏', 'Clapping'], ['🏆', 'Trophy'], ['⭐', 'Star'], ['🌟', 'Glowing star'], ['🥳', 'Celebrating'], ['🙌', 'Raised hands'], ['💯', 'Hundred'], ['🎊', 'Confetti ball'], ['🔥', 'Fire'], ['🚀', 'Rocket'], ['✨', 'Sparkles']]),
  ...R('encouragement', [['👍', 'Thumbs up'], ['💪', 'Strong'], ['🙂', 'Smile'], ['❤️', 'Heart'], ['🌈', 'Rainbow'], ['😊', 'Warm smile'], ['👌', 'Okay'], ['🤗', 'Hug'], ['🌱', 'Seedling'], ['☀️', 'Sun']]),
  ...R('thinking', [['🤔', 'Thinking'], ['💡', 'Idea'], ['🧠', 'Brain'], ['🔍', 'Magnifier'], ['📚', 'Books'], ['✏️', 'Pencil'], ['⏳', 'Hourglass'], ['🧩', 'Puzzle piece'], ['🔬', 'Microscope'], ['📝', 'Memo']]),
  ...R('teamwork', [['🤝', 'Handshake'], ['🔗', 'Link'], ['🎯', 'Target'], ['🧭', 'Compass'], ['🚩', 'Flag'], ['🏁', 'Finish flag'], ['🧱', 'Brick'], ['🛠️', 'Tools']]),
  ...R('neutral', [['👋', 'Wave'], ['🙋', 'Raised hand'], ['✅', 'Check mark'], ['❓', 'Question mark'], ['➕', 'Plus'], ['😐', 'Neutral'], ['🤷', 'Shrug'], ['⏸️', 'Pause']]),
];
const GROUP_COLOR: Record<ReactionGroup, string> = { celebration: '#ffd52f', encouragement: '#ff7a8a', thinking: '#7ad0ff', teamwork: '#7be39a', neutral: '#d0c9e6' };
const GROUP_MARK: Record<ReactionGroup, string> = { celebration: 'M32 12 L37 26 L52 27 L40 36 L44 51 L32 42 L20 51 L24 36 L12 27 L27 26Z', encouragement: 'M32 52 C10 36 14 14 32 24 C50 14 54 36 32 52Z', thinking: 'M32 10 C46 10 50 28 40 36 L40 44 L24 44 L24 36 C14 28 18 10 32 10Z', teamwork: 'M12 32 L28 18 L28 28 L36 28 L36 18 L52 32 L36 46 L36 36 L28 36 L28 46Z', neutral: 'M14 20 L50 20 L50 44 L14 44Z' };
/** Vector fallback when an emoji font is missing or renders differently: a badge in the group colour with a distinct shape. Never relies on colour alone: the label is shown next to it. */
export function reactionFallbackSvg(id: string, size = 32): string {
  const r = REACTIONS.find((x) => x.id === id); if (!r) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${r.label}"><title>${r.label}</title><circle cx="32" cy="32" r="29" fill="${GROUP_COLOR[r.group]}" stroke="${INK}" stroke-width="3"/><path d="${GROUP_MARK[r.group]}" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round" transform="translate(8 8) scale(.75)"/></svg>`;
}
export const MAX_WHEEL = 6;
export const REACTION_COOLDOWN_MS = 3000;
export function equipReaction(wheel: string[], id: string): { wheel: string[]; error?: string } {
  if (!REACTIONS.some((r) => r.id === id)) return { wheel, error: 'That reaction is not in the catalogue.' };
  if (wheel.includes(id)) return { wheel: wheel.filter((x) => x !== id) };
  if (wheel.length >= MAX_WHEEL) return { wheel, error: `The wheel holds ${MAX_WHEEL} reactions. Remove one first.` };
  return { wheel: [...wheel, id] };
}
export function canReact(lastAt: number | null, now: number, cooldown = REACTION_COOLDOWN_MS): { ok: boolean; waitMs: number } {
  const wait = lastAt === null ? 0 : Math.max(0, lastAt + cooldown - now);
  return { ok: wait === 0, waitMs: wait };
}
/** Only catalogue ids are ever sent or shown. Free text, images and arbitrary emoji are rejected (130). */
export const isValidReaction = (id: unknown): id is string => typeof id === 'string' && REACTIONS.some((r) => r.id === id);

/* ── Borders, nameplates, banners (123) ──────────────────────────────────────────────────────────────────────────────── */
export type Frame = { id: string; kind: 'border' | 'nameplate' | 'banner'; name: string; label: string; colors: [string, string]; pattern: 'solid' | 'dashed' | 'double' | 'dotted' | 'gradient' | 'stripes' | 'checks' | 'waves'; criterion: Criterion; rarity: Rarity; free: boolean };
const FRAME_NAMES = ['Sunrise', 'Meadow', 'Harbour', 'Ember', 'Orchid', 'Slate', 'Citrus', 'Glacier', 'Copper', 'Midnight', 'Coral', 'Moss', 'Plum', 'Sand', 'Lagoon', 'Marigold'];
const FRAME_COLORS: [string, string][] = [['#ff8a3d', '#ffd52f'], ['#2f9e5a', '#b6e23a'], ['#1b8fb8', '#d3f3ff'], ['#d43a14', '#ffb36b'], ['#a04bd6', '#f1c6ff'], ['#4f6d8f', '#c9d6e6'], ['#f2b93b', '#fff3b0'], ['#19b6c9', '#e6fbff'], ['#b78447', '#f6e6c4'], ['#241a5e', '#8c7bff'], ['#ff6f61', '#ffd1cb'], ['#5c7f2f', '#d9efb0'], ['#7b2a7f', '#e8b7ea'], ['#c9a66b', '#f6ecd6'], ['#27c3b0', '#bff5ee'], ['#f2a900', '#fff0b8']];
const PATTERNS: Frame['pattern'][] = ['solid', 'dashed', 'double', 'dotted', 'gradient', 'stripes', 'checks', 'waves'];
function makeFrames(kind: Frame['kind']): Frame[] {
  const offset = { border: 0, nameplate: 5, banner: 9 }[kind];
  return FRAME_NAMES.map((n, i) => {
    const free = i < 2; const rank = free ? -1 : (i - 2 + offset) % LADDER.length;
    const nice = { border: 'Border', nameplate: 'Nameplate', banner: 'Banner' }[kind];
    return { id: `${kind}.${n.toLowerCase()}`, kind, name: `${n} ${nice}`, label: `${n} ${nice.toLowerCase()} in ${PATTERNS[(i + offset) % PATTERNS.length]} style`, colors: FRAME_COLORS[i]!, pattern: PATTERNS[(i + offset) % PATTERNS.length]!, criterion: free ? { type: 'free' } : LADDER[rank]!, rarity: rarityFor(rank), free };
  });
}
export const BORDERS = makeFrames('border');
export const NAMEPLATES = makeFrames('nameplate');
export const BANNERS = makeFrames('banner');
export const ALL_FRAMES = [...BORDERS, ...NAMEPLATES, ...BANNERS];
/** Text colour that always has WCAG-AA contrast on the nameplate's darker colour. */
export const nameplateText = (f: Frame) => readableOn(f.colors[0]);
export function frameCss(f: Frame): Record<string, string> {
  const [a, b] = f.colors;
  switch (f.pattern) {
    case 'solid': return { background: a, border: `3px solid ${b}` };
    case 'dashed': return { background: a, border: `3px dashed ${b}` };
    case 'double': return { background: a, border: `6px double ${b}` };
    case 'dotted': return { background: a, border: `3px dotted ${b}` };
    case 'gradient': return { background: `linear-gradient(135deg, ${a}, ${b})`, border: `3px solid ${a}` };
    case 'stripes': return { background: `repeating-linear-gradient(45deg, ${a} 0 10px, ${b} 10px 20px)`, border: `3px solid ${a}` };
    case 'checks': return { background: `conic-gradient(${a} 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0) 0 0 / 16px 16px`, border: `3px solid ${a}` };
    case 'waves': return { background: `radial-gradient(circle at 50% 120%, ${b} 0 30%, ${a} 31%)`, border: `3px solid ${a}` };
  }
}
