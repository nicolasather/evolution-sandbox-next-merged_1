import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import { applyProcessing } from '@/lib/processing/overlay';
import { TECHNIQUES, TECH_ORDER, TECH_BY_ID } from '@/lib/processing/techniques';
import {
  compareChronological,
  sortChronological,
  sortDiscoveries,
  discoveryConfidence,
  resolveStateChronology,
  sortTechniquesChronologically,
  describeTechniqueOrigin,
  bandOf,
  TECHNIQUE_BANDS,
  type Chronological,
  type ChronologyKind,
  type ChronologyConfidence,
} from '@/lib/chronology';
import type { ProcessingData } from '@/lib/processing/types';
import type { Db } from '@/lib/types';

const data = processingJson as unknown as ProcessingData;
const db = applyProcessing(rawDb as unknown as Db, data);

/* ============================================================================
   These tests are about the central comparator and the data it derives from —
   the ONE thing every screen (Timeline/Graph/Archive/Inventory/Rail/Tutor) now
   shares instead of inventing its own order. Component-level rendering checks
   live beside each component's own test file; this file is about the rule
   itself being correct, deterministic, and honestly typed.
   ========================================================================== */

describe('compareChronological / sortChronological', () => {
  it('orders strictly by ds first, oldest first', () => {
    const a: Chronological = { id: 'a', ds: -100 };
    const b: Chronological = { id: 'b', ds: -50 };
    expect(compareChronological(a, b)).toBeLessThan(0);
    expect(compareChronological(b, a)).toBeGreaterThan(0);
    expect(sortChronological([b, a])).toEqual([a, b]);
  });

  it('breaks a ds tie by depth (dependency order), never by array position', () => {
    const a: Chronological = { id: 'z_ingredient', ds: 0, depth: 1 };
    const b: Chronological = { id: 'a_result', ds: 0, depth: 2 };
    // b depends on a's depth being lower, even though "z" would sort after "a" alphabetically
    expect(sortChronological([b, a])).toEqual([a, b]);
  });

  it('breaks a ds+depth tie by catalogue number, then finally by id — fully deterministic', () => {
    const a: Chronological = { id: 'b', ds: 0, depth: 1, no: 5 };
    const b: Chronological = { id: 'a', ds: 0, depth: 1, no: 9 };
    expect(sortChronological([b, a])).toEqual([a, b]); // no: 5 before 9
    const c: Chronological = { id: 'z', ds: 0, depth: 1 };
    const d: Chronological = { id: 'a', ds: 0, depth: 1 };
    expect(sortChronological([c, d])).toEqual([d, c]); // no ds/depth/no left — id decides, still deterministic
  });

  it('never lets a missing depth or catalogue number sort before a real one', () => {
    const withDepth: Chronological = { id: 'known', ds: 0, depth: 0 };
    const withoutDepth: Chronological = { id: 'unknown', ds: 0 };
    expect(sortChronological([withoutDepth, withDepth])).toEqual([withDepth, withoutDepth]);
  });

  it('sortChronological never mutates its input', () => {
    const items: Chronological[] = [{ id: 'b', ds: 5 }, { id: 'a', ds: 1 }];
    const copy = items.slice();
    sortChronological(items);
    expect(items).toEqual(copy);
  });
});

describe('sortDiscoveries on the real, built catalogue', () => {
  it('produces a fully ds-ascending sequence across all 322+ discoveries, era notwithstanding', () => {
    const sorted = sortDiscoveries(db.nodes);
    expect(sorted).toHaveLength(db.nodes.length);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].ds).toBeGreaterThanOrEqual(sorted[i - 1].ds);
    }
  });

  it('is a pure reordering — no discovery gained or lost', () => {
    const sorted = sortDiscoveries(db.nodes);
    expect(new Set(sorted.map(n => n.id))).toEqual(new Set(db.nodes.map(n => n.id)));
  });

  it('does NOT use era as a sort key: two adjacent eras with overlapping real ranges interleave', () => {
    // Find two distinct eras whose ds ranges actually overlap in the authored data.
    const byEra = new Map<string, number[]>();
    for (const n of db.nodes) (byEra.get(n.era) ?? byEra.set(n.era, []).get(n.era)!).push(n.ds);
    const ranges = [...byEra.entries()].map(([era, ds]) => ({ era, min: Math.min(...ds), max: Math.max(...ds) }));
    const overlap = ranges.find((r1, i) => ranges.slice(i + 1).some(r2 => r1.min < r2.max && r2.min < r1.max));
    expect(overlap).toBeDefined(); // the premise of the whole feature: eras genuinely overlap here
    const sorted = sortDiscoveries(db.nodes);
    const erasInOrder = sorted.map(n => n.era);
    const distinctRuns = erasInOrder.filter((e, i) => i === 0 || erasInOrder[i - 1] !== e).length;
    // if era were a sort key, there would be exactly one run per era — with real overlap there is more
    expect(distinctRuns).toBeGreaterThan(new Set(erasInOrder).size);
  });
});

describe('discoveryConfidence', () => {
  it('flags source_required and nothing else', () => {
    expect(discoveryConfidence({ src: ['source_required', 'x'] })).toBe('source_required');
    expect(discoveryConfidence({ src: ['x', 'y'] })).toBe('verified');
    expect(discoveryConfidence({ src: [] })).toBe('verified');
  });
});

