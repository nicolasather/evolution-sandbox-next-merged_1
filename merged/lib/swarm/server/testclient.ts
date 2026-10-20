/** A real WebSocket client used by integration tests, the load generator and dev tooling. It applies deltas exactly like a browser client would. */
import WebSocket from 'ws';
import { applyDelta, type Delta, type ViewParts } from '../net/view';
import { PROTOCOL } from '../domain';
import type { ServerPacket } from '../net/protocol';

export async function httpJson(base: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}
export type DevRoom = { roomId: string; code: string; hostToken: string; screenToken: string };
export async function devRoom(base: string, config: unknown, questions = 40, seed = 7): Promise<DevRoom> {
  const r = await httpJson(base, '/dev/rooms', { config, questions, seed }); if (r.status !== 200) throw new Error(`dev room failed: ${JSON.stringify(r.json)}`);
  return r.json as unknown as DevRoom;
}
export type Joined = { roomId: string; participantId: string; teamId: string; role: string; token: string; resumed: boolean };
export async function joinRoom(base: string, code: string, name: string, extra: Record<string, unknown> = {}) { return httpJson(base, '/join', { code, name, ...extra }); }

export class WsClient {
  ws!: WebSocket; view: ViewParts = { s: {}, e: {}, fx: [] }; packets: ServerPacket[] = []; raw: string[] = []; closed: { code: number; reason: string } | null = null; welcome: Extract<ServerPacket, { t: 'welcome' }> | null = null;
  tap: ((p: ServerPacket, raw: string) => void) | null = null;
  snaps = 0; bytes = 0; fullSnaps = 0; ackSeq = 0; lastSnapAt = 0; rtts: number[] = []; fxSeen: unknown[] = []; keepRaw = false;
  private waiters: { pred: () => boolean; ok: () => void }[] = [];
  constructor(public url: string, public token: string, public opts: { focus?: string; view?: 'play' | 'screen'; origin?: string; keepRaw?: boolean } = {}) { this.keepRaw = !!opts.keepRaw; }
  connect(sendHello = true): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url, { headers: this.opts.origin ? { origin: this.opts.origin } : undefined });
      this.ws.on('open', () => { if (sendHello) this.send({ t: 'hello', proto: PROTOCOL, token: this.token, focus: this.opts.focus, view: this.opts.view }); resolve(); });
      this.ws.on('error', (e) => reject(e));
      this.ws.on('unexpected-response', (_req, res) => { this.closed = { code: res.statusCode ?? 0, reason: 'http' }; resolve(); });
      this.ws.on('message', (d) => this.onMsg(d.toString('utf8')));
      this.ws.on('close', (code, reason) => { this.closed = { code, reason: reason.toString() }; this.poke(); });
    });
  }
  private onMsg(s: string) {
    this.bytes += s.length; if (this.keepRaw) this.raw.push(s);
    const p = JSON.parse(s) as ServerPacket; this.tap?.(p, s); this.packets.push(p); if (this.packets.length > 400) this.packets.shift();
    if (p.t === 'welcome') this.welcome = p;
    if (p.t === 'snap') { this.snaps++; if (p.full) this.fullSnaps++; this.ackSeq = p.ack; this.lastSnapAt = Date.now(); const v = p.v as Delta & { fx?: unknown[] }; this.view = applyDelta(this.view, v, p.full); if (v.fx?.length) this.fxSeen.push(...v.fx); }
    if (p.t === 'pong') this.rtts.push(Date.now() - p.c % 1e9);
    this.poke();
  }
  private poke() { this.waiters = this.waiters.filter((w) => { if (w.pred()) { w.ok(); return false; } return true; }); }
  send(p: unknown) { if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(p)); }
  sendRaw(s: string) { this.ws.send(s); }
  waitFor(pred: () => boolean, ms = 8000, what = 'condition'): Promise<void> {
    return new Promise((resolve, reject) => { if (pred()) return resolve(); const t = setTimeout(() => reject(new Error(`timeout waiting for ${what} (phase ${(this.meta as { phase?: string } | undefined)?.phase})`)), ms); this.waiters.push({ pred, ok: () => { clearTimeout(t); resolve(); } }); });
  }
  get meta() { return this.view.s.meta as Record<string, unknown> | undefined; }
  get phase() { return (this.meta?.phase as string | undefined) ?? ''; }
  get me() { return this.view.s.me as { id: string; team: string; role: string; seq: number; answered: boolean; result?: { frac: number; correct: boolean } } | undefined; }
  get quiz() { return this.view.s.quiz as { w: string; reveal: boolean; question: { id: string; kind: string; answerKey?: unknown } | null; status: string; deadlineMs: number } | undefined; }
  get draft() { return this.view.s.draft as { id: string; resolved: unknown; offers: { id: string; cost: number; affordable: boolean }[] } | undefined; }
  waitPhase(p: string | ((s: string) => boolean), ms = 20000) { return this.waitFor(() => (typeof p === 'string' ? this.phase === p : p(this.phase)), ms, `phase ${typeof p === 'string' ? p : 'predicate'}`); }
  waitClosed(ms = 4000) { return this.waitFor(() => this.closed !== null, ms, 'close'); }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}
