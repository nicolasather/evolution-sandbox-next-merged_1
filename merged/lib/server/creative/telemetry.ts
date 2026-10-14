/* Ticket 087 — counters + one structured log line per request. No ingredient lists, no addresses, no keys:
   only the outcome kind, status, latency and a short correlation id. In-process (per instance); durable numbers
   (spend, compute states, proposals) come from the database via the owner metrics endpoint. */

export class Metrics {
  private c = new Map<string, number>();
  private lat = { n: 0, sumMs: 0, maxMs: 0 };
  inc(name: string, by = 1) { this.c.set(name, (this.c.get(name) ?? 0) + by); }
  observe(ms: number) { this.lat.n++; this.lat.sumMs += ms; this.lat.maxMs = Math.max(this.lat.maxMs, ms); }
  snapshot() {
    return { counters: Object.fromEntries([...this.c].sort()), latency: { count: this.lat.n, avgMs: this.lat.n ? Math.round(this.lat.sumMs / this.lat.n) : 0, maxMs: Math.round(this.lat.maxMs) } };
  }
  reset() { this.c.clear(); this.lat = { n: 0, sumMs: 0, maxMs: 0 }; }
}

export const metrics = new Metrics();

export const newRequestId = (): string => (globalThis.crypto?.randomUUID?.() ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).slice(0, 36);

export function logRequest(f: { requestId: string; status: number; kind: string; ms: number }, sink: (line: string) => void = l => console.info(l)): void {
  sink(JSON.stringify({ evt: 'creative.try', ...f }));
}
