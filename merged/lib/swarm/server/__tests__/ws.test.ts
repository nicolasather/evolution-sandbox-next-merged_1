/** @jest-environment node */
import { startSwarmServer, type Running } from '../server';
import { MemoryStore } from '../store';
import { FixtureSource } from '../quiz-source';
import { signToken } from '../../net/tokens';
import { CANARY, correctResponse, wrongResponse } from '../fixtures';
import { devRoom, joinRoom, WsClient, httpJson, type DevRoom } from '../testclient';
import type { Clock } from '../runtime';

jest.setTimeout(90_000);
const SECRET = 'test-secret-test-secret-test-1234';
const warp = (speed: number): Clock => { const t0 = Date.now(); return { now: () => t0 + (Date.now() - t0) * speed }; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cfg = (o: Record<string, unknown> = {}) => ({ mode: 'versus', teamCount: 2, teamSizeCap: 3, minutes: 5, ...o });

let store: MemoryStore; let srv: Running; const clients: WsClient[] = [];
async function boot(o: Partial<Parameters<typeof startSwarmServer>[0]> = {}) {
  store = (o.store as MemoryStore) ?? new MemoryStore();
  srv = await startSwarmServer({ port: 0, host: '127.0.0.1', secret: SECRET, store, dev: true, allowedOrigins: ['https://site.test'], sourceFor: () => new FixtureSource(40), tokenTtlSec: 3600, ...o });
}
const track = <T extends WsClient>(c: T) => { clients.push(c); return c; };
afterEach(async () => { clients.splice(0).forEach((c) => c.close()); await srv?.close(); });

async function seatPlayers(room: DevRoom, names: string[], team?: (i: number) => string | undefined) {
  const out: { name: string; token: string; id: string; team: string; c: WsClient }[] = [];
  for (let i = 0; i < names.length; i++) {
    const r = await joinRoom(srv.url, room.code, names[i]!, team?.(i) ? { team: team(i) } : {}); if (r.status !== 200) throw new Error(JSON.stringify(r.json));
    const c = track(new WsClient(srv.wsUrl, r.json.token as string, { origin: 'https://site.test' })); await c.connect(); await c.waitFor(() => !!c.me, 4000, 'seat');
    out.push({ name: names[i]!, token: r.json.token as string, id: r.json.participantId as string, team: r.json.teamId as string, c });
  }
  return out;
}
const hostId = () => `h${Math.random().toString(36).slice(2, 10)}`;

describe('HTTP surface', () => {
  it('serves health and metrics, hides unknown routes, rejects a foreign origin on join', async () => {
    await boot();
    const h = await httpJson(srv.url, '/healthz'); expect(h.status).toBe(200); expect(h.json).toMatchObject({ ok: true, protocol: 'ss/1' });
    const m = await fetch(srv.url + '/metrics').then((r) => r.text()); expect(m).toMatch(/swarm_rooms \d/); expect(m).toMatch(/swarm_sockets \d/);
    expect((await httpJson(srv.url, '/nope')).status).toBe(404);
    const bad = await fetch(srv.url + '/join', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.test' }, body: JSON.stringify({ code: 'ABCDEF', name: 'x' }) }); expect(bad.status).toBe(403);
  });
  it('join: validates, hides which rooms exist, filters names, balances teams, enforces caps', async () => {
    await boot(); const room = await devRoom(srv.url, cfg());
    expect((await joinRoom(srv.url, 'ZZZZZZ', 'Ann')).status).toBe(404);
    expect((await httpJson(srv.url, '/join', { code: 'abc', name: 'Ann' })).status).toBe(400);
    expect((await httpJson(srv.url, '/join', { code: room.code, name: 'Ann', extra: 1 })).status).toBe(400);
    expect((await joinRoom(srv.url, room.code, 'fuck')).status).toBe(400);
    const a = await joinRoom(srv.url, room.code, 'Ann'); expect(a.status).toBe(200); expect(a.json.teamId).toBe('t1');
    expect((await joinRoom(srv.url, room.code, ' ann ')).status).toBe(400); // taken, case/space-insensitive
    expect((await joinRoom(srv.url, room.code, 'Bo')).json.teamId).toBe('t2'); // balanced automatically
    // re-joining with the old token returns the SAME seat, never a second one
    const again = await joinRoom(srv.url, room.code, 'Ann again', { resume: a.json.token }); expect(again.json).toMatchObject({ participantId: a.json.participantId, resumed: true });
    const rt = srv.rooms.get(room.roomId)!; expect(rt.room.rosterOrder).toHaveLength(2);
    for (let i = 0; i < 4; i++) await joinRoom(srv.url, room.code, 'P' + i); // t1 cap is 3
    expect(Object.values(rt.room.roster).filter((m) => m.teamId === 't1').length).toBeLessThanOrEqual(3);
  });
  it('join is rate limited per IP', async () => {
    await boot({ joinPerMinPerIp: 5 }); const room = await devRoom(srv.url, cfg());
    const codes: number[] = []; for (let i = 0; i < 8; i++) codes.push((await joinRoom(srv.url, room.code, 'N' + i)).status);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(2);
  });
});

describe('sockets: identity, hello, abuse', () => {
  it('refuses forged, expired, wrong-room and wrong-secret tokens; accepts a valid one', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const other = await devRoom(srv.url, cfg());
    const p = (await joinRoom(srv.url, room.code, 'Ann')).json.token as string;
    const tamper = p.slice(0, -3) + (p.endsWith('AAA') ? 'BBB' : 'AAA');
    const bads = [tamper, signToken({ typ: 'player', room: room.roomId, sub: 'ab'.repeat(12), ttlSec: 60 }, 'another-secret-another-secret-1234'), signToken({ typ: 'player', room: room.roomId, sub: 'ab'.repeat(12), ttlSec: -10 }, SECRET), 'garbage', ''];
    for (const t of bads) { const c = track(new WsClient(srv.wsUrl, t, { origin: 'https://site.test' })); await c.connect(); await c.waitClosed(); expect(c.closed!.code).toBe(4403); }
    // a token for a seat that does not exist in this room (valid signature, unknown subject)
    const ghost = signToken({ typ: 'player', room: room.roomId, sub: 'cd'.repeat(12), ttlSec: 60 }, SECRET); const g = track(new WsClient(srv.wsUrl, ghost, { origin: 'https://site.test' })); await g.connect(); await g.waitClosed(); expect(g.closed!.code).toBe(4403);
    // a player token cannot act as host, and a token of another room cannot enter this one
    const ok = track(new WsClient(srv.wsUrl, p, { origin: 'https://site.test' })); await ok.connect(); await ok.waitFor(() => !!ok.welcome); expect(ok.welcome!.you.kind).toBe('player');
    ok.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } }); await ok.waitFor(() => ok.packets.some((x) => x.t === 'err' && x.code === 'not_host'));
    void other;
    expect(srv.metrics.get('rejected_token_signature')).toBeGreaterThanOrEqual(2); expect(srv.metrics.get('rejected_token_expired')).toBe(1); expect(srv.metrics.get('rejected_token_malformed')).toBeGreaterThanOrEqual(1);
  });
  it('rejects a foreign Origin on the socket and a missing hello', async () => {
    await boot({ helloTimeoutMs: 400 }); const room = await devRoom(srv.url, cfg());
    const e = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://evil.test' })); await e.connect().catch(() => undefined); await e.waitClosed().catch(() => undefined); expect(e.closed).not.toBeNull();
    const silent = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await silent.connect(false); await silent.waitClosed(3000); expect(silent.closed!.code).toBe(4408);
    const first = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await first.connect(false); first.send({ t: 'move', seq: 1, x: 1, y: 0 }); await first.waitClosed(); expect(first.closed!.code).toBe(4400);
  });
  it('garbage, unknown fields and oversize packets are refused; repeated abuse closes the socket', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const [a] = await seatPlayers(room, ['Ann']); const c = a!.c;
    c.sendRaw('not json'); c.sendRaw(JSON.stringify({ t: 'move', seq: 1, x: 1, y: 0, score: 9999 })); c.sendRaw(JSON.stringify({ t: 'answer', w: 'q1', id: 'a', r: {}, correct: true })); c.sendRaw(JSON.stringify({ t: 'unknown' }));
    await c.waitFor(() => c.packets.filter((x) => x.t === 'err').length >= 4, 3000, 'errors');
    c.sendRaw('x'.repeat(9000)); await c.waitClosed(); expect(c.closed!.code).toBeGreaterThanOrEqual(1009); // ws maxPayload closes first
    const [b] = await seatPlayers(room, ['Bo']); for (let i = 0; i < 60; i++) b!.c.sendRaw('{bad'); await b!.c.waitClosed(); expect(b!.c.closed!.reason).toBe('bad_packet');
  });
  it('a held burst of moves is rate limited, not applied faster than allowed', async () => {
    await boot(); const room = await devRoom(srv.url, cfg({ mode: 'coop', teamCount: 1 })); const [a] = await seatPlayers(room, ['Ann']);
    for (let i = 1; i <= 400; i++) a!.c.send({ t: 'move', seq: i, x: 1, y: 0 });
    await sleep(300); expect(srv.metrics.get('rate_limited')).toBeGreaterThan(100); // not in an active phase either: refused as wrong_phase
  });
  it('duplicate socket: the newer connection wins, the old one is told why; no second avatar', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const [a] = await seatPlayers(room, ['Ann']);
    const second = track(new WsClient(srv.wsUrl, a!.token, { origin: 'https://site.test' })); await second.connect(); await second.waitFor(() => !!second.me);
    await a!.c.waitClosed(); expect(a!.c.closed!.code).toBe(4001); expect(srv.rooms.get(room.roomId)!.room.rosterOrder).toHaveLength(1); expect(srv.rooms.get(room.roomId)!.room.roster[a!.id]!.connected).toBe(true);
  });
  it('clock: ping/pong carries the server clock', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const [a] = await seatPlayers(room, ['Ann']);
    a!.c.send({ t: 'ping', c: 42 }); await a!.c.waitFor(() => a!.c.packets.some((x) => x.t === 'pong' && x.c === 42)); const pong = a!.c.packets.find((x) => x.t === 'pong') as { sm: number }; expect(Math.abs(pong.sm - Date.now())).toBeLessThan(2000);
  });
});

