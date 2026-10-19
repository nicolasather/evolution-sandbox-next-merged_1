/** End-to-end orchestration against real Postgres: createSession → act (ask → grade) → commit → snapshot, with the real answer pipeline. */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.QUIZ_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
const pool = new Pool({ connectionString: URL, max: 8 });
let HOST = '';
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../supabase', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use hoisted imports
  serviceDB: () => (require('../pgadapter') as typeof import('../pgadapter')).pgSupabase((globalThis as unknown as { __pool: Pool }).__pool),
  currentUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
  maybeUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
}));

suite('projector server orchestration (real SQL)', () => {
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
  const quizzes: string[] = []; const users: string[] = [];
  beforeAll(async () => {
    HOST = randomUUID(); users.push(HOST); await q('insert into auth.users(id,email) values($1,$2)', [HOST, `${HOST}@t.invalid`]);
    (globalThis as unknown as { __pool: Pool; __host: string }).__pool = pool; (globalThis as unknown as { __host: string }).__host = HOST;
  });
  afterAll(async () => { await q('delete from quizzes where id=any($1::uuid[])', [quizzes]); await q('delete from auth.users where id=any($1::uuid[])', [users]); await pool.end(); });

  const mc = (i: number) => ({ kind: 'multiple_choice', prompt: 'Q' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], meta: { topic: ['Fractions', 'Geometry', 'Algebra'][i % 3], difficulty: ['easy', 'medium', 'hard'][i % 3] } }, answerKey: { correctIds: ['a'], explanation: 'Because a.' } });
  async function quiz(n: number) {
    const r = await q('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [HOST, 'S-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(Array.from({ length: n }, (_, i) => mc(i)))]);
    quizzes.push(r[0].r); return r[0].r as string;
  }

  it('creates a room + session, refuses a too-small quiz, and plays a full Boss Battle to the end', async () => {
    const { createProjectorRoom } = await import('../create');
    const server = await import('../server');
    await expect(createProjectorRoom({ quizId: await quiz(3), game: 'boss_battle', teamNames: ['A', 'B'], minutes: 30 }, { id: HOST })).rejects.toThrow(/tooFewQuestions/);
    const created = await createProjectorRoom({ quizId: await quiz(40), game: 'boss_battle', teamNames: ['Red', 'Blue'], minutes: 15, flow: 'round_robin' }, { id: HOST });
    const roomId = created.roomId as string;
    let snap = await server.snapshot(roomId, 'host');
    expect(snap.revision).toBe(0); expect(snap.game.core.game).toBe('boss_battle');
    expect(JSON.stringify(snap.game)).not.toMatch(/answerKey|correctIds/);
    // start the room, then the teacher presses buttons
    let cmd = 0; const send = async (action: string, payload: Record<string, unknown> = {}) => { const r = await server.act({ roomId, hostId: HOST, commandId: `cmd-${String(++cmd).padStart(6, '0')}`, expectedRevision: snap.revision, action, payload }); snap = r; return r; };
    await send('start');
    let guard = 0;
    while (snap.game.core.phase !== 'finished' && guard++ < 400) {
      const c = snap.game.core; const g = snap.game.g as { teams: Record<string, { chosen: string | null; role: string }> };
      if (c.phase === 'choose') {
        const teamId = c.teams[c.actor % c.teams.length]!.id;
        if (!g.teams[teamId]!.chosen) await send('choose_action', { team: teamId, action: 'strike', aim: 'any' }); else await send('ask');
      } else if (c.phase === 'asking') {
        const t = c.ask!.teamIds.find((id) => !c.ask!.answered.includes(id))!;
        expect(snap.question).toBeTruthy(); expect(JSON.stringify((await server.snapshot(roomId, 'projector')).question)).not.toMatch(/answerKey/);
        await send('grade', { teamId: t, verdict: guard % 4 === 0 ? 'wrong' : 'correct' });
      } else await send('continue');
    }
    expect(snap.game.core.phase).toBe('finished');
    expect((await q('select status from rooms where id=$1', [roomId]))[0].status).toBe('ended');
    // every verified answer in the evidence points at a real committed submission
    const subs = await q('select id from submissions where room_id=$1', [roomId]);
    const ev = (snap.game.core.evidence ?? []) as { sub: string }[];
    expect(ev.length).toBe(subs.length); expect(ev.every((e) => subs.some((s) => s.id === e.sub))).toBe(true);
    // idempotent replay and stale revision
    const replay = await server.act({ roomId, hostId: HOST, commandId: 'cmd-000001', expectedRevision: 0, action: 'start', payload: {} });
    expect(replay.replayed).toBe(true);
    await expect(server.act({ roomId, hostId: HOST, commandId: 'zzz-000001', expectedRevision: 0, action: 'ask', payload: {} })).rejects.toThrow(/revisionConflict/);
  }, 60000);

  it('wrong host, bad verdict and early answers are rejected without changing state', async () => {
    const { createProjectorRoom } = await import('../create');
    const server = await import('../server');
    const created = await createProjectorRoom({ quizId: await quiz(40), game: 'risk_ladder', teamNames: ['A', 'B', 'C'], minutes: 20 }, { id: HOST });
    const roomId = created.roomId as string;
    await expect(server.act({ roomId, hostId: randomUUID(), commandId: 'cmd-badhost1', expectedRevision: 0, action: 'ask', payload: {} })).rejects.toThrow(/Only the room host/);
    await expect(server.act({ roomId, hostId: HOST, commandId: 'cmd-notstart', expectedRevision: 0, action: 'ask', payload: {} })).rejects.toThrow(/notRunning/);
    await server.act({ roomId, hostId: HOST, commandId: 'cmd-startrun', expectedRevision: 0, action: 'start', payload: {} });
    const s = await server.snapshot(roomId, 'host');
    await expect(server.act({ roomId, hostId: HOST, commandId: 'cmd-gradeearly', expectedRevision: s.revision, action: 'grade', payload: { teamId: 'x', verdict: 'correct' } })).rejects.toThrow(/projector:/);
    expect((await server.snapshot(roomId, 'host')).revision).toBe(s.revision);
  }, 30000);

  it('the clock: pause freezes the deadline, overtime turns into a finish-turn, extend clears it', async () => {
    const { createProjectorRoom } = await import('../create');
    const server = await import('../server');
    const created = await createProjectorRoom({ quizId: await quiz(40), game: 'treasure_vault', teamNames: ['A', 'B'], minutes: 10 }, { id: HOST });
    const roomId = created.roomId as string;
    let rev = 0; const send = async (action: string, payload: Record<string, unknown> = {}) => { const r = await server.act({ roomId, hostId: HOST, commandId: `clk-${action}-${rev}-${Math.random().toString(36).slice(2, 8)}`, expectedRevision: rev, action, payload }); rev = r.revision; return r; };
    await send('start');
    const s1 = await server.snapshot(roomId, 'host');
    expect(new Date(s1.clock.deadlineAt!).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    await send('pause'); expect((await server.snapshot(roomId, 'host')).clock.paused).toBe(true);
    await send('resume');
    await send('choose_vault', { vault: 'v1' }); await send('ask'); // a question is now open, so overtime must wait for the end of the turn
    // force the deadline into the past (but inside the grace window the room keeps accepting commands)
    await q("update rooms set expires_at = now() + interval '20 minutes' where id=$1", [roomId]);
    const over = await server.snapshot(roomId, 'host');
    expect(over.clock.overtime).toBe(true);
    expect(over.game.core.finishAfterTurn || over.game.core.phase === 'finished').toBe(true);
    rev = over.revision;
    const ext = await send('extend', { minutes: 15, reason: 'Class needed more time' });
    expect(ext.game.core.extensions.length).toBe(1);
    expect((await server.snapshot(roomId, 'host')).clock.overtime).toBe(false);
  }, 30000);
});
