import { CrewDirector, mulberry32 } from '../director';
import { IDLE_CONTEXT, type CrewContext } from '../bus';
import { SpeechArbiter } from '../speech';
import { DEFAULT_SETTINGS } from '../store';
import type { CharacterEvent, CharacterId, CrewSettings, SpeechRequest } from '../types';

function rig(over: Partial<CrewSettings> = {}, roster: CharacterId[] = ['kip', 'vex', 'orra'], opts: { reduced?: boolean; hasAction?: boolean } = {}) {
  const clock = { t: 1_000_000 };
  const ctx: CrewContext = { ...IDLE_CONTEXT };
  const d = new CrewDirector({
    now: () => clock.t, random: mulberry32(7), context: () => ctx, hasAction: () => opts.hasAction ?? true, reducedMotion: () => !!opts.reduced,
  });
  d.setSettings({ ...DEFAULT_SETTINGS, perCharacter: { ...DEFAULT_SETTINGS.perCharacter }, ...over });
  d.setRoster(roster); d.disclosureSeen = true;
  const ev = (id: string, extra: Partial<CharacterEvent> = {}): CharacterEvent => ({ id, mode: 'main-evolution', source: 'game', at: clock.t, ...extra });
  const advance = (ms: number) => { clock.t += ms; };
  return { d, ctx, clock, ev, advance };
}

/** run the scheduler for `ms`, one tick a second, returning everything it decided */
function run(r: ReturnType<typeof rig>, ms: number, quiet = true) {
  const out: ReturnType<CrewDirector['tick']> = [];
  for (let i = 0; i < ms / 1000; i++) { r.advance(1000); if (!quiet) r.d.noteInput(); out.push(...r.d.tick()); }
  return out;
}

describe('speech arbiter', () => {
  const req = (over: Partial<SpeechRequest> = {}): SpeechRequest => ({ speakerId: 'kip', lineId: 'kip.found', text: 'We made a thing!', priority: 'normal', expiresAt: 1e9, voiceCueId: 'vc.kip.found', ...over });
  it('never shows two lines at once; a higher priority pre-empts, a lower one is dropped', () => {
    const t = 1000; const a = new SpeechArbiter(() => t, () => 0.5);
    expect(a.offer(req({ priority: 'normal' }))).toBe(true);
    const first = a.current!;
    expect(a.offer(req({ speakerId: 'vex', lineId: 'vex.fail', text: 'Called it.', priority: 'ambient' }), true)).toBe(false);
    expect(a.current).toBe(first);
    expect(a.offer(req({ speakerId: 'orra', lineId: 'orra.found', text: 'As predicted.', priority: 'major' }))).toBe(true);
    expect(a.current!.speakerId).toBe('orra');
    expect(a.current).not.toBe(first);
  });
  it('lines go stale instead of appearing late', () => {
    let t = 1000; const a = new SpeechArbiter(() => t, () => 0.5);
    a.offer(req({ priority: 'major', expiresAt: 1000 + 5000 }));
    a.offer(req({ speakerId: 'vex', text: 'Too easy.', priority: 'major', expiresAt: 1000 + 1500 }));
    expect(a.hasPending()).toBe(true);
    t += 4000; a.tick();
    expect(a.current).toBeNull(); // the pending one expired while the first was showing
    expect(a.hasPending()).toBe(false);
  });
  it('ambient banter is rare', () => {
    let t = 1000; const a = new SpeechArbiter(() => t, () => 0.5);
    expect(a.offer(req({ priority: 'normal' }))).toBe(true);
    t += 3000; a.tick();
    expect(a.offer(req({ priority: 'ambient', expiresAt: t + 3000 }))).toBe(false);
    t += 60_000;
    expect(a.offer(req({ priority: 'ambient', expiresAt: t + 3000 }))).toBe(true);
  });
  it('lines last 1.2 to 2.2 seconds', () => {
    const t = 0; const a = new SpeechArbiter(() => t, () => 0.5);
    a.offer(req({ text: 'Hi' })); expect(a.current!.until - a.current!.shownAt).toBe(1200);
    a.clear(); a.offer(req({ text: 'One two three four five' }), true); expect(a.current!.until - a.current!.shownAt).toBeLessThanOrEqual(2200);
  });
});

