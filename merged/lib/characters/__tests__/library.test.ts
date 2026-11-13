import { readFileSync } from 'fs';
import { join } from 'path';
import { buildJointFrames } from '../animator';
import { CLIPS, getClip } from '../clips';
import { CrewDirector, PLAY, mulberry32 } from '../director';
import { IDLE_CONTEXT } from '../bus';
import { REQUESTED_ANIMATIONS } from '../library';
import { DEFAULT_SETTINGS } from '../store';
import { CHARACTER_IDS, JOINTS } from '../types';

describe('the requested 215-animation library', () => {
  it('has all 215, numbered 1 to 215 in order, each with a distinct name', () => {
    expect(REQUESTED_ANIMATIONS).toHaveLength(215);
    REQUESTED_ANIMATIONS.forEach((r, i) => expect(r.n).toBe(i + 1));
    expect(new Set(REQUESTED_ANIMATIONS.map(r => r.name)).size).toBe(215);
  });
  it('every one of them is implemented as a real clip', () => {
    const missing = REQUESTED_ANIMATIONS.filter(r => !getClip(r.clip));
    expect(missing.map(m => `${m.n} ${m.name}`)).toEqual([]);
  });
  it('the dedicated ones (not a loose stand-in) cover the vocabulary the list asks for', () => {
    // the 137 clips written for this list are all used by it, and each is its own piece of acting
    const own = REQUESTED_ANIMATIONS.map(r => r.clip).filter(c => /^(move|emote|silly|item|craft|pal|screen|act|adv|trio)-/.test(c));
    expect(own.length).toBeGreaterThanOrEqual(137);
    const sigs = new Set(own.map(c => JSON.stringify(getClip(c)!.keyframes)));
    expect(sigs.size).toBe(new Set(own).size);
  });
  it('pair and trio entries really use the roles of one shared timeline', () => {
    for (const r of REQUESTED_ANIMATIONS.filter(x => x.group === 'Character-to-character')) {
      const c = getClip(r.clip)!;
      if (/^pal-/.test(c.id)) expect(c.cast).toBeGreaterThanOrEqual(2);
    }
    expect(getClip('trio-group-dance')!.cast).toBe(3);
    expect(getClip('trio-sync-jump')!.cast).toBe(3);
    expect(getClip('trio-all-fall')!.cast).toBe(3);
  });
  it('every clip retargets onto every creature without producing a broken keyframe', () => {
    for (const c of CLIPS) {
      for (const who of CHARACTER_IDS) {
        for (const role of [c.keyframes, ...(c.roles ?? [])]) {
          for (const j of JOINTS) {
            if (!role.some(f => f.pose[j])) continue;
            const frames = buildJointFrames(j, role, who, 100, 1, (c.travel ?? 0) * 100, 'ease-in-out');
            expect(frames[0].offset).toBe(0);
            expect(frames[frames.length - 1].offset).toBe(1);
            for (const f of frames) { expect(f.transform).not.toMatch(/NaN|undefined/); expect(Number.isFinite(f.opacity)).toBe(true); }
          }
        }
      }
    }
  });
  it('every effect mark a clip asks for is drawn by the rigs, and is shown by the stylesheet', () => {
    const root = join(__dirname, '..', '..', '..');
    const rig = readFileSync(join(root, 'components/characters/CharacterRig.tsx'), 'utf8');
    const css = readFileSync(join(root, 'app/_characters.css'), 'utf8');
    const used = new Set(CLIPS.flatMap(c => c.fx ?? []));
    expect(used.size).toBeGreaterThanOrEqual(12);
    for (const k of used) { expect(rig).toContain(`fx-${k}`); expect(css).toContain(`[data-fx~="${k}"] .fx-${k}`); }
  });
  it('clips that leave the stage keep their last pose, so nobody pops back into view', () => {
    for (const id of ['screen-fall-off', 'screen-disappear', 'prank-portal-dive', 'exit-wave']) expect(getClip(id)!.holdEnd).toBe(true);
    expect(getClip('screen-climb-back')!.holdEnd).toBeFalsy();
  });
});

describe('constant play', () => {
  it('every clip in the play pools exists', () => {
    for (const who of CHARACTER_IDS) { expect(PLAY[who].length).toBeGreaterThan(20); for (const id of PLAY[who]) expect(getClip(id)).toBeDefined(); }
  });
  it('someone is always up to something: a new piece of play every few seconds, and never the same one twice in a row', () => {
    const clock = { t: 5_000_000 };
    const d = new CrewDirector({ now: () => clock.t, random: mulberry32(11), context: () => ({ ...IDLE_CONTEXT }), hasAction: () => false });
    d.setSettings({ ...DEFAULT_SETTINGS, perCharacter: { ...DEFAULT_SETTINGS.perCharacter }, autonomousTurns: false, objectPranks: false });
    d.setRoster(['kip', 'vex', 'orra']);
    const seen: { who: string; clip: string; at: number }[] = [];
    for (let i = 0; i < 180; i++) { clock.t += 1000; for (const p of d.tick()) seen.push({ who: p.characterId, clip: p.clipId, at: clock.t }); }
    expect(seen.length).toBeGreaterThanOrEqual(18); // in three minutes of an untouched screen
    const gaps = seen.slice(1).map((s, i) => s.at - seen[i].at);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(25_000);
    for (const who of CHARACTER_IDS) {
      const mine = seen.filter(s => s.who === who).map(s => s.clip);
      for (let i = 1; i < mine.length; i++) expect(mine[i]).not.toBe(mine[i - 1]);
    }
    expect(new Set(seen.map(s => s.clip)).size).toBeGreaterThan(14);
    expect(seen.some(s => getClip(s.clip)!.cast > 1)).toBe(true); // and they play together
  });
  it('it stays quiet when it must: hidden tab, a dialog, a cinematic, reduced motion, or the player has switched play off', () => {
    const run = (ctx: Partial<typeof IDLE_CONTEXT>, reduced = false, skits = true) => {
      const clock = { t: 9_000_000 };
      const d = new CrewDirector({ now: () => clock.t, random: mulberry32(3), context: () => ({ ...IDLE_CONTEXT, ...ctx }), hasAction: () => false, reducedMotion: () => reduced });
      d.setSettings({ ...DEFAULT_SETTINGS, perCharacter: { ...DEFAULT_SETTINGS.perCharacter }, ambientSkits: skits });
      d.setRoster(['kip', 'vex', 'orra']);
      let n = 0; for (let i = 0; i < 300; i++) { clock.t += 1000; n += d.tick().length; }
      return n;
    };
    expect(run({ hidden: true })).toBe(0);
    expect(run({ modalOpen: true })).toBe(0);
    expect(run({ guideActive: true })).toBeGreaterThan(10); // a guide silences speech and bench turns, not play
    expect(run({ gateOpen: true })).toBe(0);
    expect(run({}, true)).toBe(0);
    expect(run({}, false, false)).toBe(0);
    expect(run({})).toBeGreaterThan(10);
  });
});
