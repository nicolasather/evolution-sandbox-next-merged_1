import { runMigrations } from '@/lib/save/migrate';
import type { Migratable, Migration } from '@/lib/save/types';

interface V1 extends Migratable { v: 1; name: string }
interface V2 extends Migratable { v: 2; name: string; tags: string[] }
interface V3 extends Migratable { v: 3; name: string; tags: string[]; archived: boolean }
type Latest = V3;

const migrations: Migration[] = [
  { from: 1, migrate: d => ({ ...d, v: 2, tags: [] }) },
  { from: 2, migrate: d => ({ ...d, v: 3, archived: false }) },
];

const isValid = (d: unknown): d is Latest => {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.v === 3 && typeof o.name === 'string' && Array.isArray(o.tags) && typeof o.archived === 'boolean';
};

const run = (raw: unknown) => runMigrations<Latest>(raw, { currentVersion: 3, migrations, isValid });

describe('runMigrations', () => {
  it('walks a v1 save all the way to current, additively', () => {
    const out = run({ v: 1, name: 'Aro' } as V1);
    expect(out.error).toBeNull();
    expect(out.migrated).toBe(true);
    expect(out.data).toEqual({ v: 3, name: 'Aro', tags: [], archived: false });
  });

  it('walks a v2 save the remaining one step', () => {
    const out = run({ v: 2, name: 'Bo', tags: ['x'] } as V2);
    expect(out.error).toBeNull();
    expect(out.data).toEqual({ v: 3, name: 'Bo', tags: ['x'], archived: false });
  });

  it('a save already at the current version passes through untouched', () => {
    const out = run({ v: 3, name: 'Cho', tags: [], archived: true });
    expect(out.error).toBeNull();
    expect(out.migrated).toBe(false);
    expect(out.data).toEqual({ v: 3, name: 'Cho', tags: [], archived: true });
  });

  it('refuses a save from a newer build rather than guessing', () => {
    const out = run({ v: 99, name: 'future' });
    expect(out.data).toBeNull();
    expect(out.error).toMatch(/newer/);
  });

  it('refuses malformed input instead of throwing', () => {
    expect(run(null).error).toMatch(/not an object/);
    expect(run('nope').error).toMatch(/not an object/);
    expect(run({ name: 'no version' }).error).toMatch(/version/);
  });

  it('refuses when no migration path exists from the stored version', () => {
    const out = runMigrations<Latest>({ v: 1, name: 'x' }, {
      currentVersion: 3,
      migrations: [{ from: 2, migrate: d => ({ ...d, v: 3 }) }],
      isValid,
    });
    expect(out.data).toBeNull();
    expect(out.error).toMatch(/no migration registered/);
  });

  it('never throws even if a migration step does', () => {
    const bad: Migration[] = [{ from: 1, migrate: () => { throw new Error('boom'); } }];
    const out = runMigrations<Latest>({ v: 1, name: 'x' }, { currentVersion: 3, migrations: bad, isValid });
    expect(out.data).toBeNull();
    expect(out.error).toMatch(/threw/);
  });

  it('rejects a migration step that forgets to bump v', () => {
    const bad: Migration[] = [{ from: 1, migrate: d => ({ ...d, tags: [] }) }];
    const out = runMigrations<Latest>({ v: 1, name: 'x' }, { currentVersion: 3, migrations: bad, isValid });
    expect(out.data).toBeNull();
    expect(out.error).toMatch(/did not set v/);
  });
});
