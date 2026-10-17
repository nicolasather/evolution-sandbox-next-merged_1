#!/usr/bin/env node
/**
 * End-to-end check of Quiz Studio through its real HTTP API (no mocks): accounts, quiz persistence & ownership,
 * every question format, solo / online (synchronized + independent) / classroom (synchronized + round robin),
 * modifiers, and the five-stage answer pipeline.
 *
 *   BASE_URL=http://localhost:3100 node scripts/quiz-e2e.mjs
 *
 * Everything it creates is tagged "E2E-TEMP" and removed at the end (only its own quizzes; rooms cascade).
 * Safe for a real deployment: it never lists or touches other people's data.
 */
const BASE = (process.env.BASE_URL ?? 'http://localhost:3100').replace(/\/$/, '');
const TAG = 'E2E-TEMP-' + Date.now().toString(36);
let pass = 0, fail = 0; const failures = [];
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; failures.push(name); console.log('  ✗', name, extra); } };
const section = (s) => console.log('\n' + s);

class Client {
  constructor(label) { this.label = label; this.jar = new Map(); }
  async req(method, path, body, headers = {}) {
    const h = { ...headers }; if (body !== undefined) h['content-type'] = 'application/json';
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); if (cookie) h.cookie = cookie;
    const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v === '') this.jar.delete(k); else this.jar.set(k, v); }
    let json = null; const text = await res.text(); try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  get = (p, h) => this.req('GET', p, undefined, h);
  post = (p, b, h) => this.req('POST', p, b ?? {}, h);
  patch = (p, b) => this.req('PATCH', p, b);
  del = (p) => this.req('DELETE', p);
}
const rnd = () => Math.random().toString(36).slice(2, 8);
const A = new Client('A'), B = new Client('B'), anon = new Client('anon');
const creds = (n) => ({ email: `${TAG.toLowerCase()}-${n}@example.com`, password: 'Correct-Horse-9' });

const questions = () => ([
  { kind: 'multiple_choice', prompt: 'MC?', basePoints: 100, payload: { options: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }, { id: 'c', text: 'Gamma' }] }, answerKey: { correctIds: ['b'] } },
  { kind: 'answer_forge', prompt: 'Forge?', basePoints: 150, payload: { placeholder: 'type', caseSensitive: false }, answerKey: { accepted: ['Secret-Forge-Answer', 'sfa'] } },
  { kind: 'connection_rush', prompt: 'Rush?', basePoints: 200, payload: { left: [{ id: 'l1', label: 'one' }, { id: 'l2', label: 'two' }, { id: 'l3', label: 'three' }], right: [{ id: 'r1', label: 'uno' }, { id: 'r2', label: 'dos' }, { id: 'r3', label: 'tres' }] }, answerKey: { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }, { leftId: 'l3', rightId: 'r3' }] } },
  { kind: 'truth_hunt', prompt: 'Truth?', basePoints: 100, payload: { statements: [{ id: 's1', text: 'Water is wet' }, { id: 's2', text: 'Fire is cold' }] }, answerKey: { truth: { s1: true, s2: false } } },
  { kind: 'fill_table', prompt: 'Table?', basePoints: 120, payload: { columns: ['Country', 'Capital'], rows: [[{ text: 'France', blank: false }, { text: 'LEAKED-PARIS', blank: true }], [{ text: 'Italy', blank: false }, { text: '', blank: true }]] }, answerKey: { cells: { '0:1': ['LEAKED-PARIS'], '1:1': ['Rome'] } } },
]);
/** Build the correct response for a question from the owner's answer key. */
const correct = (q) => {
  const k = q.answerKey;
  switch (q.kind) {
    case 'multiple_choice': return { kind: q.kind, selectedIds: k.correctIds };
    case 'answer_forge': return { kind: q.kind, text: k.accepted[0] };
    case 'connection_rush': return { kind: q.kind, pairs: k.pairs };
    case 'truth_hunt': return { kind: q.kind, truth: k.truth };
    case 'fill_table': return { kind: q.kind, cells: Object.fromEntries(Object.entries(k.cells).map(([c, v]) => [c, v[0]])) };
  }
};
const wrong = (q) => {
  switch (q.kind) {
    case 'multiple_choice': return { kind: q.kind, selectedIds: [q.payload.options.find((o) => !q.answerKey.correctIds.includes(o.id)).id] };
    case 'answer_forge': return { kind: q.kind, text: 'definitely wrong' };
    case 'connection_rush': return { kind: q.kind, pairs: [{ leftId: 'l1', rightId: 'r2' }, { leftId: 'l2', rightId: 'r1' }, { leftId: 'l3', rightId: 'r3' }] };
    case 'truth_hunt': return { kind: q.kind, truth: { s1: false, s2: true } };
    case 'fill_table': return { kind: q.kind, cells: { '0:1': 'nope', '1:1': 'nope' } };
  }
};

