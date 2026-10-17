/** Turn a stored question payload into what a player may see. Pure and deterministic (no server-only imports). */
import type { QuestionKind } from './types';

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Seeded Fisher–Yates. Guarantees the result differs from the input order whenever that is possible. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = mulberry32(hash32(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

export function publicPayload(kind: QuestionKind | string, payload: Record<string, unknown>, seed: string): Record<string, unknown> {
  if (kind === 'connection_rush') {
    const right = Array.isArray(payload.right) ? (payload.right as unknown[]) : [];
    return { ...payload, right: seededShuffle(right, seed) };
  }
  if (kind === 'fill_table') {
    const rows = Array.isArray(payload.rows) ? (payload.rows as { text: string; blank: boolean }[][]) : [];
    return { ...payload, rows: rows.map((row) => row.map((c) => (c.blank ? { text: '', blank: true } : c))) };
  }
  return payload;
}
