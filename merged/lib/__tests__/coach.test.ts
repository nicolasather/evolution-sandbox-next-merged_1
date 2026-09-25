import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import { Engine, STUCK_AFTER } from '@/lib/engine';
import { applyProcessing } from '@/lib/processing/overlay';
import { INSIGHTS, insightFor } from '@/lib/processing/insights';
import { level2Form } from '@/lib/processing/coach';
import type { ProcessingData } from '@/lib/processing/types';
import type { Db, HintView } from '@/lib/types';

const db = applyProcessing(rawDb as unknown as Db, processingJson as unknown as ProcessingData);
const fresh = () => new Engine(db);
type Priv = { hint: { tries: number; level: number; target: string | null } };

/** Climb the ladder on purpose: each rung opens once the player has kept trying. */
function ladder(e: Engine, target?: string): HintView[] {
  const views: HintView[] = [];
  const first = e.requestHint(target);
  if ('error' in first) throw new Error(first.error);
  views.push(first);
  for (let i = 0; i < 4; i++) {
    (e as unknown as Priv).hint.tries = 99;
    const v = e.requestHint();
    if ('error' in v) throw new Error(v.error);
    views.push(v);
  }
  return views;
}

describe('the five-rung hint ladder', () => {
  it('goes vague → material → action → ghost → direct, for a piece of work', () => {
    const e = fresh();
    const v = ladder(e, 'sharp_stone');
    expect(v.map(x => x.level)).toEqual([1, 2, 3, 4, 5]);
    expect(v[0].text).toMatch(/hiding among your/i);
    expect(v[1].text.length).toBeGreaterThan(10);
    expect(v[2].text).toMatch(/Smash/);
    expect(v[2].ghost).toBeNull();
    expect(v[3].ghost).toEqual({ action: 'smash', from: 'stone' });
    expect(v[4].text).toBe('Try Smash on Stone.');
    expect(v[4].highlightId).toBe('stone');
  });

  it('never names the target, on any rung', () => {
    const e = fresh();
    const v = ladder(e, 'sharp_stone');
    for (const x of v) expect(x.text).not.toMatch(/sharp stone/i);
  });

  it('names one piece and describes the others by role when the answer is an assembly', () => {
    const e = fresh();
    e.process('stone', 'smash');
    e.process('wood', 'smash');
    const v = ladder(e, 'hafted_tool');
    const last = v[4];
    expect(last.level).toBe(5);
    if (last.text.startsWith('Start with')) {
      // exactly one of the ingredients is named
      const names = ['Stone', 'Stick', 'Fibre Strands'].filter(n => last.text.includes(n));
      expect(names.length).toBeLessThanOrEqual(1);
    }
  });

  it('gives the second rung a different shape for different targets, stably', () => {
    const forms = new Set(['sharp_stone', 'fire', 'cordage', 'needle', 'pottery', 'spear', 'lumber', 'bow', 'net', 'thatch'].map(level2Form));
    expect(forms.size).toBeGreaterThan(1);
    expect(level2Form('fire')).toBe(level2Form('fire'));
  });

  it('leans on what has been tried: right piece, wrong hand', () => {
    const e = fresh();
    e.process('stone', 'brush');       // tried Brush on stone
    const v = ladder(e, 'sharp_stone');
    expect(v[2].text).toMatch(/tried Brush/i);
    expect(v[2].text).toMatch(/Smash/);
  });
});

describe('the coach', () => {
  it('says nothing while play is going well', () => {
    const e = fresh();
    expect(e.hintView().coach).toBeNull();
  });

  it('nudges toward hands when the player has only ever put things together', () => {
    const e = fresh();
    (e as unknown as { streak: number }).streak = STUCK_AFTER; // a run of pairs that made nothing
    const c = e.hintView().coach;
    expect(c).toMatch(/hands/i);
  });

  it('hints at techniques still to be found once hands have been tried, without naming one', () => {
    const e = fresh();
    e.process('stone', 'brush');
    e.process('fiber', 'smash');
    for (let i = 0; i < STUCK_AFTER + 1; i++) e.process('bone', 'brush');
    const c = e.hintView().coach;
    expect(c).toMatch(/ways of working/i);
    expect(c).not.toMatch(/cut|carve|twist|burn/i);
  });
});

describe('insights', () => {
  it('are all distinct, point at real materials, and name a property', () => {
    const ids = new Set(INSIGHTS.map(i => i.id));
    expect(ids.size).toBe(INSIGHTS.length);
    const known = new Set([...db.nodes.map(n => n.id), ...(db.states ?? []).map(s => s.id)]);
    for (const i of INSIGHTS) { expect(known.has(i.from)).toBe(true); expect(i.property).toBeTruthy(); expect(i.text.length).toBeGreaterThan(10); }
    expect(insightFor('stone', 'smash', 'done')).toBeDefined();
  });

  it('are noticed once, and are never a recipe', () => {
    const e = fresh();
    const r = e.process('stone', 'smash');
    expect(r.status === 'done' && r.insight?.property).toBe('brittle');
    const again = e.process('stone', 'smash');
    expect(again.status === 'nothing' && again.insight).toBeUndefined();
    for (const i of INSIGHTS) expect(i.text).not.toMatch(/[A-Z][a-z]+ \+ [A-Z]/);
  });

  it('are noticed on a refusal too — what a material is NOT is a fact about it', () => {
    const e = fresh();
    e.states.add('water'); e.bag.push('water');
    const r = e.process('water', 'smash');
    expect(r.status === 'nothing' && r.insight?.property).toBe('fluid');
  });

  it('survive a save and are not shown twice', () => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = { localStorage: {
      getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } } };
    try {
      const e = fresh();
      e.process('stone', 'smash');
      const g = fresh();
      expect(g.load()).toBe(true);
      expect(g.insightsSeen()).toContain('stone.smash.done');
      expect(g.knows('cut')).toBe(true);
      expect(g.takeReveals()).toEqual([]);
    } finally { delete (globalThis as unknown as { window?: unknown }).window; }
  });
});
