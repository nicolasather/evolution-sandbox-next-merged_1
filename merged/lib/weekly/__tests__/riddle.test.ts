import { riddleOf } from '@/lib/weekly/riddle';
import { playDb } from '@/lib/processing';

describe('riddleOf', () => {
  it('never leaks the target discovery\'s own name into its riddle text', () => {
    const eligible = playDb.nodes.filter(n => !n.hidden && !n.primitive && n.l1);
    for (const n of eligible) {
      expect(riddleOf(n).toLowerCase()).not.toContain(n.n.toLowerCase());
    }
  });

  it('is deterministic and depends only on the given discovery', () => {
    const n = playDb.nodes.find(x => !x.hidden && !x.primitive && x.l1)!;
    expect(riddleOf(n)).toBe(riddleOf(n));
  });
});
