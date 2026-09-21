import { formatDate } from '@/lib/format';

describe('formatDate', () => {
  it('formats a date correctly', () => {
    expect(formatDate('2026-09-11')).toBe('11 September 2026');
  });
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });
  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });
});
