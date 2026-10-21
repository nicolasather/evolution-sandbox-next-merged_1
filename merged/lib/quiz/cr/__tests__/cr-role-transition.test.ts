/** Regression guard for Clue Racing's role policy (the reference behaviour the other two games now follow). */
import { activeSeats, addSeat, reduceHost, reduceSeat } from '../engine';
import { newMatch } from '../testkit';

const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }>; };
describe('Clue Racing role transitions', () => {
  it('1 → 2 → 1 players: solo pathfinder, distinct team roles, solo pathfinder again', () => {
    let { s } = newMatch({ format: 'signal_relay', sizes: [1, 1] });
    expect(activeSeats(s, 't1').map((x) => x.role)).toEqual(['solo_pathfinder']);
    s = ok(addSeat(s, 'mate', 'Mate', 9, 't1')).state;
    const two = activeSeats(s, 't1').map((x) => x.role); expect(new Set(two).size).toBe(2); expect(two).not.toContain('solo_pathfinder');
    s = ok(reduceHost(s, { kind: 'kick', seatId: 'mate' }, 0).result).state;
    expect(activeSeats(s, 't1').map((x) => x.role)).toEqual(['solo_pathfinder']);
  });
  it('a stale client cannot take a role a teammate just took, and a lone player cannot leave solo', () => {
    const { s } = newMatch({ format: 'signal_relay', sizes: [2, 1] });
    const [a, b] = activeSeats(s, 't1'); expect(reduceSeat(s, b!.id, { kind: 'role', role: a!.role })).toMatchObject({ ok: false, code: 'ROLE_TAKEN' });
    const lone = activeSeats(s, 't2')[0]!; expect(reduceSeat(s, lone.id, { kind: 'role', role: 'scout' })).toMatchObject({ ok: false, code: 'SOLO_ROLE' });
  });
});
