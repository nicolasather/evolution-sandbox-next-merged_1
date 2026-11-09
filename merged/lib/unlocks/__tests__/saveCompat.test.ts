import { createEngine } from '@/lib/engine';
import { playDb } from '@/lib/processing';
import { progressOf } from '../useUnlocks';
import { ERA_IDS, unlockedFor } from '../registry';
import { BAND_ERA, bandOpen } from '../techniqueGate';

/* Save compatibility: every unlock is DERIVED from the engine's discoveries, so an existing save
   (which only stores discoveries) gives the same unlocks it always did. Nothing here is stored. */

describe('progression is derived from the engine, so old saves keep their place', () => {
  it('a new player has made no discoveries and opens nothing', () => {
    const engine = createEngine(playDb);
    expect(progressOf(engine).made).toBe(0);
    expect(unlockedFor(progressOf(engine)).size).toBe(0);
  });

  it('the four starting materials never count as discoveries', () => {
    const engine = createEngine(playDb);
    // the primitives are already in `found`; only the discoveries beyond them count
    expect(engine.found.size).toBe(playDb.primitives.length);
    expect(progressOf(engine).made).toBe(0);
  });

  it('a returning player with existing discoveries gets exactly the unlocks those discoveries earn', () => {
    const engine = createEngine(playDb);
    const discoveries = engine.db.nodes.filter(n => !playDb.primitives.includes(n.id) && !n.hidden).slice(0, 25);
    for (const n of discoveries) engine.found.add(n.id);
    const p = progressOf(engine);
    expect(p.made).toBe(25);
    const earned = unlockedFor(p);
    expect(earned.has('archive')).toBe(true);
    expect(earned.has('collection')).toBe(true);
    expect(earned.has('hub')).toBe(true);
    // era-gated features still need the era, not just the count
    expect(earned.has('timeline')).toBe(p.eraIndex >= ERA_IDS.indexOf('settlement'));
  });

  it('a discovery count alone never opens an era-gated feature', () => {
    const p = { made: 999, eraIndex: 0 };
    const earned = unlockedFor(p);
    expect(earned.has('museum')).toBe(false);
    expect(earned.has('lab')).toBe(false);
    expect(earned.has('events')).toBe(false); // needs Science too
  });
});

describe('technique bands: the early loop stays open, later techniques wait for their era', () => {
  it('the first two bands are always open', () => {
    expect(bandOpen('foundational', 0)).toBe(true);
    expect(bandOpen('first_tools', 0)).toBe(true);
  });

  it('a later band opens once its era has been reached, and not before', () => {
    const fire = ERA_IDS.indexOf(BAND_ERA.fire_shaping as (typeof ERA_IDS)[number]);
    expect(bandOpen('fire_shaping', fire - 1)).toBe(false);
    expect(bandOpen('fire_shaping', fire)).toBe(true);
    expect(bandOpen('metallurgy', ERA_IDS.indexOf('agriculture'))).toBe(false);
    expect(bandOpen('metallurgy', ERA_IDS.indexOf('metallurgy'))).toBe(true);
  });

  it('an unknown band never hides a technique', () => {
    expect(bandOpen('not-a-band', 0)).toBe(true);
  });
});