describe('resolveStateChronology', () => {
  it('anchors a state to the EARLIEST of several producing routes, not the latest', () => {
    const dsOf = (id: string) => ({ early_material: -100, late_material: -10 } as Record<string, number>)[id];
    const resolved = resolveStateChronology({
      states: [{ id: 'some_state' }],
      transforms: [
        { from: 'late_material', out: ['some_state'] },
        { from: 'early_material', out: ['some_state'] },
      ],
      unlocks: [],
      dsOf,
    });
    expect(resolved.get('some_state')).toBe(-100);
  });

  it('resolves a state that depends on another state, by fixed point', () => {
    const dsOf = (id: string) => ({ clay: -12000 } as Record<string, number>)[id];
    const resolved = resolveStateChronology({
      states: [{ id: 'wet_clay' }, { id: 'shaped_clay' }],
      transforms: [
        { from: 'clay', out: ['wet_clay'] },
        { from: 'wet_clay', out: ['shaped_clay'] },
      ],
      unlocks: [],
      dsOf,
    });
    expect(resolved.get('wet_clay')).toBe(-12000);
    expect(resolved.get('shaped_clay')).toBe(-12000);
  });

  it('takes the min across an "any" unlock and the max across an "all" unlock', () => {
    const dsOf = (id: string) => ({ a: -100, b: -50 } as Record<string, number>)[id];
    const anyResolved = resolveStateChronology({
      states: [{ id: 's' }],
      transforms: [],
      unlocks: [{ when: ['a', 'b'], any: true, give: 's' }],
      dsOf,
    });
    expect(anyResolved.get('s')).toBe(-100); // earliest branch of an OR gate
    const allResolved = resolveStateChronology({
      states: [{ id: 's' }],
      transforms: [],
      unlocks: [{ when: ['a', 'b'], give: 's' }],
      dsOf,
    });
    expect(allResolved.get('s')).toBe(-50); // an AND gate needs the LAST of its own requirements
  });

  it('resolves every real authored state against the actual processing data, with no leftovers', () => {
    const byId = new Map(db.nodes.map(n => [n.id, n]));
    const resolved = resolveStateChronology({
      states: data.states,
      transforms: data.transforms,
      unlocks: data.unlocks,
      dsOf: id => byId.get(id)?.ds,
    });
    for (const s of data.states) expect(resolved.has(s.id)).toBe(true);
  });
});

describe('the 25 techniques carry honest chronology metadata', () => {
  const validKinds: ChronologyKind[] = ['foundational', 'earliest_evidence', 'approximate', 'derived', 'debated', 'dated'];
  const validConfidence: ChronologyConfidence[] = ['verified', 'provisional', 'source_required'];

  it('every technique has a well-typed, non-fabricated chronology block', () => {
    for (const t of TECHNIQUES) {
      expect(typeof t.chronology.sortDs).toBe('number');
      expect(Number.isFinite(t.chronology.sortDs)).toBe(true);
      expect(validKinds).toContain(t.chronology.kind);
      expect(validConfidence).toContain(t.chronology.confidence);
      expect(t.chronology.basis.length).toBeGreaterThan(0);
      expect(t.chronology.label.length).toBeGreaterThan(0);
    }
  });

  it('never prints a bare year unless kind is genuinely "dated"', () => {
    for (const t of TECHNIQUES) {
      const text = describeTechniqueOrigin(t.chronology);
      if (t.chronology.kind !== 'dated') expect(text).not.toMatch(/^\d/);
    }
  });

  it('TECH_ORDER is exactly sortDs-ascending, ties kept in original catalogue order', () => {
    for (let i = 1; i < TECH_ORDER.length; i++) {
      const prev = TECH_BY_ID[TECH_ORDER[i - 1]].chronology.sortDs;
      const cur = TECH_BY_ID[TECH_ORDER[i]].chronology.sortDs;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
    expect(new Set(TECH_ORDER).size).toBe(TECHNIQUES.length);
    expect(sortTechniquesChronologically(TECHNIQUES).map(t => t.id)).toEqual(TECH_ORDER);
  });

  it('every technique lands in exactly one display band, and bands cover the whole range', () => {
    for (const t of TECHNIQUES) {
      const band = bandOf(t.chronology.sortDs);
      expect(TECHNIQUE_BANDS).toContain(band);
      expect(t.chronology.sortDs).toBeGreaterThanOrEqual(band.from);
      expect(t.chronology.sortDs).toBeLessThan(band.to === Infinity ? Infinity : band.to);
    }
  });

  it('the saw technique is anchored at metal sawing, not generic ancient stone sawing', () => {
    // this game's `saw` gameplay-gates on a metal blade (unlock.cap) — its chronology must say so.
    expect(TECH_BY_ID.saw.unlock.cap).toBe('metalblade');
    expect(TECH_BY_ID.saw.chronology.sortDs).toBeGreaterThan(-10_000);
  });

  it('a technique this game treats as steady controlled heat is not dated to raw/first fire', () => {
    expect(TECH_BY_ID.heat.chronology.sortDs).toBeGreaterThan(TECH_BY_ID.burn.chronology.sortDs);
  });
});
