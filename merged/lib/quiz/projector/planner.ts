/** Question selection. Questions come from the room's own room_questions only; nothing is generated. */
import type { QuestionKind } from '../types';
import type { Difficulty, PoolQuestion } from './types';

const FORMAT_DIFFICULTY: Record<QuestionKind, Difficulty> = { multiple_choice: 1, truth_hunt: 1, answer_forge: 2, connection_rush: 2, fill_table: 3 };
const AUTHOR: Record<string, Difficulty> = { easy: 1, medium: 2, hard: 3 };

export type RoomQuestionRow = { id: string; position: number; kind: QuestionKind; payload?: Record<string, unknown> | null; answer_key?: Record<string, unknown> | null };

/** Difficulty is the author's label when present, otherwise the complexity of the question FORMAT — never inferred from answer time. */
export function poolFromRows(rows: readonly RoomQuestionRow[]): PoolQuestion[] {
  const originalPos = new Map<string, number>();
  return rows.slice().sort((a, b) => a.position - b.position).map((r) => {
    const meta = ((r.payload ?? {}) as { meta?: { topic?: string; difficulty?: string; objective?: string; repeatOf?: number } }).meta ?? {};
    const topic = (meta.topic ?? meta.objective ?? '').trim() || null;
    const author = meta.difficulty ? AUTHOR[meta.difficulty] : undefined;
    const key = `${r.kind}:${topic ?? ''}:${r.id}`;
    if (!originalPos.has(key)) originalPos.set(key, r.position);
    const expl = typeof (r.answer_key ?? {}).explanation === 'string' && String((r.answer_key ?? {}).explanation).trim().length > 0;
    return {
      position: r.position, id: r.id, kind: r.kind, topic, difficulty: author ?? FORMAT_DIFFICULTY[r.kind], difficultySource: author ? 'author' : 'format',
      hasExplanation: expl, repeatOf: typeof meta.repeatOf === 'number' ? meta.repeatOf : null,
    } satisfies PoolQuestion;
  });
}

export function topicsOf(pool: readonly PoolQuestion[]): string[] {
  const seen: string[] = [];
  for (const p of pool) if (p.topic && !seen.includes(p.topic)) seen.push(p.topic);
  return seen;
}

export type Want = { topic?: string | null; difficulty?: Difficulty | null; kinds?: readonly QuestionKind[]; avoidTopics?: readonly string[] };
export type Pick = { position: number; topicFallback: boolean; repeat: boolean } | null;

/** Order of preference: unused original with topic+difficulty → topic → difficulty → any unused original; then labelled repeats. */
export function pickQuestion(pool: readonly PoolQuestion[], used: readonly number[], want: Want = {}): Pick {
  const free = pool.filter((p) => !used.includes(p.position));
  const run = (cands: PoolQuestion[], topicFallback: boolean, repeat: boolean): Pick => {
    const kindFiltered = want.kinds?.length ? cands.filter((c) => want.kinds!.includes(c.kind)) : cands;
    const c = kindFiltered.length ? kindFiltered : cands;
    if (!c.length) return null;
    const first = c.slice().sort((a, b) => a.position - b.position)[0]!;
    return { position: first.position, topicFallback, repeat };
  };
  for (const repeat of [false, true]) {
    const set = free.filter((p) => (p.repeatOf !== null) === repeat);
    if (!set.length) continue;
    const t = want.topic ?? null, d = want.difficulty ?? null;
    const byTopic = t ? set.filter((p) => p.topic === t) : [];
    const a = run(byTopic.filter((p) => d === null || p.difficulty === d), false, repeat); if (a && t) return a;
    const b = run(byTopic, false, repeat); if (b && t) return b;
    if (!t) { const c = run(set.filter((p) => d === null || p.difficulty === d), false, repeat); if (c) return c; }
    const nearD = d ? set.filter((p) => p.difficulty !== null && Math.abs(p.difficulty - d) <= 1) : [];
    const e = run(nearD, !!t, repeat); if (e) return e;
    const f = run(set, !!t, repeat); if (f) return f;
  }
  return null;
}