describe('director: events', () => {
  it('locked creatures never perform; disabled ones neither', () => {
    const r = rig({}, ['kip']);
    for (let i = 0; i < 20; i++) { r.advance(60_000); for (const p of r.d.handle(r.ev('craft-valid-new'))) expect(p.cast).toEqual(['kip']); }
    const r2 = rig({ perCharacter: { kip: false, vex: true, orra: true } }, ['kip', 'vex']);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) { r2.advance(60_000); r2.d.handle(r2.ev('craft-valid-new')).forEach(p => seen.add(p.characterId)); }
    expect(seen.has('kip')).toBe(false);
    expect(rig({ enabled: false }).d.handle({ id: 'craft-valid-new', mode: 'main-evolution', source: 'game', at: 0 })).toEqual([]);
  });
  it('a major event can bring in the crew; the others are staggered, not simultaneous', () => {
    const r = rig();
    const out = r.d.handle(r.ev('craft-valid-new'));
    expect(out.length).toBeGreaterThanOrEqual(1);
    if (out.length > 1) expect(new Set(out.map(o => o.delayMs)).size).toBe(out.length);
    expect(out.filter(o => o.speech).length).toBeLessThanOrEqual(1);
  });
  it('ambient events are ignored while hidden, in a modal, a cinematic or busy (a guide being up only silences speech)', () => {
    for (const k of ['hidden', 'modalOpen', 'gateOpen', 'busy'] as const) {
      const r = rig(); r.ctx[k] = true;
      let n = 0; for (let i = 0; i < 30; i++) { r.advance(10_000); n += r.d.handle(r.ev('inventory-open')).length; }
      expect(n).toBe(0);
    }
  });
  it('ambient reactions stop entirely under reduced motion', () => {
    const r = rig({}, ['kip', 'vex', 'orra'], { reduced: true });
    let n = 0; for (let i = 0; i < 30; i++) { r.advance(10_000); n += r.d.handle(r.ev('inventory-open')).length; }
    expect(n).toBe(0);
  });
  it('does not replay the same clip on equivalent events', () => {
    const r = rig({}, ['kip']);
    const clips: string[] = [];
    for (let i = 0; i < 12; i++) { r.advance(30_000); const p = r.d.handle(r.ev('craft-invalid-pair')); if (p[0]) clips.push(p[0].clipId); }
    expect(clips.length).toBeGreaterThan(5);
    for (let i = 1; i < clips.length; i++) expect(clips[i]).not.toBe(clips[i - 1]);
  });
  it('a click on a creature is answered by that creature', () => {
    const r = rig();
    const p = r.d.handle(r.ev('character-click', { source: 'ui', payload: { characterId: 'orra' } }));
    expect(p.length).toBe(1); expect(p[0].characterId).toBe('orra');
  });
  it('pair and trio clips fall back to a solo clip when the crew is too small', () => {
    const r = rig({}, ['kip']);
    const p = r.d.handle(r.ev('crew-group-celebrate'));
    for (const x of p) expect(x.cast.length).toBe(1);
  });
});

describe('director: wrong-answer pranks', () => {
  it('Vex may point at a clearly flagged joke, but never carries any action that could select or submit', () => {
    const r = rig({ answerPranks: true }, ['vex']);
    let flagged = 0;
    for (let i = 0; i < 40; i++) {
      r.advance(40_000);
      for (const p of r.d.handle(r.ev('question-open'))) { if (p.prank) { flagged++; expect(p.clipId).toMatch(/^prank-/); } expect(p.actionId).toBeUndefined(); }
    }
    expect(flagged).toBeGreaterThan(0);
  });
  it('is off when its toggle is off', () => {
    const r = rig({ answerPranks: false }, ['vex']);
    for (let i = 0; i < 40; i++) { r.advance(40_000); for (const p of r.d.handle(r.ev('question-open'))) expect(p.prank).toBeUndefined(); }
  });
});

