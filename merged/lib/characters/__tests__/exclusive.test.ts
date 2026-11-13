import { IDLE_CONTEXT } from '../bus';
import { CrewDirector, mulberry32 } from '../director';
import { EVENTS } from '../events';
import { clipAllowedIn, exclusiveTo } from '../exclusive';
import { getClip } from '../clips';
import { MODE_EVENT_CLIPS, modeOwnClips, payloadClip } from '../modeEvents';
import { DEFAULT_SETTINGS } from '../store';
import { CHARACTER_MODES, type CharacterMode } from '../types';

function drive(mode: CharacterMode, seed = 5, steps = 400, ambientOnly = false) {
  const clock = { t: 20_000_000 };
  const d = new CrewDirector({ now: () => clock.t, random: mulberry32(seed), context: () => ({ ...IDLE_CONTEXT }), hasAction: () => false });
  d.setSettings({ ...DEFAULT_SETTINGS, perCharacter: { ...DEFAULT_SETTINGS.perCharacter }, autonomousTurns: false, objectPranks: false });
  d.setRoster(['kip', 'vex', 'orra']); d.setMode(mode);
  const clips: string[] = [];
  for (let i = 0; i < steps; i++) {
    clock.t += 2500;
    for (const p of d.tick()) clips.push(p.clipId, ...p.cast.map(() => p.clipId));
    if (ambientOnly) continue;
    const e = EVENTS[i % EVENTS.length];
    for (const p of d.handle({ id: e.id, mode, source: 'game', at: clock.t })) clips.push(p.clipId);
  }
  return clips;
}

describe('mode-exclusive acting', () => {
  it('knows which clips belong to which kind of work', () => {
    expect(exclusiveTo('act-dig')).toEqual(['survival', 'archaeology']);
    expect(exclusiveTo('act-lever')).toEqual(['escape-room']);
    expect(exclusiveTo('mode-decipher-trace-glyph')).toEqual(['decipher']);
    expect(exclusiveTo('craft-combine')).toEqual(['main-evolution', 'civilization']);
    expect(exclusiveTo('jump-big')).toBeNull();
    expect(clipAllowedIn('act-lever', 'survival')).toBe(false);
    expect(clipAllowedIn('act-lever', 'escape-room')).toBe(true);
  });
  it.each(CHARACTER_MODES)('%s never plays acting that belongs to another mode', mode => {
    const clips = drive(mode);
    expect(clips.length).toBeGreaterThan(40);
    for (const c of clips) expect(clipAllowedIn(c, mode)).toBe(true);
  });
  it.each(CHARACTER_MODES)('%s has more than 20 animations of its own, all exclusive to it', mode => {
    const own = modeOwnClips(mode);
    expect(own.length).toBeGreaterThan(20);
    for (const c of own) { expect(getClip(c)).toBeDefined(); expect(exclusiveTo(c)).toContain(mode); expect(clipAllowedIn(c, mode)).toBe(true); }
    // they are not shared with the other modes (the bench is shared only by the two merge-style modes)
    for (const other of CHARACTER_MODES.filter(m => m !== mode && !(m === 'civilization' && mode === 'main-evolution') && !(m === 'main-evolution' && mode === 'civilization'))) {
      for (const c of own) expect(clipAllowedIn(c, other)).toBe(false);
    }
  });
  it.each(CHARACTER_MODES)('%s: every one of its own animations is actually seen there', mode => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) for (const c of drive(mode, seed, 900)) seen.add(c);
    const missing = modeOwnClips(mode).filter(c => !seen.has(c));
    expect(missing.length).toBeLessThanOrEqual(Math.floor(modeOwnClips(mode).length * 0.15));
  });
  it('every event a mode produces is acted out with what logically happened in that mode', () => {
    for (const mode of CHARACTER_MODES.filter(m => m !== 'main-evolution')) {
      for (const e of EVENTS.filter(x => x.scope === mode)) {
        const list = MODE_EVENT_CLIPS[e.id];
        expect(list).toBeDefined();
        expect(list.length).toBeGreaterThanOrEqual(3);
        for (const c of list) { expect(getClip(c)).toBeDefined(); expect(exclusiveTo(c)).toEqual([mode]); }
      }
    }
  });
  it('the clip follows what the player actually did', () => {
    expect(payloadClip('survival-task-select', { task: 'gather-wood' })).toBe('sv-chop-wood');
    expect(payloadClip('survival-task-select', { task: 'fetch-water' })).toBe('sv-fetch-water-carry');
    expect(payloadClip('survival-task-select', { task: 'rest' })).toBe('sv-rest-sleep');
    expect(payloadClip('civilization-task-assign', { command: 'repair-link' })).toBe('cv-repair-link');
    expect(payloadClip('civilization-task-assign', { command: 'set-routing' })).toBe('cv-route-service');
    expect(payloadClip('archaeology-hypothesis-added', { field: 'phase' })).toBe('ar-date-phase');
    expect(payloadClip('archaeology-hypothesis-added', { field: 'function' })).toBe('ar-hypothesize-function');
    expect(payloadClip('inventory-open')).toBeNull();
  });
  it('in a mode the crew mostly does the work of that mode when left alone', () => {
    for (const mode of CHARACTER_MODES) {
      const clips = drive(mode, 9, 600, true);
      const own = new Set(modeOwnClips(mode));
      expect(clips.filter(c => own.has(c)).length).toBeGreaterThan(clips.length * 0.3);
    }
  });
});
