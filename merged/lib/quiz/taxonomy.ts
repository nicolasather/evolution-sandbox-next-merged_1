/** Quiz taxonomy: stable ids for subjects, exact grades, curricula, languages and teaching contexts. Labels are English-only until real localisation exists
 *  (the id→label indirection is the localisation seam; nothing here pretends a translation exists). Pure. */
import { normalizeText } from './text';

export type Option = { id: string; label: string };
export const SUBJECTS: readonly Option[] = [
  { id: 'mathematics', label: 'Mathematics' }, { id: 'english', label: 'English' }, { id: 'literature', label: 'Literature' }, { id: 'physics', label: 'Physics' },
  { id: 'chemistry', label: 'Chemistry' }, { id: 'biology', label: 'Biology' }, { id: 'history', label: 'History' }, { id: 'geography', label: 'Geography' },
  { id: 'computer_science', label: 'Computer Science' }, { id: 'economics', label: 'Economics' }, { id: 'business', label: 'Business' }, { id: 'arts', label: 'Arts' },
  { id: 'music', label: 'Music' }, { id: 'world_languages', label: 'World Languages' }, { id: 'physical_education', label: 'Physical Education' }, { id: 'other', label: 'Other' },
];
/** Exact grades, not "primary/secondary". UK Year n is Grade n−1, so Year 1 ≈ Kindergarten and Year 13 = Grade 12. */
export const GRADES: readonly Option[] = [
  { id: 'early_years', label: 'Kindergarten / Early Years · UK Reception–Year 1' },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `g${i + 1}`, label: `Grade ${i + 1} · UK Year ${i + 2}` })),
  { id: 'higher_ed', label: 'Higher education' }, { id: 'other', label: 'Other' },
];
/** Grades in teaching order, for display and for ranges ("Grades 9–10"). UK Year 1 sits with Grade 1; Year 13 is the upper-secondary year after Grade 12. */
export const GRADE_ORDER: readonly string[] = ['early_years', ...Array.from({ length: 12 }, (_, i) => `g${i + 1}`), 'higher_ed', 'other'];
export const CURRICULA: readonly Option[] = [
  { id: 'moet', label: 'Vietnamese national (MOET)' }, { id: 'cambridge', label: 'Cambridge' }, { id: 'ib', label: 'IB' }, { id: 'ap', label: 'AP' },
  { id: 'gcse_alevel', label: 'GCSE / A-Level' }, { id: 'common_core', label: 'Common Core' }, { id: 'local_other', label: 'Other local or national programme' },
  { id: 'none', label: 'No specific curriculum' },
];
export const LANGUAGES: readonly Option[] = [
  { id: 'en', label: 'English' }, { id: 'vi', label: 'Tiếng Việt' }, { id: 'es', label: 'Español' }, { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' }, { id: 'zh', label: '中文' }, { id: 'ja', label: '日本語' }, { id: 'ko', label: '한국어' },
];
export const CONTEXTS: readonly (Option & { hint: string })[] = [
  { id: 'projector', label: 'Projector / shared screen', hint: 'One teacher computer, no student devices needed' },
  { id: 'individual_devices', label: 'Individual devices', hint: 'Each student plays on a phone, tablet or laptop' },
  { id: 'online', label: 'Online class', hint: 'Remote students joining with a room code' },
  { id: 'independent', label: 'Independent practice', hint: 'Students practise alone, at their own pace' },
];
export const LENGTHS: readonly Option[] = [
  { id: 'short', label: 'Under 15 minutes' }, { id: '15_30', label: '15–30 minutes' }, { id: '30_45', label: '30–45 minutes' }, { id: '45_plus', label: '45+ minutes' }, { id: 'custom', label: 'It varies' },
];
export const GROUP_SIZES: readonly Option[] = [
  { id: 'small', label: 'Up to 10 students' }, { id: 'medium', label: '11–25 students' }, { id: 'large', label: '26–40 students' }, { id: 'xl', label: 'More than 40' },
];
/** Student goals (optional, short). */
export const GOALS: readonly Option[] = [
  { id: 'exam', label: 'Prepare for an exam' }, { id: 'homework', label: 'Practise homework topics' }, { id: 'fun', label: 'Learn something new for fun' }, { id: 'catch_up', label: 'Catch up on a topic I missed' },
];

const byId = (list: readonly Option[]) => new Map(list.map((o) => [o.id, o]));
const maps = { subject: byId(SUBJECTS), grade: byId(GRADES), curriculum: byId(CURRICULA), language: byId(LANGUAGES), context: byId(CONTEXTS), length: byId(LENGTHS), group: byId(GROUP_SIZES), goal: byId(GOALS) };
export type Facet = keyof typeof maps;
export const isId = (facet: Facet, id: unknown): id is string => typeof id === 'string' && maps[facet].has(id);
export const labelOf = (facet: Facet, id: string) => maps[facet].get(id)?.label ?? id;

const fold = (s: string) => normalizeText(s, { diacritics: 'ignore', punctuation: 'ignore' });
const SUBJECT_ALIASES: Record<string, string> = { math: 'mathematics', maths: 'mathematics', toan: 'mathematics', ielts: 'english', cs: 'computer_science', informatics: 'computer_science', it: 'computer_science', pe: 'physical_education', sports: 'physical_education', art: 'arts', languages: 'world_languages', language: 'world_languages' };
/** Maps a legacy free-text subject (the old "Subject" box) to a stable id, or null when it is not recognised. Never guesses beyond exact label/alias matches. */
export function subjectIdFromLabel(label: string | undefined): string | null {
  const f = fold(label ?? ''); if (!f) return null;
  const hit = SUBJECTS.find((s) => fold(s.label) === f || s.id === f.replace(/ /g, '_'));
  return hit?.id ?? SUBJECT_ALIASES[f] ?? null;
}
/** Rough grade span for an age band, used ONLY to rank unclassified quizzes (marked "estimated"); it never reclassifies a quiz or is saved. */
export const AGE_BAND_GRADES: Record<string, readonly string[]> = {
  '5-7': ['early_years', 'g1', 'g2'], '8-10': ['g3', 'g4', 'g5'], '11-13': ['g6', 'g7', 'g8'], '14-17': ['g9', 'g10', 'g11', 'g12'], '18+': ['higher_ed'],
};
/** Formats ["g9","g10","g12"] as "Grades 9–10, 12" in teaching order. */
export function describeGrades(ids: readonly string[]): string {
  const set = new Set(ids); const ordered = GRADE_ORDER.filter((g) => set.has(g));
  const nums = ordered.filter((g) => /^g\d+$/.test(g)).map((g) => Number(g.slice(1)));
  const parts: string[] = []; for (let i = 0; i < nums.length;) { let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++; parts.push(i === j ? `${nums[i]}` : `${nums[i]}–${nums[j]}`); i = j + 1; }
  const out: string[] = []; if (parts.length) out.push(`${nums.length > 1 ? 'Grades' : 'Grade'} ${parts.join(', ')}`);
  for (const g of ordered) if (!/^g\d+$/.test(g)) out.push(labelOf('grade', g));
  return out.join(' · ');
}