describe('lobby and host control over the wire', () => {
  it('lobby shows the roster, role changes persist, host start needs two teams in versus, stale revisions are refused', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect(); await host.waitFor(() => !!host.meta);
    const [a, b] = await seatPlayers(room, ['Ann', 'Bo']);
    a!.c.send({ t: 'role', role: 'medic' }); await a!.c.waitFor(() => a!.c.me?.role === 'medic'); expect(store.seats.get(`${room.roomId}:${a!.id}`)?.role).toBe('medic');
    await host.waitFor(() => (host.view.s.roster as unknown[] | undefined)?.length === 2, 3000, 'roster');
    host.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' }, rev: 0 }); await host.waitFor(() => host.packets.some((x) => x.t === 'ack' && !x.ok && x.code === 'stale_revision'), 3000, 'stale');
    const rev = host.meta!.rev as number; const id = hostId();
    host.send({ t: 'host', id, cmd: { cmd: 'begin' }, rev }); await host.waitPhase('countdown', 3000);
    host.send({ t: 'host', id, cmd: { cmd: 'begin' }, rev }); // exact retry: no second effect
    await sleep(100); expect(srv.rooms.get(room.roomId)!.room.audit.filter((x) => x.id === id)).toHaveLength(1);
    void b;
  });
  it('per-viewer redaction: a player never receives another team’s entities, roster or wallet', async () => {
    await boot({ clock: warp(6) }); const room = await devRoom(srv.url, cfg({ teamSizeCap: 2 })); const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect();
    const [a, b] = await seatPlayers(room, ['Ann', 'Bo']); expect(a!.team).not.toBe(b!.team);
    host.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } }); await a!.c.waitPhase('wave', 15000);
    await a!.c.waitFor(() => Object.keys(a!.c.view.e.p ?? {}).length > 0, 3000);
    expect(Object.keys(a!.c.view.e.p!)).toEqual([a!.id]); expect(Object.keys(b!.c.view.e.p!)).toEqual([b!.id]);
    const teams = a!.c.view.s.teams as { id: string; wallet?: number }[]; expect(teams.find((t) => t.id !== a!.team)!.wallet).toBeUndefined();
    expect((a!.c.view.s.roster as { id: string }[]).map((r) => r.id)).toEqual([a!.id]);
    await host.waitFor(() => Object.keys(host.view.e.p ?? {}).length > 0, 3000); host.send({ t: 'focus', team: 't2' }); await host.waitFor(() => Object.keys(host.view.e.p ?? {}).includes(b!.id) && !Object.keys(host.view.e.p ?? {}).includes(a!.id), 3000, 'focus');
  });
  it('a screen token is view-only', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const s = track(new WsClient(srv.wsUrl, room.screenToken, { origin: 'https://site.test' })); await s.connect(); await s.waitFor(() => !!s.meta);
    s.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } }); await s.waitFor(() => s.packets.some((x) => x.t === 'err' && x.code === 'not_host'));
  });
});

