/** Teacher / student onboarding profile: subjects, exact grades, a subject↔grade map (stored sparsely, never as a Cartesian product), curricula, three kinds of language,
 *  teaching context. Pure model + defensive parsing + a safe storage wrapper. Nothing here is required to use Quiz Studio. */
import { AGE_BAND_GRADES, CONTEXTS, CURRICULA, GOALS, GRADES, GRADE_ORDER, GROUP_SIZES, LANGUAGES, LENGTHS, SUBJECTS, describeGrades, isId, labelOf, subjectIdFromLabel } from '../taxonomy';

export const STORAGE_KEY = 'qz:onboarding:v1';
export const TEACHER_STEPS = ['subjects', 'grades', 'map', 'curricula', 'languages', 'context', 'workspace'] as const;
export type TeacherStep = (typeof TEACHER_STEPS)[number];
export type Audience = 'teacher' | 'student';

export type Profile = {
  v: 1; audience: Audience;
  subjects: string[]; customSubjects: string[];
  grades: string[];
  /** Only subjects the person narrowed down are stored; every other selected subject uses ALL selected grades (see `gradesForSubject`). */
  subjectGrades: Record<string, string[]>;
  curricula: string[]; customCurricula: string[];
  /** The interface stays English until real localisation exists; teaching and quiz-content languages are the person's own choices. */
  languages: { interface: 'en'; teaching: string[]; content: string[] };
  contexts: string[]; sessionLength: string | null; groupSize: string | null;
  goals: string[];
  step: number; completedAt: string | null; dismissedAt: string | null; updatedAt: string | null;
};
export const emptyProfile = (audience: Audience = 'teacher'): Profile => ({
  v: 1, audience, subjects: [], customSubjects: [], grades: [], subjectGrades: {}, curricula: [], customCurricula: [], languages: { interface: 'en', teaching: [], content: [] },
  contexts: [], sessionLength: null, groupSize: null, goals: [], step: 0, completedAt: null, dismissedAt: null, updatedAt: null,
});

const uniq = <T,>(a: readonly T[]) => [...new Set(a)];
const strList = (v: unknown, ok: (x: string) => boolean, max = 30) => (Array.isArray(v) ? uniq(v.filter((x): x is string => typeof x === 'string' && ok(x))).slice(0, max) : []);
const freeText = (v: unknown) => (Array.isArray(v) ? uniq(v.filter((x): x is string => typeof x === 'string').map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean)).slice(0, 6) : []);
const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const orderGrades = (g: readonly string[]) => GRADE_ORDER.filter((x) => g.includes(x));
const orderOf = (list: readonly { id: string }[], ids: readonly string[]) => list.map((o) => o.id).filter((id) => ids.includes(id));

/** Defensive parse of anything stored or imported: unknown ids are dropped, the map is pruned to selected subjects/grades, and a map entry equal to the default is removed. */
export function normalizeProfile(raw: unknown): Profile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p = emptyProfile(r.audience === 'student' ? 'student' : 'teacher');
  p.subjects = orderOf(SUBJECTS, strList(r.subjects, (x) => isId('subject', x)));
  p.customSubjects = freeText(r.customSubjects);
  p.grades = orderGrades(strList(r.grades, (x) => isId('grade', x)));
  const sg = r.subjectGrades && typeof r.subjectGrades === 'object' ? (r.subjectGrades as Record<string, unknown>) : {};
  for (const sid of p.subjects) {
    const picked = orderGrades(strList(sg[sid], (x) => p.grades.includes(x)));
    if (Array.isArray(sg[sid]) && picked.length && picked.length !== p.grades.length) p.subjectGrades[sid] = picked;
  }
  p.curricula = orderOf(CURRICULA, strList(r.curricula, (x) => isId('curriculum', x)));
  p.customCurricula = freeText(r.customCurricula);
  const l = (r.languages && typeof r.languages === 'object' ? r.languages : {}) as Record<string, unknown>;
  p.languages = { interface: 'en', teaching: orderOf(LANGUAGES, strList(l.teaching, (x) => isId('language', x))), content: orderOf(LANGUAGES, strList(l.content, (x) => isId('language', x))) };
  p.contexts = orderOf(CONTEXTS, strList(r.contexts, (x) => isId('context', x)));
  p.sessionLength = isId('length', r.sessionLength) ? (r.sessionLength as string) : null;
  p.groupSize = isId('group', r.groupSize) ? (r.groupSize as string) : null;
  p.goals = orderOf(GOALS, strList(r.goals, (x) => isId('goal', x)));
  p.step = Math.max(0, Math.min(TEACHER_STEPS.length - 1, Number.isInteger(r.step) ? (r.step as number) : 0));
  p.completedAt = iso(r.completedAt); p.dismissedAt = iso(r.dismissedAt); p.updatedAt = iso(r.updatedAt);
  return p;
}

