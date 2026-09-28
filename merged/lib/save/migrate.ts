import type { Migratable, Migration, MigrationOutcome } from './types';

/** Reads a save forward from whatever version it was written at to
 *  `currentVersion`, one step at a time, so nobody's progress ever
 *  disappears just because the schema grew. Every new persisted store in
 *  this project should route through this (see lib/profile/store.ts) rather
 *  than re-deriving its own ad hoc `if (v === 1) ... else if (v === 2)`
 *  ladder.
 *
 *  This deliberately mirrors, rather than replaces, the additive-optional-
 *  field pattern lib/engine.ts already uses for the Main Evolution save
 *  (`d.bag ?? []`, etc.) — that save works, is well understood, and is not
 *  touched by this module. This is for every *new* store. */
export function runMigrations<T extends Migratable>(
  raw: unknown,
  opts: {
    currentVersion: number;
    /** Each step only has to agree with its neighbours' shape, not with the
     *  final `T` — a v1→v2 step never has v3's fields yet. Only the very
     *  last shape is asserted to be `T`, by `isValid` below. */
    migrations: Migration[];
    isValid: (data: unknown) => data is T;
  },
): MigrationOutcome<T> {
  const { currentVersion, migrations, isValid } = opts;

  if (raw === null || typeof raw !== 'object') {
    return { data: null, migrated: false, error: 'not an object' };
  }
  const v = (raw as { v?: unknown }).v;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return { data: null, migrated: false, error: 'missing or invalid version' };
  }
  if (v > currentVersion) {
    // Written by a newer build than this one knows about. Refuse rather than
    // guess — a future migration step could otherwise silently corrupt data
    // an older build has no business touching.
    return { data: null, migrated: false, error: `save version ${v} is newer than ${currentVersion}` };
  }

  let data: Migratable = raw as Migratable;
  let migrated = false;
  let cursor = v;
  const byFrom = new Map(migrations.map(m => [m.from, m]));
  while (cursor < currentVersion) {
    const step = byFrom.get(cursor);
    if (!step) {
      return { data: null, migrated, error: `no migration registered from version ${cursor}` };
    }
    let next: Migratable;
    try {
      next = step.migrate(data);
    } catch (e) {
      return { data: null, migrated, error: `migration from v${cursor} threw: ${String(e)}` };
    }
    if (next.v !== cursor + 1) {
      return { data: null, migrated, error: `migration from v${cursor} did not set v to ${cursor + 1}` };
    }
    data = next;
    migrated = true;
    cursor = next.v;
  }

  if (!isValid(data)) {
    return { data: null, migrated, error: 'final shape failed validation' };
  }
  return { data, migrated, error: null };
}