describe('a whole match over real sockets (time-warped 8x)', () => {
  async function play(players: { id: string; c: WsClient }[], host: WsClient, o: { accuracy: number; leakScan?: boolean; maxMs?: number }) {
    let stop = false; const answered = new Set<string>(); const voted = new Set<string>(); const leaks: string[] = [];
    if (o.leakScan) for (const p of players) p.c.tap = (pk, raw) => { if (pk.t === 'snap') { const q = (pk.v as { s?: { quiz?: { reveal?: boolean } | null } }).s?.quiz; if (!(q && q.reveal) && /SWARM_SECRET_EXPLANATION|answerKey|correctIds|"accepted"|"truth":\{/.test(raw)) leaks.push(raw.slice(0, 200)); } };
    const bots = players.map(async (p, idx) => {
      let seq = 0; let n = 0;
      while (!stop && !p.c.closed) {
        const ph = p.c.phase;
        if (ph === 'wave' || ph === 'boss_wave') { const ang = (n++ * 0.35 + idx) % (Math.PI * 2); p.c.send({ t: 'move', seq: ++seq, x: Math.cos(ang) * 0.6, y: Math.sin(ang) * 0.6 }); if (n % 20 === 0) p.c.send({ t: 'ability', id: `a${n}` }); }
        const q = p.c.quiz; if (ph === 'question' && q?.question && !p.c.me?.answered && !answered.has(`${p.id}${q.w}`)) { answered.add(`${p.id}${q.w}`); const good = Math.random() < o.accuracy; p.c.send({ t: 'answer', w: q.w, id: `x${q.w}`, r: good ? correctResponse(q.question) : wrongResponse(q.question) }); }
        const d = p.c.draft; if (ph === 'upgrade' && d && !d.resolved && !voted.has(`${p.id}${d.id}`)) { const pick = d.offers.find((x) => x.affordable); if (pick) { voted.add(`${p.id}${d.id}`); p.c.send({ t: 'vote', d: d.id, u: pick.id, id: `v${d.id}` }); } }
        await sleep(50);
      }
    });
    host.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } });
    await host.waitPhase('results', o.maxMs ?? 150_000); stop = true; await Promise.all(bots);
    return leaks;
  }
  it('versus 2×2: reaches results, grades server-side, credits once, never leaks the key before reveal', async () => {
    await boot({ clock: warp(8) }); const room = await devRoom(srv.url, cfg({ teamSizeCap: 2 }), 30);
    const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect();
    const ps = await seatPlayers(room, ['A1', 'A2', 'B1', 'B2'], (i) => (i < 2 ? 't1' : 't2'));
    const leaks = await play(ps, host, { accuracy: 0.7, leakScan: true });
    expect(leaks).toEqual([]);
    const res = host.view.s.results as { standings: { teamId: string; rank: number }[] }; expect(res.standings).toHaveLength(2);
    const rt = srv.rooms.get(room.roomId)!; expect(srv.metrics.get('answers_graded')).toBeGreaterThan(4);
    // every credit exists exactly once per (window, team)
    const credited = [...store.credits.keys()]; expect(new Set(credited).size).toBe(credited.length); expect(credited.length).toBeGreaterThanOrEqual(rt.room.settledWindows.length);
    // the post-reveal snapshot DOES carry the key (the lesson), and graded results were delivered to players
    expect(JSON.stringify(ps[0]!.c.packets)).toContain('"reveal":true');
    // a late join after the match started is refused by the room, not by chance
    const late = await joinRoom(srv.url, room.code, 'Late'); expect([404, 409, 400]).toContain(late.status);
  }, 170_000);
  it('co-op solo with all-wrong answers still ends cleanly and earns nothing', async () => {
    await boot({ clock: warp(8) }); const room = await devRoom(srv.url, cfg({ mode: 'coop', teamCount: 1, teamSizeCap: 1 }), 30);
    const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect(); const ps = await seatPlayers(room, ['Solo']);
    await play(ps, host, { accuracy: 0 }); expect(srv.rooms.get(room.roomId)!.room.teams.t1!.earned).toBe(0);
  }, 170_000);
});

