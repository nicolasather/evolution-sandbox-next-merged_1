import { playMatch } from '../testkit';
import { standingsOf } from '../engine';
import type { Format } from '../domain';
describe('smoke', () => {
  for (const format of ['split_route', 'signal_relay', 'atlas_circuit'] as Format[]) {
    it(`plays ${format} to completion`, () => {
      const { state, ms, phases } = playMatch({ format, sizes: [3, 1], questions: 12, minutes: 15 });
      console.log(format, 'ms', ms, 'windows', state.plan.windows, 'legSec', state.plan.legSeconds, standingsOf(state).standings.map((x) => [x.teamId, x.score, x.mastery, x.route, x.teamwork]), state.teams.map((t) => [t.legsDone, t.legsAssisted, t.retries]), phases.length);
      expect(state.phase).toBe('finished');
    });
  }
});
