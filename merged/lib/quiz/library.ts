/** Library discovery, collections, bulk operations, remix and reporting rules (items 051-060). Pure. */
import { normalizeText } from './text';
import type { Question } from './types';
import { reid } from './editor-ops';

export type LibraryQuiz = {
  id: string; title: string; description: string; updatedAt: string; ownerId?: string; ownerName?: string;
  questionCount: number; questions?: Pick<Question, 'kind' | 'prompt' | 'payload'>[];
  meta?: { subject?: string; language?: string; ageBand?: string; tags?: string[]; cover?: unknown; sourceId?: string; sourceTitle?: string; sourceAuthor?: string };
  saves?: number; verified?: boolean; reviewState?: 'unreviewed' | 'approved' | 'flagged'; hasMedia?: boolean; estimatedSeconds?: number;
};

const fold = (s: string) => normalizeText(s, { diacritics: 'ignore', punctuation: 'ignore' });

/** Damerau-style distance, used ONLY to rank search results (never to grade answers). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
  }
  return dp[a.length]![b.length]!;
}

/** Relevance of a quiz to a query: title > tags/subject > description > question text; tolerant of case, diacritics and one-two typos. */
export function relevance(quiz: LibraryQuiz, query: string): number {
  const terms = fold(query).split(' ').filter(Boolean);
  if (!terms.length) return 1;
  const fields: [string, number][] = [
    [fold(quiz.title), 5], [fold([quiz.meta?.subject ?? '', ...(quiz.meta?.tags ?? [])].join(' ')), 3], [fold(quiz.description), 2],
    [fold((quiz.questions ?? []).map((q) => q.prompt).join(' ')), 1],
  ];
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const [text, weight] of fields) {
      if (!text) continue;
      if (text.includes(term)) { best = Math.max(best, weight); continue; }
      if (term.length >= 4) {
        const tol = term.length >= 8 ? 2 : 1;
        for (const w of text.split(' ')) if (Math.abs(w.length - term.length) <= tol && editDistance(w, term, tol) <= tol) { best = Math.max(best, weight * 0.6); break; }
      }
    }
    if (best === 0) return 0; // every term must match somewhere
    total += best;
  }
  return total;
}

export type Filters = {
  subject?: string; ageBand?: string; language?: string; kind?: string; minSeconds?: number; maxSeconds?: number; hasMedia?: boolean; verifiedOnly?: boolean;
};
export function matchesFilters(q: LibraryQuiz, f: Filters): boolean {
  if (f.subject && fold(q.meta?.subject ?? '') !== fold(f.subject)) return false;
  if (f.ageBand && q.meta?.ageBand !== f.ageBand) return false;
  if (f.language && q.meta?.language !== f.language) return false;
  if (f.kind && !(q.questions ?? []).some((x) => x.kind === f.kind)) return false;
  if (f.minSeconds !== undefined && (q.estimatedSeconds ?? 0) < f.minSeconds) return false;
  if (f.maxSeconds !== undefined && (q.estimatedSeconds ?? 0) > f.maxSeconds) return false;
  if (f.hasMedia !== undefined && !!q.hasMedia !== f.hasMedia) return false;
  if (f.verifiedOnly && !isVerified(q)) return false;
  return true;
}
/** "Creator-verified quality" is only ever shown for items a moderator approved (item 060). Popularity never implies it (054). */
export function isVerified(q: Pick<LibraryQuiz, 'verified' | 'reviewState'>): boolean { return q.verified === true && q.reviewState === 'approved'; }

