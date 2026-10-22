/** @jest-environment node */
/** Regression: Obstacle Survival squads use each role at most once, a squad of one is locked to the solo kit server-side, and approval requests carry trusted time. */
import { activeSeats, reduceHost, reduceSeat, SOLO_ROLE } from '../engine';
import { makeMatch, seatUp } from '../testkit';
import type { HostAction, OSState } from '../domain';

const host = (s: OSState, a: HostAction, now = 0) => { const r = reduceHost(s, a, now); if (!r.result.ok) throw new Error(`${a.kind}: ${r.result.code}`); return r.result.state; };
const ids = (n: number) => Array.from({ length: n }, (_, i) => `seat-${i}`.padEnd(8, 'x'));
const roles = (s: OSState, t = s.teams[0]!.id) => activeSeats(s, t).map((x) => x.role);

describe('Obstacle Survival roles', () => {
  test('new squad members are given distinct roles instead of all being trailblazers', () => {
    const s = seatUp(makeMatch({ teamCount: 1 }).state, ids(4)); expect(new Set(roles(s)).size).toBe(4);
  });
  test('a lone student cannot pick a non-solo role through the API', () => {
    const s = seatUp(makeMatch({ teamCount: 1 }).state, ids(1)); expect(reduceSeat(s, ids(1)[0]!, { kind: 'role', role: 'medic' })).toMatchObject({ ok: false, code: 'SOLO_ROLE' });
    expect(reduceSeat(s, ids(1)[0]!, { kind: 'role', role: SOLO_ROLE })).toMatchObject({ ok: true });
  });
  test('taking a teammate\'s role is refused (stale client)', () => {
    const s = seatUp(makeMatch({ teamCount: 1 }).state, ids(2)); const [a, b] = activeSeats(s);
    expect(reduceSeat(s, b!.id, { kind: 'role', role: a!.role })).toMatchObject({ ok: false, code: 'ROLE_TAKEN' });
  });
  test('kicking down to one student resets that student to the solo kit in the lobby', () => {
    const s = seatUp(makeMatch({ teamCount: 1 }).state, ids(2)); const k = host(s, { kind: 'kick', seatId: ids(2)[0]! });
    expect(roles(k)).toEqual([SOLO_ROLE]);
  });
  test('moving a student into a squad resolves role clashes', () => {
    const m = makeMatch({ teamCount: 2 }); const s = seatUp(m.state, ids(4));
    const mover = activeSeats(s, s.teams[1]!.id)[0]!; const target = s.teams[0]!.id;
    const forced: OSState = JSON.parse(JSON.stringify(s)); forced.seats.find((x) => x.id === mover.id)!.role = activeSeats(forced, target)[0]!.role;
    const moved = host(forced, { kind: 'move_seat', seatId: mover.id, teamId: target }); expect(new Set(roles(moved, target)).size).toBe(activeSeats(moved, target).length);
  });
});
