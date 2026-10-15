import { playDb } from '../../processing';
import { MODES } from '../../modes/registry';
import { ADAPTERS, resolvePacket } from '..';
import type { ModeId } from '../../modes/types';

const db = playDb;
const OPT_IN: ModeId[] = ['main-evolution', 'reverse-evolution', 'minimum-path', 'survival', 'archaeology', 'escape-room'];
const EXCLUDED: ModeId[] = ['civilization', 'decipher', 'alien-archaeology'];

describe('mode compatibility table', () => {
  it('every registered mode is either opt-in or explicitly excluded with a reason', () => {
    for (const m of MODES) {
      const a = ADAPTERS[m.id];
      expect(a).toBeDefined();
      expect(a.modeId).toBe(m.id);
      if (a.policy === 'excluded') expect(a.exclusionReason!.length).toBeGreaterThan(30);
    }
    expect(OPT_IN.every(m => ADAPTERS[m].policy === 'opt_in')).toBe(true);
    expect(EXCLUDED.every(m => ADAPTERS[m].policy === 'excluded')).toBe(true);
    expect(MODES.length).toBe(OPT_IN.length + EXCLUDED.length);
  });

  it('placeholders never become eligible anywhere', () => {
    const ph = db.nodes.filter(n => (n.caution ?? '').toLowerCase().includes('placeholder'));
    expect(ph.length).toBe(500);
    for (const m of OPT_IN) for (const n of ph.slice(0, 50)) expect(ADAPTERS[m].eligibility(n, db).eligible).toBe(false);
  });
});

describe('failure matrix: every mode × every failure ⇒ a defined, safe outcome', () => {
  const garbage: [string, unknown][] = [
    ['no AI at all', null],
    ['undefined', undefined],
    ['string, not an object', 'hello'],
    ['array', []],
    ['wrong schemaVersion', { schemaVersion: 9 }],
    ['unknown ids', { schemaVersion: 1, itemIds: ['zzz_nope'], start: 'zzz', target: 'yyy', targetId: 'qqq' }],
    ['oversized', { schemaVersion: 1, itemIds: Array(500).fill('stone') }],
    ['hostile fields', { schemaVersion: 1, __proto__: { x: 1 }, html: '<script>1</script>', itemIds: ['stone'] }],
  ];

  for (const mode of MODES.map(m => m.id)) {
    it(`${mode}`, () => {
      for (const [, raw] of garbage) {
        const r = resolvePacket(mode, raw, 'seed-1', db);
        if (ADAPTERS[mode].policy === 'excluded') {
          expect(r.source).toBe('none');
          expect(r.packet).toBeNull();
        } else {
          expect(r.source).toBe('fallback');                 // never 'generated' for junk
          expect(r.packet).not.toBeNull();
          const v = ADAPTERS[mode].validatePacket(r.packet, db);
          expect(v.ok).toBe(true);
          expect(ADAPTERS[mode].simulatePacket(r.packet, db).solvable).toBe(true);
        }
      }
    });
  }

  it('fallbacks are deterministic per seed and differ across seeds', () => {
    for (const m of OPT_IN) {
      const a = resolvePacket(m, null, 's1', db).packet, b = resolvePacket(m, null, 's1', db).packet;
      expect(a).toEqual(b);
    }
    const x = JSON.stringify(resolvePacket('minimum-path', null, 'a', db).packet);
    const y = JSON.stringify(resolvePacket('minimum-path', null, 'b', db).packet);
    expect(x).not.toBe(y);
  });
});

describe('solvability proofs', () => {
  it('Minimum Path: a valid generated packet is accepted, an unreachable/trivial one is not', () => {
    const fb = resolvePacket('minimum-path', null, 'proof', db).packet as { start: string; target: string };
    const good = { schemaVersion: 1, modeId: 'minimum-path', start: fb.start, target: fb.target };
    expect(resolvePacket('minimum-path', good, 'proof', db).source).toBe('generated');
    const same = { ...good, target: fb.start };
    expect(resolvePacket('minimum-path', same, 'proof', db).source).toBe('fallback');
  });

  it('Reverse Evolution: a primitive target is refused, a real one generates a run', () => {
    expect(resolvePacket('reverse-evolution', { schemaVersion: 1, modeId: 'reverse-evolution', targetId: 'stone' }, 's', db).source).toBe('fallback');
    expect(resolvePacket('reverse-evolution', { schemaVersion: 1, modeId: 'reverse-evolution', targetId: 'axe' }, 's', db).source).toBe('generated');
  });

  it('a validator that throws still falls back', () => {
    const spy = jest.spyOn(ADAPTERS['minimum-path'], 'validatePacket').mockImplementation(() => { throw new Error('boom'); });
    const r = resolvePacket('minimum-path', { schemaVersion: 1 }, 's', db);
    expect(r.source).toBe('fallback');
    expect(r.errors.join()).toMatch(/boom/);
    spy.mockRestore();
  });

  it('survival, archaeology and escape-room take catalogue items (finds, templates, generated rooms)', () => {
    for (const m of ['survival', 'archaeology', 'escape-room'] as const) expect(ADAPTERS[m].policy).toBe('opt_in');
    expect(resolvePacket('survival', { schemaVersion: 1 }, 's', db).source).toBe('fallback');
  });
});
