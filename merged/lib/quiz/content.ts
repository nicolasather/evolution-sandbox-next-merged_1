/** Content-quality tools for creators (items 044, 046, 047, 048, 049, 050). Pure. Nothing here edits or deletes a question:
 *  every function reports findings and the creator decides. */
import type { Loose } from './loose';
import { normalizeText } from './text';
import { questionSchema } from './validation';
import { explainIssue } from './explain';
import type { Question } from './types';

/* ── Duplicates (044) ──────────────────────────────────────────────────────────────────────────────────────────────────── */
const key = (s: string) => normalizeText(s, { diacritics: 'ignore', punctuation: 'ignore' });
const tokens = (s: string) => new Set(key(s).split(' ').filter((t) => t.length > 1));
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1;
  let inter = 0; a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / (a.size + b.size - inter);
}
/** What a question "asks and answers" in plain text, used to tell a true repeat from a similar-but-different question. */
export function answerSignature(q: Question): string {
  const ak: Loose = q.answerKey; const pl: Loose = q.payload;
  switch (q.kind) {
    case 'multiple_choice': return (ak.correctIds as string[]).map((id) => key(pl.options.find((o: Loose) => o.id === id)?.text ?? '')).sort().join('|');
    case 'answer_forge': return (ak.accepted as string[]).map(key).sort().join('|');
    case 'connection_rush': return (ak.pairs as Loose[]).map((p) => `${key(pl.left.find((x: Loose) => x.id === p.leftId)?.label ?? '')}>${key(pl.right.find((x: Loose) => x.id === p.rightId)?.label ?? '')}`).sort().join('|');
    case 'truth_hunt': return pl.statements.map((s: Loose) => `${key(s.text)}=${ak.truth[s.id]}`).sort().join('|');
    case 'fill_table': return Object.entries(ak.cells as Record<string, string[]>).sort().map(([k, v]) => `${k}:${v.map(key).sort().join('/')}`).join('|');
  }
}
export type DuplicateFinding = { index: number; other: number | string; kind: 'exact' | 'near'; similarity: number; sameAnswer: boolean; note: string };
/** Compare `candidates` with `existing`. Exact = same prompt and answer. Near = very similar wording; flagged with whether the answers also match,
 *  so a creator can keep "Capital of France?" and "Capital of Spain?" (similar wording, different answers) without being nagged. */
export function findDuplicates(candidates: Question[], existing: { id: string | number; q: Question }[] = [], threshold = 0.82): DuplicateFinding[] {
  const out: DuplicateFinding[] = [];
  const pool = [...existing.map((e) => ({ id: e.id, q: e.q, ext: true })), ...candidates.map((q, i) => ({ id: i, q, ext: false }))];
  const toks = pool.map((p) => tokens(p.q.prompt));
  const sig = pool.map((p) => answerSignature(p.q));
  const start = existing.length;
  for (let i = start; i < pool.length; i++) {
    for (let j = 0; j < i; j++) {
      const pi = pool[i]!; const pj = pool[j]!;
      if (pi.q.kind !== pj.q.kind) continue;
      const exactPrompt = key(pi.q.prompt) === key(pj.q.prompt);
      const sim = exactPrompt ? 1 : jaccard(toks[i]!, toks[j]!);
      if (sim < threshold) continue;
      const sameAnswer = sig[i] === sig[j];
      const exact = exactPrompt && sameAnswer;
      out.push({ index: pi.id as number, other: pj.id, kind: exact ? 'exact' : 'near', similarity: Math.round(sim * 100) / 100, sameAnswer,
        note: exact ? 'Same question and same answer.' : sameAnswer ? 'Very similar wording and the same answer.' : 'Similar wording but a different answer — probably intentional, so it is kept.' });
    }
  }
  return out;
}

