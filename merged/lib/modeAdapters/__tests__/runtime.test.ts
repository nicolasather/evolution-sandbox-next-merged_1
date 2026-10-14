import { playDb } from '@/lib/processing';
import { createRng } from '@/lib/seed';
import { pickChallenge } from '@/lib/minpath/daily';
import { TARGETS, reverseTargets } from '@/lib/reverseevolution/catalog';
import { adapterGate, generatedPackets } from '../runtime';
import type { Discovery } from '@/lib/types';

const stone = playDb.nodes.find(n => n.id === 'stone_flake')!;
const mk = (id: string, extra: Partial<Discovery> = {}): Discovery => ({ ...stone, id, visualArchetype: 'blade', rec: [['stone', 'stone', 'wood']], ...extra });

describe('adapterGate: the original catalogue is never filtered', () => {
  it('every original item passes every mode', () => {
    for (const mode of ['minimum-path', 'reverse-evolution', 'survival', 'archaeology', 'main-evolution', 'civilization', 'decipher'] as const) {
      expect(playDb.nodes.every(n => adapterGate(mode, n, playDb))).toBe(true);
    }
  });
  it('pipeline items need their adapter: excluded modes always say no', () => {
    const n = mk('zz_a');
    for (const mode of ['civilization', 'decipher', 'alien-archaeology', 'escape-room'] as const) expect(adapterGate(mode, n, playDb)).toBe(false);
    expect(adapterGate('minimum-path', n, playDb)).toBe(true);
  });
  it('a placeholder pipeline item is never offered', () => {
    expect(adapterGate('minimum-path', mk('zz_p', { caution: 'PLACEHOLDER text' }), playDb)).toBe(false);
  });
  it('era-limited modes fail closed when eras are missing', () => {
    expect(adapterGate('survival', mk('zz_s'), { nodes: playDb.nodes })).toBe(false);
  });
});

describe('Minimum Path really consumes the gate', () => {
  it('never starts or ends on an ineligible pipeline item, across many seeds', () => {
    const bad = mk('zz_bad', { caution: 'placeholder', rec: [['stone', 'stone', 'wood']] });
    const db = { nodes: [...playDb.nodes, bad], eras: playDb.eras };
    for (let i = 0; i < 40; i++) {
      const c = pickChallenge(db, createRng(`gate-${i}`));
      if (c) { expect(c.startId).not.toBe('zz_bad'); expect(c.targetId).not.toBe('zz_bad'); }
    }
  });
  it('is unchanged on the real database (same seed, same challenge, twice)', () => {
    expect(pickChallenge(playDb, createRng('same'))).toEqual(pickChallenge(playDb, createRng('same')));
  });
  it('uses a reviewed packet when one is shipped and solvable', () => {
    jest.resetModules();
    jest.doMock('@/data/verified/mode_packets.json', () => ({ __esModule: true, default: { schemaVersion: 1, packets: { 'minimum-path': [{ schemaVersion: 1, modeId: 'minimum-path', start: 'stone', target: 'campfire' }] } } }));
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports -- isolateModules needs synchronous require */
      const { pickChallenge: pc } = require('@/lib/minpath/daily');
      const { playDb: db } = require('@/lib/processing');
      const { createRng: rngOf } = require('@/lib/seed');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const c = pc(db, rngOf('x'));
      expect(c.startId).toBe('stone'); expect(c.targetId).toBe('campfire'); expect(c.optimalLength).toBeGreaterThan(1);
    });
    jest.dontMock('@/data/verified/mode_packets.json');
  });
});

describe('generatedPackets / reverseTargets', () => {
  const file = (packets: Record<string, unknown[]>) => ({ schemaVersion: 1, packets });
  it('ships empty: no packets, reverse list is exactly the curated TARGETS', () => {
    expect(generatedPackets('minimum-path', playDb)).toEqual([]);
    expect(reverseTargets(playDb)).toEqual(TARGETS);
  });
  it('keeps valid+solvable, drops malformed / unknown / excluded-mode / unsolvable packets', () => {
    const ok = { schemaVersion: 1, modeId: 'reverse-evolution', targetId: 'smartphone' };
    const f = file({
      'reverse-evolution': [ok, { ...ok, targetId: 'nope' }, { ...ok, extra: 1 }, 'junk', null, { ...ok, targetId: 'stone' }],
      civilization: [{ schemaVersion: 1, modeId: 'civilization' }],
    });
    expect(generatedPackets('reverse-evolution', playDb, f)).toEqual([ok]);
    expect(generatedPackets('civilization', playDb, f)).toEqual([]);
  });
  it('bounds the number of packets read and tolerates a broken file', () => {
    expect(generatedPackets('minimum-path', playDb, { schemaVersion: 2 } as never)).toEqual([]);
    expect(generatedPackets('minimum-path', playDb, file({ 'minimum-path': 'x' as never }))).toEqual([]);
  });
});