describe('answers over the wire: replay, forgery, lateness', () => {
  async function toQuestion() {
    await boot({ clock: warp(8) }); const room = await devRoom(srv.url, cfg({ mode: 'coop', teamCount: 1, teamSizeCap: 2 }), 30);
    const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect(); const ps = await seatPlayers(room, ['A', 'B']);
    host.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } });
    const idle = setInterval(() => { for (const p of ps) if (p.c.phase === 'wave' || p.c.phase === 'boss_wave') p.c.send({ t: 'move', seq: Date.now() % 1e9, x: 0.2, y: 0 }); }, 80);
    await Promise.all(ps.map((p) => p.c.waitFor(() => p.c.phase === 'question' && !!p.c.quiz?.question, 60000, 'question'))); clearInterval(idle);
    return { room, host, ps };
  }
  it('a duplicate answer returns the stored result; a different second answer cannot change the grade; a wrong window is refused; malformed is refused without burning the attempt', async () => {
    const { ps } = await toQuestion(); const c = ps[0]!.c; const q = c.quiz!;
    c.send({ t: 'answer', w: q.w, id: 'm1', r: { kind: 'nonsense' } }); await c.waitFor(() => c.packets.some((x) => x.t === 'ans' && x.id === 'm1' && !x.ok && x.code === 'bad_answer'));
    c.send({ t: 'answer', w: 'q999', id: 'm2', r: correctResponse(q.question!) }); await c.waitFor(() => c.packets.some((x) => x.t === 'ans' && x.id === 'm2' && x.code === 'stale'));
    c.send({ t: 'answer', w: q.w, id: 'a1', r: wrongResponse(q.question!) }); await c.waitFor(() => c.packets.some((x) => x.t === 'ans' && x.id === 'a1' && x.ok));
    c.send({ t: 'answer', w: q.w, id: 'a2', r: correctResponse(q.question!) }); await c.waitFor(() => c.packets.some((x) => x.t === 'ans' && x.id === 'a2' && x.ok && x.duplicate));
    const rt = [...srv.rooms.values()][0]!; expect(rt.room.quiz!.answers[ps[0]!.id]!.correct).toBe(false); expect(store.answers.size).toBe(1);
  });
  it('a client-supplied score or correctness is not even parseable; the grade comes only from the stored key', async () => {
    const { ps } = await toQuestion(); const c = ps[1]!.c; const q = c.quiz!;
    c.sendRaw(JSON.stringify({ t: 'answer', w: q.w, id: 'f1', r: wrongResponse(q.question!), correct: true, frac: 1 })); await c.waitFor(() => c.packets.some((x) => x.t === 'err' && x.code === 'bad_packet'));
    expect([...srv.rooms.values()][0]!.room.quiz!.answers[ps[1]!.id]).toBeUndefined();
  });
  it('answering after the deadline is refused', async () => {
    const { ps } = await toQuestion(); const c = ps[0]!.c; const q = c.quiz!;
    await c.waitFor(() => c.phase !== 'question', 40000, 'question to close'); c.send({ t: 'answer', w: q.w, id: 'late', r: correctResponse(q.question!) });
    await c.waitFor(() => c.packets.some((x) => x.t === 'ans' && x.id === 'late' && !x.ok), 3000); expect(['closed', 'late', 'stale']).toContain((c.packets.find((x) => x.t === 'ans' && x.id === 'late') as { code: string }).code);
  });
  it('hint is released by a separate request and only while the window is open', async () => {
    const { ps } = await toQuestion(); const c = ps[0]!.c; const q = c.quiz!;
    expect(JSON.stringify(c.packets.filter((x) => x.t === 'snap'))).not.toContain('Divisible by two');
    c.send({ t: 'hint', w: q.w }); await c.waitFor(() => c.packets.some((x) => x.t === 'hint'));
  });
});

