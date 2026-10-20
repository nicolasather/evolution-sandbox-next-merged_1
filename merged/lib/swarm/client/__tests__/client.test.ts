/** @jest-environment node */
import { SnapshotBuffer, lerpEntity, sampleGroup } from '../../render/interp';
import { InputState, isTypingTarget } from '../input';
import { SwarmConnection } from '../connection';
import { PracticeSession } from '../loopback';
import { FxLayer } from '../../render/fxlayer';
import { theme } from '../../render/palette';

jest.setTimeout(60_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('snapshot interpolation', () => {
  const e = (x: number, y: number) => ({ p: { a: [x, y, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0] } });
  it('blends between the two snapshots around the render time and ignores out-of-order packets', () => {
    const b = new SnapshotBuffer(); b.push(1000, e(0, 0), 0); b.push(1100, e(10, 20), 0); b.push(1050, e(99, 99), 0); b.push(1100, e(77, 77), 0); expect(b.size).toBe(2);
    const s = b.at(1050)!; expect(s.k).toBeCloseTo(0.5); const p = sampleGroup('p', s).a!; expect(p[0]).toBeCloseTo(5); expect(p[1]).toBeCloseTo(10);
    expect(b.at(900)!.b.sm).toBe(1000); expect(b.at(5000)!.a.sm).toBe(1100); // before the first / after the last: hold, never extrapolate
  });
  it('shows a dash or respawn at the new place instead of sliding across the arena', () => { expect(lerpEntity('p', [0, 0, 1], [200, 0, 1], 0.5)[0]).toBe(200); expect(lerpEntity('p', [0, 0, 1], [20, 0, 1], 0.5)[0]).toBe(10); });
  it('learns the clock offset from the lowest-latency pong and flags a stale connection', () => {
    const b = new SnapshotBuffer(); b.sample(1000, 51_000, 1100); expect(b.offset).toBeCloseTo(50_000 - 50 + 0, -1); b.sample(2000, 99_999, 2900); expect(Math.abs(b.offset - 49_950)).toBeLessThan(60); // a slow sample does not replace a good one
    b.push(10, e(0, 0), 5000); expect(b.staleness(5800)).toBe(800); expect(new SnapshotBuffer().staleness(1)).toBe(Infinity);
  });
});

describe('input', () => {
  it('turns keys into a unit-length vector, with a dead zone, and ignores keys while disabled', () => {
    const i = new InputState(); i.key('d', true); i.key('s', true); const v = i.vector(); expect(Math.hypot(v.x, v.y)).toBeCloseTo(1); expect(v.x).toBeGreaterThan(0); i.key('d', false); i.key('s', false); expect(i.vector()).toEqual({ x: 0, y: 0 });
    i.stick = { x: 0.03, y: 0 }; expect(i.vector()).toEqual({ x: 0, y: 0 }); i.stick = { x: 0.6, y: 0 }; expect(i.vector().x).toBeCloseTo(0.6); i.enabled = false; expect(i.vector()).toEqual({ x: 0, y: 0 });
    expect(i.key('q', true)).toBe(false); expect(i.key('ArrowLeft', true)).toBe(true);
  });
  it('maps a pointer offset to a clamped stick vector', () => { expect(InputState.stickFrom(100, 0, 40)).toEqual({ x: 1, y: 0 }); expect(InputState.stickFrom(2, 1, 40)).toEqual({ x: 0, y: 0 }); const h = InputState.stickFrom(20, 0, 40); expect(h.x).toBeCloseTo(0.5); });
  it('never steals keys from text fields', () => { expect(isTypingTarget({ tagName: 'INPUT' } as never)).toBe(true); expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false } as never)).toBe(false); expect(isTypingTarget(null)).toBe(false); });
});

describe('effects layer', () => {
  it('caps particles, aggregates damage numbers and replaces motion with static icons in reduced-motion mode', () => {
    const fx = new FxLayer(25); fx.add(Array.from({ length: 200 }, (_, i) => ({ k: 'hit' as const, x: i, y: 0, n: 3 })), 0); expect(fx.count).toBeLessThanOrEqual(25);
    const calls: string[] = []; const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : (..._a: unknown[]) => { calls.push(String(k)); }), set: () => true }) as unknown as CanvasRenderingContext2D;
    expect(() => fx.draw(ctx, theme(false, true), 0.1)).not.toThrow(); expect(() => fx.draw(ctx, theme(true, false), 0.1)).not.toThrow(); expect(calls.length).toBeGreaterThan(0);
  });
});

