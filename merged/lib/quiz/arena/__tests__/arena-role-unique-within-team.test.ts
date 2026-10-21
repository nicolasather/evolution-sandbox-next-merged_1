/** Regression: teammates in Arena Clash never share a role (matches Clue Racing's ROLE_TAKEN policy); a lone player is always the Runner. */
import { addSeat, activeSeats, reconcileSolo, reduceHost, reduceSeat } from '../engine';
import { newMatch } from '../testkit';
import { ROLES } from '../domain';

const roles = (s: ReturnType<typeof newMatch>['s'], t: string) => activeSeats(s, t).map((x) => x.role);
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }>; };

describe('Arena Clash roles are distinct inside a team', () => {
  it('every joiner gets a free role, even after a teammate was removed (no modulo collisions)', () => {
    let { s } = newMatch({ format: 'control', sizes: [3, 2] });
    expect(new Set(roles(s, 't1')).size).toBe(3);
    s = ok(reduceHost(s, { kind: 'kick', seatId: 'p0-0' }, 0).result).state; // first joiner (runner) leaves
    s = ok(addSeat(s, 'late-1', 'Late', 1, 't1')).state;
    s = ok(addSeat(s, 'late-2', 'Later', 2, 't1')).state;
    const r = roles(s, 't1'); expect(r).toHaveLength(4); expect(new Set(r).size).toBe(4);
  });
  it('a second player cannot take a role a teammate already holds (stale client / race)', () => {
    const { s } = newMatch({ format: 'control', sizes: [2, 1] });
    const [a, b] = activeSeats(s, 't1'); const res = reduceSeat(s, b!.id, { kind: 'role', role: a!.role });
    expect(res).toMatchObject({ ok: false, code: 'ROLE_TAKEN' });
  });
  it('two players racing for the same free role: the first wins, the second is refused', () => {
    const { s } = newMatch({ format: 'control', sizes: [3, 1] });
    const [a, b, c] = activeSeats(s, 't1'); const free = ROLES.find((r) => !roles(s, 't1').includes(r))!;
    const first = ok(reduceSeat(s, a!.id, { kind: 'role', role: free }));
    expect(reduceSeat(first.state, b!.id, { kind: 'role', role: free })).toMatchObject({ ok: false, code: 'ROLE_TAKEN' });
    expect(c).toBeDefined();
  });
  it('moving a seat into a team with the same role resolves the clash and resets ready', () => {
    const { s } = newMatch({ format: 'control', sizes: [2, 2] });
    const mover = activeSeats(s, 't2')[0]!; const clash = activeSeats(s, 't1')[0]!;
    const forced = JSON.parse(JSON.stringify(s)); forced.seats.find((x: { id: string }) => x.id === mover.id).role = clash.role;
    const moved = ok(reduceHost(forced, { kind: 'move_seat', seatId: mover.id, teamId: 't1' }, 0).result).state;
    expect(new Set(roles(moved, 't1')).size).toBe(3);
  });
  it('2 → 1 teammate becomes the Runner; 1 → 2 stays valid; reconcile is idempotent', () => {
    let { s } = newMatch({ format: 'relay', sizes: [2, 1] });
    s = ok(reduceHost(s, { kind: 'kick', seatId: 'p0-0' }, 0).result).state;
    expect(roles(s, 't1')).toEqual(['sentinel'].map(() => 'runner'));
    s = ok(addSeat(s, 'again', 'Again', 5, 't1')).state;
    expect(new Set(roles(s, 't1')).size).toBe(2);
    const copy = JSON.parse(JSON.stringify(s)); expect(reconcileSolo(copy)).toEqual([]);
  });
  it('mid-match reconcile never revokes a role', () => {
    const { s } = newMatch({ format: 'control', sizes: [2, 1] });
    const live = JSON.parse(JSON.stringify(s)); live.phase = 'arena_live'; live.seats[0].role = live.seats[1].role = 'builder';
    expect(reconcileSolo(live)).toEqual([]); expect(live.seats[0].role).toBe('builder');
  });
});
