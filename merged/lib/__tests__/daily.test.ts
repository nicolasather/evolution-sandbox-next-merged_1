import { dailyPick, dayKey } from '@/lib/daily';
import { dailyKey } from '@/lib/seed';
import { playDb } from '@/lib/processing';

describe('dayKey', () => {
  it('is exactly lib/seed.ts\'s own dailyKey — one canonical date-key format, not a second one', () => {
    const d = new Date('2026-09-28T23:00:00Z');
    expect(dayKey(d)).toBe(dailyKey(d));
    expect(dayKey(d)).toBe('2026-09-28');
  });
});

describe('dailyPick', () => {
  it('is deterministic: the same day always picks the same discovery', () => {
    const a = dailyPick(playDb, '2026-09-28');
    const b = dailyPick(playDb, '2026-09-28');
    expect(a).not.toBeNull();
    expect(a!.id).toBe(b!.id);
  });

  it('different days routinely pick different discoveries', () => {
    const picks = new Set(
      Array.from({ length: 14 }, (_, i) => dailyPick(playDb, `2026-09-${String(i + 1).padStart(2, '0')}`)!.id),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('only ever picks from the real pool: not hidden, not primitive, depth >= 2', () => {
    for (let i = 1; i <= 20; i++) {
      const n = dailyPick(playDb, `2026-0${(i % 9) + 1}-${String(i).padStart(2, '0')}`);
      expect(n).not.toBeNull();
      expect(n!.hidden).not.toBe(true);
      expect(playDb.primitives).not.toContain(n!.id);
      expect(n!.depth ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns null when nothing in the database qualifies', () => {
    const empty = { ...playDb, nodes: [], primitives: [] };
    expect(dailyPick(empty)).toBeNull();
  });
});
