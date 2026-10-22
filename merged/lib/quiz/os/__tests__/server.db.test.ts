/** Obstacle Survival against a REAL PostgreSQL engine (PGlite): the repository's own migrations 001–009, the real server, the real five-stage answer pipeline.
 *    npm run test:db -- lib/quiz/os
 *  Local evidence only: PGlite is Postgres compiled to WASM, not the hosted Supabase project (that gate is separate and needs the owner). */
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
const ALL = ['001_init.sql', '002_hardening.sql', '003_service_role_grants.sql', '004_quiz_studio_160.sql', '005_media_access_and_limits.sql', '005_projector_modes.sql', '006_projector_next_five.sql', '007_tower_defense.sql', '008_swarm_survival.sql', '009_obstacle_survival.sql'];
const SECRET = 'OS_SECRET_EXPLANATION_77A1';
let db: PGlite; let HOST = '';
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows;
const realNow = Date.now.bind(Date); let clock = realNow(); let spy: jest.SpyInstance;
const cmd = () => `c${randomUUID().replace(/-/g, '')}`;

async function fresh(files = ALL) {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create schema auth; create table auth.users(id uuid primary key, email text); create role anon; create role authenticated; create role service_role;');
  for (const f of files) await db.exec(MIG(f));
  (globalThis as unknown as { __db: unknown }).__db = db;
  HOST = randomUUID(); (globalThis as unknown as { __host: string }).__host = HOST; await q('insert into auth.users(id,email) values($1,$2)', [HOST, `${HOST}@t.invalid`]);
}
const kindsOf = (i: number) => {
  switch (i % 5) {
    case 0: return { kind: 'multiple_choice', prompt: 'MC ' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }] }, answerKey: { correctIds: ['a'], explanation: SECRET } };
    case 1: return { kind: 'answer_forge', prompt: 'AF ' + i, basePoints: 100, payload: {}, answerKey: { accepted: ['forty two'], explanation: SECRET } };
    case 2: return { kind: 'connection_rush', prompt: 'CR ' + i, basePoints: 100, payload: { left: [{ id: 'l1', label: 'x' }, { id: 'l2', label: 'y' }], right: [{ id: 'r1', label: 'X' }, { id: 'r2', label: 'Y' }] }, answerKey: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }], explanation: SECRET } };
    case 3: return { kind: 'truth_hunt', prompt: 'TH ' + i, basePoints: 100, payload: { statements: [{ id: 's1', text: 'One' }, { id: 's2', text: 'Two' }] }, answerKey: { truth: { s1: true, s2: false }, partial: true, explanation: SECRET } };
    default: return { kind: 'fill_table', prompt: 'FT ' + i, basePoints: 100, payload: { columns: ['k', 'v'], rows: [[{ text: 'a', blank: false }, { text: '', blank: true }]] }, answerKey: { cells: { '0:1': ['one'] }, explanation: SECRET } };
  }
};
const right = (k: string): unknown => ({ multiple_choice: { kind: k, selectedIds: ['a'] }, answer_forge: { kind: k, text: 'forty two' }, connection_rush: { kind: k, pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }] }, truth_hunt: { kind: k, truth: { s1: true, s2: false } }, fill_table: { kind: k, cells: { '0:1': 'one' } } } as Record<string, unknown>)[k];
const wrong = (k: string): unknown => ({ multiple_choice: { kind: k, selectedIds: ['b'] }, answer_forge: { kind: k, text: 'nope' }, connection_rush: { kind: k, pairs: [{ leftId: 'l1', rightId: 'r2' }, { leftId: 'l2', rightId: 'r1' }] }, truth_hunt: { kind: k, truth: { s1: false, s2: true } }, fill_table: { kind: k, cells: { '0:1': 'zzz' } } } as Record<string, unknown>)[k];
async function mkQuiz(n = 6) {
  const r = await q<{ r: string }>('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [HOST, 'OS-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(Array.from({ length: n }, (_, i) => kindsOf(i)))]);
  return r[0].r;
}
type Srv = typeof import('../server');
const srv = async (): Promise<Srv> => import('../server');
beforeAll(() => { spy = jest.spyOn(Date, 'now').mockImplementation(() => clock); });
afterAll(() => spy.mockRestore());
beforeEach(() => { clock = realNow(); });
afterEach(async () => { await db?.close().catch(() => undefined); });