/* ── Question-quality checklist (047) and AI-draft evidence (046) ──────────────────────────────────────────────────────── */
export type QualityIssue = { code: string; severity: 'warn' | 'info'; message: string; field?: string };
const ABSOLUTES = /\b(always|never|all of the above|none of the above|only|every|tất cả|không bao giờ|luôn luôn)\b/i;
const NEGATIVE = /\b(not|except|least|false|incorrect|không phải|ngoại trừ)\b/i;

export function checkQuality(q: Question): QualityIssue[] {
  const out: QualityIssue[] = [];
  const add = (code: string, message: string, severity: QualityIssue['severity'] = 'warn', field?: string) => out.push({ code, severity, message, field });
  const p = q.prompt.trim();
  if (p.length > 0 && p.length < 8) add('short-stem', 'The question is very short. Add enough context that only one reading is possible.', 'warn', 'prompt');
  if (p.length > 300) add('long-stem', 'The question is over 300 characters. Short stems are easier to read on a phone.', 'info', 'prompt');
  if (p && q.kind !== 'truth_hunt' && q.kind !== 'fill_table' && q.kind !== 'connection_rush' && !/[?？:]\s*$/.test(p) && !/\b(name|give|type|write|state|list|enter|điền|nêu|hãy)\b/i.test(p)) add('no-question-mark', 'The stem does not end with a question mark or a clear instruction.', 'info', 'prompt');
  if (/\s{2,}/.test(q.prompt) || /\b(\w+)\s+\1\b/i.test(p)) add('grammar', 'Check the wording: there is a repeated word or extra spacing.', 'info', 'prompt');
  if (p && /^[a-zà-ỹ]/.test(p)) add('capital', 'The question starts with a lowercase letter.', 'info', 'prompt');
  if ((p.match(/\b(not|no|never|except)\b/gi) ?? []).length >= 2) add('double-negative', 'Two negatives in one stem are easy to misread. Rephrase positively if you can.', 'warn', 'prompt');
  if (NEGATIVE.test(p) && q.kind === 'multiple_choice') add('negative-stem', 'A negative stem ("not", "except") — consider writing the negative word in capitals so it is not missed.', 'info', 'prompt');

  if (q.kind === 'multiple_choice') {
    const o: { id: string; text: string }[] = (q.payload as Loose).options;
    const correct = new Set((q.answerKey as Loose).correctIds as string[]);
    const texts = o.map((x) => key(x.text));
    if (new Set(texts).size !== texts.length) add('duplicate-options', 'Two options say the same thing after tidying, so more than one could be right.', 'warn', 'options');
    const right = o.filter((x) => correct.has(x.id)); const wrong = o.filter((x) => !correct.has(x.id));
    if (wrong.length) {
      const avg = wrong.reduce((n, x) => n + x.text.length, 0) / wrong.length;
      if (right.some((x) => x.text.length > avg * 1.6 && x.text.length > 25)) add('long-correct', 'The correct option is much longer than the others, which can give it away.', 'warn', 'options');
      if (right.some((x) => x.text.length < avg * 0.4 && avg > 25)) add('short-correct', 'The correct option is much shorter than the others.', 'info', 'options');
    }
    if (o.some((x) => ABSOLUTES.test(x.text))) add('absolutes', 'Words like "always", "never" or "all of the above" make options easy to rule in or out.', 'info', 'options');
    if (o.some((x) => x.text.length > 120)) add('long-option', 'An option is over 120 characters.', 'info', 'options');
    if (o.length === 2) add('two-options', 'Only two options means a 50 % chance of guessing. Three or four is fairer.', 'info', 'options');
    if (o.length > 1 && !(q.answerKey as Loose).distractorNotes) add('no-distractor-notes', 'Add a note on why wrong options are wrong to turn mistakes into learning.', 'info', 'explanation');
  }
  if (q.kind === 'answer_forge') {
    const a: string[] = (q.answerKey as Loose).accepted; const k = a.map(key);
    if (new Set(k).size !== k.length) add('duplicate-aliases', 'Two accepted answers are the same after tidying.', 'info', 'accepted');
    if (a.length === 1 && a[0] && a[0].length > 40) add('long-answer', 'A long typed answer is hard to match exactly. Consider Multiple Choice or add alternatives.', 'warn', 'accepted');
  }
  if (q.kind === 'truth_hunt') {
    const vals = Object.values((q.answerKey as Loose).truth as Record<string, boolean>);
    if (vals.length >= 3 && (vals.every(Boolean) || vals.every((v) => !v))) add('all-same', 'Every statement has the same answer, so players can guess the pattern.', 'warn', 'statements');
  }
  if (!(q.answerKey as Loose).explanation) add('no-explanation', 'No explanation yet. Players learn most when they see why an answer is right.', 'info', 'explanation');
  return out;
}

