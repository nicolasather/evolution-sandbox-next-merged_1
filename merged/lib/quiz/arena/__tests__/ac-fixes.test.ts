/** Regression tests for the Game 4 audit items fixed on the Game 5 branch (AC-01, AC-03; AC-02 is covered in server.db.test). */
import { DURATION_MINUTES } from '../balance';
import { MIN_CYCLES, planMatch } from '../plan';
import { addSeat, reconcileSolo, reduceHost, reduceSeat } from '../engine';
import { newMatch } from '../testkit';
import type { QuestionKind } from '../../types';
import { arenaCreateSchema } from '../validation';

describe('AC-01 duration policy', () => {
  it('no offered length can pretend to be ok with fewer rounds than the minimum', () => {
    expect(DURATION_MINUTES).toEqual([10, 15, 20, 30, 45]);
    for (const m of DURATION_MINUTES) for (const n of [3, 8, 20]) for (const low of [false, true]) for (const read of [false, true]) {
      const kinds = Array.from({ length: n }, () => 'multiple_choice' as QuestionKind);
      const p = planMatch({ durationMinutes: m, readAloud: read, lowPressure: low, allowReviewCycle: false }, kinds);
      expect(p.cycles >= MIN_CYCLES).toBe(!p.notes.includes('belowMinimum'));
    }
  });
  it('a forged 5-minute create request is refused with an actionable message', () => {
    const r = arenaCreateSchema.safeParse({ quizId: '00000000-0000-4000-8000-000000000000', minutes: 5 });
    expect(r.success).toBe(false); expect(JSON.stringify(r)).toMatch(/at least three rounds/);
  });
});
describe('AC-03 team of one', () => {
  it('kicking or moving a teammate in the lobby coerces the lone player to the Runner', () => {
    const { s, pool } = newMatch({ format: 'control', sizes: [2, 1], roles: [['sentinel', 'builder'], ['runner']] });
    const k = reduceHost(s, { kind: 'kick', seatId: 'p0-1' }, 0, pool); expect(k.result.ok).toBe(true);
    if (k.result.ok) expect(k.result.state.seats.find((x) => x.id === 'p0-0')!.role).toBe('runner');
    const m = reduceHost(s, { kind: 'move_seat', seatId: 'p0-1', teamId: 't2' }, 0, pool); expect(m.result.ok).toBe(true);
    if (m.result.ok) expect(m.result.state.seats.find((x) => x.id === 'p0-0')!.role).toBe('runner');
  });
  it('a lone player cannot pick another role, and two players can; reconcile is idempotent', () => {
    const { s } = newMatch({ format: 'control', sizes: [1, 1] });
    expect(reduceSeat(s, 'p0-0', { kind: 'role', role: 'builder' }).ok).toBe(false);
    const two = addSeat(s, 'extra', 'X', 0, 't1'); expect(two.ok).toBe(true);
    if (two.ok) { expect(reduceSeat(two.state, 'p0-0', { kind: 'role', role: 'builder' }).ok).toBe(true); const c = JSON.parse(JSON.stringify(two.state)); expect(reconcileSolo(c)).toEqual([]); }
  });
});
