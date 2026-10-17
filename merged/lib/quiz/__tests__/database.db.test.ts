/**
 * Database-level tests for supabase/migrations 001 + 002. They run real SQL against a scratch Postgres, so they
 * exercise the actual row locks, constraints and privileges (not mocks). Run with:
 *   QUIZ_TEST_DATABASE_URL=postgres://… npx vitest run lib/quiz/__tests__/database.db.test.ts
 * The target database must already have both migrations applied and a Supabase-style anon/authenticated/service_role setup.
 * NEVER point this at a production database: it creates (and removes) its own users, quizzes and rooms.
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.QUIZ_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

suite('database: security, scoring and concurrency', () => {
  const pool = new Pool({ connectionString: URL, max: 24 });
  const q = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows;
  const fn = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0]?.r;
  const users: string[] = [];
  const quizzes: string[] = [];
  let A = '', B = '';

  const mcQ = (prompt: string, points = 100) => ({ kind: 'multiple_choice', prompt, basePoints: points, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }, answerKey: { correctIds: ['a'] } });
  async function mkUser() { const id = randomUUID(); await q('insert into auth.users(id,email) values($1,$2)', [id, `${id}@test.invalid`]); users.push(id); return id; }
  async function mkQuiz(owner: string, n = 3, status = 'published', points = 100) {
    const id = await fn('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [owner, 'T-' + randomUUID().slice(0, 6), 'd', status, JSON.stringify(Array.from({ length: n }, (_, i) => mcQ('Q' + i, points)))]);
    quizzes.push(id); return id as string;
  }
  type RoomOpts = { mode?: string; flow?: string; mods?: string[]; slots?: number; teams?: string[]; qsec?: number | null; dur?: number; host?: string | null };
  async function mkRoom(quiz: string, o: RoomOpts = {}) {
    const mode = o.mode ?? 'classroom', flow = o.flow ?? 'synchronized';
    const cfg = { durationSeconds: o.dur ?? 900, questionSeconds: o.qsec ?? null, modifiers: o.mods ?? [], slotLimit: o.slots ?? 3, teamNames: o.teams ?? [] };
    const hash = mode === 'solo' ? randomUUID() : null;
    const out = await fn('select create_room_with_content($1,$2,$3,$4,$5::jsonb,$6,$7::text[],$8) as r', [o.host === undefined ? A : o.host, quiz, mode, flow, JSON.stringify(cfg), randomUUID().slice(0, 6).toUpperCase(), o.teams ?? [], hash]);
    return out as { roomId: string; code: string; playerId?: string };
  }
  const ctl = (room: string, host: string, action: string) => fn('select control_room($1,$2,$3) as r', [room, host, action]);
  const rq = async (room: string, pos: number) => (await q('select id from room_questions where room_id=$1 and position=$2', [room, pos]))[0].id as string;
  const commit = (room: string, qid: string, type: 'team' | 'player', actor: string, o: { correct?: boolean; base?: number; wager?: number; manual?: boolean } = {}) =>
    fn('select commit_answer($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) as r', [room, qid, type, actor, '{"kind":"multiple_choice","selectedIds":["a"]}', o.correct ?? true, o.base ?? (o.correct === false ? 0 : 100), o.wager ?? 0, o.manual ?? false]);
  async function join(code: string, name?: string) { const r = await fn('select join_room($1,$2,$3) as r', [code, name ?? 'P' + randomUUID().slice(0, 5), randomUUID()]); return r.playerId as string; }
  const pts = async (table: 'players' | 'teams', id: string) => Number((await q(`select points from ${table} where id=$1`, [id]))[0].points);
  const rejects = async (p: Promise<unknown>, re: RegExp) => { await expect(p).rejects.toThrow(re); };
  const setPoints = (table: 'players' | 'teams', id: string, n: number) => q(`update ${table} set points=$2 where id=$1`, [id, n]);

  beforeAll(async () => { A = await mkUser(); B = await mkUser(); });
  afterAll(async () => {
    await q('delete from quizzes where id = any($1::uuid[])', [quizzes]); // rooms cascade
    await q('delete from auth.users where id = any($1::uuid[])', [users]);
    await q("delete from rate_limits where key like 'test-%'");
    await pool.end();
  });

  describe('privileges (RLS / grants)', () => {
    it('anon and authenticated cannot read or write any quiz table', async () => {
      for (const role of ['anon', 'authenticated']) {
        for (const t of ['quizzes', 'quiz_questions', 'rooms', 'room_questions', 'teams', 'players', 'submissions', 'score_events', 'rate_limits']) {
          const c = await pool.connect();
          try { await c.query(`set role ${role}`); await expect(c.query(`select * from public.${t} limit 1`)).rejects.toThrow(/permission denied/); }
          finally { await c.query('reset role'); c.release(); }
        }
        const c = await pool.connect();
        try { await c.query(`set role ${role}`); await expect(c.query(`insert into public.quizzes(owner_id,title) values ('${A}','x')`)).rejects.toThrow(/permission denied/); }
        finally { await c.query('reset role'); c.release(); }
      }
    });
    it('anon and authenticated cannot execute any scoring / room function', async () => {
      const calls = [
        "select commit_answer(gen_random_uuid(),gen_random_uuid(),'player',gen_random_uuid(),'{}',true,100,0,false)",
        "select apply_modifier(gen_random_uuid(),'potluck',gen_random_uuid(),null,0)",
        "select undo_latest_score_event(gen_random_uuid())",
        "select control_room(gen_random_uuid(),gen_random_uuid(),'start')",
        "select save_owned_quiz(gen_random_uuid(),null,'x','', 'draft','[]')",
        "select create_room_with_content(null,gen_random_uuid(),'solo','independent','{}','ABC123',array[]::text[],'h')",
        "select join_room('ABC123','n','h')", "select hit_rate_limit('k',1,1)", "select cleanup_stale_data()",
        "select skip_if_timed_out(gen_random_uuid(),gen_random_uuid())", "select finalize_if_expired(gen_random_uuid())", "select set_steal(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())",
      ];
      for (const role of ['anon', 'authenticated']) for (const sql of calls) {
        const c = await pool.connect();
        try { await c.query(`set role ${role}`); await expect(c.query(sql)).rejects.toThrow(/permission denied/); }
        finally { await c.query('reset role'); c.release(); }
      }
    });
    it('service_role can execute them', async () => {
      const c = await pool.connect();
      try { await c.query('set role service_role'); const r = await c.query("select hit_rate_limit('test-priv',5,60) as r"); expect(r.rows[0].r).toBe(true); }
      finally { await c.query('reset role'); c.release(); }
    });
  });

  describe('quiz ownership & persistence', () => {
    it("only the owner can update a quiz; another user's update is refused and changes nothing", async () => {
      const id = await mkQuiz(A, 2);
      await rejects(fn('select save_owned_quiz($1,$2,$3,$4,$5,$6::jsonb) as r', [B, id, 'hijack', '', 'published', JSON.stringify([mcQ('x')])]), /not found or not owned/);
      expect((await q('select title from quizzes where id=$1', [id]))[0].title).not.toBe('hijack');
      expect(await fn('select save_owned_quiz($1,$2,$3,$4,$5,$6::jsonb) as r', [A, id, 'renamed', '', 'draft', JSON.stringify([mcQ('only')])])).toBe(id);
      expect((await q('select title,status,owner_id from quizzes where id=$1', [id]))[0]).toMatchObject({ title: 'renamed', status: 'draft', owner_id: A });
    });
    it('persists question order and rejects invalid saves', async () => {
      const id = await mkQuiz(A, 0, 'draft');
      await fn('select save_owned_quiz($1,$2,$3,$4,$5,$6::jsonb) as r', [A, id, 't', '', 'published', JSON.stringify([mcQ('first'), mcQ('second'), mcQ('third')])]);
      expect((await q('select prompt from quiz_questions where quiz_id=$1 order by position', [id])).map((r) => r.prompt)).toEqual(['first', 'second', 'third']);
      await rejects(fn('select save_owned_quiz($1,$2,$3,$4,$5,$6::jsonb) as r', [A, id, 't', '', 'published', '[]']), /needs questions/);
      await rejects(fn('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [A, '', '', 'draft', '[]']), /Invalid quiz details/);
    });
    it('a quiz that has been played can still be deleted (rooms cascade) and quizzes survive unrelated cleanup', async () => {
      const id = await mkQuiz(A, 2);
      const room = await mkRoom(id, { mode: 'solo', flow: 'independent', host: null });
      await q('delete from quizzes where id=$1', [id]);
      expect(await q('select 1 from rooms where id=$1', [room.roomId])).toHaveLength(0);
      const keep = await mkQuiz(A, 1);
      await q("update rooms set created_at = now() - interval '200 days'");
      await fn('select cleanup_stale_data() as r');
      expect(await q('select 1 from quizzes where id=$1', [keep])).toHaveLength(1);
    });
    it('rooms play from an immutable snapshot of the questions', async () => {
      const id = await mkQuiz(A, 2);
      const room = await mkRoom(id, { teams: ['x', 'y'] });
      await fn('select save_owned_quiz($1,$2,$3,$4,$5,$6::jsonb) as r', [A, id, 'edited', '', 'published', JSON.stringify([mcQ('CHANGED')])]);
      const rows = await q('select prompt from room_questions where room_id=$1 order by position', [room.roomId]);
      expect(rows.map((r) => r.prompt)).toEqual(['Q0', 'Q1']);
    });
    it('draft quizzes cannot be hosted by other users; hosted modes require a host', async () => {
      const draft = await mkQuiz(A, 1, 'draft');
      await rejects(mkRoom(draft, { mode: 'solo', flow: 'independent', host: B }), /Quiz unavailable/);
      await rejects(mkRoom(draft, { mode: 'solo', flow: 'independent', host: null }), /Quiz unavailable/);
      await expect(mkRoom(draft, { mode: 'solo', flow: 'independent', host: A })).resolves.toBeTruthy();
      const pub = await mkQuiz(A, 1);
      await rejects(mkRoom(pub, { mode: 'online', flow: 'synchronized', host: null }), /Sign in required/);
      await rejects(mkRoom(pub, { mode: 'classroom', flow: 'synchronized', teams: ['only one'] }), /2-8 teams/);
    });
  });

  describe('answer commit (stage 5): atomic, bounded, non-repeatable', () => {
    it('awards the question’s points once and refuses a duplicate', async () => {
      const room = await mkRoom(await mkQuiz(A), { teams: ['T1', 'T2'] });
      await ctl(room.roomId, A, 'start');
      const [t1] = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      const q0 = await rq(room.roomId, 0);
      expect(await commit(room.roomId, q0, 'team', t1)).toMatchObject({ correct: true, awarded: 100, newPoints: 100 });
      await rejects(commit(room.roomId, q0, 'team', t1), /Already submitted/);
      expect(await pts('teams', t1)).toBe(100);
    });
    it('rejects forged awards (more than the question is worth, or points for a wrong answer)', async () => {
      const room = await mkRoom(await mkQuiz(A), { teams: ['T1', 'T2'] });
      await ctl(room.roomId, A, 'start');
      const t = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      const q0 = await rq(room.roomId, 0);
      await rejects(commit(room.roomId, q0, 'team', t[0], { correct: true, base: 9999 }), /Invalid award/);
      await rejects(commit(room.roomId, q0, 'team', t[0], { correct: false, base: 100 }), /Invalid award/);
      await rejects(commit(room.roomId, q0, 'team', t[0], { correct: true, base: -5 }), /Invalid award/);
      await rejects(commit(room.roomId, q0, 'team', t[0], { correct: true, base: 50 }), /Invalid award/);
      expect(await pts('teams', t[0])).toBe(0);
    });
    it('only the active question can be answered, and only while the room is active and not paused/revealed/expired', async () => {
      const room = await mkRoom(await mkQuiz(A), { teams: ['T1', 'T2'] });
      const t = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      const q0 = await rq(room.roomId, 0), q1 = await rq(room.roomId, 1);
      await rejects(commit(room.roomId, q0, 'team', t[0]), /Room not active/); // waiting
      await ctl(room.roomId, A, 'start');
      await rejects(commit(room.roomId, q1, 'team', t[0]), /Wrong question/);
      await ctl(room.roomId, A, 'pause');
      await rejects(commit(room.roomId, q0, 'team', t[0]), /Room not active/);
      await ctl(room.roomId, A, 'resume');
      await ctl(room.roomId, A, 'reveal');
      await rejects(commit(room.roomId, q0, 'team', t[0]), /already revealed/);
      await ctl(room.roomId, A, 'next');
      await expect(commit(room.roomId, q1, 'team', t[0])).resolves.toBeTruthy();
      await q("update rooms set expires_at = now() - interval '1 second' where id=$1", [room.roomId]);
      await rejects(commit(room.roomId, await rq(room.roomId, 1), 'team', t[1]), /Match expired/);
    });
    it('enforces the per-question timer and pause shifts it', async () => {
      const room = await mkRoom(await mkQuiz(A), { teams: ['T1', 'T2'], qsec: 10 });
      await ctl(room.roomId, A, 'start');
      const t = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      const q0 = await rq(room.roomId, 0);
      await q("update rooms set round_opened_at = now() - interval '11 seconds' where id=$1", [room.roomId]);
      await rejects(commit(room.roomId, q0, 'team', t[0]), /timer expired/);
      await q("update rooms set round_opened_at = now() - interval '9 seconds' where id=$1", [room.roomId]);
      await ctl(room.roomId, A, 'pause');
      await q("update rooms set paused_at = now() - interval '30 seconds' where id=$1", [room.roomId]);
      await ctl(room.roomId, A, 'resume'); // 30 s of pause must not eat into the 10 s timer
      await expect(commit(room.roomId, q0, 'team', t[0])).resolves.toBeTruthy();
    });
    it('Limited Slots admits exactly N answers under 12 truly concurrent submissions', async () => {
      const room = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized', mods: ['limited_slots'], slots: 3 });
      const players: string[] = []; for (let i = 0; i < 12; i++) players.push(await join(room.code));
      await ctl(room.roomId, A, 'start');
      const q0 = await rq(room.roomId, 0);
      const results = await Promise.allSettled(players.map((p) => commit(room.roomId, q0, 'player', p)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      expect(results.filter((r) => r.status === 'rejected' && /slots taken/.test(String((r as PromiseRejectedResult).reason)))).toHaveLength(9);
      expect((await q('select count(*)::int c from submissions where room_question_id=$1', [q0]))[0].c).toBe(3);
    });
    it('a repeated/concurrent submission by one player is rewarded exactly once', async () => {
      const room = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' });
      const p = await join(room.code);
      await ctl(room.roomId, A, 'start');
      const q0 = await rq(room.roomId, 0);
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => commit(room.roomId, q0, 'player', p)));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await pts('players', p)).toBe(100);
    });
    it('classroom actors must be teams; online actors must be players', async () => {
      const cl = await mkRoom(await mkQuiz(A), { teams: ['T1', 'T2'] }); await ctl(cl.roomId, A, 'start');
      await rejects(commit(cl.roomId, await rq(cl.roomId, 0), 'player', randomUUID()), /Wrong actor type/);
      const on = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' }); const p = await join(on.code); await ctl(on.roomId, A, 'start');
      await rejects(commit(on.roomId, await rq(on.roomId, 0), 'team', p), /Wrong actor type/);
    });
    it('a player cannot answer in another room', async () => {
      const r1 = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' }), r2 = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' });
      const p1 = await join(r1.code); await ctl(r1.roomId, A, 'start'); await ctl(r2.roomId, A, 'start');
      await rejects(commit(r2.roomId, await rq(r2.roomId, 0), 'player', p1), /Player absent/);
    });
  });

  describe('classroom round robin and Steal the Question', () => {
    it('only the team whose turn it is may answer; the turn rotates on Next', async () => {
      const room = await mkRoom(await mkQuiz(A), { flow: 'round_robin', teams: ['T1', 'T2', 'T3'] });
      await ctl(room.roomId, A, 'start');
      const t = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      const q0 = await rq(room.roomId, 0), q1 = await rq(room.roomId, 1);
      await rejects(commit(room.roomId, q0, 'team', t[1]), /Wrong turn/);
      await commit(room.roomId, q0, 'team', t[0]);
      await ctl(room.roomId, A, 'next');
      await rejects(commit(room.roomId, q1, 'team', t[0]), /Wrong turn/);
      await expect(commit(room.roomId, q1, 'team', t[1])).resolves.toBeTruthy();
    });
    it('a wrong answer can be stolen once by a chosen team, and the steal then closes', async () => {
      const room = await mkRoom(await mkQuiz(A), { flow: 'round_robin', mods: ['steal_question'], teams: ['T1', 'T2', 'T3'] });
      await ctl(room.roomId, A, 'start');
      const t = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      const q0 = await rq(room.roomId, 0);
      await rejects(fn('select set_steal($1,$2,$3) as r', [room.roomId, A, t[1]]), /No incorrect answer/);
      await commit(room.roomId, q0, 'team', t[0], { correct: false });
      await rejects(fn('select set_steal($1,$2,$3) as r', [room.roomId, B, t[1]]), /Only the room host/);
      await rejects(fn('select set_steal($1,$2,$3) as r', [room.roomId, A, t[0]]), /already answered/);
      await fn('select set_steal($1,$2,$3) as r', [room.roomId, A, t[1]]);
      await rejects(commit(room.roomId, q0, 'team', t[2]), /Wrong turn/);
      await expect(commit(room.roomId, q0, 'team', t[1])).resolves.toMatchObject({ awarded: 100 });
      await rejects(commit(room.roomId, q0, 'team', t[1]), /Already submitted|Wrong turn/);
      expect((await q('select steal_active from rooms where id=$1', [room.roomId]))[0].steal_active).toBe(false);
    });
    it('Steal the Question is refused unless that modifier was chosen', async () => {
      const room = await mkRoom(await mkQuiz(A), { flow: 'round_robin', teams: ['T1', 'T2'] });
      await ctl(room.roomId, A, 'start');
      await rejects(fn('select set_steal($1,$2,$3) as r', [room.roomId, A, randomUUID()]), /requires classroom round robin/);
    });
  });

  describe('Secret Wager', () => {
    it('is refused without the modifier, can never exceed the balance, and loses at most the wager', async () => {
      const room = await mkRoom(await mkQuiz(A, 3, 'published', 100), { mode: 'online', flow: 'synchronized', mods: ['secret_wager'] });
      const p = await join(room.code); await ctl(room.roomId, A, 'start');
      const q0 = await rq(room.roomId, 0), q1 = await rq(room.roomId, 1);
      await rejects(commit(room.roomId, q0, 'player', p, { wager: 1 }), /Invalid wager/); // balance is 0
      await commit(room.roomId, q0, 'player', p); // +100
      await ctl(room.roomId, A, 'next');
      await rejects(commit(room.roomId, q1, 'player', p, { wager: 101 }), /Invalid wager/);
      await rejects(commit(room.roomId, q1, 'player', p, { wager: -1 }), /Invalid wager/);
      await commit(room.roomId, q1, 'player', p, { correct: false, wager: 100 });
      expect(await pts('players', p)).toBe(0);
      const plain = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' });
      const p2 = await join(plain.code); await ctl(plain.roomId, A, 'start'); await setPoints('players', p2, 500);
      await rejects(commit(plain.roomId, await rq(plain.roomId, 0), 'player', p2, { wager: 50 }), /Wager disabled/);
    });
    it('a correct wager wins exactly the wager on top of the base points', async () => {
      const room = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized', mods: ['secret_wager'] });
      const p = await join(room.code); await ctl(room.roomId, A, 'start'); await setPoints('players', p, 300);
      expect(await commit(room.roomId, await rq(room.roomId, 0), 'player', p, { wager: 250 })).toMatchObject({ awarded: 350, newPoints: 650 });
    });
  });

  describe('independent flow and solo', () => {
    it('players advance on their own cursors and can be on different questions', async () => {
      const room = await mkRoom(await mkQuiz(A, 3), { mode: 'online', flow: 'independent' });
      const [p1, p2] = [await join(room.code), await join(room.code)]; await ctl(room.roomId, A, 'start');
      await commit(room.roomId, await rq(room.roomId, 0), 'player', p1);
      await commit(room.roomId, await rq(room.roomId, 1), 'player', p1);
      const cur = async (p: string) => (await q('select cursor_index from players where id=$1', [p]))[0].cursor_index;
      expect([await cur(p1), await cur(p2)]).toEqual([2, 0]);
      await rejects(commit(room.roomId, await rq(room.roomId, 2), 'player', p2), /Wrong question/);
      await rejects(ctl(room.roomId, A, 'next'), /Cannot advance/);
      await rejects(ctl(room.roomId, A, 'reveal'), /reveal answers when the game ends/);
    });
    it('a solo game ends itself after the last answer, and times out an unanswered question', async () => {
      const room = await mkRoom(await mkQuiz(A, 2), { mode: 'solo', flow: 'independent', host: null, qsec: 10 });
      const player = (await q('select id from players where room_id=$1', [room.roomId]))[0].id;
      await q("update players set question_opened_at = now() - interval '12 seconds' where id=$1", [player]);
      await rejects(commit(room.roomId, await rq(room.roomId, 0), 'player', player), /timer expired/);
      expect(await fn('select skip_if_timed_out($1,$2) as r', [room.roomId, player])).toEqual({ skipped: true });
      expect((await q('select cursor_index from players where id=$1', [player]))[0].cursor_index).toBe(1);
      expect(await fn('select skip_if_timed_out($1,$2) as r', [room.roomId, player])).toEqual({ skipped: false });
      const done = await commit(room.roomId, await rq(room.roomId, 1), 'player', player);
      expect(done).toMatchObject({ finished: true, awarded: 100 });
      expect((await q('select status,revealed from rooms where id=$1', [room.roomId]))[0]).toEqual({ status: 'ended', revealed: true });
    });
    it('finalize_if_expired ends only matches whose clock has run out', async () => {
      const room = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' }); await ctl(room.roomId, A, 'start');
      expect(await fn('select finalize_if_expired($1) as r', [room.roomId])).toBe(false);
      await q("update rooms set expires_at = now() - interval '1 second' where id=$1", [room.roomId]);
      expect(await fn('select finalize_if_expired($1) as r', [room.roomId])).toBe(true);
      expect((await q('select status from rooms where id=$1', [room.roomId]))[0].status).toBe('ended');
    });
  });

  describe('quiz modifiers: audited, bounded, conserving', () => {
    async function arena(mods: string[], mode: 'classroom' | 'online' = 'online', n = 4, balances?: number[]) {
      const room = mode === 'online' ? await mkRoom(await mkQuiz(A), { mode, flow: 'synchronized', mods }) : await mkRoom(await mkQuiz(A), { mode, flow: 'synchronized', mods, teams: Array.from({ length: n }, (_, i) => 'T' + i) });
      const ids: string[] = [];
      if (mode === 'online') for (let i = 0; i < n; i++) ids.push(await join(room.code));
      else ids.push(...(await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id));
      await ctl(room.roomId, A, 'start');
      const table = mode === 'online' ? 'players' : 'teams';
      for (let i = 0; i < ids.length; i++) await setPoints(table, ids[i]!, balances?.[i] ?? 100 * (i + 1));
      return { room, ids, table: table as 'players' | 'teams' };
    }
    const mod = (room: string, kind: string, target: string, other: string | null = null, amount = 0) => fn('select apply_modifier($1,$2,$3,$4,$5) as r', [room, kind, target, other, amount]);

    it('Lose All Points, Go to First, Steal, Give and Swap each do exactly what they say', async () => {
      const { room, ids, table } = await arena(['lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points']); // 100,200,300,400
      await mod(room.roomId, 'lose_all', ids[0]!); expect(await pts(table, ids[0]!)).toBe(0);
      await mod(room.roomId, 'go_to_first', ids[0]!); expect(await pts(table, ids[0]!)).toBe(400);
      await mod(room.roomId, 'steal_points', ids[1]!, ids[2]!, 50); expect([await pts(table, ids[1]!), await pts(table, ids[2]!)]).toEqual([250, 250]);
      await mod(room.roomId, 'steal_points', ids[1]!, ids[2]!, 5000); expect([await pts(table, ids[1]!), await pts(table, ids[2]!)]).toEqual([500, 0]); // can only take what exists
      await mod(room.roomId, 'give_points', ids[1]!, ids[3]!, 9000); expect([await pts(table, ids[1]!), await pts(table, ids[3]!)]).toEqual([0, 900]);
      await mod(room.roomId, 'swap_points', ids[0]!, ids[3]!); expect([await pts(table, ids[0]!), await pts(table, ids[3]!)]).toEqual([900, 400]);
    });
    it('works the same on classroom teams', async () => {
      const { room, ids, table } = await arena(['steal_points', 'swap_points'], 'classroom', 3, [100, 40, 0]);
      await mod(room.roomId, 'steal_points', ids[0]!, ids[1]!, 100); expect([await pts(table, ids[0]!), await pts(table, ids[1]!)]).toEqual([140, 0]);
      await mod(room.roomId, 'swap_points', ids[1]!, ids[0]!); expect([await pts(table, ids[0]!), await pts(table, ids[1]!)]).toEqual([0, 140]);
    });
    it('refuses unselected, invalid and self-targeted events', async () => {
      const { room, ids } = await arena(['steal_points', 'steal_question']);
      await rejects(mod(room.roomId, 'swap_points', ids[0]!, ids[1]!), /Modifier not selected/);
      await rejects(mod(room.roomId, 'steal_points', ids[0]!, ids[0]!, 10), /Distinct opponent/);
      await rejects(mod(room.roomId, 'steal_points', ids[0]!, null, 10), /Distinct opponent/);
      await rejects(mod(room.roomId, 'steal_points', ids[0]!, ids[1]!, 0), /Invalid transfer amount/);
      await rejects(mod(room.roomId, 'steal_points', ids[0]!, ids[1]!, 10001), /Invalid transfer amount/);
      await rejects(mod(room.roomId, 'steal_points', randomUUID(), ids[1]!, 10), /Target absent/);
      await rejects(mod(room.roomId, 'steal_question', ids[0]!), /not an instant point event/);
    });
    it('Potluck stays within −200…+200, never below zero, and only once per question per target', async () => {
      const { room, ids, table } = await arena(['potluck'], 'online', 40, Array.from({ length: 40 }, (_, i) => i * 13));
      for (let i = 0; i < ids.length; i++) {
        const before = i * 13;
        const r = await mod(room.roomId, 'potluck', ids[i]!);
        expect(r.change).toBeGreaterThanOrEqual(-Math.min(200, before));
        expect(r.change).toBeLessThanOrEqual(200);
        expect(await pts(table, ids[i]!)).toBe(before + r.change);
      }
      await rejects(mod(room.roomId, 'potluck', ids[0]!), /once per question/);
      await ctl(room.roomId, A, 'next');
      await expect(mod(room.roomId, 'potluck', ids[0]!)).resolves.toBeTruthy();
    });
    it('Potluck is bounded and sometimes positive/negative over many rounds', async () => {
      const seen = new Set<number>();
      for (let k = 0; k < 6; k++) {
        const { room, ids } = await arena(['potluck'], 'online', 8, Array(8).fill(1000));
        for (const id of ids) { const r = await mod(room.roomId, 'potluck', id); expect(Math.abs(r.change)).toBeLessThanOrEqual(200); seen.add(Math.sign(r.change)); }
      }
      expect(seen.has(1) && seen.has(-1)).toBe(true);
    });
    it('concurrent transfers conserve the total and never create a negative balance', async () => {
      const { room, ids, table } = await arena(['steal_points', 'give_points', 'swap_points'], 'online', 5, [100, 200, 300, 50, 0]);
      const total = async () => (await q(`select sum(points)::int s, min(points)::int m from ${table} where room_id=$1`, [room.roomId]))[0];
      const before = (await total()).s;
      const kinds = ['steal_points', 'give_points', 'swap_points'];
      const jobs = Array.from({ length: 60 }, (_, i) => {
        const a = ids[i % 5]!, b = ids[(i * 3 + 1) % 5]!;
        return a === b ? Promise.resolve() : mod(room.roomId, kinds[i % 3]!, a, b, 10 + (i % 7) * 40);
      });
      const out = await Promise.allSettled(jobs);
      expect(out.some((o) => o.status === 'fulfilled')).toBe(true);
      const after = await total();
      expect(after.s).toBe(before);
      expect(after.m).toBeGreaterThanOrEqual(0);
    });
    it('every point change is written to the audit log', async () => {
      const { room, ids } = await arena(['steal_points']);
      await mod(room.roomId, 'steal_points', ids[0]!, ids[1]!, 30);
      const ev = await q("select actor_id,delta,reason from score_events where room_id=$1 and reason='steal_points' order by delta", [room.roomId]);
      expect(ev.map((e) => Number(e.delta))).toEqual([-30, 30]);
    });
    it('undo reverses only the latest event group, and refuses if the points were already spent', async () => {
      const room = await mkRoom(await mkQuiz(A), { teams: ['T1', 'T2'], mods: ['steal_points'] });
      await ctl(room.roomId, A, 'start');
      const t = (await q('select id from teams where room_id=$1 order by order_index', [room.roomId])).map((r) => r.id);
      await commit(room.roomId, await rq(room.roomId, 0), 'team', t[0]); // +100
      await fn('select undo_latest_score_event($1) as r', [room.roomId]); expect(await pts('teams', t[0])).toBe(0);
      await rejects(fn('select undo_latest_score_event($1) as r', [room.roomId]), /Nothing to undo/);
      await commit(room.roomId, await rq(room.roomId, 0), 'team', t[1]).catch(() => {}); // already submitted? t[1] has not
      await fn('select apply_modifier($1,$2,$3,$4,$5) as r', [room.roomId, 'steal_points', t[0], t[1], 50]);
      await setPoints('teams', t[0], 10); // the 50 points were "spent"
      await rejects(fn('select undo_latest_score_event($1) as r', [room.roomId]), /Cannot undo/);
    });
  });

  describe('room lifecycle (host authority)', () => {
    it('only the host controls the room; solo has no host controls', async () => {
      const room = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' });
      await rejects(ctl(room.roomId, B, 'start'), /Only the room host/);
      await rejects(ctl(room.roomId, randomUUID(), 'end'), /Only the room host/);
      await ctl(room.roomId, A, 'start');
      await rejects(ctl(room.roomId, A, 'start'), /already started/);
      await rejects(ctl(room.roomId, A, 'explode'), /Unsupported/);
      const solo = await mkRoom(await mkQuiz(A), { mode: 'solo', flow: 'independent', host: A });
      await rejects(ctl(solo.roomId, A, 'pause'), /no host controls/);
    });
    it('Next moves through the questions, then finishes and reveals; pause blocks Next', async () => {
      const room = await mkRoom(await mkQuiz(A, 2), { mode: 'online', flow: 'synchronized' });
      await ctl(room.roomId, A, 'start');
      await ctl(room.roomId, A, 'pause'); await rejects(ctl(room.roomId, A, 'next'), /while paused/); await ctl(room.roomId, A, 'resume');
      await ctl(room.roomId, A, 'next');
      expect((await q('select current_index from rooms where id=$1', [room.roomId]))[0].current_index).toBe(1);
      await ctl(room.roomId, A, 'next');
      expect((await q('select status,revealed from rooms where id=$1', [room.roomId]))[0]).toEqual({ status: 'ended', revealed: true });
    });
    it('only online rooms are joinable; names are unique; ended or full rooms are closed', async () => {
      const cl = await mkRoom(await mkQuiz(A), { teams: ['a', 'b'] });
      await rejects(join(cl.code), /not joinable/);
      const on = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' });
      await join(on.code, 'Sam');
      await rejects(join(on.code, 'sam'), /already taken/);
      await rejects(join('ZZZZZZ'), /not joinable/);
      for (let i = 0; i < 99; i++) await q('insert into players(room_id,display_name,secret_hash) values($1,$2,$3)', [on.roomId, 'bulk' + i, randomUUID()]);
      await rejects(join(on.code, 'overflow'), /player limit/);
      await ctl(on.roomId, A, 'end');
      await rejects(join(on.code, 'late'), /not joinable/);
    });
    it('player secrets are stored only as hashes and are unique', async () => {
      const room = await mkRoom(await mkQuiz(A), { mode: 'online', flow: 'synchronized' });
      await q('insert into players(room_id,display_name,secret_hash) values($1,$2,$3)', [room.roomId, 'h1', 'same-hash']);
      await expect(q('insert into players(room_id,display_name,secret_hash) values($1,$2,$3)', [room.roomId, 'h2', 'same-hash'])).rejects.toThrow(/unique|duplicate/);
    });
  });

  describe('rate limiter', () => {
    it('allows N hits per window, blocks the next, and recovers when the window passes', async () => {
      const key = 'test-' + randomUUID();
      const hit = () => fn('select hit_rate_limit($1,3,60) as r', [key]);
      expect([await hit(), await hit(), await hit(), await hit()]).toEqual([true, true, true, false]);
      await q("update rate_limits set window_start = now() - interval '61 seconds' where key=$1", [key]);
      expect(await hit()).toBe(true);
    });
    it('is atomic under concurrency', async () => {
      const key = 'test-' + randomUUID();
      const out = await Promise.all(Array.from({ length: 30 }, () => fn('select hit_rate_limit($1,10,60) as r', [key])));
      expect(out.filter(Boolean)).toHaveLength(10);
    });
  });
});
