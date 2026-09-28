import { generateRun } from '@/lib/reverseevolution/generate';
import { applyAction, isBudgetCapped } from '@/lib/reverseevolution/simulate';
import { playDb } from '@/lib/processing';
import type { ReverseRunState } from '@/lib/reverseevolution/types';

function currentNode(state: ReverseRunState) {
  return state.nodes[state.pendingQueue[0]];
}

describe('applyAction (reverse evolution)', () => {
  it('does not mutate the input state (pure)', () => {
    const s = generateRun(playDb, 'purity-check', 'smartphone');
    const before = JSON.stringify(s);
    applyAction(playDb, s, { kind: 'reveal' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('a correct submission marks the node correct and expands its real children', () => {
    const s = generateRun(playDb, 'correct-check', 'smartphone');
    const target = playDb.nodes.find(n => n.id === 'smartphone')!;
    const real = target.rec[0];
    const r = applyAction(playDb, s, { kind: 'submit', selectedIds: real });
    expect(r.state.nodes.n0.status).toBe('correct');
    expect(r.state.correctCount).toBe(1);
    expect(r.state.nodes.n0.childKeys.length).toBeGreaterThan(0);
    // every child corresponds to a real ingredient id
    const childDiscoveryIds = r.state.nodes.n0.childKeys.map(k => r.state.nodes[k].discoveryId);
    expect(childDiscoveryIds.sort()).toEqual([...real].sort());
  });

  it('a wrong submission still reveals the real recipe and expands into it', () => {
    const s = generateRun(playDb, 'wrong-check', 'smartphone');
    const wrongGuess = s.nodes.n0.optionIds!.filter(id => !playDb.nodes.find(n => n.id === 'smartphone')!.rec[0].includes(id)).slice(0, 2);
    const r = applyAction(playDb, s, { kind: 'submit', selectedIds: wrongGuess });
    expect(r.state.nodes.n0.status).toBe('revealed');
    expect(r.state.revealedCount).toBe(1);
    expect(r.state.nodes.n0.childKeys.length).toBeGreaterThan(0);
  });

  it('reveal has the same effect as a wrong answer, without requiring a guess', () => {
    const s = generateRun(playDb, 'reveal-check', 'smartphone');
    const r = applyAction(playDb, s, { kind: 'reveal' });
    expect(r.state.nodes.n0.status).toBe('revealed');
    expect(r.state.revealedCount).toBe(1);
  });

  it('primitive ingredients become terminal leaves, never a new question', () => {
    // "Sharp Stone" is real, shallow, and made directly from a primitive
    // (Stone) — generateRun works for any real non-terminal id, not just
    // the UI's curated deep-target catalog, which is the right target for
    // testing this specific, shallow structural property.
    const target = playDb.nodes.find(n => n.id === 'sharp_stone')!;
    expect(target.rec[0].every(id => playDb.nodes.find(n => n.id === id)?.primitive)).toBe(true);
    const s = generateRun(playDb, 'leaf-check', 'sharp_stone');
    const r = applyAction(playDb, s, { kind: 'submit', selectedIds: target.rec[0] });
    const primitiveNodes = Object.values(r.state.nodes).filter(n => n.status === 'primitive');
    for (const p of primitiveNodes) {
      const d = playDb.nodes.find(n => n.id === p.discoveryId)!;
      expect(d.primitive).toBe(true);
      expect(p.childKeys).toEqual([]);
    }
    expect(primitiveNodes.length).toBeGreaterThan(0);
    expect(r.state.ending).toBe('complete');
  });

  it('a recipe that repeats an ingredient (e.g. Stone + Stone) is treated as one distinct branch, not two', () => {
    const target = playDb.nodes.find(n => n.id === 'sharp_stone')!;
    expect(new Set(target.rec[0]).size).toBeLessThan(target.rec[0].length); // confirms it really does repeat
    const s = generateRun(playDb, 'dedup-check', 'sharp_stone');
    expect(new Set(s.nodes.n0.optionIds).size).toBe(s.nodes.n0.optionIds!.length); // no duplicate option ids
    const r = applyAction(playDb, s, { kind: 'submit', selectedIds: [...new Set(target.rec[0])] });
    expect(r.state.nodes.n0.status).toBe('correct');
    expect(r.state.nodes.n0.childKeys.length).toBe(new Set(target.rec[0]).size);
  });

  it('an all-correct run through to completion never exceeds the node budget', () => {
    let s = generateRun(playDb, 'budget-check', 'grand_theft_auto_vi');
    let guard = 0;
    while (s.ending === 'ongoing' && guard++ < 50) {
      const node = currentNode(s);
      const target = playDb.nodes.find(n => n.id === node.discoveryId)!;
      s = applyAction(playDb, s, { kind: 'submit', selectedIds: target.rec[0] }).state;
    }
    expect(s.ending).toBe('complete');
    expect(s.nodesUsed).toBeLessThanOrEqual(s.nodeBudget);
    expect(Object.keys(s.nodes).length).toBeLessThanOrEqual(s.nodeBudget);
  });

  it('does nothing once the run is complete', () => {
    let s = generateRun(playDb, 'closed-check', 'smartphone');
    let guard = 0;
    while (s.ending === 'ongoing' && guard++ < 50) {
      s = applyAction(playDb, s, { kind: 'reveal' }).state;
    }
    const beforeNodeCount = Object.keys(s.nodes).length;
    const r = applyAction(playDb, s, { kind: 'reveal' });
    expect(Object.keys(r.state.nodes).length).toBe(beforeNodeCount);
    expect(r.events[0].text).toMatch(/already complete/i);
  });

  it('a deep target (every curated catalog target) finishes budget-capped, never claiming a genuine raw-material bottom-out', () => {
    let s = generateRun(playDb, 'deep-cap-check', 'smartphone');
    let guard = 0;
    while (s.ending === 'ongoing' && guard++ < 50) {
      s = applyAction(playDb, s, { kind: 'reveal' }).state;
    }
    expect(isBudgetCapped(s)).toBe(true);
    expect(s.log[s.log.length - 1].text).toMatch(/tracing limit/i);
    expect(s.log[s.log.length - 1].text).not.toMatch(/bottoms out in raw materials/i);
  });

  it('a genuinely shallow target bottoms out at real primitives well inside the node budget, not budget-capped', () => {
    const s = generateRun(playDb, 'shallow-check', 'sharp_stone');
    const r = applyAction(playDb, s, { kind: 'reveal' });
    expect(r.state.ending).toBe('complete');
    expect(isBudgetCapped(r.state)).toBe(false);
    expect(r.state.log[r.state.log.length - 1].text).toMatch(/bottoms out in raw materials/i);
  });
});
