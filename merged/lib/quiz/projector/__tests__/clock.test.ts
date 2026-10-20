/** @jest-environment node */
/** PATCH F — the projector clock is derived from the room row only (expires_at minus the grace window), so pause/resume/extend in SQL keep it right. */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../supabase', () => ({ serviceDB: () => { throw new Error('no db in this test'); } }));
import { clockOf, GRACE_SECONDS } from '../server';
import type { Room } from '../../types';

const base = (over: Partial<Room>): Room => ({ id: 'r', quiz_id: 'q', host_id: 'h', join_code: 'ABCDEF', mode: 'classroom', flow: 'round_robin', status: 'active', config: { durationSeconds: 0, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: [], untimed: true, projector: { game: 'boss_battle', minutes: 15, focus: 'balanced' } }, current_index: 0, turn_index: 0, round_opened_at: null, started_at: new Date().toISOString(), expires_at: null, paused_at: null, revealed: false, steal_target_id: null, steal_active: false, ...over });

describe('projector clock', () => {
  it('15-minute lesson: the visible deadline is the room expiry minus the bounded grace for an open question', () => {
    const now = Date.now();
    const expires = new Date(now + 15 * 60_000 + GRACE_SECONDS * 1000).toISOString();
    const c = clockOf(base({ expires_at: expires }));
    expect(Math.round((Date.parse(c.deadlineAt!) - now) / 60_000)).toBe(15);
    expect(c.untimed).toBe(false); expect(c.overtime).toBe(false);
  });
  it('untimed lesson: no deadline and never overtime, even though the room keeps a safety expiry', () => {
    const c = clockOf(base({ expires_at: new Date(Date.now() + 1000).toISOString(), config: { ...base({}).config, projector: { game: 'boss_battle', minutes: null, focus: 'balanced' } } }));
    expect(c.untimed).toBe(true); expect(c.deadlineAt).toBeNull(); expect(c.overtime).toBe(false);
  });
  it('paused: never overtime while paused (resume shifts expires_at in SQL, so paused time is not burned)', () => {
    const c = clockOf(base({ expires_at: new Date(Date.now() + GRACE_SECONDS * 1000 - 60_000).toISOString(), paused_at: new Date().toISOString() }));
    expect(c.paused).toBe(true); expect(c.overtime).toBe(false);
    const running = clockOf(base({ expires_at: new Date(Date.now() + GRACE_SECONDS * 1000 - 60_000).toISOString() }));
    expect(running.overtime).toBe(true);
  });
});