/** A WebSocket stand-in that the test controls. */
class FakeWS {
  static all: FakeWS[] = []; readyState = 0; sent: Record<string, unknown>[] = []; onopen: (() => void) | null = null; onmessage: ((e: { data: string }) => void) | null = null; onclose: ((e: { code: number; reason: string }) => void) | null = null; onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.all.push(this); queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send(s: string) { this.sent.push(JSON.parse(s)); } close(code = 1000, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
  serverSend(p: unknown) { this.onmessage?.({ data: JSON.stringify(p) }); } serverClose(code: number, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
}
const welcome = (id = 'me') => ({ t: 'welcome', proto: 'ss/1', you: { id, kind: 'player', teamId: 't1' }, serverMs: 5000, tickHz: 20, snapHz: 10, roomCode: 'ABC123', resumed: false });

describe('SwarmConnection', () => {
  beforeEach(() => { FakeWS.all = []; });
  const mk = (extra: Partial<ConstructorParameters<typeof SwarmConnection>[0]> = {}) => new SwarmConnection({ wsUrl: 'ws://x/ws', token: 'tok', WebSocketImpl: FakeWS as never, maxBackoffMs: 50, ...extra });
  it('says hello with the token, applies full then delta snapshots, and rejects pending requests when the line drops', async () => {
    const c = mk(); c.start(); await sleep(5); const ws = FakeWS.all[0]!; expect(ws.sent[0]).toMatchObject({ t: 'hello', proto: 'ss/1', token: 'tok' });
    ws.serverSend(welcome()); expect(c.status).toBe('connected');
    ws.serverSend({ t: 'snap', full: true, ack: 0, sm: 5100, seq: 1, v: { s: { meta: { phase: 'wave' } }, e: { p: { me: [1, 2] } } } }); expect(c.phase).toBe('wave');
    ws.serverSend({ t: 'snap', full: false, ack: 0, sm: 5200, seq: 2, v: { e: { p: { set: { me: [3, 4] } } } } }); expect(c.view.e.p!.me).toEqual([3, 4]); expect(c.buffer.size).toBe(2);
    const pending = c.answer('w1', { kind: 'answer_forge', text: 'x' }); const packet = ws.sent.find((p) => p.t === 'answer')!; expect(packet).toMatchObject({ w: 'w1', r: { text: 'x' } });
    ws.serverSend({ t: 'ans', w: 'w1', id: packet.id, ok: true }); await expect(pending).resolves.toMatchObject({ ok: true });
    const lost = c.answer('w2', {}); const lostAssertion = expect(lost).rejects.toThrow(); ws.serverClose(1006); await lostAssertion; c.stop();
  });
  it('reconnects after a drop with a fresh hello, and re-requests the token each time when given a function', async () => {
    let n = 0; const c = mk({ token: async () => `t${++n}` }); c.start(); await sleep(10); FakeWS.all[0]!.serverSend(welcome()); FakeWS.all[0]!.serverClose(1006); expect(c.status).toBe('reconnecting');
    await sleep(200); expect(FakeWS.all.length).toBeGreaterThanOrEqual(2); expect(FakeWS.all[1]!.sent[0]).toMatchObject({ t: 'hello', token: 't2' }); FakeWS.all[1]!.serverSend(welcome()); expect(c.status).toBe('connected'); c.stop();
  });
  it('stops retrying when the match is over, the seat was taken over, or the token is refused', async () => {
    const a = mk(); a.start(); await sleep(5); FakeWS.all[0]!.serverSend(welcome()); FakeWS.all[0]!.serverClose(4001, 'duplicate_socket'); expect(a.status).toBe('replaced'); await sleep(150); expect(FakeWS.all.length).toBe(1); a.stop();
    FakeWS.all = []; const b = mk(); b.start(); await sleep(5); FakeWS.all[0]!.serverSend({ t: 'err', code: 'bad_token', message: 'Your session expired.', fatal: true }); expect(b.status).toBe('fatal'); expect(b.lastError).toMatch(/expired/); b.stop();
    FakeWS.all = []; const d = mk(); d.start(); await sleep(5); FakeWS.all[0]!.serverSend(welcome()); FakeWS.all[0]!.serverSend({ t: 'bye', reason: 'removed' }); expect(d.status).toBe('fatal'); expect(d.lastError).toMatch(/removed/); d.stop();
  });
  it('sends only intent: a direction with a sequence number, and ability presses with unique ids', async () => {
    const c = mk(); c.start(); await sleep(5); const ws = FakeWS.all[0]!; ws.serverSend(welcome()); c.move(0.123456, -2); c.move(0, 1); c.ability(); c.ability();
    const mv = ws.sent.filter((p) => p.t === 'move'); expect(mv.map((m) => m.seq)).toEqual([1, 2]); expect(mv[0]!.x).toBe(0.12); const ab = ws.sent.filter((p) => p.t === 'ability'); expect(ab[0]!.id).not.toBe(ab[1]!.id);
    for (const p of ws.sent) expect(Object.keys(p).some((k) => ['score', 'hp', 'x_pos', 'team', 'points'].includes(k))).toBe(false); c.stop();
  });
});

describe('Practice (the real room runtime in the browser)', () => {
  it('seats the student, runs the lobby → role → countdown → wave flow over the same protocol, and grades an answer on the "server" side', async () => {
    const ps = new PracticeSession({ name: 'Tester', minutes: 5, seed: 3 }); await ps.ready; const c = new SwarmConnection({ wsUrl: 'practice://x', token: 't', WebSocketImpl: ps.socketClass() }); c.start();
    for (let i = 0; i < 40 && c.phase !== 'role_pick'; i++) await sleep(25); expect(c.phase).toBe('role_pick'); expect(c.s.me).toMatchObject({ role: expect.any(String), team: 't1' });
    c.role('medic'); await sleep(120); expect(c.s.me.role).toBe('medic'); ps.begin();
    for (let i = 0; i < 200 && c.phase !== 'wave'; i++) await sleep(60); expect(c.phase).toBe('wave'); expect(Object.keys(c.view.e.p!)).toHaveLength(1);
    const x0 = c.view.e.p!.me![0]!; c.move(1, 0); await sleep(1500); expect(c.view.e.p!.me![0]).toBeGreaterThan(x0 + 20);
    c.stop(); ps.close();
  });
});
