import { createRun, queueBlockReason } from '@/lib/civilization/lifelines/engine';
import { legalDistricts } from '@/lib/civilization/lifelines/selectors';
import { ix, step, tryStep, variantId, respond } from '@/lib/civilization/lifelines/__testing__/helpers';
import { GUIDE_TARGET, civilizationGuide, type CivGuideUi } from '../civilization';

const fresh = (c = 'first-light') => createRun(ix, { variantId: variantId(c), runId: 'g' });
const ui = (o: Partial<CivGuideUi> = {}): CivGuideUi => ({ selectedDistrictId: null, panel: 'none', preview: null, locked: false, hasCompletions: false, ...o });
const T = 'gathering-rounds';
const okDistrict = (s: ReturnType<typeof fresh>) => s.layout.districts.find(d => queueBlockReason(ix, s, T, d.id) === null)!.id;

describe('Civilization guide', () => {
  it('first action: highlights only LEGAL districts for the chapter target', () => {
    const s = fresh();
    const g = civilizationGuide(ix, s, ui());
    expect(g.step?.text).toBe('CHOOSE A DISTRICT');
    const legal = legalDistricts(ix, s, T).map(d => GUIDE_TARGET.district(d.id));
    expect(g.step?.targets.length).toBeGreaterThan(0);
    expect(g.step?.targets.sort()).toEqual(legal.sort());
  });

  it('follows the real sub-steps: district → open programmes → choose → start', () => {
    const s = fresh();
    const d = okDistrict(s);
    expect(civilizationGuide(ix, s, ui({ selectedDistrictId: d })).step?.text).toBe('OPEN PROGRAMMES');
    expect(civilizationGuide(ix, s, ui({ selectedDistrictId: d })).step?.targets).toEqual([GUIDE_TARGET.programmesButton]);
    const open = civilizationGuide(ix, s, ui({ selectedDistrictId: d, panel: 'programmes' }));
    expect(open.step?.text).toBe('CHOOSE A PROGRAMME');
    expect(open.step?.targets).toEqual([GUIDE_TARGET.programme(T)]);
    const start = civilizationGuide(ix, s, ui({ selectedDistrictId: d, panel: 'programmes', preview: { projectId: T, districtId: d } }));
    expect(start.step?.text).toBe('START THE PROGRAMME');
    expect(start.step?.targets).toEqual([GUIDE_TARGET.plan]);
  });

  it('advances only after the REAL state changes (a programme actually queued)', () => {
    let s = fresh();
    const d = okDistrict(s);
    // clicking around without queueing never reaches "advance"
    expect(civilizationGuide(ix, s, ui({ selectedDistrictId: d, panel: 'programmes', preview: { projectId: T, districtId: d } })).step?.text).not.toBe('ADVANCE THE SEASON');
    s = step(s, { type: 'queue-programme', projectId: T, districtId: d });
    const g = civilizationGuide(ix, s, ui());
    expect(g.step?.text).toBe('ADVANCE THE SEASON');
    expect(g.step?.targets).toEqual([GUIDE_TARGET.advance]);
  });

  it('a programme started through any other route still advances the guide (no exact click order)', () => {
    const s0 = fresh();
    const s = step(s0, { type: 'queue-programme', projectId: T, districtId: okDistrict(s0) });
    expect(civilizationGuide(ix, s, ui({ panel: 'council' })).step?.text).toBe('ADVANCE THE SEASON');
  });

  it('then the forecast, and finishes without a popup', () => {
    let s = fresh();
    s = step(s, { type: 'queue-programme', projectId: T, districtId: okDistrict(s) });
    s = tryStep(respond(s), { type: 'advance' });
    const f = civilizationGuide(ix, s, ui());
    if (!s.pendingEventId) { expect(f.step?.text).toBe('CHECK THE FORECAST'); expect(f.step?.targets).toEqual([GUIDE_TARGET.forecast]); }
    s = step(respond(s), { type: 'ack-forecast' });
    s = respond(s);
    const done = civilizationGuide(ix, s, ui());
    expect(done.step).toBeNull();
    expect(done.finished).toBe(true);
  });

  it('a mandatory event shows MAKE A DECISION and never recommends one option', () => {
    const s = { ...fresh(), pendingEventId: 'x' } as ReturnType<typeof fresh>;
    const g = civilizationGuide(ix, s, ui());
    expect(g.step?.text).toBe('MAKE A DECISION');
    expect(g.step?.targets).toEqual([GUIDE_TARGET.event]);
  });

  it('never points at an unavailable action: a blocked pick explains instead of glowing Plan', () => {
    const s = fresh();
    const d = okDistrict(s);
    const wrong = s.layout.districts.find(x => queueBlockReason(ix, s, T, x.id) !== null);
    if (wrong) {
      const g = civilizationGuide(ix, s, ui({ selectedDistrictId: d, panel: 'programmes', preview: { projectId: T, districtId: wrong.id } }));
      expect(g.step?.targets).not.toContain(GUIDE_TARGET.plan);
      expect(g.step?.detail).toBeTruthy();
    }
  });

  it('only the first chapter has a beginner guide; players with completions are not eligible', () => {
    expect(civilizationGuide(ix, fresh('short-walk'), ui()).step).toBeNull();
    expect(civilizationGuide(ix, fresh(), ui({ hasCompletions: true })).eligible).toBe(false);
    expect(civilizationGuide(ix, fresh(), ui()).eligible).toBe(true);
  });

  it('is silent while the run is locked (read-only / archived)', () => {
    expect(civilizationGuide(ix, fresh(), ui({ locked: true })).step).toBeNull();
  });

  it('is a pure reader: it does not change the run', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    civilizationGuide(ix, s, ui({ selectedDistrictId: okDistrict(s), panel: 'programmes' }));
    expect(JSON.stringify(s)).toBe(before);
  });
});
