import { ERA_IDS, FEATURES, featureOfMode, requirementText, ruleHolds, unlockedFor } from '../registry';
import { parseUnlockMemory } from '../store';

describe('unlock rules', () => {
  it('opens nothing for a brand-new player', () => {
    expect(unlockedFor({ made: 0, eraIndex: 0 }).size).toBe(0);
  });

  it('opens the bench-side features by discoveries, in order', () => {
    const at = (made: number) => unlockedFor({ made, eraIndex: 0 });
    expect(at(7).has('archive')).toBe(false);
    expect(at(8).has('archive')).toBe(true);
    expect(at(7).has('graph')).toBe(false);
    expect(at(8).has('graph')).toBe(true);
    expect(at(8).has('quiz')).toBe(true);
    expect(at(8).has('companion')).toBe(true);
    expect(at(12).has('journal')).toBe(true);
    expect(at(19).has('collection')).toBe(false);
    expect(at(20).has('collection')).toBe(true);
    expect(at(20).has('hub')).toBe(true);
    expect(at(20).has('mode:survival')).toBe(true);
    expect(at(20).has('timeline')).toBe(false); // needs an era
  });

  it('keeps the optional layer closed until its milestones', () => {
    expect(unlockedFor({ made: 0, eraIndex: ERA_IDS.indexOf('trade') }).has('eggs')).toBe(true);
    expect(unlockedFor({ made: 0, eraIndex: ERA_IDS.indexOf('metallurgy') }).has('eggs')).toBe(true);
    expect(unlockedFor({ made: 0, eraIndex: ERA_IDS.indexOf('agriculture') }).has('eggs')).toBe(false);
    expect(unlockedFor({ made: 0, eraIndex: ERA_IDS.indexOf('science') }).has('events')).toBe(false); // discoveries too
    expect(unlockedFor({ made: 50, eraIndex: ERA_IDS.indexOf('science') }).has('events')).toBe(true);
    expect(unlockedFor({ made: 50, eraIndex: ERA_IDS.indexOf('trade') }).has('events')).toBe(false);
    expect(unlockedFor({ made: 7, eraIndex: ERA_IDS.indexOf('settlement') }).has('visitors')).toBe(true);
  });

  it('opens the rest era by era and never earlier', () => {
    const era = (id: string) => unlockedFor({ made: 0, eraIndex: ERA_IDS.indexOf(id as never) });
    expect(era('settlement').has('timeline')).toBe(true);
    expect(era('fire').has('timeline')).toBe(false);
    expect(era('agriculture').has('museum')).toBe(true);
    expect(era('civilization').has('mode:civilization')).toBe(true);
    expect(era('civilization').has('mode:archaeology')).toBe(true);
    expect(era('trade').has('trade')).toBe(true);
    expect(era('science').has('lab')).toBe(true);
    expect(era('industry').has('mode:reverse-evolution')).toBe(true);
    expect(era('electric').has('minpath')).toBe(true);
    expect(era('computing').has('mode:alien-archaeology')).toBe(true);
    expect(era('origins').has('mode:alien-archaeology')).toBe(false);
  });

  it('is chronological: the feature list never asks for an earlier era than the one before it', () => {
    let last = -1;
    for (const f of FEATURES) {
      if (f.rule.era === undefined) continue;
      const r = ERA_IDS.indexOf(f.rule.era as never);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it('uses only real era ids, and every feature has a rule', () => {
    for (const f of FEATURES) {
      expect(f.rule.made !== undefined || f.rule.era !== undefined).toBe(true);
      if (f.rule.era) expect(ERA_IDS).toContain(f.rule.era);
    }
  });

  it('a late player has everything', () => {
    expect(unlockedFor({ made: 900, eraIndex: ERA_IDS.length - 1 }).size).toBe(FEATURES.length);
  });

  it('an empty rule always holds, an unknown era never does', () => {
    expect(ruleHolds({}, { made: 0, eraIndex: 0 })).toBe(true);
    expect(ruleHolds({ era: 'nope' }, { made: 99, eraIndex: 99 })).toBe(false);
  });

  it('maps a mode to its feature', () => {
    expect(featureOfMode('main-evolution')).toBeNull();
    expect(featureOfMode('minimum-path')).toBe('minpath');
    expect(featureOfMode('survival')).toBe('mode:survival');
  });

  it('says what is still needed', () => {
    const f = FEATURES.find(x => x.id === 'graph')!;
    expect(requirementText(f, id => id)).toBe('Make 8 discoveries');
    const m = FEATURES.find(x => x.id === 'museum')!;
    expect(requirementText(m, id => `the ${id} era`)).toBe('Reach the agriculture era');
  });
});

describe('unlock memory', () => {
  it('survives garbage', () => {
    expect(parseUnlockMemory(null).told).toEqual([]);
    expect(parseUnlockMemory('{nope').opened).toEqual([]);
    expect(parseUnlockMemory('{"told":["graph",5],"opened":"x"}')).toEqual({ v: 1, told: ['graph'], opened: [] });
  });
});
