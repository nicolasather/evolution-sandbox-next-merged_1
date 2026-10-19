/** A minimal supabase-js look-alike over a real `pg` pool, so server code runs against real SQL in tests. */
import type { Pool } from 'pg';

type Filter = { col: string; val: unknown };
type Res = { data: unknown; error: { code?: string; message: string } | null; count?: number | null };
class Query implements PromiseLike<Res> {
  private op: 'select' | 'update' | 'delete' | 'insert' = 'select';
  private cols = '*'; private filters: Filter[] = []; private ord: { col: string; asc: boolean }[] = []; private lim: number | null = null; private patch: Record<string, unknown> = {};
  private head = false; private wantCount = false; private single: 'maybe' | 'one' | null = null; private rows: Record<string, unknown>[] = [];
  constructor(private pool: Pool, private table: string) {}
  select(cols = '*', o?: { count?: string; head?: boolean }) { if (this.op === 'select') { this.cols = cols; } this.wantCount = !!o?.count; this.head = !!o?.head; return this; }
  update(p: Record<string, unknown>) { this.op = 'update'; this.patch = p; return this; }
  delete() { this.op = 'delete'; return this; }
  insert(r: Record<string, unknown> | Record<string, unknown>[]) { this.op = 'insert'; this.rows = Array.isArray(r) ? r : [r]; return this; }
  eq(col: string, val: unknown) { this.filters.push({ col, val }); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.ord.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.single = 'maybe'; return this; }
  async exec(): Promise<Res> {
    const q = (s: string) => `"${s.replace(/"/g, '')}"`;
    const params: unknown[] = []; const where = this.filters.length ? ' where ' + this.filters.map((f) => { params.push(f.val); return `${q(f.col)} = $${params.length}`; }).join(' and ') : '';
    try {
      if (this.op === 'insert') {
        const r = this.rows[0]!; const keys = Object.keys(r); const vals = keys.map((k) => (typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k]));
        await this.pool.query(`insert into public.${q(this.table)} (${keys.map(q).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, vals); return { data: null, error: null };
      }
      if (this.op === 'update') {
        const keys = Object.keys(this.patch); const sets = keys.map((k) => { params.push(typeof this.patch[k] === 'object' && this.patch[k] !== null ? JSON.stringify(this.patch[k]) : this.patch[k]); return `${q(k)} = $${params.length}`; });
        await this.pool.query(`update public.${q(this.table)} set ${sets.join(',')}${where}`, params); return { data: null, error: null };
      }
      if (this.op === 'delete') { await this.pool.query(`delete from public.${q(this.table)}${where}`, params); return { data: null, error: null }; }
      const cols = this.cols.split(',').map((c) => c.trim()).filter(Boolean).map((c) => (c === '*' ? '*' : q(c))).join(',');
      if (this.head) { const r = await this.pool.query(`select count(*)::int c from public.${q(this.table)}${where}`, params); return { data: null, error: null, count: r.rows[0].c as number }; }
      const order = this.ord.length ? ' order by ' + this.ord.map((o) => `${q(o.col)} ${o.asc ? 'asc' : 'desc'}`).join(',') : '';
      const lim = this.lim ? ` limit ${this.lim}` : this.single ? ' limit 1' : '';
      const r = await this.pool.query(`select ${cols} from public.${q(this.table)}${where}${order}${lim}`, params);
      const rows = r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
      return { data: this.single ? (rows[0] ?? null) : rows, error: null, count: this.wantCount ? rows.length : undefined };
    } catch (e) { const err = e as { code?: string; message: string }; return { data: null, error: { code: err.code, message: err.message } }; }
  }
  then<T1 = Res, T2 = never>(ok?: ((v: Res) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null): Promise<T1 | T2> { return this.exec().then(ok, bad); }
}
export function pgSupabase(pool: Pool) {
  return {
    from: (t: string) => new Query(pool, t),
    async rpc(name: string, args: Record<string, unknown>) {
      const keys = Object.keys(args);
      const vals = keys.map((k) => (typeof args[k] === 'object' && args[k] !== null && !Array.isArray(args[k]) ? JSON.stringify(args[k]) : args[k]));
      try { const r = await pool.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}${typeof args[k] === 'object' && args[k] !== null && !Array.isArray(args[k]) ? '::jsonb' : ''}`).join(',')}) as r`, vals); return { data: r.rows[0].r, error: null }; }
      catch (e) { const err = e as { code?: string; message: string }; return { data: null, error: { code: err.code, message: err.message } }; }
    },
  };
}
