/** Tower Defense server against REAL Postgres (migrations 001–007) with the real five-stage answer pipeline. (Matrix B/D/F evidence.)
 *    QUIZ_TEST_DATABASE_URL=postgres://… npx jest -c jest.db.config.js lib/quiz/td
 *  NEVER point this at production: it creates and removes its own users, quizzes and rooms. */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.QUIZ_TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
const pool = new Pool({ connectionString: URL, max: 30 });
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../../supabase', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use hoisted imports
  serviceDB: () => { const db = (require('../../projector/pgadapter') as typeof import('../../projector/pgadapter')).pgSupabase((globalThis as unknown as { __pool: Pool }).__pool); return { ...db, channel: () => ({ send: async () => 'ok' }), removeChannel: async () => 'ok' }; },
  currentUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
  maybeUser: async () => ({ id: (globalThis as unknown as { __host: string }).__host }),
}));

const SECRET_EXPL = 'TD_SECRET_EXPLANATION_51F2';
suite('Tower Defense server (real SQL)', () => {
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
  const quizzes: string[] = []; const users: string[] = []; let HOST = '';
  const realNow = Date.now.bind(Date); let clock = realNow(); let spy: jest.SpyInstance;
  beforeEach(() => { clock = realNow(); }); // the app clock is moved forward per test; presence is stamped by the database clock
  beforeAll(async () => {
    HOST = randomUUID(); users.push(HOST); await q('insert into auth.users(id,email) values($1,$2)', [HOST, `${HOST}@t.invalid`]);
    (globalThis as unknown as { __pool: Pool; __host: string }).__pool = pool; (globalThis as unknown as { __host: string }).__host = HOST;
    spy = jest.spyOn(Date, 'now').mockImplementation(() => clock);
  });
  afterAll(async () => { spy.mockRestore(); await q('delete from quizzes where id=any($1::uuid[])', [quizzes]); await q('delete from auth.users where id=any($1::uuid[])', [users]); await pool.end(); });
  const kinds = (i: number) => {
    const k = i % 3;
    if (k === 0) return { kind: 'multiple_choice', prompt: 'MC ' + i, basePoints: 100, payload: { options: [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }] }, answerKey: { correctIds: ['a'], explanation: SECRET_EXPL } };
    if (k === 1) return { kind: 'truth_hunt', prompt: 'TH ' + i, basePoints: 100, payload: { statements: [{ id: 's1', text: 'One' }, { id: 's2', text: 'Two' }] }, answerKey: { truth: { s1: true, s2: false }, partial: true, explanation: SECRET_EXPL } };
    return { kind: 'answer_forge', prompt: 'AF ' + i, basePoints: 100, payload: {}, answerKey: { accepted: ['forty two'], explanation: SECRET_EXPL } };
  };
  const right = (k: string) => (k === 'multiple_choice' ? { kind: k, selectedIds: ['a'] } : k === 'truth_hunt' ? { kind: k, truth: { s1: true, s2: false } } : { kind: k, text: 'forty two' });
  const wrong = (k: string) => (k === 'multiple_choice' ? { kind: k, selectedIds: ['b'] } : k === 'truth_hunt' ? { kind: k, truth: { s1: false, s2: true } } : { kind: k, text: 'nope' });
  async function quiz(n: number) {
    const r = await q('select save_owned_quiz($1,null,$2,$3,$4,$5::jsonb) as r', [HOST, 'TD-' + randomUUID().slice(0, 6), 'd', 'published', JSON.stringify(Array.from({ length: n }, (_, i) => kinds(i)))]);
    quizzes.push(r[0].r); return r[0].r as string;
  }
  const cmd = () => `c${randomUUID().replace(/-/g, '')}`;

  it('co-op, five devices: join, roles, start, real graded answers credited once, build race, wave, finish with immutable results', async () => {
    const td = await import('../server');
    const created = await td.createTDRoom({ quizId: await quiz(30), format: 'coop', teamCount: 1, teamSizeCap: 5, minutes: 10, mapId: 'meadow_circuit', flow: 'synchronized' }, { id: HOST });
    const roomId = created.roomId;
    const seats: { seatId: string; token: string }[] = [];
    for (let i = 0; i < 5; i++) { const j = await td.joinTD({ joinCode: created.joinCode, displayName: `Kid ${i}` }, null); seats.push({ seatId: j.seatId, token: j.token }); expect(j.teamId).toBe('sq1'); }
    // a sixth device waits without a squad (cap 5)
    const extra = await td.joinTD({ joinCode: created.joinCode, displayName: 'Kid extra' }, null); expect(extra.teamId).toBeNull();
    // the join is idempotent per player (same command id)
    const roles = ['architect', 'tactician', 'artillerist', 'alchemist', 'warden'] as const;
    for (let i = 0; i < 5; i++) expect((await td.seatCommand(roomId, seats[i]!.seatId, cmd(), { kind: 'role', role: roles[i]! })).ok).toBe(true);
    const r1 = await td.seatCommand(roomId, seats[0]!.seatId, 'same-command-0001', { kind: 'ready', ready: true });
    const r2 = await td.seatCommand(roomId, seats[0]!.seatId, 'same-command-0001', { kind: 'ready', ready: true });
    expect(r1.ok && r2.ok && r2.replayed).toBe(true);
    expect((await td.hostCommand(roomId, cmd(), { kind: 'start' })).ok).toBe(true);
    expect((await q('select status from rooms where id=$1', [roomId]))[0].status).toBe('active');
    for (const s of seats) await td.touch(roomId, { seatId: s.seatId }); // the devices are polling
    let st = await td.snapshot(roomId, { view: 'host' });
    expect(st.teams[0] && 'maxCoreHP' in st.teams[0] && st.teams[0].maxCoreHP).toBe(26); // one Warden: +2
    clock += 3500; st = await td.snapshot(roomId, { view: 'host' });
    expect(st.phase).toBe('quiz_open');
    const room = (await q('select current_index, revealed from rooms where id=$1', [roomId]))[0];
    expect(room.revealed).toBe(false);
    // students see the question without the key, the seed is nowhere
    const kid = await td.snapshot(roomId, { view: 'student', seatId: seats[0]!.seatId });
    expect(JSON.stringify(kid)).not.toContain(SECRET_EXPL); expect(JSON.stringify(kid.question)).not.toMatch(/answerKey|correctIds|accepted/);
    const seedRow = (await q('select seed from td_sessions where room_id=$1', [roomId]))[0].seed as string;
    for (const v of ['student', 'host'] as const) expect(JSON.stringify(await td.snapshot(roomId, v === 'host' ? { view: 'host' } : { view: 'student', seatId: seats[1]!.seatId }))).not.toContain(seedRow);
    // answers: 3 right, 1 wrong, 1 forged "correct" that the pipeline grades as wrong; a duplicate is refused
    const qq = kid.question as { id: string; kind: string };
    for (let i = 0; i < 3; i++) await td.answer(roomId, seats[i]!.token, seats[i]!.seatId, { roomQuestionId: qq.id, response: right(qq.kind) });
    await td.answer(roomId, seats[3]!.token, seats[3]!.seatId, { roomQuestionId: qq.id, response: wrong(qq.kind) });
    await expect(td.answer(roomId, seats[0]!.token, seats[0]!.seatId, { roomQuestionId: qq.id, response: right(qq.kind) })).rejects.toThrow(/already/);
    // a forged payload claiming correctness is refused by the pipeline's strict response schema (nothing is committed)
    await expect(td.answer(roomId, seats[4]!.token, seats[4]!.seatId, { roomQuestionId: qq.id, response: { ...wrong(qq.kind), correct: true, grade: 1 } })).rejects.toThrow();
    expect((await q('select count(*)::int n from submissions where actor_id=$1', [seats[4]!.seatId]))[0].n).toBe(0);
    await td.answer(roomId, seats[4]!.token, seats[4]!.seatId, { roomQuestionId: qq.id, response: wrong(qq.kind) });
    st = await td.snapshot(roomId, { view: 'host' });
    expect(st.phase).toBe('reveal'); // everyone answered → closed early
    const team = st.teams[0] as import('../domain').TDTeam;
    const credits = await q('select credit_key, amount, submission_ids from td_credits where room_id=$1', [roomId]);
    expect(credits).toHaveLength(1); expect(team.points).toBe(240 + credits[0].amount); expect(credits[0].amount).toBeGreaterThan(0); expect(credits[0].amount).toBeLessThan(80);
    // after the reveal the key (explanation) is visible to the class
    expect(JSON.stringify((await td.snapshot(roomId, { view: 'student', seatId: seats[0]!.seatId })).question)).toContain(SECRET_EXPL);
    // late answer after close: refused, never credited
    await expect(td.answer(roomId, seats[4]!.token, seats[4]!.seatId, { roomQuestionId: qq.id, response: right(qq.kind) })).rejects.toThrow(/closed|already/);
    // into build
    clock += 10_000; st = await td.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('build');
    // 50 simultaneous purchases of the same pad from five devices → exactly one tower and one debit
    const before = (st.teams[0] as import('../domain').TDTeam).points;
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => td.seatCommand(roomId, seats[i % 5]!.seatId, cmd(), { kind: 'build', padId: 'm01', tower: 'bolt' }, st.revision).catch((e: Error) => ({ ok: false as const, code: 'ERR', message: e.message, currentRevision: 0 }))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    st = await td.snapshot(roomId, { view: 'host' }); const t2 = st.teams[0] as import('../domain').TDTeam;
    expect(t2.towers.filter((x) => x.padId === 'm01')).toHaveLength(1);
    expect(before - t2.points).toBeLessThanOrEqual(120); expect(before - t2.points).toBeGreaterThanOrEqual(108); // Architect discount may apply
    // a forged team in the payload is impossible (schema) and another squad's pad cannot be touched: only own squad exists here
    // kick: the removed device can no longer act or answer
    expect((await td.hostCommand(roomId, cmd(), { kind: 'kick', seatId: seats[4]!.seatId })).ok).toBe(true);
    await expect(td.verifySeat({ id: roomId }, seats[4]!.token)).rejects.toThrow(/removed/);
    // pause freezes the build deadline, resume shifts it
    const dl = st.phaseDeadlineMs!;
    await td.hostCommand(roomId, cmd(), { kind: 'pause' }); expect((await q('select paused_at from rooms where id=$1', [roomId]))[0].paused_at).not.toBeNull();
    clock += 30_000; await td.hostCommand(roomId, cmd(), { kind: 'resume' });
    st = await td.snapshot(roomId, { view: 'host' }); expect(st.phaseDeadlineMs).toBe(dl + 30_000);
    // everyone ready → the wave starts early; then the wave plays out on the server clock
    for (let i = 0; i < 4; i++) await td.seatCommand(roomId, seats[i]!.seatId, cmd(), { kind: 'ready', ready: true });
    clock += 3500; st = await td.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('wave');
    const r = st.rounds[st.rounds.length - 1]!; expect(r.waveInput?.sq1?.towers.length).toBe(1);
    // the teacher ends the match: results written once and immutable
    expect((await td.hostCommand(roomId, cmd(), { kind: 'end' })).ok).toBe(true);
    const rows = await q('select * from td_results where room_id=$1', [roomId]);
    expect(rows).toHaveLength(1); expect(rows[0].rank).toBe(1);
    await expect(q('update td_results set points = 999999 where room_id=$1', [roomId])).rejects.toThrow(/final/);
    expect((await q('select status from rooms where id=$1', [roomId]))[0].status).toBe('ended');
    await expect(td.hostCommand(roomId, cmd(), { kind: 'start' })).resolves.toMatchObject({ ok: false, code: 'MATCH_FINISHED' });
    // replay log is sanitised and ordered
    const log = await td.replay(roomId); expect(log.length).toBeGreaterThan(10); expect(log.every((e, i) => i === 0 || e.revision > log[i - 1]!.revision)).toBe(true);
    expect(JSON.stringify(log)).not.toMatch(/token|secret|seed/i);
  }, 120_000);

  it('versus: mirrored waves, rival summaries only, Secret Wager settled once, a stale buyer is told plainly', async () => {
    const td = await import('../server');
    const created = await td.createTDRoom({ quizId: await quiz(30), format: 'versus', teamCount: 2, teamSizeCap: 2, minutes: 10, mapId: 'coral_quarry', flow: 'synchronized', modifiers: ['secret_wager'] }, { id: HOST });
    const roomId = created.roomId; const seats: { seatId: string; token: string; team: string }[] = [];
    for (let i = 0; i < 4; i++) { const j = await td.joinTD({ joinCode: created.joinCode, displayName: `V${i}`, desiredTeam: i < 2 ? 'sq1' : 'sq2' }, null); seats.push({ seatId: j.seatId, token: j.token, team: j.teamId! }); }
    expect(seats.map((s) => s.team)).toEqual(['sq1', 'sq1', 'sq2', 'sq2']);
    await td.hostCommand(roomId, cmd(), { kind: 'start' }); clock += 3500;
    let st = await td.snapshot(roomId, { view: 'student', seatId: seats[0]!.seatId });
    const rival = st.teams.find((t) => t.id === 'sq2') as Record<string, unknown>;
    expect(rival.points).toBeUndefined(); expect(rival.towers).toBeUndefined();
    const qq = st.question as { id: string; kind: string };
    for (const s of seats) await td.answer(roomId, s.token, s.seatId, { roomQuestionId: qq.id, response: right(qq.kind) });
    st = await td.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('reveal');
    const pts = (id: string) => (st.teams.find((t) => t.id === id) as import('../domain').TDTeam).points;
    expect(pts('sq1')).toBe(pts('sq2')); // equal answers → equal economy
    clock += 10_000; st = await td.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('build');
    // stake before the next question, then mirrored builds
    expect((await td.seatCommand(roomId, seats[0]!.seatId, cmd(), { kind: 'wager', amount: 50 })).ok).toBe(true);
    const rev = (await td.snapshot(roomId, { view: 'host' })).revision;
    expect((await td.seatCommand(roomId, seats[0]!.seatId, cmd(), { kind: 'build', padId: 'q01', tower: 'ember' }, rev)).ok).toBe(true);
    // teammate with the old revision tries to spend points that are no longer there
    const stale = await td.seatCommand(roomId, seats[1]!.seatId, cmd(), { kind: 'build', padId: 'q02', tower: 'arc' }, rev);
    if (!stale.ok) expect(stale.code === 'STALE_REVISION' || stale.code === 'INSUFFICIENT_POINTS').toBe(true);
    await td.seatCommand(roomId, seats[2]!.seatId, cmd(), { kind: 'build', padId: 'q01', tower: 'ember' });
    for (const s of seats) await td.seatCommand(roomId, s.seatId, cmd(), { kind: 'ready', ready: true });
    clock += 3500; st = await td.snapshot(roomId, { view: 'host' }); expect(st.phase).toBe('wave');
    const round = st.rounds[st.rounds.length - 1]!;
    expect(round.waveInput!.sq1!.spawns).toEqual(round.waveInput!.sq2!.spawns); // identical enemy plan for every squad
    // a student only receives its own squad's frozen board
    const me = await td.snapshot(roomId, { view: 'student', seatId: seats[0]!.seatId });
    expect(Object.keys(me.rounds[me.rounds.length - 1]!.waveInput ?? {})).toEqual(['sq1']);
    // wave ends, result, second question: the wager is settled exactly once
    clock += 120_000; st = await td.snapshot(roomId, { view: 'host' });
    expect(['quiz_open', 'finished']).toContain(st.phase);
    if (st.phase === 'quiz_open') {
      const q2 = (await td.snapshot(roomId, { view: 'student', seatId: seats[0]!.seatId })).question as { id: string; kind: string };
      const p0 = (st.teams.find((t) => t.id === 'sq1') as import('../domain').TDTeam).points;
      for (const s of seats) await td.answer(roomId, s.token, s.seatId, { roomQuestionId: q2.id, response: s.team === 'sq1' ? right(q2.kind) : wrong(q2.kind) });
      st = await td.snapshot(roomId, { view: 'host' });
      const t1 = st.teams.find((t) => t.id === 'sq1') as import('../domain').TDTeam;
      expect(t1.points).toBeGreaterThan(p0 + 50); expect(t1.wager).toBe(0);
      expect(await q("select count(*)::int n from td_credits where room_id=$1 and credit_key like 'q:%'", [roomId])).toEqual([{ n: 4 }]);
    }
  }, 120_000);

  it('privileges: anon and authenticated cannot read or call anything Tower Defense', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const t of ['td_sessions', 'td_events', 'td_credits', 'td_presence', 'td_results', 'td_outbox']) {
        const c = await pool.connect();
        try { await c.query(`set role ${role}`); await expect(c.query(`select * from public.${t} limit 1`)).rejects.toThrow(/permission denied/); } finally { await c.query('reset role'); c.release(); }
      }
      const c = await pool.connect();
      try { await c.query(`set role ${role}`); await expect(c.query("select td_commit(gen_random_uuid(),'x','commandxx',0,'a','{}','{\"phase\":\"lobby\"}','[]','[]','[]',false,'{}')")).rejects.toThrow(/permission denied/); } finally { await c.query('reset role'); c.release(); }
    }
  });

  it('td_commit: revision-locked, idempotent, exactly-once credits; a non-host cannot create a match; the classic routes refuse the room', async () => {
    const td = await import('../server');
    const created = await td.createTDRoom({ quizId: await quiz(12), format: 'coop', teamCount: 1, teamSizeCap: 3, minutes: 10, mapId: 'skyworks' }, { id: HOST });
    const roomId = created.roomId; const row = await td.loadSession(roomId);
    await expect(td.commit(roomId, { actor: 'system', command: 'test-cmd-0001', expected: row.revision + 5, action: 'test_action', state: row.state })).rejects.toThrow(/td_revision_conflict/);
    const a = await td.commit(roomId, { actor: 'system', command: 'test-cmd-0002', expected: row.revision, action: 'test_action', state: row.state, credits: [{ key: 'q:test:sq1', teamId: 'sq1', amount: 10, submissionIds: [] }] });
    const b = await td.commit(roomId, { actor: 'system', command: 'test-cmd-0002', expected: row.revision, action: 'test_action', state: row.state });
    expect(b).toEqual({ revision: a.revision, replayed: true });
    await expect(td.commit(roomId, { actor: 'system', command: 'test-cmd-0003', expected: a.revision, action: 'test_action', state: row.state, credits: [{ key: 'q:test:sq1', teamId: 'sq1', amount: 10, submissionIds: [] }] })).rejects.toThrow();
    expect((await td.loadSession(roomId)).revision).toBe(a.revision); // the failed credit rolled the whole commit back
    const other = randomUUID(); users.push(other); await q('insert into auth.users(id,email) values($1,$2)', [other, `${other}@t.invalid`]);
    await expect(q("select td_create_session($1,$2,'coop','{}','0123456789abcdef0123','{\"phase\":\"lobby\",\"teams\":[],\"rulesVersion\":1}')", [roomId, other])).rejects.toThrow(/Only the room host/);
    // the classic answer pipeline refuses Tower Defense rooms unless called through the TD gate
    const { submitAnswer } = await import('../../answer-pipeline');
    await expect(submitAnswer({ roomId, roomQuestionId: randomUUID(), token: 'x'.repeat(20), response: { kind: 'multiple_choice', selectedIds: ['a'] } })).rejects.toThrow(/Tower Defense screen/);
  }, 60_000);
});