/** Facts and numbers in an AI draft need a human check. Unsupported ones stay "unverified" (item 046). */
export function evidenceWarnings(q: Question): string[] {
  const meta = (q.payload as Loose).meta as { aiDraft?: boolean; verified?: boolean; evidence?: string } | undefined;
  if (!meta?.aiDraft) return [];
  const w: string[] = [];
  const text = JSON.stringify([q.prompt, q.payload, q.answerKey]);
  const hasFacts = /\d/.test(text) || /\b(in|on|since|before|after)\s+(1\d{3}|20\d{2})\b/.test(text);
  if (hasFacts && !meta.evidence?.trim()) w.push('This draft contains numbers or dates but no source. Add where you checked them.');
  if (!meta.verified) w.push('A person has not marked this AI draft as verified yet. It is shown to players as written, so check every answer first.');
  return w;
}
/** Drafts from an assistant are labelled and never publish themselves. */
export function canPublish(qs: Question[]): { ok: boolean; blocked: number[] } {
  const blocked = qs.map((q, i) => ((q.payload as Loose).meta?.aiDraft && !(q.payload as Loose).meta?.verified ? i : -1)).filter((i) => i >= 0);
  return { ok: blocked.length === 0, blocked };
}

/* ── Grouping by topic, difficulty and objective (048) ─────────────────────────────────────────────────────────────────── */
export type GroupBy = 'topic' | 'difficulty' | 'objective' | 'section';
export function groupQuestions(qs: Question[], by: GroupBy): Map<string, number[]> {
  const m = new Map<string, number[]>();
  qs.forEach((q, i) => {
    const g = ((q.payload as Loose).meta?.[by] as string | undefined)?.trim() || 'Ungrouped';
    (m.get(g) ?? m.set(g, []).get(g)!).push(i);
  });
  return m;
}
/** A review sequence drawn from groups, without editing the bank. Deterministic for a given seed. */
export function reviewSequence(qs: Question[], filter: { topic?: string; difficulty?: string; objective?: string }, limit = 20): number[] {
  return qs.map((q, i) => ({ i, m: (q.payload as Loose).meta ?? {} }))
    .filter(({ m }) => (!filter.topic || m.topic === filter.topic) && (!filter.difficulty || m.difficulty === filter.difficulty) && (!filter.objective || m.objective === filter.objective))
    .slice(0, limit).map((x) => x.i);
}

/* ── Localisation helpers (049) ────────────────────────────────────────────────────────────────────────────────────────── */
export type Locale = 'en' | 'vi';
export const UI: Record<Locale, Record<string, string>> = {
  en: { true: 'True', false: 'False', submit: 'Submit answer', next: 'Next', correct: 'Correct', incorrect: 'Not correct', score: 'Score', question: 'Question', hint: 'Hint', explanation: 'Explanation' },
  vi: { true: 'Đúng', false: 'Sai', submit: 'Nộp đáp án', next: 'Tiếp theo', correct: 'Chính xác', incorrect: 'Chưa đúng', score: 'Điểm', question: 'Câu hỏi', hint: 'Gợi ý', explanation: 'Giải thích' },
};
export const t = (locale: string, k: string) => UI[(locale in UI ? locale : 'en') as Locale][k] ?? UI.en[k] ?? k;

