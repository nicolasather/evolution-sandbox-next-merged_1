/** Session reports (items 101-109). Pure. Academic points (answers) and modifier effects (steals, swaps, potluck…) are always kept apart,
 *  and team-level classroom data is never presented as individual mastery. */
import type { Loose } from './loose';
import { normalizeText } from './text';
import { SCORE_NOTE } from './report-text';

export type RQuestion = { id: string; position: number; kind: string; prompt: string; basePoints: number; topic?: string; difficulty?: string; objective?: string; optionText?: Record<string, string> };
export type RSubmission = { questionId: string; actorId: string; correct: boolean; response: Loose; awarded: number; wager?: number; at: string };
export type REvent = { actorId: string; delta: number; reason: string; at?: string; undone?: boolean };
export type RActor = { id: string; name: string; points: number };
export type SessionData = {
  title: string; mode: 'solo' | 'classroom' | 'online'; startedAt: string; actors: RActor[]; questions: RQuestion[]; submissions: RSubmission[]; events: REvent[];
  /** classroom sessions are marked by the teacher, on one device */
  teacherScored?: boolean;
};
export const MODIFIER_REASONS = ['lose_all', 'go_to_first', 'steal_points', 'give_points', 'swap_points', 'potluck', 'steal_question'] as const;
const isModifier = (r: string) => (MODIFIER_REASONS as readonly string[]).includes(r);

export type ActorRow = { id: string; name: string; finalPoints: number; academicPoints: number; modifierPoints: number; answered: number; correct: number; firstAttemptAccuracy: number; rank: number; rankWithoutModifiers: number };
export function sessionReport(d: SessionData) {
  const subsBy = new Map<string, RSubmission[]>();
  d.submissions.forEach((s) => (subsBy.get(s.actorId) ?? subsBy.set(s.actorId, []).get(s.actorId)!).push(s));
  const mod = new Map<string, number>();
  d.events.filter((e) => !e.undone && isModifier(e.reason)).forEach((e) => mod.set(e.actorId, (mod.get(e.actorId) ?? 0) + e.delta));
  const rows: ActorRow[] = d.actors.map((a) => {
    const subs = subsBy.get(a.id) ?? [];
    const answered = subs.filter((s) => s.response?.kind !== 'timeout').length;
    const correct = subs.filter((s) => s.correct).length;
    const modifierPoints = mod.get(a.id) ?? 0;
    // each question is attempted once per actor in a room, so first-attempt accuracy == correct / answered
    return { id: a.id, name: a.name, finalPoints: a.points, academicPoints: a.points - modifierPoints, modifierPoints, answered, correct, firstAttemptAccuracy: answered ? correct / answered : 0, rank: 0, rankWithoutModifiers: 0 };
  });
  const rank = (key: 'finalPoints' | 'academicPoints', into: 'rank' | 'rankWithoutModifiers') => { [...rows].sort((a, b) => b[key] - a[key]).forEach((r, i, arr) => { r[into] = i > 0 && arr[i - 1]![key] === r[key] ? arr[i - 1]![into] : i + 1; }); };
  rank('finalPoints', 'rank'); rank('academicPoints', 'rankWithoutModifiers');
  const totalAnswers = rows.reduce((n, r) => n + r.answered, 0);
  return {
    title: d.title, mode: d.mode, teamLevel: d.mode === 'classroom' || d.teacherScored === true,
    attendance: d.actors.length, questions: d.questions.length, totalAnswered: totalAnswers,
    classAccuracy: totalAnswers ? rows.reduce((n, r) => n + r.correct, 0) / totalAnswers : 0,
    rows: rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)), note: SCORE_NOTE,
    caveat: d.mode === 'classroom' ? 'These are team-level results marked by the teacher on one device. They are observations, not individual student diagnostics.' : undefined,
  };
}

/** Impact of each modifier on final standings (109). */
export function modifierImpact(d: SessionData) {
  const byReason = new Map<string, { reason: string; uses: number; gained: number; lost: number }>();
  d.events.filter((e) => !e.undone && isModifier(e.reason)).forEach((e) => {
    const r = byReason.get(e.reason) ?? byReason.set(e.reason, { reason: e.reason, uses: 0, gained: 0, lost: 0 }).get(e.reason)!;
    r.uses++; if (e.delta >= 0) r.gained += e.delta; else r.lost += -e.delta;
  });
  const rep = sessionReport(d);
  return { byReason: [...byReason.values()], rankChanges: rep.rows.filter((r) => r.rank !== r.rankWithoutModifiers).map((r) => ({ name: r.name, rank: r.rank, withoutModifiers: r.rankWithoutModifiers })) };
}

