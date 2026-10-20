/** Swarm persistence against a REAL PostgreSQL engine (PGlite) with the repository's own migrations 001–003 + 008, then the real worker and the
 *  Next-side routes on top of it.   npm run test:db -- lib/swarm
 *  Everything here is local: PGlite is Postgres compiled to WASM, not Supabase. It proves SQL semantics (constraints, fencing, RLS, immutability),
 *  not the hosted project. */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

jest.setTimeout(120_000);
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../../quiz/supabase', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use hoisted imports
  serviceDB: () => (require('../../../quiz/projector/pgadapter') as typeof import('../../../quiz/projector/pgadapter')).pgSupabase((globalThis as unknown as { __db: Pool }).__db),
  currentUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
  maybeUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
}));

const MIG = (f: string) => readFileSync(join(__dirname, '../../../../supabase/migrations', f), 'utf8');
const SECRET = 'db-test-secret-db-test-secret-1234';
let db: PGlite; let HOST = '';
afterEach(async () => { await db?.close().catch(() => undefined); });
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;

async function fresh() {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create schema auth; create table auth.users(id uuid primary key, email text); create role anon; create role authenticated; create role service_role;');
  for (const f of ['001_init.sql', '002_hardening.sql', '003_service_role_grants.sql', '008_swarm_survival.sql']) await db.exec(MIG(f));
  (globalThis as unknown as { __db: unknown }).__db = db;
  HOST = randomUUID(); (globalThis as unknown as { __host: string }).__host = HOST; await q('insert into auth.users(id,email) values($1,$2)', [HOST, `${HOST}@t.invalid`]);
}
async function mkQuiz(n = 8) {
  const id = randomUUID(); await q("insert into quizzes(id, owner_id, title, status) values ($1,$2,'Swarm DB','published')", [id, HOST]);
  for (let i = 0; i < n; i++) {
    const mc = i % 2 === 0;
    await q('insert into quiz_questions(quiz_id, position, kind, prompt, payload, answer_key, base_points) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,100)', [id, i, mc ? 'multiple_choice' : 'answer_forge', `Q${i + 1}?`,
      JSON.stringify(mc ? { options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }] } : { placeholder: 'x' }), JSON.stringify(mc ? { correctIds: ['a'], explanation: 'DB_EXPLANATION_KEY' } : { accepted: ['forty two'], explanation: 'DB_EXPLANATION_KEY' })]);
  }
  return id;
}
async function mkRoom(quizId: string, code = 'ABCD23') {
  const r = await q<{ r: { roomId: string } }>("select create_room_with_content($1,$2,'online','synchronized','{}'::jsonb,$3,'{}'::text[],null) as r", [HOST, quizId, code]); return r[0]!.r.roomId;
}
const cfg = { mode: 'versus', teamCount: 2, teamSizeCap: 2, minutes: 5, mapId: 'meadow_circuit', difficulty: 'normal', focus: 'balanced', lowPressure: false, hideTeamNames: false, allowReviewCycle: false, captainOnlyDraft: false, allowRespec: false, questionSeconds: null };

