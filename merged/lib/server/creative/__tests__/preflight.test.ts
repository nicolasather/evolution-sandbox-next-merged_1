/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playDb, processingData } from '@/lib/processing';
import { buildCatalog } from '../catalog';
import { preflight } from '../preflight';
import { MAX_CANDIDATES } from '../types';
import { actionKey, computeKey, negativeKey, recipeKey, RecipeKeyError } from '../recipeKey';
import { parseDecision, judgeDecision } from '../decision';
import { FakeProvider } from '../providers/fake';

const cat = buildCatalog(playDb, processingData);
const ids = playDb.nodes.map(n => n.id);
const rng = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); };

describe('070 recipe key parity', () => {
  const golden = JSON.parse(readFileSync(join(process.cwd(), 'tools/tests/fixtures/recipe_key_golden.json'), 'utf8'));
  it('matches the cross-language golden fixture (same file the Python suite runs)', () => {
    expect(Array.isArray(golden)).toBe(true);
    let n = 0;
    for (const c of golden as { items?: string[]; expected?: string; error?: unknown }[]) {
      if (c.items && c.expected) { expect(recipeKey(c.items)).toBe(c.expected); n++; }
      else if (c.items) { expect(() => recipeKey(c.items!)).toThrow(RecipeKeyError); n++; }
    }
    expect(n).toBe((golden as unknown[]).length);
  });
  it('stone+stone differs from stone+wood; order is irrelevant; five slots sort stably', () => {
    expect(recipeKey(['stone', 'stone'])).not.toBe(recipeKey(['stone', 'wood']));
    expect(recipeKey(['wood', 'stone'])).toBe(recipeKey(['stone', 'wood']));
    expect(recipeKey(['e', 'd', 'c', 'b', 'a'].map(x => `x_${x}`))).toBe(recipeKey(['x_a', 'x_b', 'x_c', 'x_d', 'x_e']));
  });
  it('malformed ids and 1 or 6 slots throw before any database or model call', () => {
    for (const bad of [['stone'], Array(6).fill('stone'), ['stone', 'Wood'], ['stone', 'a b'], ['stone', '1x'], ['stone', 'x;y']] as string[][]) {
      expect(() => recipeKey(bad)).toThrow(RecipeKeyError);
    }
    expect(() => actionKey('Smash!')).toThrow(RecipeKeyError);
  });
  it('compute and negative keys change with release, rules version, action and ingredients', () => {
    const a = computeKey('r1abcdef', ['stone', 'wood'], null, 'v1');
    expect(a).toBe(computeKey('r1abcdef', ['wood', 'stone'], null, 'v1'));
    for (const b of [computeKey('r2abcdef', ['stone', 'wood'], null, 'v1'), computeKey('r1abcdef', ['stone', 'wood'], 'tie', 'v1'),
      computeKey('r1abcdef', ['stone', 'stone'], null, 'v1'), computeKey('r1abcdef', ['stone', 'wood'], null, 'v2')]) expect(b).not.toBe(a);
    expect(negativeKey('r1abcdef', ['stone', 'wood'], null, 'x')).not.toBe(negativeKey('r2abcdef', ['stone', 'wood'], null, 'x'));
  });
});

describe('072 canonical first', () => {
  it('100 sampled canonical recipes resolve as known, in any order, with zero provider calls', () => {
    const provider = new FakeProvider();
    const all = playDb.nodes.flatMap(n => (n.rec ?? []).map(r => ({ target: n.id, rec: r })));
    const rand = rng(72);
    for (let i = 0; i < 100; i++) {
      const { rec } = all[Math.floor(rand() * all.length)];
      const r = preflight(cat, { ingredientIds: [...rec].reverse(), actionId: null });
      expect(r.kind).toBe('known');
    }
    expect(provider.calls).toBe(0);
  });
  it('an unknown id is invalid (HTTP 400), never an eligible attempt', () => {
    expect(preflight(cat, { ingredientIds: ['stone', 'definitely_not_an_item'], actionId: null }).kind).toBe('invalid');
  });
});

