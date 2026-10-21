/** @jest-environment node */
import type { Loose } from '../loose';
import { findDuplicates, checkQuality, evidenceWarnings, canPublish, groupQuestions, reviewSequence, duplicateIntoLanguage, revalidate, translatableStrings, takeSnapshot, rollback, hashDoc, changedQuestions, t } from '../content';
import { relevance, searchLibrary, facets, toggleFavorite, emptyCollections, addFolder, moveToFolder, parseCollections, sectionsOf, planBulk, remix, canTransition, isVerified, duplicateSpamSignal, editDistance, type LibraryQuiz } from '../library';
import { coverSvg, themeForSubject } from '../art';
import type { Question } from '../types';

const mc = (prompt: string, right: string, wrong: string[], extra: Loose = {}): Question => ({ kind: 'multiple_choice', prompt, basePoints: 100, payload: { options: [right, ...wrong].map((text, i) => ({ id: `o${i}`, text })), ...extra.payload }, answerKey: { correctIds: ['o0'], ...extra.key } });
const forge = (prompt: string, a: string[]): Question => ({ kind: 'answer_forge', prompt, basePoints: 100, payload: { placeholder: 'x', caseSensitive: false }, answerKey: { accepted: a } });

describe('duplicate detection (item 044)', () => {
  it('finds exact repeats inside a quiz and across an imported bank', () => {
    const bank = [{ id: 'bank-1', q: forge('What is the capital of France?', ['Paris']) }];
    const f = findDuplicates([forge('what is the capital of FRANCE', ['paris']), forge('Largest ocean?', ['Pacific'])], bank);
    expect(f).toHaveLength(1); expect(f[0]).toMatchObject({ index: 0, other: 'bank-1', kind: 'exact' });
  });
  it('keeps similar-but-different questions and says so', () => {
    const f = findDuplicates([forge('What is the capital of France?', ['Paris']), forge('What is the capital of France today?', ['Versailles'])]);
    expect(f.length).toBeGreaterThan(0); expect(f.every((x) => x.kind === 'near' && !x.sameAnswer)).toBe(true);
    expect(f[0]!.note).toMatch(/probably intentional/);
    expect(findDuplicates([forge('What is the capital of France?', ['Paris']), forge('Name the longest river in Africa', ['Nile'])])).toHaveLength(0);
  });
  it('never mixes formats and never deletes anything', () => {
    const qs = [forge('Same text?', ['a']), mc('Same text?', 'a', ['b'])]; const before = JSON.stringify(qs);
    expect(findDuplicates(qs)).toHaveLength(0); expect(JSON.stringify(qs)).toBe(before);
  });
});

describe('question-quality checklist (item 047)', () => {
  const codes = (q: Question) => checkQuality(q).map((i) => i.code);
  it('flags ambiguous stems, unbalanced distractors and duplicate options', () => {
    expect(codes(mc('Why', 'x', ['y']))).toEqual(expect.arrayContaining(['short-stem', 'two-options']));
    expect(codes(mc('Which is NOT a mammal and not a bird?', 'A very long correct answer that stands out', ['Cat', 'Dog', 'Pig']))).toEqual(expect.arrayContaining(['double-negative', 'long-correct']));
    expect(codes(mc('Pick one?', 'Same', ['same', 'Other']))).toContain('duplicate-options');
    expect(codes(mc('Pick one of these?', 'Always true', ['b', 'c']))).toContain('absolutes');
  });
  it('flags grammar slips, long stems and missing explanations, and stays quiet for a good question', () => {
    expect(codes(mc('the the cat sat?', 'a', ['b', 'c']))).toEqual(expect.arrayContaining(['grammar', 'capital']));
    expect(codes(mc('x'.repeat(320) + '?', 'a', ['b', 'c']))).toContain('long-stem');
    const good = mc('Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Earth', 'Mars'], { key: { explanation: 'Mercury orbits closest.', distractorNotes: { o1: 'Venus is second.' } } });
    expect(checkQuality(good)).toEqual([]);
    expect(codes({ kind: 'truth_hunt', prompt: 'Decide.', basePoints: 1, payload: { statements: [1, 2, 3].map((n) => ({ id: `s${n}`, text: `t${n}` })) }, answerKey: { truth: { s1: true, s2: true, s3: true } } })).toContain('all-same');
  });
});

describe('AI drafts stay unverified and never publish themselves (items 045, 046)', () => {
  const draft = (extra: Loose = {}) => mc('In which year did the Berlin Wall fall?', '1989', ['1991', '1979'], { payload: { meta: { aiDraft: true, ...extra } } });
  it('warns about unsupported numbers and about missing human verification', () => {
    expect(evidenceWarnings(draft()).join(' ')).toMatch(/no source/); expect(evidenceWarnings(draft()).join(' ')).toMatch(/not marked this AI draft as verified/);
    expect(evidenceWarnings(draft({ evidence: 'Encyclopaedia, 2024', verified: true }))).toEqual([]);
    expect(evidenceWarnings(mc('Q?', 'a', ['b']))).toEqual([]);
  });
  it('blocks publishing while any draft is unverified', () => {
    expect(canPublish([draft(), mc('Fine one?', 'a', ['b'])])).toEqual({ ok: false, blocked: [0] }); expect(canPublish([draft({ verified: true })]).ok).toBe(true);
  });
});

describe('grouping, localisation and revisions (items 048, 049, 050)', () => {
  const qs = [mc('Q1?', 'a', ['b'], { payload: { meta: { topic: 'Fractions', difficulty: 'easy' } } }), mc('Q2?', 'a', ['b'], { payload: { meta: { topic: 'Decimals', difficulty: 'hard', objective: 'Compare' } } }), mc('Q3?', 'a', ['b'], { payload: { meta: { topic: 'Fractions', difficulty: 'hard' } } })];
  it('groups and builds review sequences without touching the bank', () => {
    expect([...groupQuestions(qs, 'topic')]).toEqual([['Fractions', [0, 2]], ['Decimals', [1]]]); expect(reviewSequence(qs, { difficulty: 'hard' })).toEqual([1, 2]); expect(reviewSequence(qs, { topic: 'Fractions', difficulty: 'hard' })).toEqual([2]);
  });
  it('duplicates into another language, keeps the source, ids and keys, and revalidates', () => {
    const doc = { title: 'Fractions', description: '', meta: { language: 'en' }, questions: [mc('Half of 10?', '5', ['4'])] };
    const before = JSON.stringify(doc); const { copy, problems, source } = duplicateIntoLanguage(doc, 'vi', { 0: { prompt: 'Một nửa của 10?', texts: { o0: '5', o1: '4' } } });
    expect(JSON.stringify(source)).toBe(before); expect(copy.meta!.language).toBe('vi'); expect(copy.questions[0]!.prompt).toBe('Một nửa của 10?');
    expect((copy.questions[0]!.answerKey as Loose).correctIds).toEqual(['o0']); expect(problems).toEqual([]);
    const broken = duplicateIntoLanguage(doc, 'vi', { 0: { texts: { o0: '' } } }); expect(broken.problems).toHaveLength(1);
    expect(revalidate([{ ...doc.questions[0]!, prompt: '' }])).toHaveLength(1);
    expect(translatableStrings(doc.questions[0]!).map((s) => s.text)).toEqual(['5', '4']);
    expect(t('vi', 'true')).toBe('Đúng'); expect(t('xx', 'true')).toBe('True');
  });
  it('snapshots are immutable and rollback is safe', () => {
    const live = { title: 'V1', description: '', questions: [mc('Q?', 'a', ['b'])] };
    const snap = takeSnapshot(live, 'Published v1', new Date('2026-01-01T00:00:00Z'));
    live.title = 'V2'; live.questions[0]!.prompt = 'Changed?'; expect(snap.doc.title).toBe('V1'); expect(snap.doc.questions[0]!.prompt).toBe('Q?');
    expect(() => { (snap.doc as Loose).title = 'x'; }).toThrow();
    const r = rollback(live, snap); expect(r.restored.title).toBe('V1'); expect(r.safety.doc.title).toBe('V2'); expect(r.safety.label).toContain('Before restoring');
    expect(hashDoc({ a: 1, b: 2 })).toBe(hashDoc({ b: 2, a: 1 })); expect(changedQuestions(snap.doc, live)).toEqual({ added: 0, removed: 0, changed: 1 });
  });
});