describe('migration 008', () => {
  beforeEach(fresh);
  it('up creates seven tables with RLS and no anon access; down removes everything; up again is idempotent', async () => {
    const tables = async () => (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename like 'swarm_%' order by 1")).map((t) => t.tablename);
    expect(await tables()).toEqual(['swarm_answers', 'swarm_audit', 'swarm_credits', 'swarm_participants', 'swarm_purchases', 'swarm_results', 'swarm_sessions']);
    expect((await q<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname like 'swarm_%' and relkind='r'")).every((r) => r.relrowsecurity)).toBe(true);
    await db.exec('set role anon'); await expect(db.query('select * from swarm_sessions')).rejects.toThrow(/permission denied/); await expect(db.query("select swarm_acquire_lease(gen_random_uuid(),'x',30)")).rejects.toThrow(/permission denied/); await db.exec('reset role');
    await db.exec('set role service_role'); await expect(db.query('select count(*) from swarm_sessions')).resolves.toBeTruthy(); await db.exec('reset role');
    await db.exec(MIG('008_swarm_survival_down.sql')); expect(await tables()).toEqual([]);
    expect((await q("select proname from pg_proc where proname like 'swarm_%'")).length).toBe(0);
    await db.exec(MIG('008_swarm_survival.sql')); expect((await tables()).length).toBe(7); await db.exec(MIG('008_swarm_survival.sql')); expect((await tables()).length).toBe(7); // re-run is a no-op
    expect((await q("select count(*)::int c from rooms"))[0]).toEqual({ c: 0 }); // never touched the classic tables
  });
  it('session creation is owner-only; lease is single-writer; checkpoints are fenced and monotonic', async () => {
    const room = await mkRoom(await mkQuiz());
    await expect(db.query('select swarm_create_session($1,$2,$3::jsonb,5)', [room, randomUUID(), JSON.stringify(cfg)])).rejects.toThrow(/not the host/);
    await db.query('select swarm_create_session($1,$2,$3::jsonb,12345)', [room, HOST, JSON.stringify(cfg)]);
    await expect(db.query('select swarm_create_session($1,$2,$3::jsonb,5)', [room, HOST, JSON.stringify(cfg)])).rejects.toThrow(/duplicate|unique/);
    const lease = async (w: string, ttl = 30) => (await q<{ ok: boolean }>('select swarm_acquire_lease($1,$2,$3) as ok', [room, w, ttl]))[0]!.ok;
    expect(await lease('A')).toBe(true); expect(await lease('B')).toBe(false); expect(await lease('A')).toBe(true); // renew
    await expect(db.query('select swarm_acquire_lease($1,$2,1)', [room, 'A'])).rejects.toThrow(/bad ttl/);
    const save = async (w: string, rev: number) => (await q<{ ok: boolean }>('select swarm_save_checkpoint($1,$2,$3,$4::jsonb) as ok', [room, w, rev, JSON.stringify({ rev })]))[0]!.ok;
    expect(await save('A', 5)).toBe(true); expect(await save('A', 4)).toBe(false); expect(await save('A', 5)).toBe(true); expect(await save('B', 9)).toBe(false); // wrong worker is fenced out
    await q("update swarm_sessions set lease_until = now() - interval '1 second' where room_id=$1", [room]);
    expect(await save('A', 10)).toBe(false); // an expired lease cannot write
    expect(await lease('B')).toBe(true); expect(await save('B', 6)).toBe(true); expect(await save('A', 99)).toBe(false); // the old worker is a zombie now
    await expect(db.query("select swarm_save_checkpoint($1,'B',7,$2::jsonb)", [room, JSON.stringify({ pad: 'x'.repeat(3_100_000) })])).rejects.toThrow(/swarm_checkpoint_size/);
  });
  it('primary keys give exactly-once answers, credits and purchases; amounts are bounded; results are immutable', async () => {
    const { PgStore } = await import('../store'); const store = new PgStore(db as never);
    const room = await mkRoom(await mkQuiz()); await db.query('select swarm_create_session($1,$2,$3::jsonb,1)', [room, HOST, JSON.stringify(cfg)]);
    const qid = (await q<{ id: string }>('select id from room_questions where room_id=$1 limit 1', [room]))[0]!.id; const pid = 'a'.repeat(24);
    const a = { window: 'q1', pid, questionId: qid, response: { kind: 'multiple_choice', selectedIds: ['a'] }, frac: 1, correct: true };
    const results = await Promise.all(Array.from({ length: 12 }, () => store.recordAnswer(room, a))); expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.recordAnswer(room, { ...a, frac: 0, correct: false })).toBe(false); expect((await q<{ correct: boolean }>('select correct from swarm_answers'))[0]!.correct).toBe(true); // a replay cannot flip the grade
    const ev = { seq: 1, tick: 1, k: 'award', team: 't1', a: { q: 'q1', award: 100, eligible: 2 } };
    await store.recordEvents(room, [ev, ev, { ...ev, a: { q: 'q1', award: 5, eligible: 2 } }]); const credits = await q<{ amount: number }>('select amount from swarm_credits'); expect(credits).toEqual([{ amount: 100 }]);
    await expect(db.query("insert into swarm_credits(room_id, window_id, team_id, amount, eligible) values ($1,'q2','t1',101,2)", [room])).rejects.toThrow(/check/);
    const buy = { seq: 2, tick: 2, k: 'purchase', team: 't1', a: { draft: 'd1', upgrade: 'fan_bolts', cost: 90, walletBefore: 150, walletAfter: 60, how: 'vote' } };
    await store.recordEvents(room, [buy, buy]); expect((await q('select * from swarm_purchases')).length).toBe(1);
    await expect(db.query("insert into swarm_purchases(room_id,draft_id,team_id,upgrade,cost,wallet_before,wallet_after,how) values ($1,'d2','t1','fan_bolts',90,150,10,'vote')", [room])).rejects.toThrow(/check/); // wallet must equal before - cost
    await expect(db.query("insert into swarm_purchases(room_id,draft_id,team_id,upgrade,cost,wallet_before,wallet_after,how) values ($1,'d3','t1','free_gold',0,10,10,'vote')", [room])).rejects.toThrow(/check/);
    await store.audit(room, { id: 'cmd-1', cmd: 'pause', at: 1 }); await store.audit(room, { id: 'cmd-1', cmd: 'pause', at: 2 }); expect((await q('select * from swarm_audit')).length).toBe(1);
    await store.saveSeat(room, { id: pid, name: 'Ann', teamId: 't1', role: 'scout' }); await expect(store.saveSeat(room, { id: 'b'.repeat(24), name: ' ann ', teamId: 't1', role: 'scout' })).rejects.toThrow(/unique|duplicate/); // names are unique per room (case/space-insensitive)
    await store.finish(room, 'finished', { reason: 'all_fallen', outcome: 'lost', standings: [], at: 1 }); expect((await store.load(room))!.status).toBe('finished');
    await expect(db.query("update swarm_results set outcome='won' where room_id=$1", [room])).rejects.toThrow(/immutable/);
    await store.finish(room, 'finished', { reason: 'again', outcome: 'won', standings: [], at: 2 }); expect((await q<{ outcome: string }>('select outcome from swarm_results'))[0]!.outcome).toBe('lost');
    expect(await store.acquire(room, 'w', 30)).toBe(false); // a finished session cannot be leased again
    await db.query('delete from rooms where id=$1', [room]); expect((await q('select count(*)::int c from swarm_answers'))[0]).toEqual({ c: 0 }); // cascade cleanup
  });
});

describe('the worker and the Next routes on real SQL', () => {
  beforeEach(async () => { await fresh(); process.env.SWARM_SECRET = SECRET; process.env.NEXT_PUBLIC_SWARM_URL = 'http://127.0.0.1:1'; });
  it('create → join by code → play a question → committed rows → crash-restart → report and review', async () => {
    const [{ startSwarmServer }, { PgStore }, { PgSource }, { WsClient, joinRoom }, fixtures, swarm, { signToken }] = await Promise.all([import('../server'), import('../store'), import('../quiz-source'), import('../testclient'), import('../fixtures'), import('../../../quiz/swarm/server'), import('../../net/tokens')]);
    void fixtures;
    const quiz = await mkQuiz(10);
    // preflight never invents questions
    const pre = await swarm.swarmPreflight({ quizId: quiz, minutes: 45 }); expect(pre.questions).toBe(10); expect(pre.plan.questionsTotal).toBeLessThanOrEqual(10); expect(pre.plan.warnings.join(' ')).toMatch(/10 questions/);
    await expect(swarm.swarmPreflight({ quizId: quiz, minutes: 3 })).rejects.toThrow();
    // create through the real create_room_with_content + swarm_create_session
    await expect(swarm.createSwarmRoom({ quizId: quiz, config: { mode: 'versus', teamCount: 1, teamSizeCap: 2, minutes: 5 } }, { id: HOST })).rejects.toThrow(/Versus needs/);
    const created = await swarm.createSwarmRoom({ quizId: quiz, config: { mode: 'coop', teamCount: 1, teamSizeCap: 2, minutes: 5 } }, { id: HOST });
    expect(created.joinCode).toMatch(/^[A-Z2-9]{6}$/); const roomId = created.roomId;
    expect((await q<{ config: { swarm?: unknown } }>('select config from rooms where id=$1', [roomId]))[0]!.config.swarm).toBeTruthy();
    const other = randomUUID(); await q('insert into auth.users(id,email) values($1,$2)', [other, `${other}@t.invalid`]);
    await expect(swarm.mintHostTokens(roomId, other)).rejects.toThrow(/Only the room host/); const tokens = await swarm.mintHostTokens(roomId, HOST); expect(tokens.hostToken).toBeTruthy();
    // the worker, on the real store, with the room's own question copy
    const t0 = Date.now(); const clock = { now: () => t0 + (Date.now() - t0) * 8 };
    const start = async (workerId: string) => startSwarmServer({ port: 0, host: '127.0.0.1', secret: SECRET, store: new PgStore(db as never), workerId, clock, allowedOrigins: ['*'], sourceFor: (id) => new PgSource(db as never, id), checkpointEveryMs: 300 });
    let srv = await start('w1');
    const host = new WsClient(srv.wsUrl, tokens.hostToken); await host.connect(); await host.waitFor(() => !!host.meta, 5000, 'host meta');
    const j = await joinRoom(srv.url, created.joinCode, 'Ann'); expect(j.status).toBe(200); const j2 = await joinRoom(srv.url, created.joinCode, 'Bo'); expect(j2.status).toBe(200);
    expect((await joinRoom(srv.url, created.joinCode, 'Cy')).status).toBe(409); // team cap 2 in a one-team co-op
    const a = new WsClient(srv.wsUrl, j.json.token as string); await a.connect(); const b = new WsClient(srv.wsUrl, j2.json.token as string); await b.connect();
    await Promise.all([a.waitFor(() => !!a.me), b.waitFor(() => !!b.me)]);
    expect((await q('select * from swarm_participants where room_id=$1', [roomId])).length).toBe(2);
    host.send({ t: 'host', id: 'begin-1', cmd: { cmd: 'begin' } });
    const keepAlive = setInterval(() => { for (const c of [a, b]) if (c.phase === 'wave' || c.phase === 'boss_wave') c.send({ t: 'move', seq: (Date.now() % 1e9) + 1, x: 0.3, y: 0.1 }); }, 80);
    await Promise.all([a, b].map((c) => c.waitFor(() => c.phase === 'question' && !!c.quiz?.question, 90_000, 'first question')));
    // read the right answer from the DB's key (test knowledge only) and answer through the socket
    const ans = async (c: import('../testclient').WsClient, good: boolean) => { const qq = c.quiz!.question!; const row = (await q<{ kind: string }>('select kind from room_questions where id=$1', [qq.id]))[0]!; c.send({ t: 'answer', w: c.quiz!.w, id: 'a1', r: row.kind === 'multiple_choice' ? { kind: row.kind, selectedIds: [good ? 'a' : 'b'] } : { kind: row.kind, text: good ? 'Forty Two' : 'nope' } }); };
    await ans(a, true); await ans(b, false);
    await Promise.all([a, b].map((c) => c.waitFor(() => c.packets.some((p) => p.t === 'ans' && p.ok), 4000, 'ack')));
    await a.waitFor(() => a.quiz?.reveal === true, 20_000, 'reveal'); clearInterval(keepAlive);
    const rows = await q<{ participant_id: string; correct: boolean; fraction: string }>('select participant_id, correct, fraction from swarm_answers where room_id=$1 order by participant_id', [roomId]); expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.correct)).toHaveLength(1); expect(rows.find((r) => r.participant_id === (j.json.participantId as string))!.correct).toBe(true);
    await a.waitFor(() => (a.quiz as { awarded?: number } | undefined)?.awarded === 50, 4000, 'award 50 = round(100 * 1/2)');
    expect((await q<{ amount: number; eligible: number }>('select amount, eligible from swarm_credits where room_id=$1', [roomId]))).toEqual([{ amount: 50, eligible: 2 }]);
    // a restore after a crash re-applies graded answers and never re-credits
    await srv.rooms.get(roomId)!.save(); const cp = (await q<{ checkpoint_rev: string }>('select checkpoint_rev from swarm_sessions where room_id=$1', [roomId]))[0]!; expect(Number(cp.checkpoint_rev)).toBeGreaterThan(0);
    [a, b, host].forEach((c) => c.close()); await srv.close();
    await q("update swarm_sessions set lease_until = now() - interval '1 second' where room_id=$1", [roomId]);
    srv = await start('w2'); const host2 = new WsClient(srv.wsUrl, tokens.hostToken); await host2.connect(); await host2.waitFor(() => !!host2.meta, 5000);
    expect(host2.meta!.paused).toBe(true); expect(host2.meta!.pauseReason).toBe('worker_restarted');
    const a2 = new WsClient(srv.wsUrl, j.json.token as string); await a2.connect(); await a2.waitFor(() => !!a2.me, 5000); expect(a2.me!.id).toBe(j.json.participantId);
    expect((await q('select * from swarm_credits where room_id=$1', [roomId])).length).toBe(1); expect((await q('select * from swarm_answers where room_id=$1', [roomId])).length).toBe(2);
    // review is closed while the match is live; the report is host-only
    await expect(swarm.swarmReview(roomId, j.json.token)).rejects.toThrow(/review opens when the match ends/); await expect(swarm.swarmReview(roomId, 'garbage-token-garbage')).rejects.toThrow(/expired/);
    await expect(swarm.swarmReport(roomId, other)).rejects.toThrow(/Only the room host/);
    // the teacher ends the match; the worker persists results exactly once
    host2.send({ t: 'host', id: 'resume-1', cmd: { cmd: 'resume' } }); await host2.waitFor(() => host2.meta!.paused === false, 4000);
    host2.send({ t: 'host', id: 'end-1', cmd: { cmd: 'end_request' } }); await host2.waitFor(() => host2.packets.some((p) => p.t === 'ack' && p.id === 'end-1' && !!p.nonce), 4000);
    const nonce = (host2.packets.find((p) => p.t === 'ack' && p.id === 'end-1') as { nonce: string }).nonce; host2.send({ t: 'host', id: 'end-2', cmd: { cmd: 'end_confirm', nonce } });
    await host2.waitPhase('results', 8000); await new Promise((r) => setTimeout(r, 600));
    expect((await q('select * from swarm_results where room_id=$1', [roomId])).length).toBe(1); expect((await q<{ status: string; checkpoint: unknown }>('select status, checkpoint from swarm_sessions where room_id=$1', [roomId]))[0]).toEqual({ status: 'finished', checkpoint: null });
    const report = await swarm.swarmReport(roomId, HOST); expect(report.status).toBe('finished'); expect(report.results!.outcome).toBe('ended'); expect(report.players.map((p) => p.name).sort()).toEqual(['Ann', 'Bo']); expect(report.questions[0]!.answers).toBe(2); expect(report.questions[0]!.accuracyPct).toBe(50); expect(report.teamEarned.t1).toBe(50);
    const review = await swarm.swarmReview(roomId, j.json.token); expect(review.total).toBe(1); expect(review.correct).toBe(1); expect(JSON.stringify(review)).toContain('DB_EXPLANATION_KEY'); // the lesson is shown after the match
    const bReview = await swarm.swarmReview(roomId, j2.json.token); expect(bReview.correct).toBe(0);
    await expect(swarm.swarmReview(roomId, signToken({ typ: 'player', room: randomUUID(), sub: 'a'.repeat(24), ttlSec: 60 }, SECRET))).rejects.toThrow(/expired/); // another room's token
    [a2, host2].forEach((c) => c.close()); await srv.close();
    // after the match the worker refuses new joins for the code
    const srv3 = await start('w3'); expect((await joinRoom(srv3.url, created.joinCode, 'Late')).status).toBe(404); await srv3.close();
  });
});