/** The grades a subject is taught at: the explicit narrowing if there is one, else every selected grade (the smart default). */
export function gradesForSubject(p: Profile, subjectId: string): string[] { return p.subjectGrades[subjectId] ?? p.grades; }
/** Sets one subject's grades. Choosing every grade (or none) removes the entry so the map never stores the Cartesian product by accident. */
export function setSubjectGrades(p: Profile, subjectId: string, grades: readonly string[]): Profile {
  const picked = orderGrades(grades.filter((g) => p.grades.includes(g))); const next = { ...p.subjectGrades };
  if (!picked.length || picked.length === p.grades.length) delete next[subjectId]; else next[subjectId] = picked;
  return { ...p, subjectGrades: next };
}
/** Toggling a grade off also removes it from every subject's narrowing; toggling a subject off drops its narrowing. Always returns a normalised profile. */
export function toggleIn(p: Profile, key: 'subjects' | 'grades' | 'curricula' | 'contexts' | 'goals', id: string): Profile {
  const has = p[key].includes(id); const list = has ? p[key].filter((x) => x !== id) : [...p[key], id];
  return normalizeProfile({ ...p, [key]: list });
}
export function toggleLanguage(p: Profile, kind: 'teaching' | 'content', id: string): Profile {
  const cur = p.languages[kind]; return normalizeProfile({ ...p, languages: { ...p.languages, [kind]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } });
}

export type StepIssue = { step: TeacherStep; message: string };
/** Gentle completeness hints. None blocks finishing: every step is skippable. */
export function hints(p: Profile): StepIssue[] {
  const out: StepIssue[] = [];
  if (!p.subjects.length && !p.customSubjects.length) out.push({ step: 'subjects', message: 'Pick at least one subject to get recommendations.' });
  if (!p.grades.length) out.push({ step: 'grades', message: 'Pick the exact grades you teach to filter the library by grade.' });
  if (p.subjects.length > 1 && p.grades.length > 1 && !Object.keys(p.subjectGrades).length) out.push({ step: 'map', message: 'Every subject currently uses every grade. Narrow it if you teach them at different levels.' });
  return out;
}
export const isStarted = (p: Profile) => !!(p.subjects.length || p.grades.length || p.curricula.length || p.contexts.length || p.languages.teaching.length || p.languages.content.length);
/** Shown once to a teacher until it is completed or dismissed; editable afterwards from the welcome page. */
export const shouldShowOnboarding = (p: Profile) => p.audience === 'teacher' && !p.completedAt && !p.dismissedAt;
export const complete = (p: Profile, now = new Date()): Profile => ({ ...p, completedAt: now.toISOString(), dismissedAt: null, updatedAt: now.toISOString() });
export const dismiss = (p: Profile, now = new Date()): Profile => ({ ...p, dismissedAt: now.toISOString(), updatedAt: now.toISOString() });

