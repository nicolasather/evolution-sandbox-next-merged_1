/** Part A repairs against REAL Postgres (001–006 applied) with the real five-stage answer pipeline:
 *  secrecy of whole responses, two host tabs racing, orphaned-answer reconciliation, both modifiers end-to-end, migration 006.
 *    QUIZ_TEST_DATABASE_URL=postgres://… npx jest -c jest.db.config.js lib/quiz/projector
 *  NEVER point this at production: it creates and removes its own users, quizzes and rooms. */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.QUIZ_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
const pool = new Pool({ connectionString: URL, max: 12 });
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../supabase', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use hoisted imports
  serviceDB: () => (require('../pgadapter') as typeof import('../pgadapter')).pgSupabase((globalThis as unknown as { __pool: Pool }).__pool),
  currentUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
  maybeUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
}));

const SECRET_EXPL = 'SECRET_EXPLANATION_7E09';
const SECRET_SEED = 'SECRET_SEED_9A41';

suite('projector repairs (real SQL)', () => {
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
  const quizzes: string[] = []; const users: string[] = []; let HOST = '';
  beforeAll(async () => {
    HOST = randomUUID(); users.push(HOST); await q('insert into auth.users(id,email) values($1,$2)', [HOST, `${HOST}@t.invalid`]);
    (globalThis as unknown as { __pool: Pool; __host: string }).__pool = pool; (globalThis as unknown as { __host: string }).__host = HOST;
  });
  afterAll(async () => { await q('delete from quizzes where id=any($1::uuid[])', [quizzes]); await q('delete from auth.users where id=any($1::uuid[])', [users]); await pool.end(); });
  const mc = (i: number) => ({ kind: 'multiple_choice', prompt: 'Q' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], meta: { topic: ['Fractions', 'Geometry'][i % 2] } }, answerKey: { correctIds: ['a'], explanation: SECRET_EXPL } });
  async function quiz(n: number) {
    const r = await q('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [HOST, 'R-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(Array.from({ length: n }, (_, i) => mc(i)))]);
    quizzes.push(r[0].r); return r[0].r as string;
  }
  async function game(gameKey: string, extra: Record<string, unknown> = {}) {
    const { createProjectorRoom } = await import('../create');
    const server = await import('../server');
    const created = await createProjectorRoom({ quizId: await quiz(40), game: gameKey, teamNames: ['Red', 'Blue', 'Gold'], minutes: 30, seed: SECRET_SEED, ...extra }, { id: HOST });
    const roomId = created.roomId as string; let n = 0;
    let snap = await server.snapshot(roomId, 'host');
    const send = async (action: string, payload: Record<string, unknown> = {}) => { const r = await server.act({ roomId, hostId: HOST, commandId: `cmd-${randomUUID()}`, expectedRevision: snap.revision, action, payload }); snap = r; n++; return r; };
    await send('start');
    return { roomId, server, send, get snap() { return snap; }, set snap(v) { snap = v; } };
  }

  it('PATCH D: neither the projector nor the host response ever contains the seed; the projector never gets the key before reveal', async () => {
    const g = await game('boss_battle');
    const { server, roomId } = g;
    // choose + ask → a question is open
    const t = g.snap.game.core.teams[0]!.id;
    await g.send('choose_action', { team: t, action: 'strike', aim: 'any' }); await g.send('ask');
    expect(g.snap.game.core.phase).toBe('asking');
    const proj = JSON.stringify(await server.snapshot(roomId, 'projector'));
    const host = JSON.stringify(await server.snapshot(roomId, 'host'));
    expect(proj).not.toContain(SECRET_SEED); expect(host).not.toContain(SECRET_SEED);
    expect(proj).not.toContain(SECRET_EXPL); expect(proj).not.toMatch(/answerKey|correctIds/);
    expect(host).toContain(SECRET_EXPL); // the teacher's peek, to mark spoken answers
    await g.send('grade', { teamId: t, verdict: 'correct' });
  }, 60000);

  it('PATCH C: two host tabs grading the same team at once → one submission, one consumption, no lost answer', async () => {
    const g = await game('risk_ladder');
    const { server, roomId } = g;
    const t = g.snap.game.core.teams[0]!.id;
    await g.send('choose_action', { team: t, action: 'climb', route: 'normal' }); await g.send('ask');
    const rev = g.snap.revision;
    const tab = (verdict: string) => server.act({ roomId, hostId: HOST, commandId: `tab-${randomUUID()}`, expectedRevision: rev, action: 'grade', payload: { teamId: t, verdict } }).then((r) => ({ ok: true as const, r }), (e: Error) => ({ ok: false as const, e }));
    const [a, b] = await Promise.all([tab('correct'), tab('wrong')]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1); // exactly one tab's command commits
    const subs = await q('select id, correct from submissions where room_id=$1', [roomId]);
    expect(subs).toHaveLength(1);
    const s = await server.snapshot(roomId, 'host');
    expect(s.game.core.evidence.filter((e) => e.sub === subs[0].id)).toHaveLength(1);
    expect(s.game.core.evidence[0]!.grade).toBe(subs[0].correct ? 'correct' : 'wrong'); // the state matches the committed row, whichever tab won
  }, 60000);

  it('PATCH C: an answer committed while the state commit failed is reconciled by the next command, never lost or doubled', async () => {
    const g = await game('final_showdown');
    const { server, roomId } = g;
    const t = g.snap.game.core.teams[0]!.id;
    await g.send('choose_action', { team: t, choice: 'steady' });
    if (g.snap.game.core.phase !== 'asking') await g.send('ask');
    expect(g.snap.game.core.phase).toBe('asking');
    const ask = g.snap.game.core.ask!;
    // simulate: the pipeline committed the answer, then the projector_commit lost (nothing else happened)
    const { submitAnswer } = await import('../../answer-pipeline');
    await submitAnswer({ roomId, roomQuestionId: ask.roomQuestionId, actorId: ask.teamIds[0], override: true });
    const before = await server.snapshot(roomId, 'host');
    expect(before.game.core.ask!.answered).toHaveLength(0); // the game has not seen it yet
    // the teacher clicks "grade" again (with no verdict — the committed row is the truth)
    const after = await server.act({ roomId, hostId: HOST, commandId: `rec-${randomUUID()}`, expectedRevision: before.revision, action: 'grade', payload: { teamId: ask.teamIds[0] } });
    const subs = await q('select id from submissions where room_id=$1', [roomId]);
    expect(subs).toHaveLength(1);
    expect(after.game.core.evidence.map((e) => e.sub)).toEqual([subs[0].id]);
    expect(after.game.core.evidence[0]!.grade).toBe('correct');
  }, 60000);

  it('PATCH B: Secret Wager and Steal the Question end-to-end in Auction House (round robin), settled in the game wallet only', async () => {
    const g = await game('auction_house', { flow: 'round_robin', modifiers: ['secret_wager', 'steal_question'] });
    const { server, roomId } = g;
    const [t1, t2] = g.snap.game.core.teams.map((t) => t.id);
    const wallet = () => g.snap.game.g as { teams: Record<string, { points: number }> };
    const teamsPoints = async () => (await q('select id, points from teams where room_id=$1', [roomId])).reduce((m, r) => ({ ...m, [r.id]: Number(r.points) }), {} as Record<string, number>);
    expect(g.snap.config.mods).toEqual(['secret_wager', 'steal_question']);
    const start1 = wallet().teams[t1!]!.points;
    await g.send('wager', { team: t1, amount: 3 });
    expect((await server.snapshot(roomId, 'projector')).game.core.wagers![t1!]).toBe(-1); // amount hidden on the shared screen
    await g.send('ask', { tier: 'standard' });
    await g.send('grade', { teamId: t1, verdict: 'wrong' });
    expect(wallet().teams[t1!]!.points).toBe(start1 - 3); // stake lost, nothing earned
    expect(g.snap.game.core.rebound).toMatchObject({ from: t1, used: false });
    // the projector still shows the question while it can be stolen, without the key
    const proj = await server.snapshot(roomId, 'projector');
    expect(proj.question).toBeTruthy(); expect(JSON.stringify(proj.question)).not.toContain(SECRET_EXPL);
    const start2 = wallet().teams[t2!]!.points;
    await g.send('rebound', { team: t2, verdict: 'correct' });
    expect(wallet().teams[t2!]!.points).toBe(start2 + 6);
    expect(g.snap.game.core.rebound).toMatchObject({ used: true, team: t2 });
    const subs = await q('select actor_id, correct, wager from submissions where room_id=$1 order by submitted_at', [roomId]);
    expect(subs.map((r) => [r.actor_id, r.correct, r.wager])).toEqual([[t1, false, 0], [t2, true, 0]]); // no classic wager in teams.points
    // a second steal of the same question is refused by the reducer and by set_steal
    await expect(g.send('rebound', { team: g.snap.game.core.teams[2]!.id, verdict: 'correct' })).rejects.toThrow(/noRebound/);
    expect(Object.values(await teamsPoints()).every((p) => Number(p) >= 0)).toBe(true);
  }, 60000);

  it('PATCH B: the server refuses a modifier the game cannot run', async () => {
    const { createProjectorRoom } = await import('../create');
    await expect(createProjectorRoom({ quizId: await quiz(40), game: 'boss_battle', teamNames: ['A', 'B'], minutes: 30, modifiers: ['potluck'] }, { id: HOST })).rejects.toThrow(/random score swing/);
    await expect(createProjectorRoom({ quizId: await quiz(40), game: 'auction_house', teamNames: ['A', 'B'], minutes: 30, flow: 'synchronized', modifiers: ['steal_question'] }, { id: HOST })).rejects.toThrow(/round robin/);
    await expect(createProjectorRoom({ quizId: await quiz(40), game: 'auction_house', teamNames: ['Red', ' red '], minutes: 30 }, { id: HOST })).rejects.toThrow(/same name/);
  }, 30000);

  it('migration 006: exactly the ten game keys are allowed; an unknown key is rejected', async () => {
    const con = await q("select pg_get_constraintdef(c.oid) d from pg_constraint c join pg_class r on r.oid=c.conrelid where r.relname='projector_sessions' and c.contype='c' and pg_get_constraintdef(c.oid) like '%game%'");
    expect(con).toHaveLength(1);
    for (const k of ['empire_race', 'boss_battle', 'escape_room', 'treasure_vault', 'risk_ladder', 'auction_house', 'territory_war', 'lucky_factory', 'pirate_voyage', 'final_showdown']) expect(con[0].d).toContain(`'${k}'`);
    const quizId = await quiz(3);
    const room = (await q("select create_room_with_content($1,$2,'classroom','round_robin',$3::jsonb,$4,$5::text[],null) as r", [HOST, quizId, JSON.stringify({ durationSeconds: 900, questionSeconds: null, modifiers: [], slotLimit: 3, teamNames: ['A', 'B'] }), randomUUID().slice(0, 6).toUpperCase(), ['A', 'B']]))[0].r.roomId;
    await expect(q("select projector_create_session($1,$2,'tower_defense','{}','{}')", [room, HOST])).rejects.toThrow(/check constraint/);
    await expect(q("select projector_create_session($1,$2,'final_showdown','{}','{}')", [room, HOST])).resolves.toBeTruthy();
  }, 30000);
});
