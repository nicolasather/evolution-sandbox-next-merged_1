/**
 * Database tests for supabase/migrations/005_projector_modes.sql against a real Postgres with 001–005 applied.
 *   QUIZ_TEST_DATABASE_URL=postgres://… npx jest -c jest.db.config.js lib/quiz/projector
 * NEVER point this at production: it creates and removes its own users, quizzes and rooms.
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.QUIZ_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite('projector database functions', () => {
  const pool = new Pool({ connectionString: URL, max: 12 });
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
  const fn = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows[0]?.r;
  const users: string[] = []; const quizzes: string[] = [];
  const mc = (i: number) => ({ kind: 'multiple_choice', prompt: 'Q' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], meta: { topic: i % 2 ? 'Odd' : 'Even' } }, answerKey: { correctIds: ['a'] } });
  async function mkUser() { const id = randomUUID(); await q('insert into auth.users(id,email) values($1,$2)', [id, `${id}@test.invalid`]); users.push(id); return id; }
  async function mkRoom(host: string, flow = 'synchronized', n = 12, teams = ['Red', 'Blue']) {
    const quiz = await fn('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [host, 'P-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(Array.from({ length: n }, (_, i) => mc(i)))]);
    quizzes.push(quiz);
    const cfg = { durationSeconds: 7200, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: teams };
    const out = await fn('select create_room_with_content($1,$2,$3,$4,$5::jsonb,$6,$7::text[],$8) as r', [host, quiz, 'classroom', flow, JSON.stringify(cfg), randomUUID().slice(0, 6).toUpperCase(), teams, null]);
    const t = await q('select id from teams where room_id=$1 order by order_index', [out.roomId]);
    return { room: out.roomId as string, teams: t.map((x) => x.id as string) };
  }
  const start = (room: string, host: string) => fn("select control_room($1,$2,'start') as r", [room, host]);
  const create = (room: string, host: string, state: unknown = { core: { x: 1 } }) => fn('select projector_create_session($1,$2,$3,$4::jsonb,$5::jsonb) as r', [room, host, 'boss_battle', '{}', JSON.stringify(state)]);
  const commit = (room: string, host: string, cmd: string, exp: number, state: unknown = { core: { x: exp + 1 } }, fin = false) =>
    fn('select projector_commit($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9) as r', [room, host, cmd, exp, 'ask', '{}', JSON.stringify(state), '{}', fin]);
  const rejects = (p: Promise<unknown>, re: RegExp) => expect(p).rejects.toThrow(re);
  let A = '', B = '';
  beforeAll(async () => { A = await mkUser(); B = await mkUser(); });
  afterAll(async () => { await q('delete from quizzes where id=any($1::uuid[])', [quizzes]); await q('delete from auth.users where id=any($1::uuid[])', [users]); await pool.end(); });

  it('anon and authenticated cannot touch any projector table or function', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const t of ['projector_sessions', 'projector_events', 'projector_teaching_evidence', 'projector_reward_ledger', 'projector_reward_appeals']) {
        const c = await pool.connect();
        try { await c.query(`set role ${role}`); await expect(c.query(`select * from public.${t} limit 1`)).rejects.toThrow(/permission denied/); } finally { await c.query('reset role'); c.release(); }
      }
      const c = await pool.connect();
      try { await c.query(`set role ${role}`); await expect(c.query("select projector_commit(gen_random_uuid(),gen_random_uuid(),'c1c1c1c1c1',0,'a','{}','{}','{}',false)")).rejects.toThrow(/permission denied/); } finally { await c.query('reset role'); c.release(); }
    }
  });

  it('only the host can create a session, and only before start', async () => {
    const { room } = await mkRoom(A);
    await rejects(create(room, B), /Only the room host/);
    expect((await create(room, A)).ok).toBe(true);
    await rejects(create(room, A), /already exists/);
    const r2 = await mkRoom(A); await start(r2.room, A);
    await rejects(create(r2.room, A), /already started/);
  });

  it('commit is revision-locked and idempotent', async () => {
    const { room } = await mkRoom(A); await create(room, A); await start(room, A);
    const first = await commit(room, A, 'cmd-00000001', 0);
    expect(first.revision).toBe(1);
    const replay = await commit(room, A, 'cmd-00000001', 0);
    expect(replay.replayed).toBe(true); expect(replay.revision).toBe(1);
    await rejects(commit(room, A, 'cmd-00000002', 0), /revision_conflict/);
    expect((await commit(room, A, 'cmd-00000002', 1)).revision).toBe(2);
    expect((await q('select count(*)::int c from projector_events where room_id=$1', [room]))[0].c).toBe(2);
  });

  it('two simultaneous commits with the same expected revision: exactly one wins', async () => {
    const { room } = await mkRoom(A); await create(room, A); await start(room, A);
    const res = await Promise.allSettled([commit(room, A, 'race-0000001', 0), commit(room, A, 'race-0000002', 0)]);
    expect(res.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(res.filter((r) => r.status === 'rejected').length).toBe(1);
    expect((await q('select revision from projector_sessions where room_id=$1', [room]))[0].revision).toBe(1);
  });

  it('a non-host cannot commit', async () => {
    const { room } = await mkRoom(A); await create(room, A); await start(room, A);
    await rejects(commit(room, B, 'foreign-00001', 0), /Only the room host/);
  });

  it('finishing ends the room and blocks further commits', async () => {
    const { room } = await mkRoom(A); await create(room, A); await start(room, A);
    await commit(room, A, 'fin-00000001', 0, { core: { done: true } }, true);
    expect((await q('select status,revealed from rooms where id=$1', [room]))[0]).toEqual({ status: 'ended', revealed: true });
    await rejects(commit(room, A, 'fin-00000002', 1), /finished/);
  });

  it('open_question moves the cursor, refuses used questions and wrong teams, and sets the round-robin turn', async () => {
    const { room, teams } = await mkRoom(A, 'round_robin'); await create(room, A); await start(room, A);
    const out = await fn('select projector_open_question($1,$2,$3,$4::uuid[]) as r', [room, A, 4, [teams[1]]]);
    expect(out.position).toBe(4);
    const r = (await q('select current_index,turn_index,revealed from rooms where id=$1', [room]))[0];
    expect(r).toEqual({ current_index: 4, turn_index: 1, revealed: false });
    await rejects(fn('select projector_open_question($1,$2,$3,$4::uuid[]) as r', [room, A, 5, [teams[0], teams[1]]]), /one team at a time/);
    await rejects(fn('select projector_open_question($1,$2,$3,$4::uuid[]) as r', [room, A, 5, [randomUUID()]]), /Team not found/);
    // answering through the existing atomic commit proves the cursor is compatible with commit_answer_v2
    const qid = (await q('select id from room_questions where room_id=$1 and position=4', [room]))[0].id;
    const res = await fn("select commit_answer_v2($1,$2,'team',$3,'{\"kind\":\"manual_observation\"}'::jsonb,true,100,0,false,0,true) as r", [room, qid, teams[1]]);
    expect(res.correct).toBe(true);
    await rejects(fn('select projector_open_question($1,$2,$3,$4::uuid[]) as r', [room, A, 4, [teams[1]]]), /already used/);
  });

  it('extend_time is bounded and audited; repeat cycle needs consent and is labelled', async () => {
    const { room } = await mkRoom(A, 'synchronized', 6); await create(room, A); await start(room, A);
    const before = (await q('select expires_at from rooms where id=$1', [room]))[0].expires_at as Date;
    await fn("select projector_extend_time($1,$2,10,'class ran long') as r", [room, A]);
    const after = (await q('select expires_at from rooms where id=$1', [room]))[0].expires_at as Date;
    expect(after.getTime() - before.getTime()).toBe(600_000);
    await rejects(fn("select projector_extend_time($1,$2,500,'x') as r", [room, A]), /1 to 60/);
    await rejects(fn('select projector_add_repeat_cycle($1,$2,false,6) as r', [room, A]), /agree/);
    const out = await fn('select projector_add_repeat_cycle($1,$2,true,6) as r', [room, A]);
    expect(out.added).toBe(6);
    const rep = await q("select position,payload->'meta'->>'repeatOf' as of from room_questions where room_id=$1 and position>=6 order by position", [room]);
    expect(rep.map((x) => Number(x.of))).toEqual([0, 1, 2, 3, 4, 5]);
    expect((await q("select count(*)::int c from audit_log where room_id=$1 and action in ('projector_extend','projector_repeat_cycle')", [room]))[0].c).toBe(2);
  });

  describe('rewards', () => {
    async function played(host: string, answers: number, spreadMinutes: number) {
      const { room, teams } = await mkRoom(host, 'synchronized', Math.max(answers, 6)); await create(room, host); await start(room, host);
      for (let i = 0; i < answers; i++) {
        await fn('select projector_open_question($1,$2,$3,$4::uuid[]) as r', [room, host, i, [teams[0]]]);
        const qid = (await q('select id from room_questions where room_id=$1 and position=$2', [room, i]))[0].id;
        await fn("select commit_answer_v2($1,$2,'team',$3,'{\"kind\":\"manual_observation\"}'::jsonb,true,100,0,false,0,true) as r", [room, qid, teams[0]]);
        await q("update submissions set submitted_at = now() - make_interval(mins => $2) where room_question_id=$1", [qid, Math.round(spreadMinutes - (i * spreadMinutes) / Math.max(1, answers - 1))]);
      }
      await commit(room, host, 'end-' + randomUUID().slice(0, 8), 0, { core: { done: 1 } }, true);
      return room;
    }
    it('rejects a thin or idle session, with reasons, and refuses to evaluate unfinished games', async () => {
      const C = await mkUser();
      const { room } = await mkRoom(C); await create(room, C); await start(room, C);
      await rejects(fn('select projector_evaluate_reward($1,$2) as r', [room, C]), /Finish the game/);
      const thin = await played(C, 3, 1);
      const out = await fn('select projector_evaluate_reward($1,$2) as r', [thin, C]);
      expect(out.verdict).toBe('rejected'); expect(out.reasons).toEqual(expect.arrayContaining(['tooFewAnswers']));
      expect((await q('select count(*)::int c from projector_reward_ledger where owner_id=$1', [C]))[0].c).toBe(0);
    });
    it('accepts a real session once; a second claim for the same room is a duplicate with no extra reward; non-hosts cannot claim', async () => {
      const D = await mkUser();
      const room = await played(D, 12, 30);
      await rejects(fn('select projector_evaluate_reward($1,$2) as r', [room, A]), /Only the room host/);
      const out = await fn('select projector_evaluate_reward($1,$2) as r', [room, D]);
      expect(out.verdict).toBe('accepted'); expect(out.amount).toBeGreaterThan(0);
      const again = await fn('select projector_evaluate_reward($1,$2) as r', [room, D]);
      expect(again.duplicate).toBe(true);
      expect((await q('select count(*)::int c from projector_reward_ledger where owner_id=$1', [D]))[0].c).toBe(1);
    });
    it('a second session that overlaps the first in time is rejected', async () => {
      const E = await mkUser();
      const r1 = await played(E, 12, 30); const r2 = await played(E, 12, 30);
      expect((await fn('select projector_evaluate_reward($1,$2) as r', [r1, E])).verdict).toBe('accepted');
      const second = await fn('select projector_evaluate_reward($1,$2) as r', [r2, E]);
      expect(second.verdict).toBe('rejected'); expect(second.reasons).toContain('overlapsAnotherSession');
    });
    it('only a rejected evaluation can be appealed, once', async () => {
      const F = await mkUser();
      const thin = await played(F, 3, 1);
      const ev = await fn('select projector_evaluate_reward($1,$2) as r', [thin, F]);
      await rejects(fn("select projector_appeal_reward($1,$2,'too short reason') as r", [A, ev.evidenceId]), /own rejected/);
      expect((await fn("select projector_appeal_reward($1,$2,'We ran a short revision drill on purpose') as r", [F, ev.evidenceId])).ok).toBe(true);
      await rejects(fn("select projector_appeal_reward($1,$2,'We ran a short revision drill on purpose') as r", [F, ev.evidenceId]), /already appealed/);
    });
  });
});
