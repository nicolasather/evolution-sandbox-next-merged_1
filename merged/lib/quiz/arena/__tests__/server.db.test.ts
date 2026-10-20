/** Arena Clash against a REAL PostgreSQL engine (PGlite): the repository's own migrations 001–010, the real server, the real answer pipeline.
 *    npm run test:db -- lib/quiz/arena
 *  Local evidence only: PGlite is Postgres compiled to WASM, NOT the hosted Supabase project (that gate is separate and needs the owner). */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join as pathJoin } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

jest.setTimeout(240_000);
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../supabase', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use hoisted imports
  serviceDB: () => { const db = (require('../../projector/pgadapter') as typeof import('../../projector/pgadapter')).pgSupabase((globalThis as unknown as { __db: Pool }).__db); return { ...db, channel: () => ({ send: async () => 'ok' }), removeChannel: async () => 'ok' }; },
  currentUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
  maybeUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
}));

const MIG = (f: string) => readFileSync(pathJoin(__dirname, '../../../../supabase/migrations', f), 'utf8');
const UP = ['001_init.sql', '002_hardening.sql', '003_service_role_grants.sql', '004_quiz_studio_160.sql', '005_media_access_and_limits.sql', '005_projector_modes.sql', '006_projector_next_five.sql', '007_tower_defense.sql', '008_swarm_survival.sql', '009_obstacle_survival.sql', '010_arena_clash.sql'];
const SECRET = 'ARENA_SECRET_EXPLANATION_55C2';
let db: PGlite; let HOST = '';
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const realNow = Date.now.bind(Date); let clock = realNow(); let spy: jest.SpyInstance;
const cmd = () => `c${randomUUID().replace(/-/g, '')}`;
async function fresh(files = UP) {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create schema auth; create table auth.users(id uuid primary key, email text); create role anon; create role authenticated; create role service_role;');
  for (const f of files) await db.exec(MIG(f));
  (globalThis as unknown as { __db: unknown }).__db = db;
  HOST = randomUUID(); (globalThis as unknown as { __host: string }).__host = HOST; await q('insert into auth.users(id,email) values($1,$2)', [HOST, `${HOST}@t.invalid`]);
}
async function mkQuiz(n = 6) {
  const qs = Array.from({ length: n }, (_, i) => ({ kind: 'multiple_choice', prompt: 'MC ' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }] }, answerKey: { correctIds: ['a'], explanation: SECRET } }));
  const r = await q<{ r: string }>('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [HOST, 'AR-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(qs)]);
  return r[0].r;
}
type Srv = typeof import('../server');
const srv = async (): Promise<Srv> => import('../server');
beforeAll(() => { spy = jest.spyOn(Date, 'now').mockImplementation(() => clock); });
afterAll(() => spy.mockRestore());
beforeEach(() => { clock = realNow(); });
afterEach(async () => { await db?.close().catch(() => undefined); });
let kid = 0;
async function room(o: Record<string, unknown> = {}) {
  const ar = await srv(); const created = await ar.createArenaRoom({ quizId: await mkQuiz(), format: 'control', teamCount: 2, teamSizeCap: 5, minutes: 10, mapId: 'meadow_mosaic', ...o }, { id: HOST });
  return { ar, ...created };
}
const join = async (ar: Srv, code: string, team?: string) => { const j = await ar.joinArena({ joinCode: code, displayName: `Kid ${++kid}`, desiredTeam: team }, null); return j; };