async function main() {
  console.log(`Quiz Studio E2E → ${BASE}  (tag ${TAG})`);

  section('1. Accounts');
  const ca = creds('a'), cb = creds('b');
  let r = await A.post('/api/quiz/auth/signup', ca);
  ok(r.status === 201, 'sign-up A', r.text);
  if (!r.json?.signedIn) { console.log('  ! email confirmation is required on this project; cannot continue automatically'); process.exit(2); }
  r = await B.post('/api/quiz/auth/signup', cb); ok(r.status === 201, 'sign-up B');
  r = await anon.post('/api/quiz/auth/signin', { email: ca.email, password: 'wrong-password-1' }); ok(r.status === 401, 'wrong password rejected', r.text);
  r = await anon.post('/api/quiz/auth/signup', { email: 'x@y.com', password: 'short' }); ok(r.status === 400, 'weak password rejected', r.text);
  r = await A.get('/api/quiz/auth/session'); ok(r.json?.user?.email === ca.email, 'session reports A');
  r = await anon.get('/api/quiz/auth/session'); ok(r.json?.user === null, 'anonymous has no session');
  r = await anon.req('POST', '/api/quiz/auth/signin', ca, { origin: 'https://evil.example' }); ok(r.status === 403, 'cross-site POST blocked (CSRF)', r.text);

  section('2. Quiz creation, drafts and persistence');
  const qs = questions();
  r = await anon.post('/api/quiz/quizzes', { title: 'x', status: 'draft', questions: [] }); ok(r.status === 401, 'anonymous cannot create a quiz');
  r = await A.post('/api/quiz/quizzes', { title: `${TAG} empty draft`, description: '', status: 'draft', questions: [] }); ok(r.status === 201, 'empty private draft saved'); const emptyId = r.json.id;
  r = await A.post('/api/quiz/quizzes', { title: `${TAG} bad`, status: 'published', questions: [] }); ok(r.status === 400, 'cannot publish an empty quiz', r.text);
  r = await A.post('/api/quiz/quizzes', { title: `${TAG} bad`, status: 'draft', questions: [{ ...qs[0], answerKey: { correctIds: ['zzz'] } }] }); ok(r.status === 400, 'invalid answer key rejected', r.text);
  r = await A.post('/api/quiz/quizzes', { title: `${TAG} mixed`, description: 'all five formats', status: 'draft', questions: qs }); ok(r.status === 201, 'mixed five-format draft saved', r.text); const quiz = r.json.id;
  r = await A.get('/api/quiz/quizzes?mine=1'); ok(r.json.quizzes.some((x) => x.id === quiz && x.status === 'draft' && x.questionCount === 5), 'draft appears under My Quizzes with 5 questions');
  r = await anon.get('/api/quiz/quizzes'); ok(!r.json.quizzes.some((x) => x.id === quiz), 'draft is NOT in the public library');
  r = await anon.get(`/api/quiz/quizzes/${quiz}`); ok(r.status === 404, 'draft is not retrievable by the public');
  r = await B.get(`/api/quiz/quizzes/${quiz}`); ok(r.status === 404, "draft is not retrievable by another user");
  r = await A.get(`/api/quiz/quizzes/${quiz}`); ok(r.status === 200 && r.json.questions.length === 5 && r.json.questions[0].answerKey, 'owner can load draft with answer keys');
  const owner = r.json.questions;
  ok(owner.map((q) => q.kind).join() === 'multiple_choice,answer_forge,connection_rush,truth_hunt,fill_table', 'question order and formats persisted');
  ok(!JSON.stringify(owner[4].payload).includes('LEAKED-PARIS'), 'blank-cell answers are stripped from the stored visible payload');

  section('3. Ownership & access control');
  r = await B.post('/api/quiz/quizzes', { id: quiz, title: 'hijacked', status: 'published', questions: qs }); ok(r.status === 404 || r.status === 403, "User B cannot overwrite User A's quiz", `${r.status} ${r.text}`);
  r = await B.patch(`/api/quiz/quizzes/${quiz}`, { status: 'published' }); ok(r.status === 404, "User B cannot publish User A's quiz");
  r = await B.del(`/api/quiz/quizzes/${quiz}`); ok(r.status === 404, "User B cannot delete User A's quiz");
  r = await A.get(`/api/quiz/quizzes/${quiz}`); ok(r.json.quiz.title === `${TAG} mixed`, "A's quiz is unchanged after B's attempts");
  r = await B.get('/api/quiz/quizzes?mine=1'); ok(!r.json.quizzes.some((x) => x.id === quiz), "B's My Quizzes does not show A's quiz");
  r = await B.get(`/quiz/edit/${quiz}`); ok(r.status === 404, "B cannot open A's editor page");
  r = await anon.get(`/quiz/edit/${quiz}`); ok(r.status === 307 || r.status === 302, 'anonymous is redirected to sign in', String(r.status));
  r = await anon.get(`/quiz/setup/${quiz}`); ok(r.status === 404, 'setup page for an unpublished quiz is hidden from the public');

  section('4. Edit, reorder, publish / unpublish');
  const edited = owner.map(({ id, ...q }) => q).reverse();
  r = await A.post('/api/quiz/quizzes', { id: quiz, title: `${TAG} mixed (edited)`, description: 'edited', status: 'draft', questions: edited }); ok(r.status === 200, 'edit saved');
  r = await A.get(`/api/quiz/quizzes/${quiz}`); ok(r.json.quiz.title.endsWith('(edited)') && r.json.questions[0].kind === 'fill_table' && r.json.questions[4].kind === 'multiple_choice', 'edit + reorder persisted');
  const ordered = r.json.questions;
  r = await A.patch(`/api/quiz/quizzes/${emptyId}`, { status: 'published' }); ok(r.status === 400, 'publishing an empty draft is refused', r.text);
  r = await A.patch(`/api/quiz/quizzes/${quiz}`, { status: 'published' }); ok(r.status === 200, 'publish');
  r = await anon.get('/api/quiz/quizzes'); ok(r.json.quizzes.some((x) => x.id === quiz), 'published quiz is in the public library');
  r = await anon.get(`/api/quiz/quizzes/${quiz}`);
  ok(r.status === 200 && r.json.questions.length === 5, 'public can read a published quiz');
  ok(!r.text.includes('answerKey') && !r.text.includes('Secret-Forge-Answer') && !r.text.includes('LEAKED-PARIS') && !r.text.includes('answer_key'), 'public quiz payload contains NO answer keys');
  const pubRush = r.json.questions.find((q) => q.kind === 'connection_rush');
  ok(pubRush.payload.right.map((x) => x.id).join() !== 'r1,r2,r3', 'Connection Rush right column is shuffled for the public');
  r = await A.patch(`/api/quiz/quizzes/${quiz}`, { status: 'draft' }); ok(r.status === 200, 'unpublish');
  r = await anon.get(`/api/quiz/quizzes/${quiz}`); ok(r.status === 404, 'unpublished quiz disappears from public again');
  await A.patch(`/api/quiz/quizzes/${quiz}`, { status: 'published' });

  const byKind = Object.fromEntries(ordered.map((q) => [q.kind, q]));
  const seq = ordered; // fill_table, truth_hunt, connection_rush, answer_forge, multiple_choice
  const total = seq.reduce((s, q) => s + q.basePoints, 0);

  section('5. Solo (guest, no account)');
  r = await anon.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'solo', flow: 'independent', durationSeconds: 600, questionSeconds: null, modifiers: ['limited_slots'] }); ok(r.status === 400, 'incompatible modifier refused (not silently dropped)', r.text);
  r = await anon.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'solo', flow: 'synchronized', durationSeconds: 600, questionSeconds: null, modifiers: [] }); ok(r.status === 400, 'solo cannot use a synchronized flow', r.text);
  r = await anon.post('/api/quiz/rooms/create', { quizId: emptyId, mode: 'solo', flow: 'independent', durationSeconds: 600, questionSeconds: null, modifiers: [] }); ok(r.status >= 400, 'cannot play a quiz with no questions', r.text);
  r = await anon.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'solo', flow: 'independent', durationSeconds: 600, questionSeconds: null, modifiers: ['secret_wager', 'potluck'] });
  ok(r.status === 201 && r.json.token, 'guest starts a solo game', r.text); const solo = r.json;
  const sh = { 'x-player-token': solo.token };
  r = await anon.get(`/api/quiz/rooms/${solo.roomId}/state`); ok(r.status === 401, 'solo state requires the player token');
  r = await anon.get(`/api/quiz/rooms/${solo.roomId}/state`, { 'x-player-token': 'wrong' }); ok(r.status === 403, 'wrong token refused');
  let st = (await anon.get(`/api/quiz/rooms/${solo.roomId}/state`, sh)).json;
  ok(st.status === 'active' && st.question.kind === 'fill_table' && st.questionCount === 5, 'solo starts on question 1');
  ok(!JSON.stringify(st).includes('answerKey') && !JSON.stringify(st).includes('Secret-Forge') && !JSON.stringify(st).includes('LEAKED'), 'solo state exposes no answer key before reveal');
  ok(st.question.payload.rows.flat().every((c) => !c.blank || c.text === ''), 'blank cells carry no text');
  const sub = (body) => anon.post(`/api/quiz/rooms/${solo.roomId}/submit`, { token: solo.token, ...body });
  // stage 1
  r = await anon.post(`/api/quiz/rooms/${solo.roomId}/submit`, { roomQuestionId: st.question.id, response: correct(seq[0]) }); ok(r.status === 403 && r.json.stage === 1, 'stage 1 rejects a missing token', r.text);
  r = await anon.post(`/api/quiz/rooms/${solo.roomId}/submit`, { token: 'forged', roomQuestionId: st.question.id, response: correct(seq[0]) }); ok(r.status === 403 && r.json.stage === 1, 'stage 1 rejects a forged token');
  // stage 2
  r = await sub({ roomQuestionId: '00000000-0000-4000-8000-000000000000', response: correct(seq[0]) }); ok(r.status === 400 && r.json.stage === 2, 'stage 2 rejects a question that is not the active one', r.text);
  r = await sub({ roomQuestionId: st.question.id, response: correct(seq[0]), wager: 5 }); ok(r.status === 400 && /wager/i.test(r.json.error), 'a wager larger than the balance is refused', r.text);
  // stage 3
  r = await sub({ roomQuestionId: st.question.id, response: { kind: 'fill_table', cells: { '0:1': 'x', '1:1': 'y', '9:9': 'z' } } }); ok(r.status === 400 && r.json.stage === 3, 'stage 3 rejects unexpected table cells', r.text);
  r = await sub({ roomQuestionId: st.question.id, response: { kind: 'multiple_choice', selectedIds: ['a'] } }); ok(r.status === 400 && r.json.stage === 3, 'stage 3 rejects the wrong response type', r.text);
  r = await sub({ roomQuestionId: st.question.id, response: { kind: 'fill_table', cells: { '0:1': 'x'.repeat(600), '1:1': 'y' } } }); ok(r.status === 400, 'stage 3 rejects an oversized answer', r.text);
  r = await sub({ roomQuestionId: st.question.id }); ok(r.status === 400 && r.json.stage === 3, 'stage 3 rejects a missing answer');
  // stage 4 + 5: forged client fields are ignored
  r = await sub({ roomQuestionId: st.question.id, response: wrong(seq[0]), correct: true, points: 99999, awarded: 99999, override: undefined });
  ok(r.status === 200 && r.json.correct === false && r.json.awarded === 0, 'stage 4 grades on the server — a client-claimed "correct: true" / points is ignored', r.text);
  r = await sub({ roomQuestionId: st.question.id, response: correct(seq[0]) }); ok(r.status === 400 && r.json.stage === 2, 'duplicate answer refused (cannot be re-answered for points)', r.text);
  st = (await anon.get(`/api/quiz/rooms/${solo.roomId}/state`, sh)).json;
  ok(st.currentIndex === 1 && st.players[0].points === 0, 'independent cursor advanced server-side, still 0 points');
  r = await sub({ roomQuestionId: st.question.id, response: correct(seq[1]), override: true }); ok(r.status === 403, 'a player cannot use the classroom override', r.text);
  let expected = 0;
  for (let i = 1; i < 5; i++) {
    st = (await anon.get(`/api/quiz/rooms/${solo.roomId}/state`, sh)).json;
    if (i === 3) { // use Potluck once, bounded
      r = await anon.post(`/api/quiz/rooms/${solo.roomId}/modifier`, { kind: 'potluck' }, sh);
      ok(r.status === 200 && r.json.change >= -200 && r.json.change <= 200, `solo Potluck is bounded (${r.json?.change})`, r.text); expected += r.json.change;
      r = await anon.post(`/api/quiz/rooms/${solo.roomId}/modifier`, { kind: 'potluck' }, sh); ok(r.status === 400, 'Potluck only once per question', r.text);
      r = await anon.post(`/api/quiz/rooms/${solo.roomId}/modifier`, { kind: 'steal_points', target: solo.roomId }, sh); ok(r.status === 400, 'opponent modifiers are unavailable in solo');
    }
    r = await sub({ roomQuestionId: st.question.id, response: correct(seq[i]) });
    ok(r.status === 200 && r.json.correct === true && r.json.awarded === seq[i].basePoints, `solo answer ${i + 1} (${seq[i].kind}) graded correct, +${seq[i].basePoints}`, r.text); expected += seq[i].basePoints;
  }
  st = (await anon.get(`/api/quiz/rooms/${solo.roomId}/state`, sh)).json;
  ok(st.status === 'ended' && st.players[0].points === expected && Array.isArray(st.review), `solo finished automatically; points = ${expected} (server-computed)`, JSON.stringify(st.players));
  ok(st.review.every((x) => x.answerKey), 'answer review is only available after the game ends');
  r = await sub({ roomQuestionId: st.review[0].id, response: correct(seq[0]) }); ok(r.status >= 400, 'no answers accepted after the game ended');

  section('6. Online multiplayer — synchronized, Limited Slots + Secret Wager');
  r = await anon.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'online', flow: 'synchronized', durationSeconds: 600, questionSeconds: null, modifiers: [] }); ok(r.status === 401, 'hosting requires an account');
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'online', flow: 'round_robin', durationSeconds: 600, questionSeconds: null, modifiers: [] }); ok(r.status === 400, 'online has no round-robin flow', r.text);
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'online', flow: 'synchronized', durationSeconds: 600, questionSeconds: null, modifiers: ['limited_slots', 'secret_wager', 'steal_points', 'swap_points', 'give_points', 'lose_all', 'go_to_first', 'potluck'], slotLimit: 2 });
  ok(r.status === 201, 'host creates an online synchronized room', r.text); const on = r.json;
  const players = [];
  for (let i = 0; i < 4; i++) { const c = new Client('p' + i); const j = await c.post('/api/quiz/rooms/join', { joinCode: on.code, displayName: 'Player' + i }); ok(j.status === 201, `player ${i + 1} joins with the code`, j.text); players.push({ c, ...j.json }); }
  r = await new Client('dup').post('/api/quiz/rooms/join', { joinCode: on.code, displayName: 'player0' }); ok(r.status === 400, 'duplicate display name refused', r.text);
  r = await new Client('bad').post('/api/quiz/rooms/join', { joinCode: 'ZZZZZZ', displayName: 'x' }); ok(r.status === 400 || r.status === 404, 'unknown code refused');
  r = await anon.get(`/api/quiz/rooms/${on.roomId}/state`); ok(r.status === 401, 'unauthenticated cannot read a room');
  r = await B.get(`/api/quiz/rooms/${on.roomId}/state`); ok(r.status === 403, 'another account cannot read the host view');
  r = await anon.get(`/api/quiz/rooms/${on.roomId}/state`, { 'x-player-token': solo.token }); ok(r.status === 403, "a token from another room doesn't work here");
  r = await players[0].c.get(`/api/quiz/rooms/${on.roomId}/state`, { 'x-player-token': players[0].token }); ok(r.json.status === 'waiting' && r.json.question === null, 'players see no question before the host starts');
  r = await B.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'start' }); ok(r.status === 403, 'a non-host cannot start the room');
  r = await anon.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'start' }); ok(r.status === 401, 'an anonymous caller cannot start the room');
  r = await players[0].c.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'start' }, { 'x-player-token': players[0].token }); ok(r.status === 401, 'a player cannot start the room');
  r = await A.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'start' }); ok(r.status === 200, 'host starts');
  let ps = (await players[0].c.get(`/api/quiz/rooms/${on.roomId}/state`, { 'x-player-token': players[0].token })).json;
  ok(ps.question.kind === 'fill_table' && !JSON.stringify(ps).includes('answerKey'), 'players get the same first question, with no key');
  r = await Promise.all(players.map((p) => p.c.post(`/api/quiz/rooms/${on.roomId}/submit`, { roomQuestionId: ps.question.id, token: p.token, response: correct(seq[0]) })));
  ok(r.filter((x) => x.status === 200).length === 2 && r.filter((x) => x.status === 400 && /slots/i.test(x.json?.error)).length === 2, 'Limited Slots: exactly 2 of 4 simultaneous answers accepted', r.map((x) => `${x.status}:${x.json?.error ?? x.json?.awarded}`).join(' | '));
  let hs = (await A.get(`/api/quiz/rooms/${on.roomId}/state`)).json;
  ok(hs.players.filter((p) => p.points === seq[0].basePoints).length === 2 && hs.players.reduce((s, p) => s + p.points, 0) === 2 * seq[0].basePoints, 'scoreboard: exactly two players scored, once each');
  r = await A.get(`/api/quiz/rooms/${on.roomId}/state?peek=1`); ok(r.json.question.answerKey, 'host can peek at the key');
  r = await players[0].c.get(`/api/quiz/rooms/${on.roomId}/state?peek=1`, { 'x-player-token': players[0].token }); ok(!JSON.stringify(r.json).includes('answerKey'), 'a player cannot peek');
  r = await A.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'reveal' }); ok(r.status === 200, 'host reveals');
  ps = (await players[3].c.get(`/api/quiz/rooms/${on.roomId}/state`, { 'x-player-token': players[3].token })).json;
  ok(ps.revealed && ps.question.answerKey, 'after reveal players can see the answer key');
  r = await players[3].c.post(`/api/quiz/rooms/${on.roomId}/submit`, { roomQuestionId: ps.question.id, token: players[3].token, response: correct(seq[0]) }); ok(r.status >= 400, 'no answers after reveal', r.text);
  // modifiers by the host
  const pid = hs.players.map((p) => p.id);
  const scorer = hs.players.filter((p) => p.points > 0), loser = hs.players.filter((p) => p.points === 0);
  r = await A.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'steal_points', target: loser[0].id, other: scorer[0].id, amount: 50 }); ok(r.status === 200 && r.json.change === 50, 'host: Steal Points moves 50 points', r.text);
  r = await A.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'swap_points', target: loser[1].id, other: scorer[1].id }); ok(r.status === 200, 'host: Swap Points', r.text);
  r = await A.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'lose_all', target: scorer[0].id }); ok(r.status === 200, 'host: Lose All Points');
  r = await A.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'go_to_first', target: scorer[0].id }); ok(r.status === 200, 'host: Go to First');
  r = await players[0].c.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'lose_all', target: pid[1] }, { 'x-player-token': players[0].token }); ok(r.status === 401, 'a player cannot trigger host modifiers');
  r = await B.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'lose_all', target: pid[1] }); ok(r.status === 403, 'another account cannot trigger them either');
  hs = (await A.get(`/api/quiz/rooms/${on.roomId}/state`)).json;
  ok(hs.players.every((p) => p.points >= 0), 'no balance is ever negative');
  r = await A.post(`/api/quiz/rooms/${on.roomId}/modifier`, { kind: 'undo' }); ok(r.status === 200 || r.status === 400, 'undo responds sensibly', r.text);
  // wager
  r = await A.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'next' }); ok(r.status === 200, 'host advances');
  ps = (await players[0].c.get(`/api/quiz/rooms/${on.roomId}/state`, { 'x-player-token': players[0].token })).json;
  const rich = hs.players.sort((a, b) => b.points - a.points)[0]; const richP = players.find((p) => p.playerId === rich.id);
  r = await richP.c.post(`/api/quiz/rooms/${on.roomId}/submit`, { roomQuestionId: ps.question.id, token: richP.token, response: wrong(seq[1]), wager: rich.points + 1 }); ok(r.status === 400 && r.json.stage === 5, 'a wager above the balance is refused (stage 5)', r.text);
  const before = (await A.get(`/api/quiz/rooms/${on.roomId}/state`)).json.players.find((p) => p.id === rich.id).points;
  r = await richP.c.post(`/api/quiz/rooms/${on.roomId}/submit`, { roomQuestionId: ps.question.id, token: richP.token, response: wrong(seq[1]), wager: Math.min(40, before) }); ok(r.status === 200 && r.json.awarded === -Math.min(40, before), 'a lost wager costs exactly the wager', r.text);
  r = await A.post(`/api/quiz/rooms/${on.roomId}/control`, { action: 'end' }); ok(r.status === 200, 'host ends the game');
  r = await new Client('late').post('/api/quiz/rooms/join', { joinCode: on.code, displayName: 'late' }); ok(r.status === 400, 'cannot join an ended room');

  section('7. Online multiplayer — independent progression');
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'online', flow: 'independent', durationSeconds: 600, questionSeconds: null, modifiers: [] }); const ind = r.json;
  const ip = []; for (let i = 0; i < 2; i++) { const c = new Client('i' + i); const j = await c.post('/api/quiz/rooms/join', { joinCode: ind.code, displayName: 'Ind' + i }); ip.push({ c, ...j.json }); }
  await A.post(`/api/quiz/rooms/${ind.roomId}/control`, { action: 'start' });
  for (let i = 0; i < 3; i++) { const s = (await ip[0].c.get(`/api/quiz/rooms/${ind.roomId}/state`, { 'x-player-token': ip[0].token })).json; await ip[0].c.post(`/api/quiz/rooms/${ind.roomId}/submit`, { roomQuestionId: s.question.id, token: ip[0].token, response: correct(seq[i]) }); }
  const s0 = (await ip[0].c.get(`/api/quiz/rooms/${ind.roomId}/state`, { 'x-player-token': ip[0].token })).json, s1 = (await ip[1].c.get(`/api/quiz/rooms/${ind.roomId}/state`, { 'x-player-token': ip[1].token })).json;
  ok(s0.currentIndex === 3 && s1.currentIndex === 0, 'two players are on different questions at the same time');
  r = await A.post(`/api/quiz/rooms/${ind.roomId}/control`, { action: 'next' }); ok(r.status === 400, 'host cannot advance an independent room (players do)');
  r = await A.post(`/api/quiz/rooms/${ind.roomId}/control`, { action: 'pause' }); ok(r.status === 200, 'host can pause the match');
  r = await ip[1].c.post(`/api/quiz/rooms/${ind.roomId}/submit`, { roomQuestionId: s1.question.id, token: ip[1].token, response: correct(seq[0]) }); ok(r.status === 400 && r.json.stage === 2, 'stage 2: no answers while paused', r.text);
  await A.post(`/api/quiz/rooms/${ind.roomId}/control`, { action: 'resume' });
  r = await ip[1].c.post(`/api/quiz/rooms/${ind.roomId}/submit`, { roomQuestionId: s0.question.id, token: ip[1].token, response: correct(seq[3]) }); ok(r.status === 400 && r.json.stage === 2, "stage 2: a player cannot answer another player's question", r.text);
  await A.post(`/api/quiz/rooms/${ind.roomId}/control`, { action: 'end' });

  section('8. Classroom projector — synchronized');
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'classroom', flow: 'synchronized', durationSeconds: 900, questionSeconds: null, modifiers: ['secret_wager', 'limited_slots'], slotLimit: 2, teamNames: ['Red'] }); ok(r.status === 400, 'classroom needs at least 2 teams', r.text);
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'classroom', flow: 'synchronized', durationSeconds: 900, questionSeconds: null, modifiers: [], teamNames: ['Red', 'red'] }); ok(r.status === 400, 'team names must differ');
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'classroom', flow: 'independent', durationSeconds: 900, questionSeconds: null, modifiers: [], teamNames: ['A', 'B'] }); ok(r.status === 400, 'classroom has no free-progress flow', r.text);
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'classroom', flow: 'synchronized', durationSeconds: 900, questionSeconds: null, modifiers: ['limited_slots', 'potluck'], slotLimit: 2, teamNames: ['Red', 'Blue', 'Green'] });
  ok(r.status === 201, 'teacher creates a 3-team classroom game', r.text); const cl = r.json;
  hs = (await A.get(`/api/quiz/rooms/${cl.roomId}/state`)).json; const [red, blue, green] = hs.teams;
  await A.post(`/api/quiz/rooms/${cl.roomId}/control`, { action: 'start' });
  hs = (await A.get(`/api/quiz/rooms/${cl.roomId}/state`)).json;
  const csub = (team, body) => A.post(`/api/quiz/rooms/${cl.roomId}/submit`, { roomQuestionId: hs.question.id, actorId: team.id, ...body });
  r = await B.post(`/api/quiz/rooms/${cl.roomId}/submit`, { roomQuestionId: hs.question.id, actorId: red.id, override: true }); ok(r.status === 403 && r.json.stage === 1, "stage 1: another teacher cannot score this room", r.text);
  r = await anon.post(`/api/quiz/rooms/${cl.roomId}/submit`, { roomQuestionId: hs.question.id, actorId: red.id, override: true }); ok(r.status === 401 && r.json.stage === 1, 'stage 1: anonymous cannot score', r.text);
  r = await csub(red, { override: true }); ok(r.status === 200 && r.json.awarded === seq[0].basePoints, 'teacher marks the spoken answer correct (oral)', r.text);
  r = await csub(red, { override: true }); ok(r.status === 409 && r.json.stage === 2, 'a team cannot be scored twice for one question', r.text);
  r = await csub(blue, { response: wrong(seq[0]) }); ok(r.status === 200 && r.json.correct === false, 'typed answer auto-checked as wrong');
  r = await csub(green, { response: correct(seq[0]) }); ok(r.status === 400 && /slots/i.test(r.json.error), 'Limited Slots closes the question after 2 answers', r.text);
  ok(JSON.stringify((await A.get(`/api/quiz/rooms/${cl.roomId}/state`)).json).includes('answerKey') === false, 'projector state has no answer key before reveal');
  r = await A.post(`/api/quiz/rooms/${cl.roomId}/control`, { action: 'pause' }); r = await csub(green, { override: true }); ok(r.status === 400 && r.json.stage === 2, 'stage 2: paused room refuses scoring', r.text);
  await A.post(`/api/quiz/rooms/${cl.roomId}/control`, { action: 'resume' });
  r = await A.post(`/api/quiz/rooms/${cl.roomId}/modifier`, { kind: 'potluck', target: blue.id }); ok(r.status === 200 && r.json.change >= 0 && r.json.change <= 200, 'Potluck on a team with 0 points can only gain (floored at zero)', r.text);
  r = await A.post(`/api/quiz/rooms/${cl.roomId}/modifier`, { kind: 'undo' }); ok(r.status === 200, 'teacher undoes the latest score change', r.text);
  for (let i = 0; i < 5; i++) await A.post(`/api/quiz/rooms/${cl.roomId}/control`, { action: 'next' });
  hs = (await A.get(`/api/quiz/rooms/${cl.roomId}/state`)).json; ok(hs.status === 'ended' && hs.review?.length === 5, 'teacher finishes the game; review available'); 

  section('9. Classroom projector — round robin + Steal the Question');
  r = await A.post('/api/quiz/rooms/create', { quizId: quiz, mode: 'classroom', flow: 'round_robin', durationSeconds: 900, questionSeconds: null, modifiers: ['steal_question', 'swap_points'], teamNames: ['Red', 'Blue', 'Green'] });
  ok(r.status === 201, 'round-robin classroom created', r.text); const rr = r.json;
  hs = (await A.get(`/api/quiz/rooms/${rr.roomId}/state`)).json; const [t0, t1, t2] = hs.teams;
  await A.post(`/api/quiz/rooms/${rr.roomId}/control`, { action: 'start' });
  hs = (await A.get(`/api/quiz/rooms/${rr.roomId}/state`)).json;
  const rsub = (team, body) => A.post(`/api/quiz/rooms/${rr.roomId}/submit`, { roomQuestionId: hs.question.id, actorId: team.id, ...body });
  r = await rsub(t1, { override: true }); ok(r.status === 400 && r.json.stage === 2 && /turn/i.test(r.json.error), 'stage 2: only the team whose turn it is may answer', r.text);
  r = await A.post(`/api/quiz/rooms/${rr.roomId}/modifier`, { kind: 'steal_question', target: t1.id }); ok(r.status === 400, 'cannot steal before anyone has answered wrongly', r.text);
  r = await rsub(t0, { override: false }); ok(r.status === 200 && r.json.correct === false, 'first team answers wrongly');
  r = await A.post(`/api/quiz/rooms/${rr.roomId}/modifier`, { kind: 'steal_question', target: t1.id }); ok(r.status === 200, 'teacher hands the question to Blue', r.text);
  r = await rsub(t2, { override: true }); ok(r.status === 400, 'a third team still cannot answer', r.text);
  r = await rsub(t1, { override: true }); ok(r.status === 200 && r.json.awarded === seq[0].basePoints, 'Blue steals the question and scores', r.text);
  r = await A.post(`/api/quiz/rooms/${rr.roomId}/control`, { action: 'next' }); hs = (await A.get(`/api/quiz/rooms/${rr.roomId}/state`)).json;
  ok(hs.turnIndex === 1 && hs.currentIndex === 1, 'next question rotates the turn to the next team');
  r = await rsub(t0, { override: true }); ok(r.status === 400 && /turn/i.test(r.json.error), 'previous team is blocked from the new question');
  r = await rsub(t1, { response: correct(seq[1]) }); ok(r.status === 200 && r.json.correct === true, 'typed answer from the current team auto-graded');
  r = await A.post(`/api/quiz/rooms/${rr.roomId}/modifier`, { kind: 'swap_points', target: t0.id, other: t1.id }); ok(r.status === 200, 'teacher swaps two teams’ points', r.text);
  hs = (await A.get(`/api/quiz/rooms/${rr.roomId}/state`)).json; ok(hs.teams[0].points === seq[0].basePoints + seq[1].basePoints && hs.teams[1].points === 0, 'swap exchanged the totals exactly');

  section('10. Abuse limits');
  const spam = new Client('spam'); let limited = false;
  for (let i = 0; i < 400 && !limited; i++) { const x = await spam.post('/api/quiz/rooms/join', { joinCode: 'QQQQQQ', displayName: 'x' }); if (x.status === 429) limited = true; }
  ok(limited, 'repeated join attempts are rate-limited (429)');
  r = await anon.get('/api/quiz/cron/cleanup'); ok(r.status === 404 || r.status === 401, 'cleanup endpoint is not public');

  section('11. Persistence across sign-out / sign-in and redeploy');
  r = await A.post('/api/quiz/auth/signout'); ok(r.status === 200, 'A signs out');
  r = await A.get('/api/quiz/quizzes?mine=1'); ok(r.status === 401, 'signed-out user sees no private list');
  r = await A.post('/api/quiz/auth/signin', ca); ok(r.status === 200, 'A signs back in');
  r = await A.get('/api/quiz/quizzes?mine=1'); ok(r.json.quizzes.some((x) => x.id === quiz && x.status === 'published'), 'the quiz is still there after sign-out/sign-in');
  r = await A.get(`/api/quiz/quizzes/${quiz}`); ok(r.json.questions.length === 5 && r.json.quiz.title.endsWith('(edited)'), 'with its edits and all five questions');

  section('12. Clean-up of temporary data');
  r = await A.del(`/api/quiz/quizzes/${quiz}`); ok(r.status === 200, 'temporary quiz deleted (its test rooms cascade)');
  r = await A.del(`/api/quiz/quizzes/${emptyId}`); ok(r.status === 200, 'temporary empty draft deleted');
  r = await A.get('/api/quiz/quizzes?mine=1'); ok(!r.json.quizzes.some((x) => x.title.includes(TAG)), 'no E2E data remains');
  r = await anon.get(`/api/quiz/rooms/${on.roomId}/state`, {}); ok(r.status === 404, 'its rooms are gone from the API too');

  console.log(`\n${fail === 0 ? 'ALL PASSED' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
  if (fail) { console.log(failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
}
main().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });
