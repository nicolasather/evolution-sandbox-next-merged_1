import { hubSummarySnapshot, NONE_SUMMARY, readHubSummary } from '../hubSummary';
import { lifelinesRecords } from '../archiveRecords';
import { validateQuestions, QUESTIONS, gradeAnswer } from '../questions';
import { VERIFIED_CHAPTER_EXHIBITS } from '../rewards';
import { archiveSections } from '@/lib/museum/archive';
import { getMode } from '@/lib/modes/registry';
import { ix } from '../__testing__/helpers';
import { CAMPAIGN_KEY, SAVE_KEY } from '../schema';

afterEach(() => window.localStorage.clear());

describe('hub summary and museum records', () => {
  it('reads only light metadata and never fabricates a year', () => {
    expect(readHubSummary()).toEqual(NONE_SUMMARY);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ meta: { chapterTitle: 'First Light', turn: 3 } }));
    window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ completions: { a: { chapterId: 'x' }, b: { chapterId: 'x' }, c: { chapterId: 'y' } } }));
    const s = readHubSummary();
    expect(s).toMatchObject({ kind: 'lifelines', chapterTitle: 'First Light', turn: 3, completed: 2 });
    expect(s.line).not.toMatch(/year/i);
    expect(JSON.parse(hubSummarySnapshot()).kind).toBe('lifelines');
  });
  it('survives corrupt storage and a legacy-only profile', () => {
    window.localStorage.setItem(SAVE_KEY, '{nope');
    expect(readHubSummary().kind).toBe('none');
    window.localStorage.clear();
    window.localStorage.setItem('evo.civilization.v1', JSON.stringify({ v: 1, active: { year: 40 }, dioramas: [] }));
    expect(readHubSummary()).toMatchObject({ kind: 'legacy', line: 'A saved settlement is waiting' });
  });
  it('archived attempts appear in the Mode Archive as procedural fiction with their seed', () => {
    window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ archives: [{ runId: 'r1', chapterTitle: 'First Light', headline: 'Held.', seed: 'S1', archivedAt: 5, mode: 'campaign', completed: true, turn: 9 }, { bad: true }] }));
    const recs = lifelinesRecords();
    expect(recs).toHaveLength(1);
    expect(recs[0].provenance).toMatchObject({ kind: 'procedural-fictional', seed: 'S1' });
    const section = archiveSections().find(s => s.id === 'civilization-lifelines')!;
    expect(section.records).toHaveLength(1);
    expect(lifelinesRecords('not json')).toEqual([]);
  });
  it('the Mode Hub registry keeps the stable id and the legacy save key', () => {
    expect(getMode('civilization')).toMatchObject({ id: 'civilization', subtitle: 'Lifelines', saveKey: 'evo.civilization.v1', status: 'available' });
  });
  it('no fake museum cards: no chapter is mapped to an exhibit unless verified', () => {
    expect(Object.keys(VERIFIED_CHAPTER_EXHIBITS)).toEqual([]);
  });
  it('learning questions are reviewed: unique ids, real chapters, distinct choices, rationales', () => {
    expect(validateQuestions(ix)).toEqual([]);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(12);
    expect(gradeAnswer(QUESTIONS[0], (QUESTIONS[0].correct + 1) % 3).label).toBe('Recorded.');
  });
});
