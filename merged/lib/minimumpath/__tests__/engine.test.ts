import { expect, test } from '@jest/globals';
import { buildGraph, evidence, isComplete, move, neighbors, recordResult, shortest, startRun, validPath } from '@/lib/minimumpath/engine';
import { content, graph } from '@/lib/minimumpath/content';
import { fresh } from '@/lib/minimumpath/save';
import type { Content, Mission } from '@/lib/minimumpath/types';
const fixture: Content = { ...content, items: [
  { id: 'a', name: 'A', era: '', recipes: [] },
  { id: 'b', name: 'B', era: '', recipes: [['a']] },
  { id: 'c', name: 'C', era: '', recipes: [['a']] },
  { id: 'd', name: 'D', era: '', recipes: [['b', 'c']] },
  { id: 'e', name: 'E', era: '', recipes: [['c']] },
  { id: 'z', name: 'Z', era: '', recipes: [] },
] };
const small = buildGraph(fixture);
const mission: Mission = { id: 't', chapter: '', title: '', briefing: '', start: 'a', target: 'd', via: [], blocked: [], direction: 'both', optimal: 2 };
test('shortest route; all equal shortest solutions count', () => {
  expect(shortest(small, mission)).toEqual(['a', 'b', 'd']);
  expect(validPath(small, mission, ['a', 'c', 'd'], 10)).toBe(true);
});
test('two waypoints require expanded state and may revisit nodes', () => {
  const m = { ...mission, via: ['b', 'e'] };
  const path = shortest(small, m);
  expect(path?.length).toBe(7);
  expect(path && isComplete(m, path)).toBe(true);
});
test('blocked route, one-way links, unreachable and unknown endpoints', () => {
  expect(shortest(small, { ...mission, blocked: ['b'] })).toEqual(['a', 'c', 'd']);
  expect(shortest(small, { ...mission, blocked: ['b', 'c'] })).toBeNull();
  expect(shortest(small, { ...mission, start: 'd', target: 'a', direction: 'forward' })).toBeNull();
  expect(shortest(small, { ...mission, target: 'z' })).toBeNull();
  expect(shortest(small, { ...mission, start: 'unknown', target: 'unknown' })).toBeNull();
});
test('same start target and waypoint-aware hints from current position', () => {
  expect(shortest(small, { ...mission, target: 'a' })).toEqual(['a']);
  expect(shortest(small, { ...mission, via: ['e'] }, ['a', 'c', 'e', 'c'])).toEqual(['c', 'd']);
});
test('recipe evidence retains every companion ingredient; duplicates remain', () => {
  expect(evidence(small, 'b', 'd')).toEqual(['B + C → D']);
  const g = buildGraph({ ...fixture, items: [...fixture.items, { id: 'f', name: 'F', era: '', recipes: [['a', 'a']] }] });
  expect(evidence(g, 'a', 'f')).toEqual(['A + A → F']);
  expect(neighbors(g, mission, 'a').filter(id => id === 'f')).toHaveLength(1);
});
test('cannot teleport, extend a completed route, or exceed path bound', () => {
  const run = startRun(mission);
  expect(move(small, mission, run, 'z', 10)).toBe(run);
  expect(move(small, mission, run, 'b', 1)).toBe(run);
  const done = { ...run, path: ['a', 'b', 'd'] };
  expect(move(small, mission, done, 'c', 10)).toBe(done);
  expect(validPath(small, mission, ['a','b','d','c','d'], 10)).toBe(false);
});
test('best results idempotent; assisted and unassisted stay separate', () => {
  const m = content.missions[0]; const path = shortest(graph, m)!;
  const s = recordResult({ ...fresh(content), run: { missionId: m.id, path, assisted: false } }, m);
  expect(recordResult(s, m)).toBe(s);
  const assisted = recordResult({ ...s, run: { missionId: m.id, path, assisted: true } }, m);
  expect(assisted.records).toHaveLength(2);
});
test('all campaign solutions replay through the actual step API', () => {
  for (const m of content.missions) {
    const path = shortest(graph, m)!;
    let run = startRun(m);
    for (const next of path.slice(1)) run = move(graph, m, run, next, content.limits.maxPath);
    expect(run.path).toEqual(path); expect(isComplete(m, run.path)).toBe(true);
    expect(path.length - 1).toBe(m.optimal);
  }
});
