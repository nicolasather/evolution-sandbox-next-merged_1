/** Snapshot interpolation. The server sends 10 Hz; the client draws at the display rate by blending the two snapshots around (now − delay).
 *  Pure and clock-agnostic: callers pass server-domain milliseconds. */
import type { ViewParts } from '../net/view';

export type Buf = { sm: number; e: ViewParts['e']; arrived: number };
export class SnapshotBuffer {
  private buf: Buf[] = [];
  /** estimated (serverMs − clientMs); updated from ping/pong with the lowest-RTT sample winning */
  offset = 0; private bestRtt = Infinity;
  push(sm: number, e: ViewParts['e'], arrivedClientMs: number) {
    if (this.buf.length && sm <= this.buf[this.buf.length - 1]!.sm) return; // out of order or duplicate
    this.buf.push({ sm, e, arrived: arrivedClientMs }); if (this.buf.length > 8) this.buf.shift();
  }
  clear() { this.buf = []; }
  get size() { return this.buf.length; }
  latest(): Buf | undefined { return this.buf[this.buf.length - 1]; }
  /** Learn the clock offset from a pong (client-send time, server time at reply, client-receive time). */
  sample(sentClient: number, serverMs: number, recvClient: number) {
    const rtt = recvClient - sentClient; if (rtt < 0) return; if (rtt <= this.bestRtt * 1.25 + 4 || this.bestRtt === Infinity) { this.offset = serverMs + rtt / 2 - recvClient; this.bestRtt = Math.min(this.bestRtt, rtt); } else this.bestRtt = this.bestRtt * 1.02 + 0.5; // slowly forget an old low sample
  }
  /** Staleness: how long since the newest snapshot, in client ms. */
  staleness(nowClient: number) { const l = this.buf[this.buf.length - 1]; return l ? nowClient - l.arrived : Infinity; }
  /** Entities at server-time `t`. Groups: p (players), e (enemies), b (bullets), h (hazards), t (turrets), d (drones). Positions are x=[0],y=[1] for p/e? (see index map). */
  at(t: number): { a: Buf; b: Buf; k: number } | null {
    const n = this.buf.length; if (!n) return null; if (n === 1 || t >= this.buf[n - 1]!.sm) { const l = this.buf[n - 1]!; return { a: l, b: l, k: 0 }; }
    if (t <= this.buf[0]!.sm) return { a: this.buf[0]!, b: this.buf[0]!, k: 0 };
    for (let i = n - 1; i > 0; i--) { const a = this.buf[i - 1]!, b = this.buf[i]!; if (t >= a.sm && t <= b.sm) return { a, b, k: (t - a.sm) / Math.max(1, b.sm - a.sm) }; }
    return { a: this.buf[n - 1]!, b: this.buf[n - 1]!, k: 0 };
  }
}
/** Position index of each group's array: players [x,y,…], enemies [kind,x,y,…], bullets [x,y,…], turrets [x,y,…], drones [x,y]. */
export const POS: Record<string, [number, number]> = { p: [0, 1], e: [1, 2], b: [0, 1], t: [0, 1], d: [0, 1], h: [1, 2] };
export function lerpEntity(group: string, a: number[] | undefined, b: number[], k: number): number[] {
  if (!a || k <= 0) return b; const [xi, yi] = POS[group]!; const out = b.slice(); out[xi] = a[xi]! + (b[xi]! - a[xi]!) * k; out[yi] = a[yi]! + (b[yi]! - a[yi]!) * k;
  // a teleport (dash, respawn, wind-up of a charge) larger than 90 units is shown at the new place instead of sliding across the arena
  if (Math.hypot(b[xi]! - a[xi]!, b[yi]! - a[yi]!) > 90) { out[xi] = b[xi]!; out[yi] = b[yi]!; }
  return out;
}
export function sampleGroup(group: string, s: { a: Buf; b: Buf; k: number }): Record<string, number[]> {
  const out: Record<string, number[]> = {}; const A = s.a.e[group] ?? {}; const B = s.b.e[group] ?? {};
  for (const id of Object.keys(B)) out[id] = lerpEntity(group, A[id], B[id]!, s.k);
  return out;
}