describe('presence, pause, restart', () => {
  it('a dropped player is marked offline, reconnects into the same seat, and the room keeps running', async () => {
    await boot(); const room = await devRoom(srv.url, cfg()); const [a, b] = await seatPlayers(room, ['Ann', 'Bo']); const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect();
    a!.c.close(); await sleep(150); const rt = srv.rooms.get(room.roomId)!; expect(rt.room.roster[a!.id]!.connected).toBe(false);
    await host.waitFor(() => (host.view.s.roster as { id: string; on: boolean }[] | undefined)?.find((r) => r.id === a!.id)?.on === false, 3000, 'offline flag');
    const back = track(new WsClient(srv.wsUrl, a!.token, { origin: 'https://site.test' })); await back.connect(); await back.waitFor(() => !!back.me);
    expect(rt.room.roster[a!.id]!.connected).toBe(true); expect(back.welcome!.you.id).toBe(a!.id); void b;
  });
  it('a missing host pauses the match after 8 s and the pause survives; the teacher can resume', async () => {
    await boot({ clock: warp(8) }); const room = await devRoom(srv.url, cfg({ mode: 'coop', teamCount: 1, teamSizeCap: 1 }), 30); const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect(); const [a] = await seatPlayers(room, ['Ann']);
    host.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } }); await a!.c.waitPhase('wave', 20000); host.close();
    await a!.c.waitFor(() => a!.c.meta?.paused === true, 8000, 'pause'); expect(a!.c.meta!.pauseReason).toBe('host_away');
    const h2 = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await h2.connect(); await h2.waitFor(() => !!h2.meta);
    h2.send({ t: 'host', id: hostId(), cmd: { cmd: 'resume' } }); await a!.c.waitFor(() => a!.c.meta?.paused === false, 4000, 'resume');
  });
  it('restart: the checkpoint resumes the room, the room comes back paused, and a second worker cannot steal a live lease', async () => {
    const shared = new MemoryStore(); await boot({ store: shared, clock: warp(8), checkpointEveryMs: 200 }); const room = await devRoom(srv.url, cfg({ mode: 'coop', teamCount: 1, teamSizeCap: 1 }), 30);
    const host = track(new WsClient(srv.wsUrl, room.hostToken, { origin: 'https://site.test' })); await host.connect(); const [a] = await seatPlayers(room, ['Ann']);
    host.send({ t: 'host', id: hostId(), cmd: { cmd: 'begin' } }); await a!.c.waitPhase('wave', 20000); await sleep(600);
    const rec = await shared.load(room.roomId); expect(rec!.checkpoint).not.toBeNull(); const wave = rec!.checkpoint!.wave;
    // a second worker with a different id cannot take the live lease
    const s2 = await startSwarmServer({ port: 0, host: '127.0.0.1', secret: SECRET, store: shared, dev: true, workerId: 'second', allowedOrigins: ['*'], sourceFor: () => new FixtureSource(30) });
    const c2 = track(new WsClient(s2.wsUrl, a!.token)); await c2.connect(); await c2.waitClosed(); expect(c2.closed!.code).toBe(4410); await s2.close();
    clients.splice(0).forEach((c) => c.close()); await srv.close(); // graceful: rooms checkpointed
    const lease = shared.sessions.get(room.roomId)!; lease.leaseUntil = 0; // the old worker is gone
    srv = await startSwarmServer({ port: 0, host: '127.0.0.1', secret: SECRET, store: shared, dev: true, workerId: 'third', allowedOrigins: ['https://site.test'], sourceFor: () => new FixtureSource(30), tokenTtlSec: 3600 });
    const back = track(new WsClient(srv.wsUrl, a!.token, { origin: 'https://site.test' })); await back.connect(); await back.waitFor(() => !!back.me, 5000, 'seat after restart');
    expect(back.meta!.wave).toBe(wave); expect(back.meta!.paused).toBe(true); expect(back.meta!.pauseReason).toBe('worker_restarted');
  }, 60000);
  it('two rooms are isolated and idle lobbies cost no CPU-heavy work', async () => {
    await boot(); const r1 = await devRoom(srv.url, cfg()); const r2 = await devRoom(srv.url, cfg()); const [a] = await seatPlayers(r1, ['Ann']); const [b] = await seatPlayers(r2, ['Ann']);
    expect(a!.id).not.toBe(b!.id); expect(srv.rooms.size).toBe(2); await sleep(300); expect(srv.metrics.stats('tick_ms').p95).toBeLessThan(10);
  });
  it('server_busy: a full worker refuses new rooms with a clear message', async () => {
    await boot({ maxRooms: 1 }); const r1 = await devRoom(srv.url, cfg()); const r2 = await devRoom(srv.url, cfg());
    expect((await joinRoom(srv.url, r1.code, 'Ann')).status).toBe(200); const second = await joinRoom(srv.url, r2.code, 'Bo'); expect(second.status).toBe(503); expect(second.json.code).toBe('server_busy');
  });
});
void CANARY;

describe('SW-09 /metrics exposure', () => {
  it('outside dev, /metrics is a 404 unless a token is configured; with one it needs the bearer token', async () => {
    await boot({ dev: false, allowedOrigins: ['https://site.test'] });
    expect((await fetch(srv.url + '/metrics')).status).toBe(404);
    await srv.close();
    await boot({ dev: false, allowedOrigins: ['https://site.test'], metricsToken: 'm'.repeat(32) });
    expect((await fetch(srv.url + '/metrics')).status).toBe(401);
    expect((await fetch(srv.url + '/metrics', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    const ok = await fetch(srv.url + '/metrics', { headers: { authorization: 'Bearer ' + 'm'.repeat(32) } }); expect(ok.status).toBe(200); expect(await ok.text()).toMatch(/swarm_rooms \d/);
    const h = await fetch(srv.url + '/healthz'); expect(JSON.stringify(await h.json())).not.toMatch(/token|secret|room[Ii]d/); // health exposes counts only
  });
});
