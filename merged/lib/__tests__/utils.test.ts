import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('handles conditional classes', () => {
    expect(cn('base', true && 'on')).toBe('base on');
  });
});