async function room(o: Record<string, unknown> = {}, quizN = 6) {
  const os = await srv(); const created = await os.createOSRoom({ quizId: await mkQuiz(quizN), format: 'cooperative_escape', teamCount: 1, teamSizeCap: 5, minutes: 15, mapId: 'chalkyard_circuit', ...o }, { id: HOST });
  return { os, ...created };
}
async function join(os: Srv, code: string, n: number, team?: string) {
  const seats: { seatId: string; token: string; teamId: string | null }[] = [];
  for (let i = 0; i < n; i++) { const j = await os.joinOS({ joinCode: code, displayName: `Kid ${++kidN}`, desiredTeam: team }, null); seats.push({ seatId: j.seatId, token: j.token, teamId: j.teamId }); }
  return seats;
}
let kidN = 0;
const idle = (n: number) => Array.from({ length: n }, () => ({ dx: 0, dy: 0, hop: false }));
const right1 = (n: number) => Array.from({ length: n }, () => ({ dx: 1, dy: 0, hop: false }));

describe('migration 009', () => {
  it('up creates 7 tables with RLS and no anon access; down removes everything and touches nothing else; up again is idempotent; 007 and 008 coexist', async () => {
    await fresh();
    const tables = async () => (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename like 'os\\_%' order by 1")).map((t) => t.tablename);
    expect(await tables()).toEqual(['os_credits', 'os_events', 'os_input_batches', 'os_outbox', 'os_results', 'os_seats', 'os_sessions']);
    expect((await q<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname like 'os\\_%' and relkind='r'")).every((r) => r.relrowsecurity)).toBe(true);
    expect((await q("select count(*)::int c from pg_policies where tablename like 'os\\_%'"))[0]).toEqual({ c: 0 });
    await db.exec('set role anon'); await expect(db.query('select * from os_sessions')).rejects.toThrow(/permission denied/);
    await expect(db.query("select os_commit(gen_random_uuid(),'a','b',0,'x','{}','{}','[]','[]','[]',false,'{}',null)")).rejects.toThrow(/permission denied/);
    await expect(db.query("select os_input(gen_random_uuid(),gen_random_uuid(),'c',0,'{}',1,1,'d')")).rejects.toThrow(/permission denied/); await db.exec('reset role');
    await db.exec('set role service_role'); await expect(db.query('select count(*) from os_seats')).resolves.toBeTruthy(); await db.exec('reset role');
    const others = async () => (await q<{ tablename: string }>("select tablename from pg_tables where schemaname='public' and tablename not like 'os\\_%' order by 1")).map((t) => t.tablename);
    const before = await others(); expect(before).toEqual(expect.arrayContaining(['td_sessions', 'swarm_sessions', 'rooms']));
    await db.exec(MIG('009_obstacle_survival_down.sql')); expect(await tables()).toEqual([]); expect((await q("select proname from pg_proc where proname like 'os\\_%'")).length).toBe(0);
    expect(await others()).toEqual(before);
    await db.exec(MIG('009_obstacle_survival.sql')); expect((await tables()).length).toBe(7); await db.exec(MIG('009_obstacle_survival.sql')); expect((await tables()).length).toBe(7);
    await db.exec(MIG('009_obstacle_survival_down.sql')); await db.exec(MIG('009_obstacle_survival_down.sql')); // down twice is a no-op
  });
});

describe('lobby, capacity and cleanup', () => {
  it('OS-065/OS-096 the 21st seat is refused, the unseated player row is cleaned up, a locked room refuses, a kicked device is dead', async () => {
    await fresh(); const { os, roomId, joinCode } = await room({ format: 'relay_race', teamCount: 4, teamSizeCap: 5 });
    const seats = await join(os, joinCode, 20); expect(seats.map((s) => s.teamId).filter((t) => t === 'sq1')).toHaveLength(5);
    await expect(os.joinOS({ joinCode, displayName: 'Kid 21' }, null)).rejects.toThrow(/20 players|full/);
    expect((await q("select count(*)::int c from players where room_id=$1", [roomId]))[0].c).toBe(20); expect((await q('select count(*)::int c from os_seats where room_id=$1', [roomId]))[0].c).toBe(20);
    await os.hostCommand(roomId, cmd(), { kind: 'lock', locked: true }); await expect(os.joinOS({ joinCode, displayName: 'Late' }, null)).rejects.toThrow(/closed/);
    expect((await os.hostCommand(roomId, cmd(), { kind: 'kick', seatId: seats[3].seatId })).ok).toBe(true);
    await expect(os.verifySeat({ id: roomId }, seats[3].token)).rejects.toThrow(/removed/);
    expect(await os.seatCommand(roomId, seats[3].seatId, cmd(), { kind: 'ready', ready: true })).toMatchObject({ ok: false, code: 'SEAT_REVOKED' });
    expect(await os.submitInput(roomId, seats[3].seatId, { commandId: cmd(), fromTick: 1, samples: idle(1) })).toMatchObject({ ok: false, code: 'SEAT_REVOKED', status: 403 });
  });
  it('a foreign seat token is refused (OS-051); another room\'s token is not a seat here', async () => {
    await fresh(); const a = await room(); const b = await room(); const sa = await join(a.os, a.joinCode, 1); const sb = await join(b.os, b.joinCode, 1);
    await expect(a.os.verifySeat({ id: a.roomId }, sb[0].token)).rejects.toThrow(); await expect(a.os.verifySeat({ id: a.roomId }, undefined)).rejects.toThrow(/Join the room first/);
    await expect(a.os.verifySeat({ id: a.roomId }, sa[0].token)).resolves.toBeTruthy();
    await expect(a.os.joinOS({ joinCode: 'ZZZZZZ', displayName: 'x1' }, null)).rejects.toThrow(/not joinable/);
  });
});

describe('movement through the server (OS-055..060, OS-064, OS-091)', () => {
  async function running() {
    await fresh(); const r = await room(); const seats = await join(r.os, r.joinCode, 2); await r.os.hostCommand(r.roomId, cmd(), { kind: 'start' });
    const st = await r.os.snapshot(r.roomId, { view: 'host' }); clock = st.deadlineMs! + 20 * 50 + 5; // 20 ticks into the run
    return { ...r, seats, st };
  }
  it('accepts a valid batch, is idempotent per command, and refuses old/future/gapped/oversized/forged input without changing the body', async () => {
    const { os, roomId, seats } = await running(); const s = seats[0].seatId;
    const c1 = cmd(); const a = await os.submitInput(roomId, s, { commandId: c1, fromTick: 1, samples: right1(10) }); expect(a).toMatchObject({ ok: true, replayed: false, tick: 10, accepted: 10 });
    const again = await os.submitInput(roomId, s, { commandId: c1, fromTick: 1, samples: right1(10) }); expect(again).toMatchObject({ ok: true, replayed: true, tick: 10 }); // network retry
    const body = async () => (await q<{ body: { tick: number; x: number } }>('select body from os_seats where player_id=$1', [s]))[0].body;
    const b0 = await body(); expect(b0.tick).toBe(10);
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 1, samples: right1(3) })).toMatchObject({ ok: false, code: 'OLD_TICK', status: 409 }); // OS-056
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 10, samples: right1(3) })).toMatchObject({ ok: false, code: 'OLD_TICK' });
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 15, samples: right1(3) })).toMatchObject({ ok: false, code: 'TICK_GAP' });
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 11, samples: right1(48) })).toMatchObject({ ok: false, code: 'FUTURE_TICK' }); // OS-055: the clock is at tick ~20
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 11, samples: right1(49) })).toMatchObject({ ok: false, code: 'BATCH_SIZE' }); // OS-064
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 11, samples: [{ dx: 9, dy: 0, hop: false }] })).toMatchObject({ ok: false, code: 'INPUT_INVALID' });
    expect(await body()).toEqual(b0);
    expect((await q('select count(*)::int c from os_input_batches where seat_id=$1', [s]))[0].c).toBe(1);
  });
  it('two devices racing the SAME ticks: exactly one wins; the other is told plainly (OS-095)', async () => {
    const { os, roomId, seats } = await running(); const s = seats[0].seatId;
    const res = await Promise.all(Array.from({ length: 6 }, () => os.submitInput(roomId, s, { commandId: cmd(), fromTick: 1, samples: right1(12) })));
    expect(res.filter((r) => r.ok)).toHaveLength(1); expect(res.filter((r) => !r.ok).every((r) => !r.ok && ['OLD_TICK', 'BUSY', 'TICK_GAP'].includes(r.code))).toBe(true);
    expect((await q<{ body: { tick: number } }>('select body from os_seats where player_id=$1', [s]))[0].body.tick).toBe(12);
  });
  it('a world that is frozen or paused accepts no movement (OS-085/087)', async () => {
    const { os, roomId, seats, st } = await running(); const s = seats[0].seatId;
    await os.hostCommand(roomId, cmd(), { kind: 'pause' }); expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 1, samples: idle(2) })).toMatchObject({ ok: false, code: 'PAUSED' });
    clock += 5000; await os.hostCommand(roomId, cmd(), { kind: 'resume' });
    clock = st.deadlineMs! + 5000 + st.chapterTicks * 50 + 200; // the pause shifted the schedule by exactly 5 s; now past the freeze → barrier
    expect(await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 1, samples: idle(2) })).toMatchObject({ ok: false, code: 'FROZEN', status: 409 });
    expect((await os.snapshot(roomId, { view: 'host' })).phase).toBe('barrier');
  });
  it('an ability with a squad effect writes the cooldown and the squad pulse atomically; cooldown is enforced', async () => {
    const { os, roomId, seats } = await running(); const s = seats[0].seatId;
    await os.seatCommand(roomId, s, cmd(), { kind: 'role', role: 'medic' }).catch(() => undefined); // too late: roles are fixed mid-run
    const lobby = await os.snapshot(roomId, { view: 'host' }); expect(lobby.seats.find((x) => x.id === s)!.role).toBe('trailblazer');
    const r = await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 1, samples: [{ dx: 0, dy: 0, hop: false, ability: true }, ...idle(4)] }); expect(r).toMatchObject({ ok: true });
    const r2 = await os.submitInput(roomId, s, { commandId: cmd(), fromTick: 6, samples: [{ dx: 0, dy: 0, hop: false, ability: true }] }); expect(r2).toMatchObject({ ok: true, denied: { ability: 1 } }); // OS-060
  });
});

