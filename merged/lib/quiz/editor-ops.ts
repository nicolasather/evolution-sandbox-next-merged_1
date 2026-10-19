/** Pure question-list operations for the editor (items 017, 018, 048). Every function returns a NEW array. */
import type { Loose } from './loose';
import { carryOverMedia } from './media';
import { questionSchema } from './validation';
import { uid } from './editor-model';
import type { Question } from './types';

export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return [...arr];
  const c = [...arr]; const [x] = c.splice(from, 1); c.splice(to, 0, x!); return c;
}
export const moveBy = <T,>(arr: readonly T[], i: number, d: -1 | 1) => moveItem(arr, i, i + d);
export function removeMany<T>(arr: readonly T[], indexes: Iterable<number>): T[] { const drop = new Set(indexes); return arr.filter((_, i) => !drop.has(i)); }
export function duplicateAt(arr: readonly Question[], i: number): Question[] {
  const c = reid(arr[i]!); const out = [...arr]; out.splice(i + 1, 0, c); return out;
}

/** Fresh, consistent ids for every option/tile/statement, in both the payload and the answer key. The copy never shares ids with the original. */
export function reid(q: Question, make: (p: string) => string = uid): Question {
  const copy = JSON.parse(JSON.stringify(q)) as Question & { id?: string };
  delete copy.id;
  const map = new Map<string, string>();
  const collect = (v: Loose) => { if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') { if (typeof v.id === 'string' && !map.has(v.id)) map.set(v.id, make(v.id.slice(0, 1) || 'x')); Object.values(v).forEach(collect); } };
  collect(copy.payload);
  const remap = (v: Loose, keyed: boolean): Loose => {
    if (Array.isArray(v)) return v.map((x) => remap(x, keyed));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [map.get(k) ?? k, remap(x, keyed)]));
    return typeof v === 'string' && map.has(v) ? map.get(v)! : v;
  };
  copy.payload = remap(copy.payload, false);
  copy.answerKey = remap(copy.answerKey, true);
  return copy;
}

/* ── Sections ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export const sectionOf = (q: Question) => ((q.payload as { meta?: { section?: string } }).meta?.section ?? '').trim();
export function setSection(qs: readonly Question[], indexes: number[], section: string): Question[] {
  const pick = new Set(indexes);
  return qs.map((q, i) => {
    if (!pick.has(i)) return q;
    const meta = { ...((q.payload as Loose).meta ?? {}) } as Record<string, unknown>;
    if (section.trim()) meta.section = section.trim().slice(0, 80); else delete meta.section;
    const payload = { ...q.payload, meta } as Record<string, unknown>;
    if (!Object.keys(meta).length) delete payload.meta;
    return { ...q, payload };
  });
}
/** Orders questions so each section is contiguous (stable inside a section). Unsectioned questions stay first. */
export function groupBySection(qs: readonly Question[]): Question[] {
  const order: string[] = ['']; qs.forEach((q) => { const s = sectionOf(q); if (!order.includes(s)) order.push(s); });
  return order.flatMap((s) => qs.filter((q) => sectionOf(q) === s));
}

/* ── Copy / paste between quizzes the creator owns (018) ───────────────────────────────────────────────────────────────── */
export const CLIPBOARD_SCHEMA = 'quiz-studio.questions';
export function toClipboard(qs: readonly Question[], ownerId: string | null): string { return JSON.stringify({ schema: CLIPBOARD_SCHEMA, version: 1, ownerId, questions: qs }); }
export type PasteResult = { ok: true; questions: Question[]; dropped: string[]; problems: string[] } | { ok: false; error: string };
/** Pasted questions get fresh ids. Media the person does not own, or that no longer exists, is removed and reported — never silently kept as a broken link. */
export function fromClipboard(text: string, ownerId: string | null, mediaExists: (path: string) => boolean = () => true): PasteResult {
  let raw: Loose; try { raw = JSON.parse(text); } catch { return { ok: false, error: 'The clipboard does not contain Quiz Studio questions.' }; }
  if (raw?.schema !== CLIPBOARD_SCHEMA || !Array.isArray(raw.questions)) return { ok: false, error: 'The clipboard does not contain Quiz Studio questions.' };
  const out: Question[] = []; const dropped: string[] = []; const problems: string[] = [];
  raw.questions.forEach((q: Question, i: number) => {
    const r = ownerId ? carryOverMedia(q, ownerId, mediaExists) : { question: stripAllMedia(q, dropped), dropped: [] as string[] };
    dropped.push(...r.dropped);
    const fresh = reid(r.question);
    const check = questionSchema.safeParse(fresh);
    if (check.success) out.push(fresh); else problems.push(`Question ${i + 1} could not be pasted: ${check.error.issues[0]!.message}`);
  });
  return { ok: true, questions: out, dropped, problems };
}
function stripAllMedia(q: Question, dropped: string[]): Question {
  const walk = (v: Loose): Loose => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      if ((v.type === 'image' || v.type === 'video' || v.type === 'audio') && typeof v.ref === 'string' && v.ref.startsWith('quiz-media/')) { dropped.push(v.ref); return undefined; }
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]).filter(([, x]) => x !== undefined));
    }
    return v;
  };
  return { ...q, payload: walk(q.payload) };
}

/* ── Field-level errors with focus links (019) ─────────────────────────────────────────────────────────────────────────── */
export type FieldError = { questionIndex: number; path: (string | number)[]; message: string; anchor: string };
export const anchorId = (qi: number, path: (string | number)[]) => `qf-${qi}-${path.filter((p) => p !== 'payload' && p !== 'answerKey').join('-') || 'prompt'}`;
export function fieldErrors(qs: readonly Question[]): FieldError[] {
  const out: FieldError[] = [];
  qs.forEach((q, qi) => {
    const r = questionSchema.safeParse(q);
    if (r.success) return;
    r.error.issues.forEach((is) => out.push({ questionIndex: qi, path: is.path as (string | number)[], message: is.message, anchor: anchorId(qi, is.path as (string | number)[]) }));
  });
  return out;
}
