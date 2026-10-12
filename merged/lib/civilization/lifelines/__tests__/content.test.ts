import db from '@/data/civilization/lifelines.v1.json';
import { buildContentIndex, ContentError, loadLifelinesContent, resetContentCache } from '../content';
import { ix } from '../__testing__/helpers';

/* eslint-disable @typescript-eslint/no-explicit-any -- tests deliberately corrupt raw JSON */
const raw = () => JSON.parse(JSON.stringify(db));
const codeOf = (fn: () => unknown): string | null => { try { fn(); return null; } catch (e) { return e instanceof ContentError ? e.code : 'other'; } };

describe('content database', () => {
  it('loads the supplied database with the documented counts', () => {
    expect(ix.db.contentVersion).toBe('1.0.0');
    const c = ix.db.manifest.counts;
    expect([ix.eras.size, ix.resources.size, ix.biomes.size, ix.projects.size, ix.policies.size, ix.events.size, ix.chapters.size, ix.objectives.size, ix.variants.size])
      .toEqual([8, 12, 12, 144, 48, 48, 24, 72, 288]);
    expect(c.hints).toBe(432);
    expect(ix.db.rules.shortageMode).toBe('warnings-only');
  });
  it('every chapter has a hint ladder of three levels and an unbroken previous-chapter chain', () => {
    for (const p of ix.projects.values()) expect(ix.hintsByProject.get(p.id)?.map(h => h.level)).toEqual([1, 2, 3]);
    expect(ix.chaptersByOrder[0].previousChapterId).toBeNull();
    ix.chaptersByOrder.slice(1).forEach((c, i) => expect(c.previousChapterId).toBe(ix.chaptersByOrder[i].id));
  });
  it('no historical claims in authored rows', () => {
    expect(ix.db.historicalStatus).toMatch(/./);
    for (const c of ix.chapters.values()) expect(c.historicalClaim).toBe(false);
    for (const p of ix.projects.values()) expect(p.provenance.historicalStatus).toBe('unverified-concept');
  });
  it('is deeply frozen', () => { expect(Object.isFrozen(ix.db)).toBe(true); expect(Object.isFrozen(ix.db.projects[0])).toBe(true); });
  it('lazy loader memoises one index', async () => {
    resetContentCache();
    const a = await loadLifelinesContent();
    expect(await loadLifelinesContent()).toBe(a);
  });
  it.each([
    ['duplicate project id', (d: any) => { d.projects[1].id = d.projects[0].id; }, 'duplicate-projects-id'],
    ['unknown prerequisite', (d: any) => { d.projects[5].requires = ['nope']; }, 'unknown-prerequisite'],
    ['unknown schema', (d: any) => { d.schemaVersion = 9; }, 'unsupported-content-schema'],
    ['event without free choice', (d: any) => { d.events[0].choices.forEach((c: any) => { c.cost = { food: 1 }; }); }, 'event-without-free-choice'],
    ['non-warnings-only shortages', (d: any) => { d.rules.shortageMode = 'collapse'; }, 'invalid-rules'],
    ['manifest count mismatch', (d: any) => { d.manifest.counts.projects = 3; }, 'manifest-count-mismatch'],
    ['negative cost', (d: any) => { d.projects[0].cost = { food: -2 }; }, 'invalid-project-quantity'],
  ])('rejects %s', (_n, mutate, code) => {
    const d = raw(); mutate(d);
    expect(codeOf(() => buildContentIndex(d))).toBe(code);
  });
  it('rejects a prerequisite cycle', () => {
    const d = raw();
    const a = d.projects.find((p: any) => p.requires.length > 0);
    const dep = d.projects.find((p: any) => p.id === a.requires[0]);
    dep.requires = [a.id];
    expect(['cyclic-prerequisite', 'prerequisite-later-era']).toContain(codeOf(() => buildContentIndex(d)));
  });
});