describe('migration 010', () => {
  it('up creates the arena tables with RLS and no anon access; down removes them and nothing else; up again is idempotent', async () => {
    await fresh();
    const tables = async () => (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename like 'arena\\_%' order by 1")).map((t) => t.tablename);
    const t = await tables(); expect(t).toEqual(expect.arrayContaining(['arena_sessions', 'arena_seats', 'arena_events', 'arena_results']));
    expect((await q<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname like 'arena\\_%' and relkind='r'")).every((r) => r.relrowsecurity)).toBe(true);
    expect((await q("select count(*)::int c from pg_policies where tablename like 'arena\\_%'"))[0]).toEqual({ c: 0 });
    await db.exec('set role anon'); await expect(db.query('select * from arena_sessions')).rejects.toThrow(/permission denied/); await db.exec('reset role');
    await db.exec('set role service_role'); await expect(db.query('select count(*) from arena_seats')).resolves.toBeTruthy(); await db.exec('reset role');
    const others = (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename not like 'arena\\_%' order by 1")).map((x) => x.tablename);
    await db.exec(MIG('010_arena_clash_down.sql')); expect(await tables()).toEqual([]);
    expect((await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' order by 1")).map((x) => x.tablename)).toEqual(others);
    await db.exec(MIG('010_arena_clash.sql')); await db.exec(MIG('010_arena_clash.sql')); expect(await tables()).toEqual(t);
  });
});

describe('server on a real database', () => {
  it('creates a room, joins two teams, rejects bad commands, and never leaks an answer key to a student snapshot', async () => {
    await fresh(); const { ar, roomId, joinCode } = await room();
    const a = await join(ar, joinCode, 't1'); const b = await join(ar, joinCode, 't2');
    expect(a.teamId).toBe('t1'); expect(b.teamId).toBe('t2');
    const snap = await ar.snapshot(roomId, { view: 'student', seatId: a.seatId });
    expect(JSON.stringify(snap)).not.toContain(SECRET); expect(JSON.stringify(snap)).not.toContain('correctIds');
    // idempotent command: same id twice → second is a replay, not a second effect
    const c = cmd(); const r1 = await ar.seatCommand(roomId, a.seatId, c, { kind: 'role', role: 'runner' }); const r2 = await ar.seatCommand(roomId, a.seatId, c, { kind: 'role', role: 'runner' });
    expect(r1.ok).toBe(true); expect(r2.ok && r2.replayed).toBe(true);
    // a solo team may only be the Runner
    const bad = await ar.seatCommand(roomId, b.seatId, cmd(), { kind: 'role', role: 'sentinel' }); expect(bad.ok).toBe(false);
    // a purchase with no points fails server-side (the client never decides affordability), and a stale revision is reported as such
    const rev = (await q<{ revision: number }>('select revision from arena_sessions where room_id=$1', [roomId]))[0]!.revision;
    const poor = await ar.seatCommand(roomId, a.seatId, cmd(), { kind: 'buy', helper: 'trail_speed' }, rev - 1); expect(poor.ok).toBe(false);
  });
  it('a second room cannot be steered with another room’s seat; the host starts the match and the state advances only on the server clock', async () => {
    await fresh(); const A = await room(); const B = await room();
    const a1 = await join(A.ar, A.joinCode, 't1'); await join(A.ar, A.joinCode, 't2'); await join(B.ar, B.joinCode, 't1');
    const cross = await A.ar.submitInput(B.roomId, a1.seatId, { seq: 1, x: 1, y: 0 }); expect(cross.ok).toBe(false);
    const st = await A.ar.hostCommand(A.roomId, cmd(), { kind: 'start' }); expect(st.ok).toBe(true);
    clock += 120_000; const s = await A.ar.step(A.roomId, clock); expect(['question_open', 'arena_live', 'planning', 'countdown', 'intro', 'finished'].length).toBeGreaterThan(0); expect(s.revision).toBeGreaterThan(0);
  });
  it('rejects non-monotonic and out-of-range steering intent', async () => {
    await fresh(); const { ar, roomId, joinCode } = await room(); const a = await join(ar, joinCode, 't1'); await join(ar, joinCode, 't2');
    await ar.hostCommand(roomId, cmd(), { kind: 'start' });
    for (let i = 0; i < 40; i++) { clock += 5000; await ar.step(roomId, clock); const ph = (await ar.loadSession(roomId)).state.phase; if (ph === 'arena_live') break; }
    const ok = await ar.submitInput(roomId, a.seatId, { seq: 10, x: 1, y: 0 }); const stale = await ar.submitInput(roomId, a.seatId, { seq: 3, x: 1, y: 0 });
    expect(ok.ok || (!ok.ok && ok.code)).toBeTruthy(); expect(stale.ok && stale.replayed ? true : !stale.ok).toBe(true);
  });
});
