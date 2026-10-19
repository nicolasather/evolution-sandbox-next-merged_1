/** Original cover artwork for library cards, generated from a seed and the subject. No faces, no text (item 053, 003). Pure. */
import { THEMES, type Theme } from './cosmetics/catalog';

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const SUBJECT_THEME: [RegExp, string][] = [
  [/space|astronom|planet|physics/i, 'cosmos'], [/biolog|nature|forest|environment|plant|ecolog/i, 'wildwood'], [/ocean|sea|geograph|water|marine/i, 'deepblue'],
  [/science|chem|lab|tech|computer/i, 'lab'], [/english|literature|language|reading|writing|vietnam|ngữ văn|ngu van|tiếng/i, 'story'], [/math|toán|toan|algebra|geometry|number/i, 'number'],
  [/histor|lịch sử|lich su|social|civics|culture/i, 'time'], [/art|music|drama|sport|pe\b|âm nhạc|mỹ thuật/i, 'stage'],
];
export function themeForSubject(subject: string | undefined, seed: string): Theme {
  const hit = SUBJECT_THEME.find(([re]) => subject && re.test(subject));
  return THEMES.find((t) => t.id === hit?.[1]) ?? THEMES[hash(seed) % THEMES.length]!;
}
export function coverSvg(seed: string, subject?: string, size = { w: 320, h: 180 }): string {
  const t = themeForSubject(subject, seed); const h = hash(seed); const mo = t.motifs[h % t.motifs.length]!;
  const r = (n: number, k: number) => ((h >>> (k * 3)) % n);
  const paint = mo.svg.replace(/fill="A"/g, `fill="${t.main}"`).replace(/fill="B"/g, `fill="${t.accent}"`).replace(/fill="C"/g, `fill="${t.light}"`).replace(/stroke="A"/g, `stroke="${t.main}"`).replace(/stroke="B"/g, `stroke="${t.accent}"`).replace(/stroke="C"/g, `stroke="${t.light}"`);
  const blobs = [0, 1, 2, 3].map((i) => `<circle cx="${20 + r(280, i)}" cy="${10 + r(160, i + 1)}" r="${14 + r(40, i + 2)}" fill="${i % 2 ? t.accent : t.main}" opacity=".18"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="${size.w}" height="${size.h}" role="img" aria-label="${mo.label}" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="${t.bg}"/>${blobs}<g transform="translate(${r(40, 4) + 190} ${12 + r(10, 5)}) scale(2)" stroke="#1b1230" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${paint}</g><g transform="translate(${10 + r(20, 6)} ${100 + r(20, 7)}) scale(.9)" opacity=".85" stroke="#1b1230" stroke-width="3" stroke-linejoin="round">${paint}</g></svg>`;
}