/* ── Questions: distribution and common wrong answers (102) ────────────────────────────────────────────────────────────── */
export type Viewer = { role: 'host' | 'player' | 'public' };
export function questionStats(d: SessionData, viewer: Viewer = { role: 'host' }) {
  return d.questions.map((q) => {
    const subs = d.submissions.filter((s) => s.questionId === q.id && s.response?.kind !== 'timeout');
    const dist = new Map<string, number>();
    subs.forEach((s) => {
      const r = s.response ?? {};
      const label = q.kind === 'multiple_choice' ? (r.selectedIds ?? []).map((id: string) => q.optionText?.[id] ?? id).join(', ')
        : q.kind === 'answer_forge' ? normalizeText(String(r.text ?? ''), { diacritics: 'ignore', punctuation: 'ignore' })
        : s.correct ? 'Correct' : 'Incorrect';
      if (label) dist.set(label, (dist.get(label) ?? 0) + 1);
    });
    const wrong = new Map<string, number>();
    subs.filter((s) => !s.correct).forEach((s) => {
      const r = s.response ?? {};
      const label = q.kind === 'multiple_choice' ? (r.selectedIds ?? []).map((id: string) => q.optionText?.[id] ?? id).join(', ') : q.kind === 'answer_forge' ? normalizeText(String(r.text ?? ''), { diacritics: 'ignore', punctuation: 'ignore' }) : 'Incorrect';
      if (label) wrong.set(label, (wrong.get(label) ?? 0) + 1);
    });
    const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([label, count]) => ({ label, count }));
    const out = { id: q.id, position: q.position, prompt: q.prompt, kind: q.kind, answered: subs.length, correct: subs.filter((s) => s.correct).length, accuracy: subs.length ? subs.filter((s) => s.correct).length / subs.length : 0, distribution: top(dist, 8), commonWrong: top(wrong, 3) };
    // players and the public never see who gave which answer; only the aggregate
    return viewer.role === 'host' ? { ...out, byActor: subs.map((s) => ({ actorId: s.actorId, correct: s.correct })) } : out;
  });
}

/* ── Topic / objective views, misconceptions, filters (103, 105, 106) ──────────────────────────────────────────────────── */
export function performanceBy(d: SessionData, by: 'topic' | 'objective' | 'difficulty' | 'kind') {
  const g = new Map<string, { answered: number; correct: number }>();
  d.submissions.filter((s) => s.response?.kind !== 'timeout').forEach((s) => {
    const q = d.questions.find((x) => x.id === s.questionId); if (!q) return;
    const k = (by === 'kind' ? q.kind : (q as Loose)[by]) || 'Ungrouped';
    const a = g.get(k) ?? g.set(k, { answered: 0, correct: 0 }).get(k)!; a.answered++; if (s.correct) a.correct++;
  });
  return [...g].map(([label, v]) => ({ label, ...v, accuracy: v.answered ? v.correct / v.answered : 0 })).sort((a, b) => a.accuracy - b.accuracy);
}
export function perActor(d: SessionData, actorId: string, by: 'topic' | 'objective' | 'question') {
  if (d.mode === 'classroom') return { teamLevel: true as const, rows: [] as { label: string; answered: number; correct: number }[] };
  const g = new Map<string, { answered: number; correct: number }>();
  d.submissions.filter((s) => s.actorId === actorId).forEach((s) => {
    const q = d.questions.find((x) => x.id === s.questionId); if (!q) return;
    const k = by === 'question' ? `Q${q.position + 1}` : ((q as Loose)[by] || 'Ungrouped');
    const a = g.get(k) ?? g.set(k, { answered: 0, correct: 0 }).get(k)!; a.answered++; if (s.correct) a.correct++;
  });
  return { teamLevel: false as const, rows: [...g].map(([label, v]) => ({ label, ...v })) };
}
/** Ranks learning objectives by mistake rate and lists the questions that produced the signal (106). */
export function misconceptions(d: SessionData, minAnswers = 2) {
  const g = new Map<string, { answered: number; wrong: number; questions: Set<string> }>();
  d.submissions.filter((s) => s.response?.kind !== 'timeout').forEach((s) => {
    const q = d.questions.find((x) => x.id === s.questionId); if (!q) return;
    const k = q.objective || q.topic || `Q${q.position + 1}`;
    const a = g.get(k) ?? g.set(k, { answered: 0, wrong: 0, questions: new Set() }).get(k)!;
    a.answered++; if (!s.correct) { a.wrong++; a.questions.add(q.id); }
  });
  return [...g].filter(([, v]) => v.answered >= minAnswers)
    .map(([objective, v]) => ({ objective, mistakeRate: v.wrong / v.answered, answers: v.answered, questionIds: [...v.questions] }))
    .sort((a, b) => b.mistakeRate - a.mistakeRate || b.answers - a.answers);
}
export type ReportFilter = { actorId?: string; kind?: string; difficulty?: string; topic?: string; from?: string; to?: string };
/** Filtering returns a VIEW; the raw data is never modified (105). */
export function filterSession(d: SessionData, f: ReportFilter): SessionData {
  const qids = new Set(d.questions.filter((q) => (!f.kind || q.kind === f.kind) && (!f.difficulty || q.difficulty === f.difficulty) && (!f.topic || q.topic === f.topic)).map((q) => q.id));
  const inRange = (at: string) => (!f.from || at >= f.from) && (!f.to || at <= f.to);
  return { ...d, actors: f.actorId ? d.actors.filter((a) => a.id === f.actorId) : d.actors, questions: d.questions.filter((q) => qids.has(q.id)),
    submissions: d.submissions.filter((s) => qids.has(s.questionId) && (!f.actorId || s.actorId === f.actorId) && inRange(s.at)),
    events: d.events.filter((e) => !f.actorId || e.actorId === f.actorId) };
}

