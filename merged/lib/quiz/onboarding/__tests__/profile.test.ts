import { complete, dismiss, emptyProfile, gradesForSubject, hints, loadProfile, matchQuiz, normalizeProfile, recommend, saveProfile, setSubjectGrades, shouldShowOnboarding, summarize, toggleIn, toggleLanguage, STORAGE_KEY } from '../profile';
import { describeGrades, subjectIdFromLabel } from '../../taxonomy';

const teacher = () => { let p = emptyProfile(); for (const s of ['mathematics', 'computer_science']) p = toggleIn(p, 'subjects', s); for (const g of ['g9', 'g10', 'g11', 'g12']) p = toggleIn(p, 'grades', g); return p; };
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };

describe('subject↔grade map', () => {
  it('defaults to every selected grade and stores only real narrowing', () => {
    let p = teacher(); expect(gradesForSubject(p, 'mathematics')).toEqual(['g9', 'g10', 'g11', 'g12']); expect(p.subjectGrades).toEqual({});
    p = setSubjectGrades(p, 'mathematics', ['g9', 'g10']); p = setSubjectGrades(p, 'computer_science', ['g10', 'g11', 'g12']);
    expect(p.subjectGrades).toEqual({ mathematics: ['g9', 'g10'], computer_science: ['g10', 'g11', 'g12'] });
    expect(summarize(p)).toBe('Mathematics · Grades 9–10; Computer Science · Grades 10–12');
    expect(Object.keys(setSubjectGrades(p, 'mathematics', ['g9', 'g10', 'g11', 'g12']).subjectGrades)).toEqual(['computer_science']); // all grades = default, not stored
  });
  it('deselecting a grade or subject prunes the map', () => {
    let p = setSubjectGrades(teacher(), 'mathematics', ['g9', 'g10']); p = toggleIn(p, 'grades', 'g9');
    expect(p.subjectGrades.mathematics).toEqual(['g10']); p = toggleIn(p, 'subjects', 'mathematics'); expect(p.subjectGrades).toEqual({});
  });
  it('describes grade ranges in teaching order', () => { expect(describeGrades(['g12', 'g9', 'g10', 'higher_ed', 'g2'])).toBe('Grades 2, 9–10, 12 · Higher education'); });
});
describe('normalizeProfile', () => {
  it('drops unknown ids, junk types and out-of-range steps; never throws', () => {
    for (const bad of [null, 5, 'x', [], { subjects: 'math', grades: [1, 2], step: 99, languages: 3 }]) expect(() => normalizeProfile(bad)).not.toThrow();
    const p = normalizeProfile({ subjects: ['mathematics', 'nope', 7], grades: ['g3', 'g99'], step: 99, sessionLength: 'forever', completedAt: 'not a date', subjectGrades: { mathematics: ['g3'], physics: ['g3'] } });
    expect(p.subjects).toEqual(['mathematics']); expect(p.grades).toEqual(['g3']); expect(p.step).toBe(6); expect(p.sessionLength).toBeNull(); expect(p.completedAt).toBeNull(); expect(p.subjectGrades).toEqual({});
  });
  it('the interface language is always English', () => { expect(normalizeProfile({ languages: { interface: 'vi', teaching: ['vi'], content: ['vi', 'xx'] } }).languages).toEqual({ interface: 'en', teaching: ['vi'], content: ['vi'] }); });
  it('keeps teaching and content languages separate', () => { const p = toggleLanguage(toggleLanguage(emptyProfile(), 'teaching', 'vi'), 'content', 'en'); expect(p.languages).toMatchObject({ teaching: ['vi'], content: ['en'] }); });
});
describe('first-run lifecycle and storage', () => {
  it('shows once until completed or dismissed; students are never prompted', () => {
    const p = emptyProfile(); expect(shouldShowOnboarding(p)).toBe(true); expect(shouldShowOnboarding(complete(p))).toBe(false); expect(shouldShowOnboarding(dismiss(p))).toBe(false); expect(shouldShowOnboarding(emptyProfile('student'))).toBe(false);
  });
  it('resumes the saved step and survives blocked or broken storage', () => {
    const s = mem(); expect(saveProfile({ ...teacher(), step: 3 }, s)).toBe(true); expect(loadProfile(s).step).toBe(3);
    s.setItem(STORAGE_KEY, '{bad json'); expect(loadProfile(s)).toEqual(emptyProfile());
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(loadProfile(blocked)).toEqual(emptyProfile()); expect(saveProfile(teacher(), blocked)).toBe(false); expect(saveProfile(teacher(), null)).toBe(false);
  });
  it('hints are gentle and never required', () => { expect(hints(emptyProfile()).map((h) => h.step)).toEqual(['subjects', 'grades']); expect(hints(teacher()).map((h) => h.step)).toEqual(['map']); });
});
describe('discovery', () => {
  const p = setSubjectGrades(teacher(), 'mathematics', ['g9', 'g10']);
  const quizzes = [
    { id: 'a', updatedAt: '2026-01-02', meta: { subjectIds: ['mathematics'], gradeIds: ['g10'], language: 'en' } },
    { id: 'b', updatedAt: '2026-01-03', meta: { subject: 'Maths', ageBand: '14-17' } },
    { id: 'c', updatedAt: '2026-01-04', meta: { subjectIds: ['mathematics'], gradeIds: ['g2'] } },
    { id: 'd', updatedAt: '2026-01-05', meta: { subjectIds: ['history'], gradeIds: ['g10'] } },
    { id: 'e', updatedAt: '2026-01-06', meta: { subject: 'Underwater basket weaving' } },
    { id: 'f', updatedAt: '2026-01-07' },
  ];
  it('matches subject AND the grades taught for that subject; unclassified or foreign-grade quizzes are not recommended', () => {
    const r = recommend(quizzes, p).map((x) => x.quiz.id); expect(r).toEqual(['a', 'b']);
  });
  it('explains every recommendation and labels age-band guesses as estimates', () => {
    const [a, b] = recommend(quizzes, p); expect(a!.match.reasons.join(' ')).toMatch(/Made for Grade 10/); expect(b!.match.reasons.join(' ')).toMatch(/estimated/);
  });
  it('has no recommendations (not fabricated ones) when the profile is empty or the inventory is empty', () => { expect(recommend(quizzes, emptyProfile())).toEqual([]); expect(recommend([], p)).toEqual([]); expect(matchQuiz(undefined, p)).toBeNull(); });
  it('maps legacy free-text subjects only on exact label or alias', () => { expect(subjectIdFromLabel('Math')).toBe('mathematics'); expect(subjectIdFromLabel(' computer science ')).toBe('computer_science'); expect(subjectIdFromLabel('Mathematical theory of knots')).toBeNull(); });
});
