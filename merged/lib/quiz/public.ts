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
  if (kind === 'multiple_choice') {
    // Display order is shuffled per player/attempt, but grading uses stable option ids, so the order never matters to the key.
    const options = Array.isArray(payload.options) ? (payload.options as unknown[]) : [];
    return payload.shuffle === false ? payload : { ...payload, options: seededShuffle(options, seed) };
  }
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

export type StoredQuestion = { id: string; position: number; kind: string; prompt: string; payload: Record<string, unknown>; answer_key: Record<string, unknown>; base_points: number };
/** The ONLY shape a player may receive for a live question. The answer key (with the explanation, hint and distractor notes) is added
 *  only after reveal, or for a host who explicitly peeks. Used by the room state route and covered by tests for all five formats (item 134). */
export function publicQuestionView(row: StoredQuestion, opts: { reveal: boolean; hostPeek?: boolean; seed: string }) {
  const out: Record<string, unknown> = {
    id: row.id, position: row.position, kind: row.kind, prompt: row.prompt, base_points: row.base_points,
    payload: publicPayload(row.kind, row.payload, opts.seed),
    hasHint: typeof row.answer_key?.hint === 'string' && row.answer_key.hint.length > 0,
  };
  if (opts.reveal || opts.hostPeek) out.answerKey = row.answer_key;
  return out;
}
/** Hints are released by a separate call so the first response never carries them (item 028). */
export function hintOf(row: Pick<StoredQuestion, 'answer_key'>): string | null {
  const h = row.answer_key?.hint; return typeof h === 'string' && h.trim() ? h : null;
}
