/** The Swarm worker: HTTP (health, metrics, join, dev) + WebSocket (/ws). Runs as ONE persistent Node process (see swarm-server/). It is not
 *  a serverless function: a match lives in this process's memory and is checkpointed to the store. Horizontal scale = more workers, each
 *  holding the lease for the rooms it hosts (a room never runs in two workers). */
import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { signToken, verifyToken, newSubject } from '../net/tokens';
import { RoomRuntime, realClock, type Clock, type Sock } from './runtime';
import { Metrics } from './metrics';
import type { Store } from './store';
import { FixtureSource, type QuizSource } from './quiz-source';
import { configSchema } from '../domain';
import { checkNickname } from '../../quiz/safety';
import { MAX_PARTICIPANTS, PROTOCOL } from '../domain';
import { clientPacket } from '../net/protocol';

export type ServerOpts = {
  port?: number; host?: string; secret: string; store: Store; workerId?: string; clock?: Clock; log?: (m: string, o?: unknown) => void;
  sourceFor: (roomId: string) => QuizSource; allowedOrigins?: string[]; dev?: boolean;
  maxRooms?: number; maxSockets?: number; joinPerMinPerIp?: number; joinPerMinPerRoom?: number; checkpointEveryMs?: number; resultsTtlMs?: number;
  tokenTtlSec?: number; helloTimeoutMs?: number; trustProxy?: boolean;
  /** SW-09: /metrics needs 'Authorization: Bearer <this>'. With no token it is served only in dev (o.dev) and is a 404 otherwise. */
  metricsToken?: string;
};
export type Running = { port: number; metrics: Metrics; rooms: Map<string, RoomRuntime>; close(): Promise<void>; url: string; wsUrl: string; ensureRoom(roomId: string): Promise<RoomRuntime> };

const joinBody = z.object({ code: z.string().trim().length(6).regex(/^[A-Za-z0-9]{6}$/), name: z.string().min(1).max(60), team: z.string().max(8).optional(), resume: z.string().max(600).optional() }).strict();
const devCreate = z.object({ config: z.unknown(), questions: z.number().int().min(3).max(120).default(40), seed: z.number().int().optional(), code: z.string().length(6).optional() });

