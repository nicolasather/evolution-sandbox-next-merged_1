import { readFileSync } from 'fs';
import { join } from 'path';
import { MIN_GAP_MS, Narrator, STUCK_AFTER_MS, COOLDOWN_MS } from '../narrator';
import { ERA_LINES, ERA_VOICE, VOICES } from '../voices';

const eras = (JSON.parse(readFileSync(join(__dirname, '../../../data/db.json'), 'utf8')).eras as { id: string }[]).map(e => e.id);
let seed = 3; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mk = () => new Narrator(rng, 0);

describe('voices', () => {
  it('every era has a voice and welcome lines; every voice has lines for each occasion', () => {
    for (const e of eras) { expect(ERA_VOICE[e]).toBeDefined(); expect(ERA_LINES[e]?.length).toBeGreaterThanOrEqual(2); }
    for (const v of Object.values(VOICES)) {
      for (const k of ['major', 'technique', 'stuck', 'minor'] as const) expect(v[k].length).toBeGreaterThanOrEqual(2);
      expect(v.note.length).toBeGreaterThan(10);
    }
  });
  it('early voices are anonymous; dramatised ones say so and quote nobody', () => {
    expect(VOICES.toolmaker.kind).toBe('archetype');
    for (const id of ['observer', 'experimenter', 'logician'] as const) {
      expect(VOICES[id].kind).toBe('dramatised'); expect(VOICES[id].note).toMatch(/Dramatised.*Not a quotation/);
    }
  });
  it('no line contains a quotation, a date or a figure', () => {
    const all = [...Object.values(ERA_LINES).flat(), ...Object.values(VOICES).flatMap(v => [...v.major, ...v.technique, ...v.stuck, ...v.minor])];
    for (const l of all) { expect(l).not.toMatch(/[“”"]/); expect(l).not.toMatch(/\d/); }
  });
});

describe('narrator', () => {
  it('speaks each era once, in that era’s voice', () => {
    const n = mk();
    const a = n.notice({ kind: 'era', era: 'origins' }, 1000);
    expect(a?.voice.id).toBe('toolmaker');
    expect(n.notice({ kind: 'era', era: 'origins' }, 20_000)).toBeNull();
    expect(n.notice({ kind: 'era', era: 'fire' }, 20_000)?.voice.id).toBe('firekeeper');
  });
  it('a more important line cuts in; a less important one never does', () => {
    const n = mk();
    n.notice({ kind: 'technique', era: 'origins', tech: 'Cut' }, 0);
    expect(n.notice({ kind: 'minor', era: 'origins' }, 100)).toBeNull();
    expect(n.notice({ kind: 'stuck', era: 'origins' }, 100)).toBeNull();
    expect(n.notice({ kind: 'major', era: 'origins', name: 'Spear' }, 200)?.kind).toBe('major');
    expect(n.notice({ kind: 'technique', era: 'origins', tech: 'Dig' }, 300)).toBeNull();
    expect(n.notice({ kind: 'era', era: 'fire' }, 400)?.kind).toBe('era');
  });
  it('keeps a gap between lines and a cooldown per kind', () => {
    const n = mk();
    const l = n.notice({ kind: 'major', era: 'origins', name: 'A' }, 0)!;
    n.tick(l.until, 'origins');
    expect(n.current).toBeNull();
    expect(n.notice({ kind: 'major', era: 'origins', name: 'B' }, l.until)).toBeNull();     // inside the gap and cooldown
    expect(n.notice({ kind: 'technique', era: 'origins', tech: 'X' }, MIN_GAP_MS - 1)).toBeNull();
    expect(n.notice({ kind: 'major', era: 'origins', name: 'B' }, COOLDOWN_MS.major + 1)).not.toBeNull();
  });
  it('fills in the names', () => {
    const n = mk();
    const l = n.notice({ kind: 'major', era: 'origins', name: 'Hand Axe' }, 0)!;
    expect(l.text).toContain('Hand Axe'); expect(l.text).not.toContain('{');
  });
  it('offers a nudge when stuck, but not straight after progress and not repeatedly', () => {
    const n = mk();
    n.tick(STUCK_AFTER_MS - 1, 'origins'); expect(n.current).toBeNull();
    n.tick(STUCK_AFTER_MS, 'origins'); expect(n.current?.kind).toBe('stuck');
    n.dismiss();
    n.tick(STUCK_AFTER_MS + 30_000, 'origins'); expect(n.current).toBeNull();
  });
  it('off says nothing; minimal and full both speak', () => {
    const n = mk(); n.setMode('off');
    expect(n.notice({ kind: 'era', era: 'origins' }, 0)).toBeNull();
    n.setMode('minimal');
    expect(n.notice({ kind: 'era', era: 'origins' }, 0)).not.toBeNull();
    expect(n.mode).toBe('minimal');
  });
  it('a restored game does not re-announce eras already met', () => {
    const n = mk(); n.markMet('origins'); n.markMet('fire');
    expect(n.notice({ kind: 'era', era: 'fire' }, 0)).toBeNull();
    expect(n.notice({ kind: 'era', era: 'settlement' }, 0)).not.toBeNull();
  });
});
