/** Clue Racing against a REAL PostgreSQL engine (PGlite): the repository's own migrations 001–011, the real server, the real answer pipeline.
 *    npm run test:db -- lib/quiz/cr
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
const UP = ['001_init.sql', '002_hardening.sql', '003_service_role_grants.sql', '004_quiz_studio_160.sql', '005_media_access_and_limits.sql', '005_projector_modes.sql', '006_projector_next_five.sql', '007_tower_defense.sql', '008_swarm_survival.sql', '009_obstacle_survival.sql', '010_arena_clash.sql', '011_clue_racing.sql'];
const SECRET = 'CR_SECRET_EXPLANATION_77A1';
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
async function mkQuiz(n = 8) {
  const qs = Array.from({ length: n }, (_, i) => ({ kind: 'multiple_choice', prompt: 'MC ' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }] }, answerKey: { correctIds: ['a'], explanation: SECRET } }));
  const r = await q<{ r: string }>('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [HOST, 'CR-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(qs)]);
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
  const cr = await srv(); const created = await cr.createCrRoom({ quizId: await mkQuiz(), format: 'split_route', teamCount: 2, teamSizeCap: 5, minutes: 15, mapId: 'sunleaf_passage', ...o }, { id: HOST });
  return { cr, ...created };
}
const join = async (cr: Srv, code: string, team?: string) => cr.joinCr({ joinCode: code, displayName: `Kid ${++kid}`, desiredTeam: team }, null);

describe('migration 011', () => {
  it('up creates the cr tables with RLS and no anon access; down removes them and nothing else; up again is idempotent', async () => {
    await fresh();
    const tables = async () => (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename like 'cr\\_%' order by 1")).map((t) => t.tablename);
    const t = await tables(); expect(t).toEqual(expect.arrayContaining(['cr_sessions', 'cr_seats', 'cr_events', 'cr_results', 'cr_awards', 'cr_purchases']));
    expect((await q<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname like 'cr\\_%' and relkind='r'")).every((r) => r.relrowsecurity)).toBe(true);
    expect((await q("select count(*)::int c from pg_policies where tablename like 'cr\\_%'"))[0]).toEqual({ c: 0 });
    await db.exec('set role anon'); await expect(db.query('select * from cr_sessions')).rejects.toThrow(/permission denied/); await db.exec('reset role');
    await db.exec('set role service_role'); await expect(db.query('select count(*) from cr_seats')).resolves.toBeTruthy(); await db.exec('reset role');
    const others = (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename not like 'cr\\_%' order by 1")).map((x) => x.tablename);
    await db.exec(MIG('011_clue_racing_down.sql')); expect(await tables()).toEqual([]);
    expect((await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' order by 1")).map((x) => x.tablename)).toEqual(others);
    expect((await q("select count(*)::int c from pg_tables where schemaname='public' and tablename like 'arena\\_%'"))[0]).toEqual({ c: 7 }); // Arena Clash is untouched
    await db.exec(MIG('011_clue_racing.sql')); await db.exec(MIG('011_clue_racing.sql')); expect(await tables()).toEqual(t);
  });
});

describe('server on a real database', () => {
  it('creates a room, joins two teams, derives roles, rejects bad commands, and never leaks a key to a student snapshot', async () => {
    await fresh(); const { cr, roomId, joinCode } = await room();
    const a = await join(cr, joinCode, 't1'); const b = await join(cr, joinCode, 't2'); const a2 = await join(cr, joinCode, 't1');
    expect(a.teamId).toBe('t1'); expect(b.teamId).toBe('t2');
    const snap = await cr.snapshot(roomId, { view: 'student', seatId: a.seatId });
    const text = JSON.stringify(snap); expect(text).not.toContain(SECRET); expect(text).not.toContain('correctIds'); expect(text).not.toContain('postIdx'); expect(text).not.toContain('"seed"'); expect(text).not.toContain('"order"');
    // lone student is a Solo Pathfinder; once a teammate joins both hold distinct team roles
    expect(snap.you!.role).not.toBe('solo_pathfinder');
    const bSnap = await cr.snapshot(roomId, { view: 'student', seatId: b.seatId }); expect(bSnap.you!.role).toBe('solo_pathfinder');
    const c = cmd(); const r1 = await cr.seatCommand(roomId, a.seatId, c, { kind: 'role', role: 'cartographer' }); const r2 = await cr.seatCommand(roomId, a.seatId, c, { kind: 'role', role: 'cartographer' });
    expect(r1.ok).toBe(true); expect(r2.ok && r2.replayed).toBe(true);
    const taken = await cr.seatCommand(roomId, a2.seatId, cmd(), { kind: 'role', role: 'cartographer' }); expect(taken.ok).toBe(false);
    const solo = await cr.seatCommand(roomId, b.seatId, cmd(), { kind: 'role', role: 'scout' }); expect(solo.ok).toBe(false);
    const rev = (await q<{ revision: number }>('select revision from cr_sessions where room_id=$1', [roomId]))[0]!.revision;
    const poor = await cr.seatCommand(roomId, a.seatId, cmd(), { kind: 'buy', perk: 'route_lamp' }, rev - 1); expect(poor.ok).toBe(false);
  });
  it('a second room cannot be steered with another room’s seat; the host starts the race and the state advances only on the server clock', async () => {
    await fresh(); const A = await room(); const B = await room();
    const a1 = await join(A.cr, A.joinCode, 't1'); await join(A.cr, A.joinCode, 't2'); await join(B.cr, B.joinCode, 't1');
    const cross = await A.cr.submitInput(B.roomId, a1.seatId, { seq: 1, x: 1, y: 0 }); expect(cross.ok).toBe(false);
    const st = await A.cr.hostCommand(A.roomId, cmd(), { kind: 'start' }); expect(st.ok).toBe(true);
    clock += 12_000; const s = await A.cr.step(A.roomId, clock); expect(s.state.phase).toBe('race');
  });
  it('rejects non-monotonic and out-of-range steering intent, and a forged position can never be sent', async () => {
    await fresh(); const { cr, roomId, joinCode } = await room(); const a = await join(cr, joinCode, 't1'); await join(cr, joinCode, 't2');
    await cr.hostCommand(roomId, cmd(), { kind: 'start' }); clock += 12_000; await cr.step(roomId, clock);
    const ok = await cr.submitInput(roomId, a.seatId, { seq: 10, x: 1, y: 0 }); const stale = await cr.submitInput(roomId, a.seatId, { seq: 3, x: 1, y: 0 });
    expect(ok.ok).toBe(true); expect(stale.ok && stale.replayed).toBe(true);
    const wild = await cr.submitInput(roomId, a.seatId, { seq: 11, x: 99, y: 0 }); expect(wild.ok).toBe(false);
    const { crMoveSchema } = await import('../validation'); expect(crMoveSchema.safeParse({ seq: 12, x: 0, y: 0, px: 100, py: 100 }).success).toBe(false);
  });
  it('plays a whole race: the quiz window freezes the world, awards are credited exactly once, and a replayed system command is rejected', async () => {
    await fresh(); const { cr, roomId, joinCode } = await room({ minutes: 10 }); const a = await join(cr, joinCode, 't1'); const b = await join(cr, joinCode, 't2');
    expect((await cr.hostCommand(roomId, cmd(), { kind: 'start' })).ok).toBe(true);
    let sawBarrier = false;
    for (let i = 0; i < 400; i++) {
      clock += 4000; const row = await cr.step(roomId, clock); const s = row.state;
      if (s.phase === 'barrier') { sawBarrier = true; const tickAt = s.live!.tick; const rq = (await q<{ id: string }>('select id from room_questions where room_id=$1 and position=$2', [roomId, s.question!.position]))[0]!.id; await cr.answer(roomId, await tokenOf(roomId, a.seatId), a.seatId, { roomQuestionId: rq, response: { selected: ['a'] } }).catch(() => undefined); void b; clock += 2000; const after = await cr.step(roomId, clock); expect(after.state.live!.tick).toBe(tickAt); }
      if (s.phase === 'finished') break;
    }
    const fin = await cr.loadSession(roomId); expect(sawBarrier).toBe(true); expect(fin.state.phase).toBe('finished');
    const awards = await q<{ n: number }>('select count(*)::int n from (select credit_key from cr_awards where room_id=$1 group by credit_key having count(*)>1) x', [roomId]); expect(awards[0]!.n).toBe(0);
    expect((await q('select * from cr_results where room_id=$1', [roomId])).length).toBe(2);
    await expect(db.query("update cr_results set score = 1 where room_id=$1", [roomId])).rejects.toThrow(/final/);
    const dupe = await cr.commit(roomId, { actor: 'system', command: 'x-1234567890', expected: fin.revision, action: 'advance:test', state: fin.state }).catch((e: Error) => e); expect(dupe).toBeInstanceOf(Error);
  });
  it('a perk is bought once per team per leg even under a racing duplicate commit', async () => {
    await fresh(); const { cr, roomId, joinCode } = await room(); const a = await join(cr, joinCode, 't1'); await join(cr, joinCode, 't2');
    const s0 = await cr.loadSession(roomId);
    const base = { actor: a.seatId, expected: s0.revision, action: 'seat:buy', state: s0.state, purchases: [{ leg: 1, teamId: 't1', perk: 'route_lamp', cost: 100, seatId: a.seatId }] };
    const r1 = await cr.commit(roomId, { ...base, command: cmd() }); expect(r1.replayed).toBe(false);
    const s1 = await cr.loadSession(roomId);
    await expect(cr.commit(roomId, { ...base, expected: s1.revision, command: cmd() })).rejects.toBeTruthy();
    expect((await q('select * from cr_purchases where room_id=$1', [roomId])).length).toBe(1);
  });
});
async function tokenOf(roomId: string, seatId: string): Promise<string> {
  // Seats authenticate with a per-room secret; the test re-issues one for the player row (only its hash is stored).
  const { hashSecret } = await import('../../rooms'); const token = 'tok' + randomUUID().replace(/-/g, '');
  await db.query('update players set secret_hash = $1 where id = $2 and room_id = $3', [hashSecret(token), seatId, roomId]); return token;
}
