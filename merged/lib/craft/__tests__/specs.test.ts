/**
 * The recipe → process layer: every recipe has a process, every process is made
 * only of registered interaction kinds, and the hidden difficulty stays in the
 * shape the design asks for (quick ≈ 1 s, medium 2–3 steps, major 5–15 s).
 */
import rawDb from '@/data/db.json';
import { Engine } from '@/lib/engine';
import type { Db } from '@/lib/types';
import { MATERIALS, materialOf, propsOf, registerMaterial } from '../materials';
import { BUDGET, CRAFT_OVERRIDES, deriveSpec, estimateSteps } from '../specs';
import { registerStep, stepDef, stepKinds } from '../steps';
import type { StepKind } from '../types';

const db = rawDb as unknown as Db;
const byId = new Map(db.nodes.map(n => [n.id, n]));
const eraIndex = (id: string) => Math.max(0, db.eras.findIndex(e => e.id === byId.get(id)!.era));
const pairs: { a: string; b: string; r: string }[] = [];
for (const n of db.nodes) for (const [a, b] of n.rec) pairs.push({ a, b, r: n.id });
const specOf = (p: { a: string; b: string; r: string }, relax = false) =>
  deriveSpec(byId.get(p.a)!, byId.get(p.b)!, byId.get(p.r)!, { eraIndex: eraIndex(p.r), relax });

describe('materials', () => {
  it('every discovery has a material with physics', () => {
    for (const n of db.nodes) {
      const m = materialOf(n);
      expect(MATERIALS[m]).toBeDefined();
      const p = propsOf(m);
      expect(p.mass).toBeGreaterThan(0);
      expect(p.size).toBeGreaterThan(0.5);
    }
  });

  it('a new material registers in one call and is picked up', () => {
    registerMaterial('test-alloy', { ...MATERIALS.metal, mass: 4 }, ['stone']);
    expect(propsOf('test-alloy' as never).mass).toBe(4);
    registerMaterial('stone', MATERIALS.stone, ['stone']);
  });
});

describe('step registry', () => {
  it('knows every interaction kind the recipes use', () => {
    const used = new Set<StepKind>();
    for (const o of Object.values(CRAFT_OVERRIDES)) for (const s of o.steps) used.add(s.kind);
    for (const p of pairs) for (const s of specOf(p).steps) used.add(s.kind);
    expect([...used].filter(k => !stepDef(k))).toEqual([]);
  });

  it('a new kind registers by name', () => {
    registerStep({ kind: 'touch', verb: 'Bring together', estimate: () => 0.9, create: stepDef('touch')!.create });
    expect(stepKinds()).toContain('touch');
  });
});

describe('recipe specs', () => {
  it('give every pair in the game a process', () => {
    for (const p of pairs) {
      const s = specOf(p);
      expect(s.steps.length).toBeGreaterThan(0);
      expect(['quick', 'medium', 'major']).toContain(s.tier);
      expect(s.resistance).toBeGreaterThan(0.5);
      expect(s.resistance).toBeLessThan(1.8);
    }
  });

  it('are deterministic: the same pair is always the same craft', () => {
    for (const p of pairs.slice(0, 80)) expect(specOf(p)).toEqual(specOf(p));
  });

  it('keep each tier inside its shape', () => {
    for (const p of pairs) {
      const s = specOf(p);
      const est = estimateSteps(s.steps, s.resistance);
      if (s.tier === 'quick') { expect(s.steps).toHaveLength(1); expect(est).toBeLessThanOrEqual(BUDGET.quick + 0.5); }
      if (s.tier === 'medium') { expect(s.steps.length).toBeGreaterThanOrEqual(2); expect(s.steps.length).toBeLessThanOrEqual(3); expect(est).toBeLessThanOrEqual(BUDGET.medium + 3); }
      if (s.tier === 'major') { expect(s.steps.length).toBeGreaterThanOrEqual(2); expect(s.steps.length).toBeLessThanOrEqual(5); expect(est).toBeLessThanOrEqual(BUDGET.major + 3); expect(est).toBeGreaterThan(4); }
    }
  });

  it('ramp with the era: early finds are lighter than late ones', () => {
    const avg = (from: number, to: number) => {
      const xs = pairs.filter(p => eraIndex(p.r) >= from && eraIndex(p.r) < to).map(p => { const s = specOf(p); return estimateSteps(s.steps, s.resistance); });
      return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    };
    expect(avg(0, 3)).toBeLessThan(avg(7, 14));
  });

  it('the worked examples read as promised', () => {
    const find = (r: string) => pairs.find(p => p.r === r)!;
    const kinds = (r: string) => specOf(find(r)).steps.map(s => s.kind);
    expect(kinds('hafted_tool')).toEqual(['align', 'wrap', 'hold']);   // drag, align, wrap fibre, tighten
    expect(kinds('lumber')).toEqual(expect.arrayContaining(['strike', 'cut'])); // chop, then cut
    expect(kinds('cart')[0]).toBe('assemble');                          // wheel + axle + wheel + frame
    expect(specOf(find('iron')).steps.map(s => s.kind)).toEqual(expect.arrayContaining(['place', 'heat', 'strike']));
  });

  it('never change what a pair makes: the engine is the only authority', () => {
    // every pair still resolves to its recipe result, whatever the process
    const e = new Engine(db);
    for (const id of db.nodes.map(n => n.id)) (e as unknown as { found: Set<string> }).found.add(id);
    for (const p of pairs) expect(e.recipeFor(p.a, p.b)).toBe(p.r);
  });
});