export type Translation = Record<number, { prompt?: string; texts?: Record<string, string> }>;
/** Duplicate a quiz into another language. The source is returned untouched; ids and answer keys are kept; the copy is revalidated. */
export function duplicateIntoLanguage(doc: { title: string; description: string; meta?: Record<string, unknown>; questions: Question[] }, lang: string, translation: Translation = {}) {
  const copy = JSON.parse(JSON.stringify(doc)) as typeof doc;
  copy.title = `${doc.title} (${lang})`;
  copy.meta = { ...(doc.meta ?? {}), language: lang };
  copy.questions.forEach((q, i) => {
    const tr = translation[i]; if (!tr) return;
    if (tr.prompt) q.prompt = tr.prompt;
    if (tr.texts) { const walk = (v: Loose) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.id === 'string' && tr.texts![v.id] !== undefined) { if ('text' in v) v.text = tr.texts![v.id]; else if ('label' in v) v.label = tr.texts![v.id]; } Object.values(v).forEach(walk); } }; walk(q.payload); }
  });
  return { copy, problems: revalidate(copy.questions), source: doc };
}
export function revalidate(qs: Question[]): { index: number; message: string }[] {
  const out: { index: number; message: string }[] = [];
  qs.forEach((q, i) => { const r = questionSchema.safeParse(q); if (!r.success) out.push({ index: i, message: explainIssue({ path: ['questions', i, ...(r.error.issues[0]!.path as (string | number)[])], message: r.error.issues[0]!.message, code: r.error.issues[0]!.code }) }); });
  return out;
}
/** Everything a translator needs: each visible string with the id that identifies it (answer keys are never shown here). */
export function translatableStrings(q: Question): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const walk = (v: Loose) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (typeof v.id === 'string') { if (typeof v.text === 'string' && v.text) out.push({ id: v.id, text: v.text }); else if (typeof v.label === 'string' && v.label) out.push({ id: v.id, text: v.label }); } Object.values(v).forEach(walk); } };
  walk(q.payload);
  return out;
}

/* ── Revision history (050) ────────────────────────────────────────────────────────────────────────────────────────────── */
export type Snapshot = { id: string; takenAt: string; label: string; hash: string; doc: { title: string; description: string; meta?: Record<string, unknown>; questions: Question[] } };
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Loose)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export function hashDoc(doc: unknown): string {
  const s = stable(doc); let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
function deepFreeze<T>(o: T): T { if (o && typeof o === 'object') { Object.values(o as object).forEach(deepFreeze); Object.freeze(o); } return o; }
/** An immutable copy: later edits to the live quiz can never change it. */
export function takeSnapshot(doc: Snapshot['doc'], label: string, now = new Date()): Snapshot {
  const copy = JSON.parse(JSON.stringify(doc)) as Snapshot['doc'];
  const hash = hashDoc(copy);
  return deepFreeze({ id: `${now.getTime().toString(36)}-${hash.slice(0, 6)}`, takenAt: now.toISOString(), label, hash, doc: copy });
}
/** Rolling back never destroys anything: the current state is snapshotted first, then the old one becomes current. */
export function rollback(current: Snapshot['doc'], target: Snapshot, now = new Date()): { safety: Snapshot; restored: Snapshot['doc'] } {
  return { safety: takeSnapshot(current, `Before restoring ${target.label}`, now), restored: JSON.parse(JSON.stringify(target.doc)) };
}
export function changedQuestions(a: Snapshot['doc'], b: Snapshot['doc']): { added: number; removed: number; changed: number } {
  const n = Math.max(a.questions.length, b.questions.length); let changed = 0;
  for (let i = 0; i < Math.min(a.questions.length, b.questions.length); i++) if (stable(a.questions[i]) !== stable(b.questions[i])) changed++;
  return { added: Math.max(0, b.questions.length - a.questions.length), removed: Math.max(0, a.questions.length - b.questions.length), changed: n ? changed : 0 };
}
