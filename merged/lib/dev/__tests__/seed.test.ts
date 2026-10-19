import { freshSeed } from '../seed';
import { devOverrides } from '../overrides';

describe('freshSeed', () => {
  afterEach(() => devOverrides._reset());
  it('keeps the time-based format when nothing is pinned (production behaviour)', () => {
    expect(freshSeed('run', 123)).toBe('run-123');
  });
});
