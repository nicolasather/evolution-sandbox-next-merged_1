/** @jest-environment node */
/** Regression: approval requests are stamped with the server's trusted time, never the 0 sentinel. */
import { reduceHost, reduceSeat } from '../engine';
import { makeMatch, seatUp } from '../testkit';
import type { OSState } from '../domain';

const ids = ['seat-0xxx', 'seat-1xxx'];
test('a request for a costly upgrade records requestedMs from the supplied trusted clock', () => {
  const m = makeMatch({ approvalAbove: 100 }, 6); let s = seatUp(m.state, ids);
  const r = reduceHost(s, { kind: 'start' }, 1_000_000); if (!r.result.ok) throw new Error('start'); s = JSON.parse(JSON.stringify(r.result.state)) as OSState;
  s.phase = 'build_choice'; s.teams[0].points = 300; s.phaseDeadlineMs = 1_060_000;
  const ask = reduceSeat(s, ids[0]!, { kind: 'purchase', perk: 'bridge_socket' }, 1_023_456);
  if (!ask.ok) throw new Error(ask.code);
  expect(ask.state.approvals).toHaveLength(1); expect(ask.state.approvals![0]!.requestedMs).toBe(1_023_456);
});
