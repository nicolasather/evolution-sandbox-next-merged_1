import { materialOf } from '../craft/materials';
import type { Discovery } from '../types';
import type { Processing } from './types';

/* ============================================================================
   TAGS — what a thing IS, said once, so rules can be written about kinds of
   things instead of about hundreds of ids. A resource's tags are its craft
   material's defaults plus anything data adds for that id. Actions, attraction,
   refusal copy and hint role-phrases all read tags; none of them read names.
   ========================================================================== */

const cache = new WeakMap<Processing, Map<string, ReadonlySet<string>>>();

export function tagsOf(proc: Processing | undefined, node: Pick<Discovery, 'id' | 'cat' | 'era'> | undefined): ReadonlySet<string> {
  if (!node) return new Set();
  if (!proc) return new Set(materialTagsFallback(node));
  let m = cache.get(proc);
  if (!m) { m = new Map(); cache.set(proc, m); }
  const hit = m.get(node.id);
  if (hit) return hit;
  const set = new Set<string>(proc.materialTags[materialOf(node)] ?? []);
  proc.tags[node.id]?.forEach(t => set.add(t));
  m.set(node.id, set);
  return set;
}

function materialTagsFallback(node: Pick<Discovery, 'id' | 'cat' | 'era'>): string[] {
  return [materialOf(node)];
}

/** How a tag reads in a role phrase ("something hard"). First matching tag of a thing wins. */
const ROLE_WORDS: [string, string][] = [
  ['hot', 'hot'], ['fluid', 'liquid'], ['metal', 'metallic'], ['glassy', 'glassy'],
  ['earthy', 'earthen'], ['fibrous', 'stringy'], ['woody', 'woody'], ['boney', 'bony'],
  ['mineral', 'stony'], ['loose', 'loose'], ['plastic', 'mouldable'], ['hard', 'hard'],
  ['mechanical', 'mechanical'], ['energy', 'charged'], ['signal', 'digital'], ['living', 'living'],
  ['large', 'built'], ['made', 'made'],
];

export function roleWord(proc: Processing | undefined, node: Discovery): string | null {
  const tags = tagsOf(proc, node);
  for (const [tag, word] of ROLE_WORDS) if (tags.has(tag)) return word;
  return null;
}

const CAT_ROLE: Record<string, string> = {
  technique: 'a technique', culture: 'a custom', society: 'a way of living together', knowledge: 'a piece of knowledge',
  science: 'a scientific idea', economy: 'an economic idea', computing: 'a piece of computing', media: 'a medium',
  energy: 'a source of energy', engineering: 'an engineered part', technology: 'a technology', biology: 'a living thing',
  material: 'a material',
};

/** "something hard", "an idea", "a technique" — what a piece plays in a recipe, never its name. */
export function rolePhrase(proc: Processing | undefined, node: Discovery): string {
  const w = roleWord(proc, node);
  if (w && !['made', 'built'].includes(w)) return `something ${w}`;
  return CAT_ROLE[node.cat] ?? 'a piece';
}

/** Say a list of role phrases as prose: "something hard, two stringy things and a technique". */
export function sayRoles(phrases: string[]): string {
  const counts = new Map<string, number>();
  phrases.forEach(p => counts.set(p, (counts.get(p) ?? 0) + 1));
  const parts = [...counts].map(([p, n]) => {
    if (n === 1) return p;
    const base = p.replace(/^something /, '').replace(/^an? /, '');
    const word = ['zero', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);
    return p.startsWith('something ') ? `${word} ${base} things` : `${word} ${base}s`;
  });
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