const lib = (o: Partial<LibraryQuiz> & { id: string; title: string }): LibraryQuiz => ({ description: '', updatedAt: '2026-01-01T00:00:00Z', questionCount: 5, ...o });
describe('library search, filters and sorting (items 051-054)', () => {
  const all = [
    lib({ id: '1', title: 'Photosynthesis basics', meta: { subject: 'Biology', language: 'en', ageBand: '11-13', tags: ['plants'] }, updatedAt: '2026-03-01T00:00:00Z', saves: 5, hasMedia: true, estimatedSeconds: 300, questions: [{ kind: 'multiple_choice', prompt: 'Which gas do plants absorb?', payload: {} }] }),
    lib({ id: '2', title: 'Lịch sử Việt Nam', meta: { subject: 'History', language: 'vi', ageBand: '14-17' }, updatedAt: '2026-02-01T00:00:00Z', saves: 50, verified: true, reviewState: 'approved', estimatedSeconds: 900 }),
    lib({ id: '3', title: 'Fractions drill', description: 'Practice adding fractions', meta: { subject: 'Math', language: 'en', ageBand: '8-10' }, updatedAt: '2026-04-01T00:00:00Z', saves: 500, verified: true, reviewState: 'unreviewed', estimatedSeconds: 600 }),
  ];
  it('ignores case and diacritics and tolerates a typo', () => {
    expect(searchLibrary(all, { query: 'LICH SU viet nam' }).map((q) => q.id)).toEqual(['2']);
    expect(searchLibrary(all, { query: 'photosyntesis' }).map((q) => q.id)).toEqual(['1']); // one letter missing
    expect(searchLibrary(all, { query: 'plants' }).map((q) => q.id)).toEqual(['1']); // tag
    expect(searchLibrary(all, { query: 'absorb gas' }).map((q) => q.id)).toEqual(['1']); // question content
    expect(searchLibrary(all, { query: 'zzzzqqq' })).toEqual([]);
    expect(editDistance('kitten', 'sitting', 3)).toBe(3); expect(relevance(all[0]!, '')).toBe(1);
  });
  it('filters by subject, age, language, type, duration, media and verified', () => {
    const ids = (f: Loose) => searchLibrary(all, { filters: f }).map((q) => q.id).sort();
    expect(ids({ subject: 'history' })).toEqual(['2']); expect(ids({ ageBand: '8-10' })).toEqual(['3']); expect(ids({ language: 'en' })).toEqual(['1', '3']);
    expect(ids({ kind: 'multiple_choice' })).toEqual(['1']); expect(ids({ minSeconds: 500, maxSeconds: 700 })).toEqual(['3']); expect(ids({ hasMedia: true })).toEqual(['1']); expect(ids({ verifiedOnly: true })).toEqual(['2']);
  });
  it('sorts by relevance, recent, saves and verified — popularity is not correctness', () => {
    expect(searchLibrary(all, { sort: 'recent' }).map((q) => q.id)).toEqual(['3', '1', '2']); expect(searchLibrary(all, { sort: 'saves' }).map((q) => q.id)).toEqual(['3', '2', '1']);
    expect(searchLibrary(all, { sort: 'verified' })[0]!.id).toBe('2');
    expect(isVerified(all[2]!)).toBe(false); // many saves + a verified flag but never reviewed → not shown as verified
  });
  it('offers facets for the filter panel', () => expect(facets(all).languages).toEqual([['en', 2], ['vi', 1]]));
});

