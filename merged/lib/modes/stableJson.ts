/** Deterministic JSON: object keys sorted recursively, so the same packet always hashes the same on server and client.
 *  Keys whose value is undefined are skipped (exactly what JSON.stringify/JSONB do), so a packet hashed in memory and the
 *  same packet read back from the database or from data/mode_packets.json produce the same digest. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}