export type SortKey = 'relevance' | 'recent' | 'saves' | 'verified';
export function searchLibrary(all: LibraryQuiz[], opts: { query?: string; filters?: Filters; sort?: SortKey }): LibraryQuiz[] {
  const scored = all.filter((q) => matchesFilters(q, opts.filters ?? {})).map((q) => ({ q, r: relevance(q, opts.query ?? '') })).filter((x) => x.r > 0);
  const sort = opts.sort ?? (opts.query ? 'relevance' : 'recent');
  const byRecent = (a: LibraryQuiz, b: LibraryQuiz) => b.updatedAt.localeCompare(a.updatedAt);
  scored.sort((a, b) => {
    switch (sort) {
      case 'relevance': return b.r - a.r || byRecent(a.q, b.q);
      case 'saves': return (b.q.saves ?? 0) - (a.q.saves ?? 0) || byRecent(a.q, b.q);
      case 'verified': return Number(isVerified(b.q)) - Number(isVerified(a.q)) || b.r - a.r || byRecent(a.q, b.q);
      default: return byRecent(a.q, b.q);
    }
  });
  return scored.map((x) => x.q);
}
export function facets(all: LibraryQuiz[]) {
  const count = (get: (q: LibraryQuiz) => string | undefined) => { const m = new Map<string, number>(); all.forEach((q) => { const v = get(q); if (v) m.set(v, (m.get(v) ?? 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
  return { subjects: count((q) => q.meta?.subject), ageBands: count((q) => q.meta?.ageBand), languages: count((q) => q.meta?.language) };
}

/* ── Collections and favourites (055) ──────────────────────────────────────────────────────────────────────────────────── */
export type Collections = { v: 1; favorites: string[]; folders: { id: string; name: string; quizIds: string[] }[] };
export const emptyCollections = (): Collections => ({ v: 1, favorites: [], folders: [] });
export function toggleFavorite(c: Collections, id: string): Collections { return { ...c, favorites: c.favorites.includes(id) ? c.favorites.filter((x) => x !== id) : [...c.favorites, id] }; }
export function addFolder(c: Collections, name: string, id: string): Collections {
  const n = name.trim().slice(0, 60); if (!n) return c;
  return c.folders.some((f) => f.name.toLowerCase() === n.toLowerCase()) ? c : { ...c, folders: [...c.folders, { id, name: n, quizIds: [] }] };
}
export function moveToFolder(c: Collections, quizIds: string[], folderId: string): Collections {
  return { ...c, folders: c.folders.map((f) => f.id === folderId ? { ...f, quizIds: [...new Set([...f.quizIds, ...quizIds])] } : { ...f, quizIds: f.quizIds.filter((q) => !quizIds.includes(q)) }) };
}
export function parseCollections(raw: string | null): Collections {
  try { const p = JSON.parse(raw ?? ''); if (p?.v === 1 && Array.isArray(p.favorites) && Array.isArray(p.folders)) return p; } catch { /* fall through */ }
  return emptyCollections();
}

/* ── My Quizzes sections and bulk operations (056, 057) ────────────────────────────────────────────────────────────────── */
export type MineItem = { id: string; title: string; status: 'draft' | 'published'; where: 'device' | 'cloud'; imported?: boolean; archived?: boolean; updatedAt: string };
export function sectionsOf(items: MineItem[], favorites: string[]) {
  const live = items.filter((i) => !i.archived);
  return {
    drafts: live.filter((i) => i.status === 'draft' && !i.imported),
    published: live.filter((i) => i.status === 'published'),
    favorites: items.filter((i) => favorites.includes(i.id)),
    imported: live.filter((i) => i.imported),
    archived: items.filter((i) => i.archived),
  };
}
export type BulkAction = 'archive' | 'unarchive' | 'duplicate' | 'move' | 'export' | 'delete';
export type BulkPlan = { action: BulkAction; ids: string[]; needsConfirm: boolean; undoable: boolean; message: string };
export function planBulk(action: BulkAction, ids: string[]): BulkPlan {
  const n = ids.length;
  return { action, ids, needsConfirm: action === 'delete', undoable: action !== 'delete' && action !== 'export',
    message: action === 'delete' ? `Permanently delete ${n} quiz${n === 1 ? '' : 'zes'}? This cannot be undone.` : `${action[0]!.toUpperCase()}${action.slice(1)} ${n} quiz${n === 1 ? '' : 'zes'}.` };
}

/* ── Remix (058) ───────────────────────────────────────────────────────────────────────────────────────────────────────── */
/** An independent copy owned by the remixer: fresh ids, visible provenance, always a private draft. The source is never writable through it. */
export function remix(source: { id: string; title: string; description: string; ownerName?: string; meta?: Record<string, unknown>; questions: Question[] }, newId: (prefix: string) => string) {
  const questions = source.questions.map((q) => reid(q, newId));
  return { title: `${source.title} (remix)`.slice(0, 160), description: source.description, status: 'draft' as const, questions,
    meta: { ...(source.meta ?? {}), sourceId: source.id, sourceTitle: source.title, sourceAuthor: source.ownerName ?? 'Unknown' } };
}

/* ── Reports and moderation signals (059, 060, 140) ────────────────────────────────────────────────────────────────────── */
export const REPORT_REASONS = ['incorrect_fact', 'broken_media', 'copyright', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = 'received' | 'in_review' | 'resolved' | 'dismissed' | 'appealed';
export const REPORT_STATUS_TEXT: Record<ReportStatus, string> = {
  received: 'Received — a moderator has not looked at it yet.', in_review: 'A moderator is reviewing it.',
  resolved: 'Resolved — the quiz was corrected, hidden or removed.', dismissed: 'Reviewed — no change was needed. You can appeal once.', appealed: 'Appeal received — a different moderator will review it.',
};
const NEXT: Record<ReportStatus, ReportStatus[]> = { received: ['in_review', 'dismissed', 'resolved'], in_review: ['resolved', 'dismissed'], dismissed: ['appealed'], appealed: ['resolved', 'dismissed'], resolved: [] };
export const canTransition = (from: ReportStatus, to: ReportStatus) => NEXT[from].includes(to);

/** Quality signals for the public library. "verified" needs an approved review; spam looks like many near-identical quizzes from one account. */
export function duplicateSpamSignal(own: { title: string; firstPrompt: string }[], candidate: { title: string; firstPrompt: string }): boolean {
  const k = (x: { title: string; firstPrompt: string }) => fold(`${x.title} ${x.firstPrompt}`);
  const c = k(candidate);
  return own.filter((o) => k(o) === c).length >= 2;
}
export function qualitySignals(q: LibraryQuiz): { label: string; ok: boolean }[] {
  return [
    { label: 'Has a description', ok: q.description.trim().length >= 20 },
    { label: 'Has at least 5 questions', ok: q.questionCount >= 5 },
    { label: 'Subject and language set', ok: !!(q.meta?.subject && q.meta?.language) },
    { label: 'Reviewed by a moderator', ok: isVerified(q) },
  ];
}