describe('questions, credits, shop, results', () => {
  it('OS-080..084/098/052/053/067/069: a full 6-chapter match grades every question kind through the real pipeline; credits are exactly-once; secrets stay secret', async () => {
    await fresh(); const { os, roomId, joinCode } = await room(); const seats = await join(os, joinCode, 3);
    expect((await os.hostCommand(roomId, cmd(), { kind: 'start' })).ok).toBe(true);
    const seedRow = (await q<{ seed: string }>('select seed from os_sessions where room_id=$1', [roomId]))[0].seed;
    let st = await os.snapshot(roomId, { view: 'host' }); const kinds: string[] = [];
    for (let ch = 0; ch < st.chapters; ch++) {
      // run to the freeze → barrier
      clock = (st.phase === 'preview' ? st.deadlineMs! : st.phaseStartedMs) + 1; let guard = 0;
      while (st.phase !== 'barrier' && guard++ < 40) { clock += 3000; st = await os.snapshot(roomId, { view: 'host' }); }
      expect(st.phase).toBe('barrier');
      const kid = await os.snapshot(roomId, { view: 'student', seatId: seats[0].seatId }); const qq = kid.question as { id: string; kind: string }; kinds.push(qq.kind);
      expect(JSON.stringify(kid)).not.toContain(SECRET); expect(JSON.stringify(kid.question)).not.toMatch(/answerKey|correctIds|accepted|truth"|pairs":\[\{"leftId":"l1","rightId":"r1"/); expect(JSON.stringify(kid)).not.toContain(seedRow);
      expect(JSON.stringify(await os.snapshot(roomId, { view: 'projector' }))).not.toMatch(new RegExp(`${SECRET}|${seedRow}`));
      // 2 right, 1 wrong (a forged "correct" flag is refused by the pipeline's strict response schema; nothing is committed)
      await os.answer(roomId, seats[0].token, seats[0].seatId, { roomQuestionId: qq.id, response: right(qq.kind) });
      await os.answer(roomId, seats[1].token, seats[1].seatId, { roomQuestionId: qq.id, response: right(qq.kind) });
      await expect(os.answer(roomId, seats[2].token, seats[2].seatId, { roomQuestionId: qq.id, response: { ...(wrong(qq.kind) as object), correct: true } })).rejects.toThrow();
      expect((await q('select count(*)::int n from submissions where actor_id=$1 and room_question_id=$2', [seats[2].seatId, qq.id]))[0].n).toBe(0);
      expect(JSON.stringify((await os.snapshot(roomId, { view: 'student', seatId: seats[0].seatId })).question)).not.toContain(SECRET); // still before the reveal
      await os.answer(roomId, seats[2].token, seats[2].seatId, { roomQuestionId: qq.id, response: wrong(qq.kind) });
      await expect(os.answer(roomId, seats[0].token, seats[0].seatId, { roomQuestionId: qq.id, response: right(qq.kind) })).rejects.toThrow(/already|closed/); // OS-053 duplicate
      st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('reveal'); // everyone answered → closed early
      expect(JSON.stringify((await os.snapshot(roomId, { view: 'student', seatId: seats[0].seatId })).question)).toContain(SECRET); // key visible only after the reveal
      await expect(os.answer(roomId, seats[2].token, seats[2].seatId, { roomQuestionId: qq.id, response: right(qq.kind) })).rejects.toThrow(/closed|already/); // OS-067
      expect((await q('select count(*)::int n from os_credits where room_id=$1', [roomId]))[0].n).toBe(ch + 1);
      if (ch < st.chapters - 1) { clock = st.deadlineMs! + 1; st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('build_choice'); clock = st.deadlineMs! + 1; await os.snapshot(roomId, { view: 'host' }); st = await os.snapshot(roomId, { view: 'host' }); }
    }
    expect(new Set(kinds).size).toBe(5); // all five native kinds were asked
    // each barrier: 2 of 3 right = floor(66.66/5)*5 = 65, capped at 600
    const credits = await q<{ amount: number }>('select amount from os_credits where room_id=$1 order by credit_key', [roomId]); expect(credits.every((c) => c.amount === 65)).toBe(true);
    clock = st.deadlineMs! + 1; st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('finished');
    const rows = await q<{ rank: number; progress: number; mastery: number; score: number; finish_reason: string }>('select * from os_results where room_id=$1', [roomId]);
    expect(rows).toHaveLength(1); expect(rows[0].rank).toBe(1); expect(rows[0].mastery).toBeGreaterThan(600); expect(rows[0].mastery).toBeLessThan(700);
    await expect(q('update os_results set score = 1000 where room_id=$1', [roomId])).rejects.toThrow(/final/);
    expect((await q<{ status: string }>('select status from rooms where id=$1', [roomId]))[0].status).toBe('ended');
    expect(await os.hostCommand(roomId, cmd(), { kind: 'start' })).toMatchObject({ ok: false });
    const log = await os.replay(roomId); expect(log.length).toBeGreaterThan(15); expect(JSON.stringify(log)).not.toMatch(/token|secret|seed/i);
    const report = await os.learningReport(roomId, false); expect(report.length).toBe(6); expect(JSON.stringify(report)).not.toMatch(/Kid \d/);
  });
  it('OS-054/066/068/094: 50 simultaneous purchases from five devices debit exactly once; wrong phase and underflow are refused', async () => {
    await fresh(); const { os, roomId, joinCode } = await room(); const seats = await join(os, joinCode, 5); await os.hostCommand(roomId, cmd(), { kind: 'start' });
    expect(await os.seatCommand(roomId, seats[0].seatId, cmd(), { kind: 'purchase', perk: 'safety_rail' })).toMatchObject({ ok: false, code: 'WRONG_PHASE' }); // OS-066
    let st = await os.snapshot(roomId, { view: 'host' }); clock = st.deadlineMs! + st.chapterTicks * 50 + 10; st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('barrier');
    const qq = (await os.snapshot(roomId, { view: 'student', seatId: seats[0].seatId })).question as { id: string; kind: string };
    for (const s of seats) await os.answer(roomId, s.token, s.seatId, { roomQuestionId: qq.id, response: right(qq.kind) });
    st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('reveal'); expect((st.teams[0] as { points: number }).points).toBe(100);
    clock = st.deadlineMs! + 1; st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('build_choice');
    const res = await Promise.all(Array.from({ length: 50 }, (_, i) => os.seatCommand(roomId, seats[i % 5].seatId, cmd(), { kind: 'purchase', perk: 'safety_rail' }, st.revision).catch(() => ({ ok: false as const, code: 'ERR', message: '', currentRevision: 0 }))));
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    st = await os.snapshot(roomId, { view: 'host' }); const t = st.teams[0] as { points: number; perks: string[]; spent: number }; expect(t.points).toBe(20); expect(t.perks).toEqual(['safety_rail']); expect(t.spent).toBe(80);
    expect(await os.seatCommand(roomId, seats[1].seatId, cmd(), { kind: 'purchase', perk: 'safe_gate' })).toMatchObject({ ok: false, code: 'INSUFFICIENT_POINTS' }); // OS-068
    await q("update os_sessions set state = jsonb_set(state, '{teams,0,points}', '300') where room_id=$1", [roomId]); // test fixture: a richer squad
    const same = cmd(); const a = await os.seatCommand(roomId, seats[0].seatId, same, { kind: 'purchase', perk: 'team_dash_pad' }); const b = await os.seatCommand(roomId, seats[0].seatId, same, { kind: 'purchase', perk: 'team_dash_pad' });
    expect(a).toMatchObject({ ok: true }); expect(b).toMatchObject({ ok: true, replayed: true }); // OS-054: a duplicate command debits once
    expect(((await os.snapshot(roomId, { view: 'host' })).teams[0] as { points: number }).points).toBe(230);
  });
  it('a student who joined after the question opened cannot answer it, and earns nothing for it', async () => {
    await fresh(); const { os, roomId, joinCode } = await room(); const seats = await join(os, joinCode, 1); await os.hostCommand(roomId, cmd(), { kind: 'start' });
    let st = await os.snapshot(roomId, { view: 'host' }); clock = st.deadlineMs! + st.chapterTicks * 50 + 10; st = await os.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('barrier');
    const late = await join(os, joinCode, 1); const qq = (await os.snapshot(roomId, { view: 'student', seatId: seats[0].seatId })).question as { id: string; kind: string };
    await expect(os.answer(roomId, late[0].seatId, late[0].seatId, { roomQuestionId: qq.id, response: right(qq.kind) })).rejects.toThrow();
    await expect(os.answer(roomId, late[0].token, late[0].seatId, { roomQuestionId: qq.id, response: right(qq.kind) })).rejects.toThrow(/joined after/);
  });
  it('OS-099 a short quiz shrinks the run or is refused with a useful message; OS-097 the room can be deleted with every child row', async () => {
    await fresh(); const os = await srv(); const quiz2 = await mkQuiz(2);
    await expect(os.createOSRoom({ quizId: quiz2, format: 'cooperative_escape', teamCount: 1, teamSizeCap: 5, minutes: 15, mapId: 'chalkyard_circuit' }, { id: HOST })).rejects.toThrow(/at least 3 questions/);
    const quiz4 = await mkQuiz(4); const ok = await os.createOSRoom({ quizId: quiz4, format: 'cooperative_escape', teamCount: 1, teamSizeCap: 5, minutes: 15, mapId: 'lantern_harbor' }, { id: HOST });
    expect(ok.plan.chapters).toBe(4); expect(ok.plan.notes).toContain('shortQuiz');
    const seats = await join(os, ok.joinCode, 2); await os.submitInput(ok.roomId, seats[0].seatId, { commandId: cmd(), fromTick: 1, samples: idle(1) });
    await q('delete from rooms where id=$1', [ok.roomId]);
    for (const t of ['os_sessions', 'os_seats', 'os_events', 'os_input_batches', 'os_credits', 'os_results', 'os_outbox']) expect((await q(`select count(*)::int c from ${t} where room_id=$1`, [ok.roomId]))[0].c).toBe(0);
  });
  it('OS-062/110 only the host controls the match; the projector link is room-scoped and revocable', async () => {
    await fresh(); const a = await room(); const b = await room();
    const link = await a.os.makeSpectatorLink(a.roomId, HOST); await expect(a.os.verifySpectator(a.roomId, link.token)).resolves.toBeUndefined();
    await expect(b.os.verifySpectator(b.roomId, link.token)).rejects.toThrow(/not valid/); // OS-061 cross-room token
    await expect(a.os.verifySpectator(a.roomId, null)).rejects.toThrow(); await expect(a.os.verifySpectator(a.roomId, 'x'.repeat(200))).rejects.toThrow();
    const link2 = await a.os.makeSpectatorLink(a.roomId, HOST); await expect(a.os.verifySpectator(a.roomId, link.token)).rejects.toThrow(); await expect(a.os.verifySpectator(a.roomId, link2.token)).resolves.toBeUndefined();
    await expect(a.os.makeSpectatorLink(a.roomId, randomUUID())).rejects.toThrow(/host/i); // a stranger cannot mint a link
  });
});