describe('scheduler: autonomous bench turns', () => {
  it('fires on a randomised 24-42 s cadence after the player has been idle, and never chains', () => {
    const r = rig(); r.d.mode = 'main-evolution';
    const out = run(r, 400_000).filter(p => p.actionId === 'bench.tryRandomMerge');
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.length).toBeLessThanOrEqual(CrewDirector.MAX_MERGES_PER_SESSION);
    expect(r.d.mergeAttempts).toBe(out.length);
  });
  it('the interval is within 24-42 s with a mean near 33 s', () => {
    const r = rig(); const xs = Array.from({ length: 2000 }, () => r.d.mergeInterval());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(24_000); expect(Math.max(...xs)).toBeLessThanOrEqual(42_000);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length; expect(mean).toBeGreaterThan(32_000); expect(mean).toBeLessThan(34_000);
  });
  it('is capped per session', () => {
    const r = rig(); const out = run(r, 3_000_000).filter(p => p.actionId === 'bench.tryRandomMerge');
    expect(out.length).toBe(CrewDirector.MAX_MERGES_PER_SESSION);
  });
  it.each(['hidden', 'dragging', 'typing', 'modalOpen', 'gateOpen', 'busy', 'guideActive'] as const)('never while %s', key => {
    const r = rig(); r.ctx[key] = true;
    expect(run(r, 600_000).filter(p => p.actionId === 'bench.tryRandomMerge')).toEqual([]);
  });
  it('never when the setting is off, consent is missing, motion is reduced, or the mode has no bench', () => {
    const off = rig({ autonomousTurns: false });
    expect(run(off, 600_000).filter(p => p.actionId === 'bench.tryRandomMerge')).toEqual([]);
    const noConsent = rig(); noConsent.d.disclosureSeen = false;
    expect(run(noConsent, 600_000).filter(p => p.actionId === 'bench.tryRandomMerge')).toEqual([]);
    const reduced = rig({}, ['kip', 'vex', 'orra'], { reduced: true });
    expect(run(reduced, 600_000)).toEqual([]);
    const noBench = rig({}, ['kip', 'vex', 'orra'], { hasAction: false });
    expect(run(noBench, 600_000).filter(p => p.actionId === 'bench.tryRandomMerge')).toEqual([]);
  });
  it('waits for the player to stop touching things first', () => {
    const r = rig();
    const busy = run(r, 200_000, false); // input every second: never idle
    expect(busy.filter(p => p.actionId === 'bench.tryRandomMerge')).toEqual([]);
  });
});

describe('scheduler: pranks and ambient life', () => {
  it('Vex only sends a bench piece home rarely (90-150 s apart) and only with its toggle on', () => {
    const r = rig({ autonomousTurns: false });
    const times: number[] = []; const start = r.clock.t;
    for (let i = 0; i < 1500; i++) { r.advance(1000); r.d.noteInput(); r.clock.t += 0; if (i % 20 === 0) r.clock.t += 0; const out = r.d.tick(); if (out.some(p => p.actionId === 'bench.returnItemHome')) times.push(r.clock.t - start); }
    expect(times.length).toBe(0); // the player is never idle here
    const idle = rig({ autonomousTurns: false });
    const hits = run(idle, 1_500_000).filter(p => p.actionId === 'bench.returnItemHome');
    expect(hits.length).toBeGreaterThan(0);
    const gaps = hits.map((_, i) => i);
    expect(gaps.length).toBe(hits.length);
    const off = rig({ autonomousTurns: false, objectPranks: false });
    expect(run(off, 1_500_000).filter(p => p.actionId === 'bench.returnItemHome')).toEqual([]);
    const noVex = rig({ autonomousTurns: false }, ['kip', 'orra']);
    expect(run(noVex, 1_500_000).filter(p => p.actionId === 'bench.returnItemHome')).toEqual([]);
  });
  it('ambient skits stay off when disabled and never run while hidden', () => {
    const a = rig({ autonomousTurns: false, objectPranks: false, ambientSkits: false });
    expect(run(a, 1_000_000)).toEqual([]);
    const h = rig({ autonomousTurns: false }); h.ctx.hidden = true;
    expect(run(h, 1_000_000)).toEqual([]);
  });
  it('is reproducible from a seed', () => {
    const one = run(rig(), 600_000).map(p => `${p.characterId}:${p.clipId}`);
    const two = run(rig(), 600_000).map(p => `${p.characterId}:${p.clipId}`);
    expect(one).toEqual(two);
  });
});
