import { EPISODES, GENERATED_EPISODES } from '../registry';
import { solveEscape } from '@/lib/server/creative/modes/solvers';

describe('generated escape-room episodes', () => {
  it('has one room per expansion topic with unique ids', () => {
    expect(GENERATED_EPISODES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EPISODES.map(e => e.id)).size).toBe(EPISODES.length);
  });
  it.each(GENERATED_EPISODES.map(e => [e.id]))('%s is solvable from its own data', id => {
    expect(solveEscape(id).ok).toBe(true);
  });
});
