/* Minimal database port (ticket 076). Production uses node-postgres (`pgDb`); tests use PGlite, a real
   PostgreSQL engine compiled to WASM (`pgliteDb`). Neither is a managed cloud database: cloud proof is BLOCKED
   until the owner provisions one (docs/PHASE2_STATUS.md). All SQL is parameterised; no string interpolation. */

export interface QueryResult<T> { rows: T[]; rowCount: number }
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  /** Several statements at once, no parameters (migrations only). */
  exec(text: string): Promise<void>;
}
export interface Db extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** node-postgres adapter. `pool` is a pg.Pool created from DATABASE_URL by the caller (server-only). */
export function pgDb(pool: import('pg').Pool): Db {
  const wrap = (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Sql => ({
    async query<T>(text: string, params: readonly unknown[] = []) {
      const r = await c.query(text, params as unknown[]);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? r.rows.length };
    },
    async exec(text: string) { await c.query(text); },     // no values array => simple protocol, multi-statement allowed
  });
  return {
    ...wrap(pool),
    async transaction<T>(fn: (tx: Sql) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch { /* connection is gone; nothing to roll back */ }
        throw e;
      } finally { client.release(); }
    },
    async close() { await pool.end(); },
  };
}

/** PGlite adapter (tests and local development). */
export function pgliteDb(pg: import('@electric-sql/pglite').PGlite): Db {
  const wrap = (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>; exec: (t: string) => Promise<unknown> }): Sql => ({
    async query<T>(text: string, params: readonly unknown[] = []) {
      const r = await c.query(text, params as unknown[]);
      return { rows: r.rows as T[], rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(text: string) { await c.exec(text); },
  });
  return {
    ...wrap(pg),
    transaction: <T,>(fn: (tx: Sql) => Promise<T>) => pg.transaction(tx => fn(wrap(tx))),
    close: () => pg.close(),
  };
}