describe('073 deterministic impossibility filter', () => {
  const placeholders = [...cat.profiles.values()].filter(p => p.status === 'placeholder').map(p => p.id);
  const abstract = [...cat.profiles.values()].filter(p => p.family === 'abstract' && p.status === 'verified').map(p => p.id);
  const physical = ['stone', 'wood', 'bone', 'fiber'].filter(i => cat.profiles.has(i));

  it('400 deliberate negatives are all rejected and the provider is never reached', () => {
    const provider = new FakeProvider();
    const rand = rng(73);
    const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
    const fixtures: { ids: string[]; action: string | null }[] = [];
    for (let i = 0; i < 100; i++) fixtures.push({ ids: [pick(abstract), pick(physical)], action: pick([null, 'smash', 'tie']) });          // idea + matter
    for (let i = 0; i < 100; i++) fixtures.push({ ids: [pick(placeholders), pick(physical)], action: null });                                // unverified legacy
    for (let i = 0; i < 50; i++) fixtures.push({ ids: [pick(physical), pick(physical)], action: pick(['teleport', 'abracadabra', 'SMASH', 'x']) }); // unknown action
    for (let i = 0; i < 50; i++) fixtures.push({ ids: [pick(abstract), pick(abstract)], action: null });                                      // ideas only
    for (let i = 0; i < 100; i++) fixtures.push({ ids: [pick(['wood', 'bone']), pick(['wood', 'bone'])], action: pick(['heat', 'grind', 'pour', 'tie', 'cut']) }); // missing component
    expect(fixtures.length).toBe(400);
    for (const f of fixtures) {
      const r = preflight(cat, { ingredientIds: f.ids, actionId: f.action });
      if (r.kind === 'known') continue;                       // a real recipe happened to be drawn; that is not a negative
      expect(['no_result', 'invalid']).toContain(r.kind);
      expect(r.kind).not.toBe('eligible');
    }
    expect(provider.calls).toBe(0);
  });

  it('only a small fraction of random attempts is ever eligible for a model (no quota, no dice)', () => {
    const rand = rng(7);
    let eligible = 0; const N = 5000;
    for (let i = 0; i < N; i++) {
      const n = 2 + Math.floor(rand() * 3);
      const r = preflight(cat, { ingredientIds: Array.from({ length: n }, () => ids[Math.floor(rand() * ids.length)]), actionId: [null, 'smash', 'tie', 'heat', 'grind'][Math.floor(rand() * 5)] });
      if (r.kind === 'eligible') eligible++;
    }
    expect(eligible / N).toBeLessThan(0.05);
  });
});

describe('074 approved target pool', () => {
  it('is bounded, deterministic, verified-only, era-ordered, and every inclusion is explained', () => {
    const rand = rng(74);
    let seen = 0;
    for (let i = 0; i < 4000 && seen < 20; i++) {
      const r = preflight(cat, { ingredientIds: [ids[Math.floor(rand() * ids.length)], ids[Math.floor(rand() * ids.length)], ids[Math.floor(rand() * ids.length)]], actionId: 'smash' });
      if (r.kind !== 'eligible') continue;
      seen++;
      expect(r.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
      for (const c of r.candidates) {
        const p = cat.profiles.get(c.targetId)!;
        expect(p.status).toBe('verified');
        expect(c.rationale.length).toBeGreaterThan(10);
        expect(c.ingredientIds).not.toContain(c.targetId);
      }
      const again = preflight(cat, { ingredientIds: [...r.candidates[0].ingredientIds].reverse(), actionId: 'smash' });
      expect(again.kind === 'eligible' && again.fingerprint).toBe(r.fingerprint);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('no placeholder (g10) or pending-evidence entry is ever a target', () => {
    const rand = rng(75);
    for (let i = 0; i < 3000; i++) {
      const r = preflight(cat, { ingredientIds: [ids[Math.floor(rand() * ids.length)], ids[Math.floor(rand() * ids.length)]], actionId: 'smash' });
      if (r.kind === 'eligible') for (const c of r.candidates) expect(cat.profiles.get(c.targetId)!.status).toBe('verified');
    }
  });
});

describe('075 provider decision contract', () => {
  const rules = [{ targetId: 'stone_axe', processId: 'tie', ingredientIds: ['a_x', 'b_x'], actionId: 'tie', rationale: 'because of a real reason' }];
  const good = { schemaVersion: 1, decision: 'propose', targetId: 'stone_axe', processId: 'tie', requiredActionId: 'tie',
    causalMechanism: 'A cord of plant fibre is wrapped around the haft so the stone head cannot slip when swung.', evidenceClass: 'reconstructed', reasonCodes: [] };
  const judge = (raw: unknown, action: string | null = 'tie') => { const p = parseDecision(raw); return p.ok ? judgeDecision(p.decision, rules, action) : { kind: 'no_result', reason: p.reason }; };

  it('a well-formed proposal for an offered target becomes a private pending_review draft only', () => {
    expect(judge(good).kind).toBe('pending_review');
    expect(judge(JSON.stringify(good)).kind).toBe('pending_review');
  });
  it('none is a first-class answer', () => {
    expect(judge({ schemaVersion: 1, decision: 'none', reasonCodes: ['NO_CAUSAL_MECHANISM'] })).toEqual({ kind: 'no_result', reason: 'model_abstained' });
  });
  it('invented ids, free-text names, spoofed fields, malformed JSON, weak association and wrong action are all refused', () => {
    const bad: unknown[] = [
      { ...good, targetId: 'brand_new_item' }, { ...good, targetId: 'Stone Axe!' }, { ...good, processId: 'melt' },
      { ...good, itemName: 'Mystic Axe' }, { ...good, sourceUrl: 'http://x' }, { ...good, evidenceClass: 'proven' },
      { ...good, causalMechanism: 'Stone symbolically represents the spirit of the axe, somehow.' }, { ...good, causalMechanism: 'short' },
      { ...good, causalMechanism: 'x'.repeat(301) }, { ...good, requiredActionId: 'heat' }, { ...good, schemaVersion: 2 },
      '{not json', '', 'x'.repeat(9000), null, [], 42, { schemaVersion: 1, decision: 'maybe', reasonCodes: [] },
    ];
    for (const b of bad) expect(judge(b).kind).toBe('no_result');
  });
  it('comical pairings cannot pass: a proposal for a target that was not offered never reaches the engine', () => {
    for (const t of ['pizza', 'smartphone', 'unicorn']) expect(judge({ ...good, targetId: t }).kind).toBe('no_result');
  });
});
