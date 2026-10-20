/** Practice mode: the production room runtime, running inside the browser, behind a WebSocket-shaped object. The page uses the very same client
 *  (SwarmConnection, snapshots, deltas, redaction) as an online match; only the transport is in-process. Nothing is saved or sent anywhere. */
import { RoomRuntime, type Conn, type Sock } from '../server/runtime';
import { Metrics } from '../server/metrics';
import type { Store } from '../server/store';
import { practiceQuestions } from './practice-questions';
import { PROTOCOL, configSchema, type Config } from '../domain';

const noopStore: Store = {
  async acquire() { return true; }, async load() { return null; }, async saveSeat() { /* nothing is stored */ }, async saveCheckpoint() { return true; },
  async recordAnswer() { return true; }, async answersFor() { return []; }, async recordEvents() { /* */ }, async findRoomByCode() { return null; }, async audit() { /* */ },
  async finish() { /* */ }, async sweep() { return 0; }, async close() { /* */ },
};

export type PracticeOpts = { name?: string; minutes?: number; difficulty?: Config['difficulty']; mapId?: Config['mapId']; focus?: Config['focus']; lowPressure?: boolean; seed?: number };
export class PracticeSession {
  runtime = new RoomRuntime('practice', { workerId: 'local', store: noopStore, metrics: new Metrics(), checkpointEveryMs: 3_600_000 });
  ready: Promise<void>; private hostConn: Conn | null = null; private hostSock: Sock = { send() { /* the host view is not shown */ }, close() { /* */ }, buffered: 0, open: true };
  constructor(o: PracticeOpts = {}) {
    const config = configSchema.parse({ mode: 'coop', teamCount: 1, teamSizeCap: 1, minutes: o.minutes ?? 5, mapId: o.mapId ?? 'meadow_circuit', difficulty: o.difficulty ?? 'normal', focus: o.focus ?? 'balanced', lowPressure: o.lowPressure ?? false });
    this.ready = (async () => {
      await this.runtime.open({ roomId: 'practice', hostId: 'local', config, seed: o.seed ?? (Math.random() * 2 ** 31) | 0, status: 'active', checkpoint: null, checkpointRev: 0, code: 'PRACT1' }, practiceQuestions());
      this.runtime.seatPlayer('me', (o.name ?? 'You').slice(0, 24) || 'You', null);
      this.hostConn = this.runtime.attach(this.hostSock, { kind: 'host', sub: 'host' });
      this.command({ cmd: 'start' });
    })();
  }
  private n = 0;
  command(cmd: Record<string, unknown>) { if (this.hostConn) this.runtime.onMessage(this.hostConn, JSON.stringify({ t: 'host', id: `p${++this.n}`, cmd })); }
  /** the student's own "Start practice" button */
  begin() { this.command({ cmd: 'begin' }); }
  pause(v: boolean) { this.command({ cmd: v ? 'pause' : 'resume' }); }
  close() { this.runtime.close('practice_closed'); }
  /** WebSocket-compatible factory for SwarmConnection */
  socketClass(): typeof WebSocket {
    const rt = this.runtime; const ready = this.ready;
    class LoopbackSocket {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 0; onopen: (() => void) | null = null; onmessage: ((e: { data: string }) => void) | null = null; onclose: ((e: { code: number; reason: string }) => void) | null = null; onerror: (() => void) | null = null;
      private conn: Conn | null = null;
      constructor(url: string) { void url; void ready.then(() => { this.readyState = 1; this.onopen?.(); }); }
      send(raw: string) {
        let p: { t?: string; token?: string } = {}; try { p = JSON.parse(raw) as typeof p; } catch { return; }
        if (p.t === 'hello') {
          const sock: Sock = { send: (d) => { queueMicrotask(() => this.onmessage?.({ data: d })); }, close: (code, reason) => { this.finish(code, reason); }, buffered: 0, get open() { return true; } };
          this.conn = rt.attach(sock, { kind: 'player', sub: 'me' }); void PROTOCOL; return;
        }
        if (this.conn) rt.onMessage(this.conn, raw);
      }
      private finish(code: number, reason: string) { if (this.readyState === 3) return; this.readyState = 3; if (this.conn) { rt.detach(this.conn); this.conn = null; } this.onclose?.({ code, reason }); }
      close(code = 1000, reason = '') { this.finish(code, reason); }
    }
    return LoopbackSocket as unknown as typeof WebSocket;
  }
}
