/** Browser side of protocol ss/1: one WebSocket with reconnect (exponential backoff + jitter), clock-offset estimation, delta application and
 *  request/response helpers for answers, hints and host commands. It never decides anything about the game: it sends intent and renders what the server says. */
import type { Loose } from '../../quiz/loose';
import { applyDelta, type Delta, type ViewParts } from '../net/view';
import { PROTOCOL } from '../domain';
import type { ServerPacket } from '../net/protocol';
import { SnapshotBuffer } from '../render/interp';

export type ConnStatus = 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'replaced' | 'ended' | 'fatal';
export type ConnOpts = { wsUrl: string; token: string | (() => Promise<string>); view?: 'play' | 'screen'; focus?: string; WebSocketImpl?: typeof WebSocket; now?: () => number; maxBackoffMs?: number };
type Pending = { resolve: (p: Loose) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
export type AnsResult = { ok: boolean; duplicate?: boolean; code?: string; message?: string };
export type HostAck = { ok: boolean; code?: string; message?: string; nonce?: string };

export class SwarmConnection {
  status: ConnStatus = 'connecting'; view: ViewParts = { s: {}, e: {}, fx: [] }; buffer = new SnapshotBuffer();
  welcome: Extract<ServerPacket, { t: 'welcome' }> | null = null; rttMs = 0; lastError = ''; reconnects = 0; version = 0; fxQueue: Loose[] = []; resumedAt = 0;
  private ws: WebSocket | null = null; private listeners = new Set<() => void>(); private pend = new Map<string, Pending>(); private seq = 0; private stopped = false;
  private tries = 0; private timers: ReturnType<typeof setTimeout>[] = []; private pingT: ReturnType<typeof setInterval> | null = null; private lastSnap = 0; private everConnected = false;
  private Impl: typeof WebSocket; private now: () => number;
  constructor(private o: ConnOpts) { this.Impl = o.WebSocketImpl ?? WebSocket; this.now = o.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now())); }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.version++; for (const l of this.listeners) l(); }
  private setStatus(s: ConnStatus) { if (this.status !== s) { this.status = s; this.emit(); } }
  get s() { return this.view.s as Record<string, Loose>; }
  /** server wall-clock estimate, for deadlines in the snapshot */
  serverNow(): number { return this.now() + this.buffer.offset; }
  get phase(): string { return (this.s.meta?.phase as string) ?? ''; }

  start() { this.stopped = false; void this.open(); }
  stop() { this.stopped = true; this.timers.forEach(clearTimeout); this.timers = []; if (this.pingT) clearInterval(this.pingT); this.pingT = null; try { this.ws?.close(1000, 'bye'); } catch { /* closed */ } this.rejectAll('closed'); }
  /** Voluntary exit: tells the server so the seat is released, then closes for good. */
  leave() { this.send({ t: 'leave' }); this.stop(); }

  private async open() {
    if (this.stopped) return;
    let token: string; try { token = typeof this.o.token === 'function' ? await this.o.token() : this.o.token; } catch (e) { this.lastError = (e as Error).message; this.scheduleRetry(); return; }
    if (this.stopped) return;
    const ws = new this.Impl(this.o.wsUrl); this.ws = ws; let opened = false;
    ws.onopen = () => { opened = true; this.send({ t: 'hello', proto: PROTOCOL, token, view: this.o.view, focus: this.o.focus }); };
    ws.onmessage = (ev) => { try { this.onPacket(JSON.parse(String(ev.data)) as ServerPacket); } catch { /* ignore a malformed frame */ } };
    ws.onerror = () => { /* close follows */ };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return; this.ws = null; if (this.pingT) { clearInterval(this.pingT); this.pingT = null; }
      this.rejectAll('connection lost');
      if (this.stopped || this.status === 'replaced' || this.status === 'ended' || this.status === 'fatal') return;
      if (ev.code === 4001) { this.setStatus('replaced'); return; }
      this.setStatus(this.everConnected ? 'reconnecting' : 'connecting'); void opened; this.scheduleRetry();
    };
  }
  private scheduleRetry() {
    if (this.stopped) return; const base = Math.min(this.o.maxBackoffMs ?? 8000, 400 * 2 ** Math.min(this.tries, 5)); const wait = base * (0.6 + Math.random() * 0.8); this.tries++;
    if (this.everConnected && this.status !== 'reconnecting') this.setStatus('reconnecting');
    this.timers.push(setTimeout(() => { this.reconnects++; void this.open(); }, wait));
  }
  private onPacket(p: ServerPacket) {
    switch (p.t) {
      case 'welcome': this.welcome = p; if (!this.buffer.offset) this.buffer.offset = p.serverMs - this.now(); this.tries = 0; this.everConnected = true; this.lastSnap = this.now(); this.view = { s: {}, e: {}, fx: [] }; this.buffer.clear(); this.resumedAt = Date.now(); this.setStatus('connected'); this.startPing(); break;
      case 'snap': {
        this.lastSnap = this.now(); const v = p.v as Delta & { fx?: unknown[] };
        this.view = applyDelta(this.view, v, p.full); if (v.fx?.length) { this.fxQueue.push(...v.fx); if (this.fxQueue.length > 200) this.fxQueue.splice(0, this.fxQueue.length - 200); }
        this.buffer.push(p.sm, this.view.e, this.now());
        if (this.status === 'degraded') this.status = 'connected'; this.emit(); break;
      }
      case 'pong': this.rttMs = Math.max(0, this.now() - p.c); this.buffer.sample(p.c, p.sm, this.now()); break;
      case 'ans': this.settle(`ans:${p.id}`, p); break;
      case 'ack': this.settle(`ack:${p.id}`, p); break;
      case 'hint': this.settle(`hint:${p.w}`, p); break;
      case 'err':
        this.lastError = p.message; if (p.fatal || p.code === 'bad_token' || p.code === 'wrong_room' || p.code === 'ended') { this.setStatus(p.code === 'ended' ? 'ended' : 'fatal'); this.stopFor(); } else this.emit(); break;
      case 'bye': this.lastError = p.reason; if (p.reason === 'ended' || p.reason === 'room_closed') this.setStatus('ended'); else if (p.reason === 'replaced' || p.reason === 'duplicate_socket') this.setStatus('replaced'); else if (p.reason === 'removed' || p.reason === 'kicked') { this.setStatus('fatal'); this.lastError = 'You were removed from this match by the teacher.'; } break;
    }
  }
  private stopFor() { this.timers.forEach(clearTimeout); this.timers = []; try { this.ws?.close(); } catch { /* closed */ } }
  private startPing() {
    if (this.pingT) clearInterval(this.pingT);
    const ping = () => { this.send({ t: 'ping', c: Math.round(this.now()) }); const idle = this.now() - this.lastSnap; if (idle > 2500 && this.status === 'connected') this.setStatus('degraded'); if (idle > 9000 && this.ws) { try { this.ws.close(); } catch { /* closed */ } } };
    ping(); this.pingT = setInterval(ping, 1500);
  }
  send(p: unknown): boolean { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(p)); return true; } return false; }
  /** Movement intent, in −1…1. The server clamps speed; this is never a position. */
  move(x: number, y: number) { return this.send({ t: 'move', seq: ++this.seq, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }); }
  ability(): boolean { return this.send({ t: 'ability', id: this.uid() }); }
  role(role: string) { return this.send({ t: 'role', role }); }
  ready(v: boolean) { return this.send({ t: 'ready', v }); }
  vote(d: string, u: string) { return this.send({ t: 'vote', d, u, id: this.uid() }); }
  focusTeam(team: string) { return this.send({ t: 'focus', team }); }
  private uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  private await<T>(key: string, ok: () => boolean): Promise<T> {
    return new Promise((resolve, reject) => { if (!ok()) { reject(new Error('Not connected. Wait for the connection to come back, then try again.')); return; } const timer = setTimeout(() => { this.pend.delete(key); reject(new Error('The server did not answer in time.')); }, 9000); this.pend.set(key, { resolve, reject, timer }); });
  }
  private settle(key: string, p: unknown) { const x = this.pend.get(key); if (!x) return; clearTimeout(x.timer); this.pend.delete(key); x.resolve(p); }
  private rejectAll(why: string) { for (const [, x] of this.pend) { clearTimeout(x.timer); x.reject(new Error(why)); } this.pend.clear(); }
  /** Sends an answer once; a lost connection rejects so the UI lets the student send again (the server de-duplicates by window). */
  answer(windowId: string, response: unknown): Promise<AnsResult> {
    const id = this.uid(); const w = this.await<AnsResult>(`ans:${id}`, () => !!this.ws && this.ws.readyState === 1);
    this.send({ t: 'answer', w: windowId, id, r: response }); return w;
  }
  hint(windowId: string): Promise<string | null> {
    const w = this.await<{ hint: string | null }>(`hint:${windowId}`, () => !!this.ws && this.ws.readyState === 1); this.send({ t: 'hint', w: windowId }); return w.then((r) => r.hint);
  }
  host(cmd: Record<string, unknown>): Promise<HostAck> {
    const id = this.uid(); const rev = (this.s.meta?.rev as number | undefined); const w = this.await<HostAck>(`ack:${id}`, () => !!this.ws && this.ws.readyState === 1);
    this.send({ t: 'host', id, rev, cmd }); return w;
  }
}