export async function startSwarmServer(o: ServerOpts): Promise<Running> {
  const clock = o.clock ?? realClock; const metrics = new Metrics(); const log = o.log ?? (() => undefined);
  const workerId = o.workerId ?? `w-${randomUUID().slice(0, 8)}`; const rooms = new Map<string, RoomRuntime>(); const opening = new Map<string, Promise<RoomRuntime>>();
  const maxRooms = o.maxRooms ?? 40, maxSockets = o.maxSockets ?? 1200, ttl = o.tokenTtlSec ?? 6 * 3600; const startedAt = Date.now();
  const buckets = new Map<string, { n: number; at: number }>();
  const limited = (key: string, perMin: number): boolean => { const now = Date.now(); const b = buckets.get(key); if (!b || now - b.at > 60_000) { buckets.set(key, { n: 1, at: now }); return false; } return ++b.n > perMin; };
  const origins = o.allowedOrigins ?? []; let sockets = 0; const devQ = new Map<string, number>();
  const sourceFor = (id: string): QuizSource => (devQ.has(id) ? new FixtureSource(devQ.get(id)) : o.sourceFor(id));
  metrics.gauges.set('rooms', () => rooms.size); metrics.gauges.set('sockets', () => sockets); metrics.gauges.set('uptime_seconds', () => Math.floor((Date.now() - startedAt) / 1000));
  metrics.gauges.set('heap_used_bytes', () => process.memoryUsage().heapUsed);

  async function ensureRoom(roomId: string): Promise<RoomRuntime> {
    const live = rooms.get(roomId); if (live && live.status !== 'closed') return live;
    const pend = opening.get(roomId); if (pend) return pend;
    const p = (async () => {
      if (rooms.size >= maxRooms) throw Object.assign(new Error('busy'), { code: 'server_busy' });
      const rec = await o.store.load(roomId); if (!rec || rec.status !== 'active') throw Object.assign(new Error('gone'), { code: 'ended' });
      const questions = await sourceFor(roomId).load();
      const rt = new RoomRuntime(roomId, { clock, workerId, store: o.store, metrics, log, checkpointEveryMs: o.checkpointEveryMs, resultsTtlMs: o.resultsTtlMs });
      const code = (rec as { code?: string }).code ?? roomId.slice(0, 6).toUpperCase();
      await rt.open({ ...rec, code }, questions); rooms.set(roomId, rt); metrics.inc('rooms_opened'); return rt;
    })().finally(() => opening.delete(roomId));
    opening.set(roomId, p); return p;
  }
  const sweep = setInterval(() => { for (const [id, rt] of rooms) if (rt.maintenance() === 'drop') { rt.close('room_closed'); rooms.delete(id); metrics.inc('rooms_retired'); } void o.store.sweep(7 * 86400_000).catch(() => undefined); }, 15_000); (sweep as { unref?: () => void }).unref?.();
  const lease = setInterval(() => { for (const rt of rooms.values()) void o.store.acquire(rt.roomId, workerId, 30).catch(() => undefined); }, 10_000); (lease as { unref?: () => void }).unref?.();

  // ── HTTP ──
  const clientIp = (req: http.IncomingMessage) => (o.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0]!.trim() : '') || req.socket.remoteAddress || 'unknown';
  const cors = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const origin = req.headers.origin; if (origin && (origins.includes('*') || origins.includes(origin))) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'origin'); }
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS'); res.setHeader('access-control-allow-headers', 'content-type'); // /metrics is called server-to-server, never by a browser, so Authorization is deliberately not allowed here res.setHeader('access-control-max-age', '600');
  };
  const json = (res: http.ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
  const readBody = (req: http.IncomingMessage, max = 4096) => new Promise<unknown>((resolve, reject) => { let n = 0; const chunks: Buffer[] = []; req.on('data', (d: Buffer) => { n += d.length; if (n > max) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(d); }); req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); } }); req.on('error', reject); });

  const server = http.createServer(async (req, res) => {
    cors(req, res);
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
      if (url.pathname === '/healthz') { json(res, 200, { ok: true, worker: workerId, protocol: PROTOCOL, rooms: rooms.size, sockets, uptimeSec: Math.floor((Date.now() - startedAt) / 1000) }); return; }
      if (url.pathname === '/metrics') {
        const tokenOk = (): boolean => { const h = String(req.headers.authorization ?? ''); const want = o.metricsToken ?? ''; if (!want || !h.startsWith('Bearer ')) return false; const a = Buffer.from(h.slice(7)); const b = Buffer.from(want); return a.length === b.length && timingSafeEqual(a, b); };
        if (o.metricsToken ? !tokenOk() : !o.dev) { json(res, o.metricsToken ? 401 : 404, { code: o.metricsToken ? 'unauthorized' : 'not_found', message: o.metricsToken ? 'Metrics need a token.' : 'Not found.' }); return; }
        res.setHeader('content-type', 'text/plain; version=0.0.4'); res.end(metrics.render()); return;
      }
      if (url.pathname === '/join' && req.method === 'POST') {
        if (req.headers.origin && !(origins.includes('*') || origins.includes(req.headers.origin))) { json(res, 403, { code: 'origin', message: 'This site is not allowed to join.' }); return; }
        if (limited(`ip:${clientIp(req)}`, o.joinPerMinPerIp ?? 30)) { metrics.inc('join_rate_limited'); json(res, 429, { code: 'rate', message: 'Too many tries. Wait a minute and try again.' }); return; }
        const body = joinBody.safeParse(await readBody(req)); if (!body.success) { json(res, 400, { code: 'bad_request', message: 'Enter the 6-letter room code and a name.' }); return; }
        const roomId = await o.store.findRoomByCode(body.data.code);
        // the same message for "no such code", "ended" and "not a Swarm room": never reveal which rooms exist
        if (!roomId) { metrics.inc('join_unknown_code'); json(res, 404, { code: 'no_room', message: 'This room is not open. Check the code.' }); return; }
        if (limited(`room:${roomId}`, o.joinPerMinPerRoom ?? 120)) { json(res, 429, { code: 'rate', message: 'This room is busy. Try again in a moment.' }); return; }
        let rt: RoomRuntime; try { rt = await ensureRoom(roomId); } catch (e) { const c = (e as { code?: string }).code; json(res, c === 'server_busy' ? 503 : 404, { code: c ?? 'no_room', message: c === 'server_busy' ? 'The game server is full. Try again shortly.' : 'This room is not open. Check the code.' }); return; }
        if (rt.status !== 'active') { json(res, 404, { code: 'ended', message: 'This match has ended.' }); return; }
        // a returning device presents its old token: the same seat comes back (no duplicate player, no second seat)
        let id = '';
        if (body.data.resume) { const v = verifyToken(body.data.resume, o.secret, { room: roomId, typ: 'player' }); if (v.ok && rt.room.roster[v.claims.sub] && !rt.room.roster[v.claims.sub]!.forfeited) id = v.claims.sub; }
        if (id) { const m = rt.room.roster[id]!; json(res, 200, { roomId, participantId: id, teamId: m.teamId, role: m.role, token: signToken({ typ: 'player', room: roomId, sub: id, ttlSec: ttl }, o.secret), resumed: true, code: rt.room.code }); return; }
        const nick = checkNickname(body.data.name, { taken: rt.takenNames() });
        if (!nick.ok) { json(res, 400, { code: 'name', message: nick.message }); return; }
        if (Object.keys(rt.room.roster).length >= MAX_PARTICIPANTS) { json(res, 409, { code: 'room_full', message: 'This room is full.' }); return; }
        const sub = newSubject(); const seated = rt.seatPlayer(sub, nick.name, body.data.team ?? null);
        if (!seated.ok) { json(res, 409, { code: seated.code, message: seated.message }); return; }
        metrics.inc('joins'); json(res, 200, { roomId, participantId: sub, teamId: seated.teamId, role: seated.role, token: signToken({ typ: 'player', room: roomId, sub, ttlSec: ttl }, o.secret), resumed: false, code: rt.room.code }); return;
      }
      if (o.dev && url.pathname === '/dev/rooms' && req.method === 'POST') {
        const b = devCreate.safeParse(await readBody(req, 16384)); if (!b.success) { json(res, 400, { code: 'bad_request', message: 'Bad config.' }); return; }
        const mem = o.store as unknown as { seed?: (r: unknown) => void }; if (!mem.seed) { json(res, 501, { code: 'unsupported', message: 'Dev rooms need the memory store.' }); return; }
        const cfg = configSchema.safeParse(b.data.config); if (!cfg.success) { json(res, 400, { code: 'bad_config', message: cfg.error.issues[0]?.message ?? 'Bad config.' }); return; }
        const roomId = randomUUID(); const code = b.data.code ?? randomUUID().replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
        mem.seed({ roomId, hostId: 'dev-host', config: cfg.data, seed: b.data.seed ?? Math.floor(Math.random() * 2 ** 31), code });
        devQ.set(roomId, b.data.questions);
        json(res, 200, { roomId, code, hostToken: signToken({ typ: 'host', room: roomId, sub: 'host', ttlSec: ttl }, o.secret), screenToken: signToken({ typ: 'screen', room: roomId, sub: 'screen-' + newSubject().slice(0, 6), ttlSec: ttl }, o.secret) }); return;
      }
      json(res, 404, { code: 'not_found', message: 'Not found.' });
    } catch (e) {
      const st = (e as { status?: number }).status ?? 500; if (st === 500) { metrics.inc('http_500'); log('http error', { err: e instanceof Error ? e.message : String(e) }); }
      if (!res.headersSent) json(res, st, { code: st === 413 ? 'too_large' : st === 400 ? 'bad_request' : 'server_error', message: st === 500 ? 'Something went wrong on our side.' : 'Bad request.' });
    }
  });

  // ── WebSocket ──
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') { socket.destroy(); return; }
    const origin = req.headers.origin; if (origin && !(origins.includes('*') || origins.includes(origin))) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); metrics.inc('rejected_origin'); return; }
    if (sockets >= maxSockets) { socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); metrics.inc('rejected_server_busy'); return; }
    wss.handleUpgrade(req, socket, head, (ws) => onSocket(ws));
  });
  function onSocket(ws: WebSocket) {
    sockets++; metrics.inc('sockets_opened');
    const sock: Sock = { send: (d) => ws.send(d), close: (c, r) => ws.close(c, r.slice(0, 100)), get buffered() { return ws.bufferedAmount; }, get open() { return ws.readyState === ws.OPEN; } };
    let rt: RoomRuntime | null = null; let conn: ReturnType<RoomRuntime['attach']> = null; let alive = true;
    const helloTimer = setTimeout(() => { if (!conn) ws.close(4408, 'hello_timeout'); }, o.helloTimeoutMs ?? 5000);
    ws.on('pong', () => { alive = true; });
    const hb = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; try { ws.ping(); } catch { /* closed */ } }, 10_000); (hb as { unref?: () => void }).unref?.();
    let helloing = false;
    ws.on('message', async (data, isBinary) => {
      if (isBinary) { ws.close(4400, 'binary_not_supported'); return; }
      const raw = data.toString('utf8');
      if (conn && rt) { rt.onMessage(conn, raw); return; }
      if (helloing) return; helloing = true;
      try {
        let j: unknown; try { j = JSON.parse(raw); } catch { ws.close(4400, 'bad_packet'); return; }
        const p = clientPacket.safeParse(j); if (!p.success || p.data.t !== 'hello') { ws.send(JSON.stringify({ t: 'err', code: 'not_hello', message: 'Say hello first.', fatal: true })); ws.close(4400, 'not_hello'); return; }
        const v = verifyToken(p.data.token, o.secret, { now: Date.now() });
        if (!v.ok) { metrics.inc(`rejected_token_${v.reason}`); ws.send(JSON.stringify({ t: 'err', code: 'bad_token', message: 'Your session expired. Join again.', fatal: true })); ws.close(4403, 'bad_token'); return; }
        const kind = v.claims.typ; const view = p.data.view;
        try { rt = await ensureRoom(v.claims.room); } catch (e) { const c = (e as { code?: string }).code ?? 'ended'; ws.send(JSON.stringify({ t: 'err', code: c === 'server_busy' ? 'server_busy' : 'ended', message: c === 'server_busy' ? 'The game server is full.' : 'This match is over.', fatal: true })); ws.close(4410, c); return; }
        clearTimeout(helloTimer);
        conn = rt.attach(sock, { kind: view === 'screen' && kind === 'host' ? 'screen' : kind, sub: v.claims.sub, focus: p.data.focus });
        if (!conn) rt = null;
      } finally { helloing = false; }
    });
    ws.on('close', () => { clearTimeout(helloTimer); clearInterval(hb); sockets--; if (rt && conn) rt.detach(conn); metrics.inc('sockets_closed'); });
    ws.on('error', () => { /* close follows */ });
  }
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(o.port ?? 0, o.host ?? '0.0.0.0', () => resolve()); });
  const port = (server.address() as { port: number }).port;
  return {
    port, metrics, rooms, ensureRoom, url: `http://127.0.0.1:${port}`, wsUrl: `ws://127.0.0.1:${port}/ws`,
    async close() {
      clearInterval(sweep); clearInterval(lease);
      await Promise.all([...rooms.values()].map((r) => r.shutdown('restart').catch(() => undefined))); rooms.clear();
      for (const c of wss.clients) c.close(1001, 'restart');
      await new Promise<void>((r) => wss.close(() => r())); await new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections?.(); });
    },
  };
}