/** A one-line human summary, e.g. "Mathematics · Grades 9–10; Computer Science · Grades 10–12". */
export function summarize(p: Profile): string {
  const parts = p.subjects.map((s) => `${labelOf('subject', s)}${p.grades.length ? ` · ${describeGrades(gradesForSubject(p, s))}` : ''}`);
  return [...parts, ...p.customSubjects].join('; ');
}

// ── storage (always wrapped: storage can be blocked, full or absent) ─────────────────────────────────────────────────────
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };
export function loadProfile(s: Store | null = store()): Profile {
  try { const raw = s?.getItem(STORAGE_KEY); return raw ? normalizeProfile(JSON.parse(raw)) : emptyProfile(); } catch { return emptyProfile(); }
}
export function saveProfile(p: Profile, s: Store | null = store(), now = new Date()): boolean {
  try { if (!s) return false; s.setItem(STORAGE_KEY, JSON.stringify({ ...p, updatedAt: now.toISOString() })); return true; } catch { return false; }
}
export function clearProfile(s: Store | null = store()): boolean { try { s?.removeItem(STORAGE_KEY); return !!s; } catch { return false; } }

// ── discovery ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Classified = { subjectIds?: string[]; gradeIds?: string[]; curriculumIds?: string[]; subject?: string; ageBand?: string; language?: string };
export type Match = { score: number; reasons: string[] };
/** Why (or whether) a quiz suits this profile. Unclassified quizzes never match by guesswork; an age band only contributes a clearly-labelled estimate. */
export function matchQuiz(meta: Classified | undefined, p: Profile): Match | null {
  if (!meta) return null;
  const subjectIds = meta.subjectIds?.length ? meta.subjectIds : (() => { const s = subjectIdFromLabel(meta.subject); return s ? [s] : []; })();
  const shared = subjectIds.filter((s) => p.subjects.includes(s)); if (!shared.length) return null;
  let score = 3; const reasons = [`Matches your subject: ${shared.map((s) => labelOf('subject', s)).join(', ')}`];
  const taught = uniq(shared.flatMap((s) => gradesForSubject(p, s)));
  if (meta.gradeIds?.length) {
    const g = meta.gradeIds.filter((x) => taught.includes(x));
    if (!g.length && taught.length) return null; // the quiz states its grades and none are taught
    if (g.length) { score += 3; reasons.push(`Made for ${describeGrades(g)}`); }
  } else if (meta.ageBand && taught.length) {
    const est = (AGE_BAND_GRADES[meta.ageBand] ?? []).filter((x) => taught.includes(x));
    if (est.length) { score += 1; reasons.push(`Ages ${meta.ageBand} (estimated to fit ${describeGrades(est)})`); }
  }
  const cur = (meta.curriculumIds ?? []).filter((c) => p.curricula.includes(c)); if (cur.length) { score += 1; reasons.push(`Curriculum: ${cur.map((c) => labelOf('curriculum', c)).join(', ')}`); }
  const wanted = p.languages.content.length ? p.languages.content : p.languages.teaching;
  if (meta.language && wanted.includes(meta.language.split('-')[0]!)) { score += 1; reasons.push(`In ${labelOf('language', meta.language.split('-')[0]!)}`); }
  return { score, reasons };
}
export function recommend<T extends { id: string; updatedAt: string; meta?: Classified }>(quizzes: readonly T[], p: Profile, limit = 6): { quiz: T; match: Match }[] {
  return quizzes.flatMap((quiz) => { const match = matchQuiz(quiz.meta, p); return match ? [{ quiz, match }] : []; })
    .sort((a, b) => b.match.score - a.match.score || b.quiz.updatedAt.localeCompare(a.quiz.updatedAt) || a.quiz.id.localeCompare(b.quiz.id)).slice(0, limit);
}
export const GRADE_OPTIONS = GRADES; export const LENGTH_OPTIONS = LENGTHS; export const GROUP_OPTIONS = GROUP_SIZES;