/* ── Private student view (108) ────────────────────────────────────────────────────────────────────────────────────────── */
export function studentView(d: SessionData, actorId: string) {
  const me = d.actors.find((a) => a.id === actorId); if (!me) return null;
  const rep = sessionReport(d);
  const row = rep.rows.find((r) => r.id === actorId)!;
  return { name: me.name, points: me.points, answered: row.answered, correct: row.correct, answers: d.submissions.filter((s) => s.actorId === actorId).map((s) => ({ questionId: s.questionId, correct: s.correct, response: s.response })) /* no other player's data */ };
}

/* ── Export (107) ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
const csvCell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; /* spreadsheet formula injection */ return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function reportCsv(d: SessionData, opts: { locale?: string; timeZone?: string; now?: Date } = {}): string {
  const locale = opts.locale ?? 'en'; const tz = opts.timeZone ?? 'UTC'; const rep = sessionReport(d);
  const when = (iso: string) => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso)); } catch { return iso; } };
  const nf = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const lines: unknown[][] = [
    ['Quiz', d.title], ['Session started', when(d.startedAt)], ['Time zone', tz], ['Language', locale], ['Play method', d.mode], [], ['How scores are calculated', SCORE_NOTE], ...(rep.caveat ? [['Note', rep.caveat]] : []), [],
    ['Rank', 'Name', 'Final points', 'Academic points', 'Modifier points', 'Answered', 'Correct', 'First-attempt accuracy %'],
    ...rep.rows.map((r) => [r.rank, r.name, nf(r.finalPoints), nf(r.academicPoints), nf(r.modifierPoints), r.answered, r.correct, nf(r.firstAttemptAccuracy * 100)]), [],
    ['Question', 'Prompt', 'Answered', 'Correct', 'Accuracy %'],
    ...questionStats(d, { role: 'player' }).map((q) => [q.position + 1, q.prompt, q.answered, q.correct, nf(q.accuracy * 100)]),
  ];
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
/** A small, valid, text-only PDF (Helvetica, WinAnsi) so reports can be printed without a PDF dependency. Non-Latin text falls back to "?"; use CSV for full Unicode. */
export function simplePdf(title: string, lines: string[]): Uint8Array {
  const esc = (s: string) => s.normalize('NFC').replace(/[^\x20-\x7E\xA0-\xFF]/g, (c) => (c === '—' || c === '–' ? '-' : '?')).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrap = (s: string) => { const out: string[] = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).length > 92) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; } out.push(cur); return out; };
  const all = [title, '', ...lines].flatMap((l) => wrap(l));
  const perPage = 52; const pages: string[][] = []; for (let i = 0; i < all.length; i += perPage) pages.push(all.slice(i, i + perPage));
  const objs: string[] = []; const add = (s: string) => objs.push(s);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pages.forEach((p, i) => {
    const stream = `BT /F1 10 Tf 40 800 Td 14 TL ${p.map((l, k) => `${k ? 'T* ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = '%PDF-1.4\n'; const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff);
}
export function reportPdfLines(d: SessionData, locale = 'en', timeZone = 'UTC'): string[] {
  const rep = sessionReport(d);
  const when = (() => { try { return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(new Date(d.startedAt)); } catch { return d.startedAt; } })();
  return [`Started: ${when} (${timeZone})`, `Language: ${locale} · Play method: ${d.mode}`, `Participants: ${rep.attendance} · Answers: ${rep.totalAnswered} · Class accuracy: ${Math.round(rep.classAccuracy * 100)}%`, '', SCORE_NOTE, ...(rep.caveat ? ['', rep.caveat] : []), '',
    ...rep.rows.map((r) => `${r.rank}. ${r.name} - ${r.finalPoints} pts (${r.academicPoints} from answers, ${r.modifierPoints >= 0 ? '+' : ''}${r.modifierPoints} from modifiers) - ${r.correct}/${r.answered} correct`)];
}
