/** A persisted blob shaped like the existing engine save (lib/engine.ts's
 *  `Saved`): a flat object with its schema version at `v`, siblings added
 *  additively as the version grows. `runMigrations` (./migrate) walks one of
 *  these forward version by version so a new store never has to hand-roll
 *  its own migration chain. */
export interface Migratable {
  v: number;
  [key: string]: unknown;
}

/** Upgrades a save from exactly version `from` to `from + 1`. Must not throw;
 *  return the input unchanged (but do not just mutate — see migrate.ts) if
 *  there is truly nothing to do at this step. */
export interface Migration<T extends Migratable = Migratable> {
  from: number;
  migrate: (data: T) => T;
}

export interface MigrationOutcome<T> {
  /** The upgraded, validated save — or null if it could not be recovered. */
  data: T | null;
  /** True if at least one migration step ran. */
  migrated: boolean;
  /** Set when `data` is null: why nothing could be loaded. Never thrown. */
  error: string | null;
}
