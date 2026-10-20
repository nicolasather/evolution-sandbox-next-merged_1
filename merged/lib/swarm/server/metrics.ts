/** Tiny dependency-free metrics: counters and bounded histograms, rendered in Prometheus text format. */
export class Metrics {
  private c = new Map<string, number>(); private h = new Map<string, { n: number; sum: number; max: number; last: number[] }>(); gauges = new Map<string, () => number>();
  inc(k: string, by = 1) { this.c.set(k, (this.c.get(k) ?? 0) + by); }
  get(k: string) { return this.c.get(k) ?? 0; }
  observe(k: string, v: number) { const x = this.h.get(k) ?? { n: 0, sum: 0, max: 0, last: [] }; x.n++; x.sum += v; if (v > x.max) x.max = v; x.last.push(v); if (x.last.length > 512) x.last.shift(); this.h.set(k, x); }
  stats(k: string) { const x = this.h.get(k); if (!x || !x.n) return { n: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 }; const s = [...x.last].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!; return { n: x.n, avg: x.sum / x.n, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: x.max }; }
  render(): string {
    const out: string[] = [];
    for (const [k, v] of [...this.c].sort()) out.push(`swarm_${k.replace(/[^a-z0-9_]/gi, '_')}_total ${v}`);
    for (const k of [...this.h.keys()].sort()) { const s = this.stats(k); for (const [n, v] of Object.entries(s)) out.push(`swarm_${k}_${n} ${Number(v.toFixed(3))}`); }
    for (const [k, f] of this.gauges) out.push(`swarm_${k} ${f()}`);
    return out.join('\n') + '\n';
  }
}
