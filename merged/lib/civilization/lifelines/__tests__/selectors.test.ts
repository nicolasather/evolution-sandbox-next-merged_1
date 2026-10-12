import { chapterStatuses, completionKeyFor, blankManifest, feasibleMastery, isChapterUnlocked, nextChapter, recordCompletion, sandboxTiers, addArchive, summarizeRun, evaluateMastery, MAX_ARCHIVES } from '../campaign';
import { createRun, forecast, queueBlockReason } from '../engine';
import { generateLayout } from '../layout';
import { councilPreview, hintFor, needsDirection, networkTeaching, objectiveViews, pressures, remediesFor, tutorialStep, visibleProgrammes, programmeOption, districtView } from '../selectors';
import { ix, step, tryStep, variantId, respond } from '../__testing__/helpers';

const fresh = (c: string) => createRun(ix, { variantId: variantId(c), runId: 'sel' });

describe('selectors', () => {
  it('tutorial derives from state, not from a click sequence', () => {
    let s = fresh('first-light');
    expect(tutorialStep(ix, s).step).toBe('start-programme');
    s = step(s, { type: 'queue-programme', projectId: 'gathering-rounds', districtId: s.layout.districts.find(d => queueBlockReason(ix, s, 'gathering-rounds', d.id) === null)!.id });
    expect(tutorialStep(ix, s).step).not.toBe('start-programme');
    expect(tutorialStep(ix, fresh('short-walk')).step).toBe('done');
  });
  it('hints are state-aware: never tell the player to build what already exists', () => {
    let s = fresh('first-light');
    const d = s.layout.districts.find(x => queueBlockReason(ix, s, 'gathering-rounds', x.id) === null)!.id;
    expect(hintFor(ix, s, 1).projectId).toBe('gathering-rounds');
    s = step(s, { type: 'queue-programme', projectId: 'gathering-rounds', districtId: d });
    expect(hintFor(ix, s, 2).reasons.join(' ')).toMatch(/already planned/);
    for (let i = 0; i < 10; i++) s = tryStep(respond(s), { type: 'advance' });
    expect(s.built.some(b => b.projectId === 'gathering-rounds')).toBe(true);
    expect(hintFor(ix, s, 3).projectId).toBeNull();
  });
  it('direction cue appears from blocked actions or stalled progress, never from a clock', () => {
    const s = fresh('first-light');
    expect(needsDirection(s, 0)).toBe(false); expect(needsDirection(s, 3)).toBe(true);
    expect(needsDirection({ ...s, turn: 6, lastProgressTurn: 0 }, 0)).toBe(true);
  });
  it('programme options explain blocks and expose exact shortfalls', () => {
    const s = fresh('first-light');
    const opts = visibleProgrammes(ix, s);
    expect(opts[0].project.id).toBe('gathering-rounds');
    const poor = { ...s, stocks: { ...s.stocks, materials: 0 } };
    const o = programmeOption(ix, poor, ix.projects.get('gathering-rounds')!);
    expect(o.reasonText).toBeTruthy();
  });
  it('council preview is read-only and flags invalid sets', () => {
    const s = fresh('fair-share');
    const before = JSON.stringify(s);
    const one = ix.db.policies[0];
    const p = councilPreview(ix, s, [{ id: one.id, districtId: null }]);
    expect(p.valid).toBe(true); expect(p.incoming).toEqual([one.name]);
    expect(councilPreview(ix, s, [{ id: one.id, districtId: null }, { id: ix.db.policies[1].id, districtId: null }, { id: ix.db.policies[2].id, districtId: null }, { id: ix.db.policies[3].id, districtId: null }]).valid).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    expect(forecast(ix, s)).toEqual(forecast(ix, JSON.parse(before)));
  });
  it('shortage remedies are distinct strategies previewed by the real resolver', () => {
    let s = fresh('across-water');
    for (let i = 0; i < 20; i++) s = tryStep(respond(s), { type: 'advance' });
    const list = pressures(s);
    if (list.length) {
      const remedies = remediesFor(ix, s, list[0]);
      expect(new Set(remedies.map(r => r.kind)).size).toBe(remedies.length);
      remedies.filter(r => r.legal).forEach(r => expect(r.diff).not.toBeNull());
    }
    expect(networkTeaching(ix, fresh('first-light'))).toEqual({ repair: false, alternate: false, routing: false });
    expect(networkTeaching(ix, createRun(ix, { variantId: variantId('across-water'), runId: 'x', mode: 'sandbox' })).routing).toBe(true);
  });
  it('objectives and district views are consistent with state', () => {
    const s = fresh('first-light');
    expect(objectiveViews(ix, s)).toHaveLength(3);
    s.layout.districts.forEach(d => expect(districtView(ix, s, d.id, null)?.district.id).toBe(d.id));
    expect(districtView(ix, s, 'nope', null)).toBeNull();
  });
});

describe('campaign', () => {
  it('unlocks by explicit previous-chapter id and previews only the next brief', () => {
    let m = blankManifest('1.0.0');
    expect(chapterStatuses(ix, m).filter(c => c.unlocked)).toHaveLength(1);
    expect(nextChapter(ix, m)?.id).toBe('first-light');
    m = recordCompletion(m, { key: completionKeyFor('first-light', 'lifelines-rules-1'), chapterId: 'first-light', runId: 'r', turn: 9, at: 1, mastery: [] });
    expect(isChapterUnlocked(ix, m, ix.chapters.get('short-walk')!)).toBe(true);
    expect(isChapterUnlocked(ix, m, ix.chapters.get('shared-roof')!)).toBe(false);
    expect(sandboxTiers(ix, m)[0].unlocked).toBe(true);
  });
  it('records a completion once per key and unions mastery', () => {
    let m = blankManifest('1.0.0');
    const k = 'first-light@lifelines-rules-1';
    m = recordCompletion(m, { key: k, chapterId: 'first-light', runId: 'a', turn: 9, at: 1, mastery: ['no-hints'] });
    m = recordCompletion(m, { key: k, chapterId: 'first-light', runId: 'b', turn: 5, at: 2, mastery: ['no-emergency'] });
    expect(m.completions[k]).toMatchObject({ firstRunId: 'a', firstCompletedAtTurn: 9, count: 2, mastery: ['no-emergency', 'no-hints'] });
  });
  it('mastery is declared before the run and only when feasible', () => {
    const ch = ix.chapters.get('first-light')!;
    const l = generateLayout('s', ch, ix);
    expect(feasibleMastery(ch, l).map(x => x.id)).not.toContain('alternate-route');
    const late = ix.chaptersByOrder[12];
    expect(feasibleMastery(late, generateLayout('s', late, ix)).map(x => x.id)).toContain('alternate-route');
    const s = createRun(ix, { variantId: variantId('first-light'), runId: 'm', masteryDeclared: ['no-hints'] });
    expect(evaluateMastery(s)).toEqual(['no-hints']);
    expect(evaluateMastery({ ...s, hintsUsed: 1 })).toEqual([]);
    expect(evaluateMastery({ ...s, masteryDeclared: [] , hintsUsed: 0 })).toEqual([]);
  });
  it('archives are bounded and labelled as simulated', () => {
    let m = blankManifest('1.0.0');
    const s = fresh('first-light');
    for (let i = 0; i < MAX_ARCHIVES + 5; i++) m = addArchive(m, summarizeRun(ix, { ...s, runId: `r${i}` }, i));
    expect(m.archives).toHaveLength(MAX_ARCHIVES);
    expect(m.archives[0].headline).toMatch(/simulated settlement/);
  });
});
