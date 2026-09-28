import { buildGraph } from '@/lib/minpath/graph';
import { findCompletingPath } from '@/lib/minpath/modifiers';
import { pickVariantChallenge } from '@/lib/minpath/variantChallenge';
import { hubIds, pathLeansOnHub } from '@/lib/minpath/validate';
import { createRng } from '@/lib/seed';
import { playDb } from '@/lib/processing';
import type { ModifierKind } from '@/lib/minpath/modifiers';

const KINDS: ModifierKind[] = ['no-backtracking', 'chronological-only', 'exactly-n-clicks', 'visit-an-era'];
const graph = buildGraph(playDb);
const hubs = hubIds(graph);

describe('pickVariantChallenge', () => {
  it('is deterministic for the same seed and modifier kind', () => {
    for (const kind of KINDS) {
      const a = pickVariantChallenge(playDb, createRng(`repeat-${kind}`), kind);
      const b = pickVariantChallenge(playDb, createRng(`repeat-${kind}`), kind);
      expect(a).toEqual(b);
    }
  });

  it('every generated challenge, for every modifier kind, is provably solvable — checked across many seeds', () => {
    for (const kind of KINDS) {
      for (let i = 0; i < 15; i++) {
        const c = pickVariantChallenge(playDb, createRng(`solvable-${kind}-${i}`), kind);
        expect(c).not.toBeNull();
        const found = findCompletingPath(playDb, graph, c!.startId, c!.targetId, c!.modifier, c!.optimalLength + 4);
        expect(found).not.toBeNull();
        expect(found!.length - 1).toBe(c!.optimalLength);
      }
    }
  });

  it('never hands out a start/target pair that leans on a hub shortcut', () => {
    for (const kind of KINDS) {
      for (let i = 0; i < 10; i++) {
        const c = pickVariantChallenge(playDb, createRng(`hub-${kind}-${i}`), kind);
        expect(c).not.toBeNull();
        const found = findCompletingPath(playDb, graph, c!.startId, c!.targetId, c!.modifier, c!.optimalLength + 4)!;
        expect(pathLeansOnHub(found, hubs)).toBe(false);
      }
    }
  });

  it('exactly-n-clicks challenges always carry a positive click target', () => {
    for (let i = 0; i < 10; i++) {
      const c = pickVariantChallenge(playDb, createRng(`n-check-${i}`), 'exactly-n-clicks');
      expect(c).not.toBeNull();
      const modifier = c!.modifier;
      expect(modifier.kind).toBe('exactly-n-clicks');
      if (modifier.kind === 'exactly-n-clicks') expect(modifier.n).toBeGreaterThan(0);
    }
  });

  it('visit-an-era challenges name a real era that a solving path genuinely passes through', () => {
    for (let i = 0; i < 10; i++) {
      const c = pickVariantChallenge(playDb, createRng(`era-check-${i}`), 'visit-an-era');
      expect(c).not.toBeNull();
      const modifier = c!.modifier;
      expect(modifier.kind).toBe('visit-an-era');
      if (modifier.kind !== 'visit-an-era') continue;
      const found = findCompletingPath(playDb, graph, c!.startId, c!.targetId, modifier, c!.optimalLength + 4)!;
      const byId = new Map(playDb.nodes.map(n => [n.id, n]));
      expect(found.some(id => byId.get(id)?.era === modifier.era)).toBe(true);
    }
  });

  it('visit-an-era never names the start\'s or the target\'s own era — the modifier must demand a real detour, not be satisfied for free', () => {
    for (let i = 0; i < 30; i++) {
      const c = pickVariantChallenge(playDb, createRng(`era-waypoint-${i}`), 'visit-an-era');
      expect(c).not.toBeNull();
      const modifier = c!.modifier;
      expect(modifier.kind).toBe('visit-an-era');
      if (modifier.kind !== 'visit-an-era') continue;
      const byId = new Map(playDb.nodes.map(n => [n.id, n]));
      const startEra = byId.get(c!.startId)?.era;
      const targetEra = byId.get(c!.targetId)?.era;
      expect(modifier.era).not.toBe(startEra);
      expect(modifier.era).not.toBe(targetEra);
    }
  });
});