describe('collections, My Quizzes, bulk actions and remix (items 055-058)', () => {
  it('favourites and folders are immutable updates that survive a round trip', () => {
    let c = toggleFavorite(emptyCollections(), 'a'); c = addFolder(c, 'Unit 1', 'f1'); c = addFolder(c, 'unit 1', 'f2'); c = moveToFolder(c, ['a'], 'f1');
    expect(c.favorites).toEqual(['a']); expect(c.folders).toHaveLength(1); expect(c.folders[0]!.quizIds).toEqual(['a']);
    expect(parseCollections(JSON.stringify(c))).toEqual(c); expect(parseCollections('junk')).toEqual(emptyCollections()); expect(toggleFavorite(c, 'a').favorites).toEqual([]);
  });
  it('separates drafts, published, favourites, imported and archived with save location', () => {
    const items = [{ id: '1', title: 'a', status: 'draft' as const, where: 'device' as const, updatedAt: '' }, { id: '2', title: 'b', status: 'published' as const, where: 'cloud' as const, updatedAt: '' }, { id: '3', title: 'c', status: 'draft' as const, where: 'cloud' as const, imported: true, updatedAt: '' }, { id: '4', title: 'd', status: 'draft' as const, where: 'cloud' as const, archived: true, updatedAt: '' }];
    const s = sectionsOf(items, ['2']); expect(s.drafts.map((i) => i.id)).toEqual(['1']); expect(s.published.map((i) => i.id)).toEqual(['2']); expect(s.favorites.map((i) => i.id)).toEqual(['2']); expect(s.imported.map((i) => i.id)).toEqual(['3']); expect(s.archived.map((i) => i.id)).toEqual(['4']);
  });
  it('only delete needs confirmation; the rest can be undone', () => {
    expect(planBulk('delete', ['1', '2'])).toMatchObject({ needsConfirm: true, undoable: false }); expect(planBulk('archive', ['1'])).toMatchObject({ needsConfirm: false, undoable: true });
  });
  it('remix makes an independent private draft with provenance and consistent fresh ids', () => {
    const src = { id: 'src-1', title: 'Original', description: 'd', ownerName: 'Ms Lan', questions: [mc('Q?', 'a', ['b'])] };
    const r = remix(src, (p) => `${p}new${Math.random().toString(36).slice(2, 6)}`);
    expect(r.status).toBe('draft'); expect(r.meta).toMatchObject({ sourceId: 'src-1', sourceTitle: 'Original', sourceAuthor: 'Ms Lan' });
    const q: Loose = r.questions[0]; expect(q.payload.options.map((o: Loose) => o.id)).toContain(q.answerKey.correctIds[0]); expect(q.answerKey.correctIds[0]).not.toBe('o0'); expect(src.questions[0]!.answerKey).toEqual({ correctIds: ['o0'] });
  });
});

describe('reports and moderation workflow (items 059, 060, 140)', () => {
  it('allows only sensible status transitions and one appeal', () => {
    expect(canTransition('received', 'in_review')).toBe(true); expect(canTransition('resolved', 'in_review')).toBe(false); expect(canTransition('dismissed', 'appealed')).toBe(true); expect(canTransition('appealed', 'appealed')).toBe(false);
  });
  it('detects repeated duplicate quizzes from one account', () => {
    const own = [{ title: 'Free robux', firstPrompt: 'Q' }, { title: 'free robux', firstPrompt: 'q' }]; expect(duplicateSpamSignal(own, { title: 'Free Robux', firstPrompt: 'Q' })).toBe(true); expect(duplicateSpamSignal(own, { title: 'Real quiz', firstPrompt: 'Q' })).toBe(false);
  });
});

describe('cover artwork (item 053)', () => {
  it('is deterministic, original (no text, no faces) and subject-aware', () => {
    expect(coverSvg('seed-1', 'Math')).toBe(coverSvg('seed-1', 'Math')); expect(coverSvg('seed-1', 'Math')).not.toBe(coverSvg('seed-2', 'Math'));
    expect(coverSvg('x', 'History').replace('http://www.w3.org/2000/svg','')).not.toMatch(/<text|<image|http/); expect(themeForSubject('Lịch sử', 'x').id).toBe('time'); expect(themeForSubject('Chemistry', 'x').id).toBe('lab');
  });
});

describe('taxonomy filters (subject / exact grade / curriculum)', () => {
  const mk = (id: string, meta: NonNullable<LibraryQuiz['meta']>): LibraryQuiz => ({ id, title: id, description: '', updatedAt: '2026-01-01', questionCount: 5, meta });
  const all = [mk('a', { subjectIds: ['mathematics'], gradeIds: ['g9', 'g10'], curriculumIds: ['moet'] }), mk('b', { subject: 'Math' }), mk('c', { subjectIds: ['physics'], gradeIds: ['g10'], curriculumIds: ['cambridge'] })];
  it('filters by stable subject id, accepting legacy free-text subjects that match exactly', () => {
    expect(searchLibrary(all, { filters: { subjectId: 'mathematics' } }).map((q) => q.id).sort()).toEqual(['a', 'b']);
  });
  it('filters by exact grade and curriculum only on stated classifications', () => {
    expect(searchLibrary(all, { filters: { gradeId: 'g10' } }).map((q) => q.id).sort()).toEqual(['a', 'c']);
    expect(searchLibrary(all, { filters: { gradeId: 'g10', curriculumId: 'moet' } }).map((q) => q.id)).toEqual(['a']);
  });
  it('facets count each id once per quiz', () => { const f = facets(all); expect(f.gradeIds).toEqual([['g10', 2], ['g9', 1]]); expect(f.subjectIds.find(([id]) => id === 'mathematics')?.[1]).toBe(2); });
});
