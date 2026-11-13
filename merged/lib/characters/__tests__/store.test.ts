import { CREW_KEY, DEFAULT_SETTINGS, blankSave, crewStore, sanitize } from '../store';
import { earnedCrew, ruleHolds, CHARACTERS, ERA_ORDER } from '../registry';

beforeEach(() => { localStorage.clear(); crewStore._reset(); });

describe('crew save', () => {
  it('falls back to defaults on corrupt or old data and never throws', () => {
    for (const bad of [null, 5, 'x', [], { unlocked: 4, settings: 7 }, { v: 99, settings: { enabled: 'yes' } }]) {
      const s = sanitize(bad);
      expect(s.unlocked.kip).toBeDefined();
      expect(s.settings.enabled).toBe(true);
    }
    localStorage.setItem(CREW_KEY, '{not json');
    expect(crewStore.get().settings).toEqual(DEFAULT_SETTINGS);
  });
  it('never reads or writes any other save key', () => {
    localStorage.setItem('evo.sandbox.v1', 'MAIN'); localStorage.setItem('evo.retention.v1', 'RET'); localStorage.setItem('evo.survival.v1', 'SURV');
    crewStore.setSettings({ dialogue: false }); crewStore.unlock('vex'); crewStore.bump('kip>vex', 'trust');
    expect(localStorage.getItem('evo.sandbox.v1')).toBe('MAIN');
    expect(localStorage.getItem('evo.retention.v1')).toBe('RET');
    expect(localStorage.getItem('evo.survival.v1')).toBe('SURV');
    expect(localStorage.getItem(CREW_KEY)).toContain('"dialogue":false');
  });
  it('unlocks once and survives a reload', () => {
    expect(crewStore.unlock('vex', 123)).toBe(true);
    expect(crewStore.unlock('vex', 456)).toBe(false);
    crewStore._reset();
    expect(crewStore.get().unlocked.vex).toBe(123);
  });
  it('persists each toggle independently', () => {
    crewStore.setSettings({ enabled: false, objectPranks: false, answerPranks: false, autonomousTurns: false, ambientSkits: false, dialogue: false, reducedMotion: true });
    crewStore.setCharacterEnabled('orra', false);
    crewStore._reset();
    const s = crewStore.get().settings;
    expect([s.enabled, s.objectPranks, s.answerPranks, s.autonomousTurns, s.ambientSkits, s.dialogue, s.reducedMotion, s.perCharacter.orra]).toEqual([false, false, false, false, false, false, true, false]);
  });
  it('resetting history clears only relationships', () => {
    crewStore.bump('vex>kip', 'debt'); crewStore.unlock('orra'); crewStore.resetRelationships();
    expect(crewStore.get().affinity).toEqual({}); expect(crewStore.get().unlocked.orra).toBeDefined();
  });
  it('blank save has Kip present from the start', () => { expect(blankSave().unlocked.kip).toBe(0); });
});

describe('unlock rules', () => {
  it('Kip at the start, Vex at 20 discoveries, Orra on reaching the Civilization era', () => {
    expect(earnedCrew({ made: 0, eraIndex: 0 })).toEqual(['kip']);
    expect(earnedCrew({ made: 19, eraIndex: 3 })).toEqual(['kip']);
    expect(earnedCrew({ made: 20, eraIndex: 0 })).toEqual(['kip', 'vex']);
    const civ = ERA_ORDER.indexOf('civilization');
    expect(earnedCrew({ made: 5, eraIndex: civ })).toEqual(['kip', 'orra']);
    expect(earnedCrew({ made: 30, eraIndex: civ })).toEqual(['kip', 'vex', 'orra']);
    expect(ruleHolds(CHARACTERS.orra.unlock, { made: 999, eraIndex: civ - 1 })).toBe(false);
  });
});
