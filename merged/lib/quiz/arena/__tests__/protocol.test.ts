/** arena/1 wire contracts: every packet is strict, bounded and intent-only. These are pure-schema tests (no server, no database). */
import { arenaActionSchema, arenaAnswerSchema, arenaCreateSchema, arenaHostSchema, arenaJoinSchema, arenaMoveSchema, clientPacketSchema, MAX_PACKET_BYTES, validAxis } from '../validation';
import { advance, reduceHost, reduceSeat } from '../engine';
import { newMatch } from '../testkit';
export const ROLE_SETS: Record<number, string[]> = {
  1: ['runner'],
  2: ['runner', 'sentinel'],
  3: ['runner', 'sentinel', 'builder'],
  4: ['runner', 'sentinel', 'builder', 'trickster'],
  5: ['runner', 'sentinel', 'builder', 'trickster', 'navigator'],
};

const QUIZ = '11111111-2222-4333-8444-555555555555';
describe('create', () => {
  it('accepts defaults and enforces 2–4 teams, 1–5 per team, max 20 players', () => {
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ }).success).toBe(true);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, teamCount: 1 }).success).toBe(false);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, teamCount: 5 }).success).toBe(false);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, teamSizeCap: 6 }).success).toBe(false);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, teamCount: 4, teamSizeCap: 5 }).success).toBe(true);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, teamCount: 4, teamSizeCap: 5, teamNames: ['a'] }).success).toBe(false);
  });
  it('rejects unknown keys (no client-chosen score, position or grade can ride along)', () => {
    for (const extra of [{ score: 9999 }, { x: 5 }, { isCorrect: true }, { role: 'runner' }]) expect(arenaCreateSchema.safeParse({ quizId: QUIZ, ...extra }).success).toBe(false);
  });
  it('rejects an invalid format, map or duration', () => {
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, format: 'deathmatch' }).success).toBe(false);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, mapId: '../etc' }).success).toBe(false);
    expect(arenaCreateSchema.safeParse({ quizId: QUIZ, minutes: 7 }).success).toBe(false);
  });
});
describe('move intent', () => {
  it('accepts a direction in the unit square and nothing else', () => {
    expect(arenaMoveSchema.safeParse({ seq: 1, x: 1, y: -1 }).success).toBe(true);
    for (const bad of [{ seq: 1, x: 2, y: 0 }, { seq: 1, x: NaN, y: 0 }, { seq: 1, x: 0, y: Infinity }, { seq: 0, x: 0, y: 0 }, { seq: 1.5, x: 0, y: 0 }, { seq: 1, x: '1', y: 0 }, { seq: 1, x: 0, y: 0, tick: 99 }, { seq: 1, x: 0, y: 0, teleport: { x: 1, y: 1 } }, { x: 0, y: 0 }, { seq: 3_000_000_000, x: 0, y: 0 }]) expect(arenaMoveSchema.safeParse(bad).success).toBe(false);
  });
  it('validAxis refuses NaN, Infinity, out-of-range and non-numbers', () => {
    expect([0, 1, -1, 0.5].every(validAxis)).toBe(true);
    expect([NaN, Infinity, -Infinity, 1.0001, '0', null, undefined].some(validAxis)).toBe(false);
  });
  it('the packet cap is small', () => { expect(MAX_PACKET_BYTES).toBeLessThanOrEqual(16 * 1024); });
});
describe('seat and host actions', () => {
  const cmd = 'c0123456789abcdef';
  it('seat actions are a closed set', () => {
    expect(arenaActionSchema.safeParse({ commandId: cmd, action: { kind: 'role', role: 'runner' } }).success).toBe(true);
    expect(arenaActionSchema.safeParse({ commandId: cmd, action: { kind: 'role', role: 'warlord' } }).success).toBe(false);
    expect(arenaActionSchema.safeParse({ commandId: cmd, action: { kind: 'buy', helper: 'free_points' } }).success).toBe(false);
    expect(arenaActionSchema.safeParse({ commandId: cmd, action: { kind: 'kick', seatId: QUIZ } }).success).toBe(false);
    expect(arenaActionSchema.safeParse({ commandId: 'x', action: { kind: 'pass' } }).success).toBe(false);
    expect(arenaActionSchema.safeParse({ commandId: cmd, action: { kind: 'ability', points: 500 } }).success).toBe(false);
  });
  it('host actions need a uuid seat and cannot be sent as a seat action', () => {
    expect(arenaHostSchema.safeParse({ commandId: cmd, action: { kind: 'start' } }).success).toBe(true);
    expect(arenaHostSchema.safeParse({ commandId: cmd, action: { kind: 'kick', seatId: 'nope' } }).success).toBe(false);
    expect(arenaActionSchema.safeParse({ commandId: cmd, action: { kind: 'start' } }).success).toBe(false);
  });
  it('join is strict', () => {
    expect(arenaJoinSchema.safeParse({ joinCode: 'ABC123', displayName: 'Sam' }).success).toBe(true);
    expect(arenaJoinSchema.safeParse({ joinCode: 'ABC123', displayName: 'Sam', teamId: 't1' }).success).toBe(false);
    expect(arenaJoinSchema.safeParse({ joinCode: 'ABC123', displayName: 'x'.repeat(25) }).success).toBe(false);
  });
  it('answers carry no grade', () => {
    expect(arenaAnswerSchema.safeParse({ roomQuestionId: QUIZ, response: { kind: 'multiple_choice', selectedIds: ['a'] } }).success).toBe(true);
    expect(arenaAnswerSchema.safeParse({ roomQuestionId: QUIZ, response: {}, isCorrect: true }).success).toBe(false);
    expect(arenaAnswerSchema.safeParse({ roomQuestionId: 'not-a-uuid', response: {} }).success).toBe(false);
  });
  it('the persistent-worker packet union is closed too', () => {
    expect(clientPacketSchema.safeParse({ t: 'move', seq: 1, x: 0, y: 1 }).success).toBe(true);
    expect(clientPacketSchema.safeParse({ t: 'move', seq: 1, x: 0, y: 1, speed: 99 }).success).toBe(false);
    expect(clientPacketSchema.safeParse({ t: 'setScore', value: 1 }).success).toBe(false);
  });
});
describe('role rules by team size', () => {
  it('role sets grow 1→5 with the team and a solo player gets exactly one role', () => {
    expect(ROLE_SETS[1]).toEqual(['runner']);
    for (let n = 2; n <= 5; n++) expect(ROLE_SETS[n as 2 | 3 | 4 | 5].length).toBe(n);
  });
  it('the engine refuses a non-runner role for a solo team', () => {
    const m = newMatch({ format: 'control', sizes: [1, 1] });
    const r = reduceSeat(m.s, 'p0-0', { kind: 'role', role: 'sentinel' }); expect(r.ok).toBe(false);
    const ok = reduceSeat(m.s, 'p0-0', { kind: 'role', role: 'runner' }); expect(ok.ok).toBe(true);
  });
  it('the host cannot start a match with fewer than two teams present', () => {
    const m = newMatch({ format: 'control', sizes: [2, 0] }); const r = reduceHost(m.s, { kind: 'start' }, 0, m.pool);
    expect(r.result.ok).toBe(false); expect(advance).toBeDefined();
  });
});
