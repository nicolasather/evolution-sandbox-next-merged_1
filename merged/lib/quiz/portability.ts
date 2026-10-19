/** Import / export for question banks (items 041, 042, 043). Nothing here changes a quiz: every function returns a *preview*
 *  (questions plus explicit problems) that the person must confirm on a correction screen first. Pure except readXlsx (node:zlib). */
import { questionSchema, quizMetaSchema } from './validation';
import { uid } from './editor-model';
import { explainIssue } from './explain';
import type { Question } from './types';

/* ── CSV ───────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: [string, number][] = [',', ';', '\t', '|'].map((d) => [d, first.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ',';
}
/** RFC 4180 parser: quoted fields, escaped quotes, newlines inside quotes, BOM. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/* ── XLSX (first worksheet) ────────────────────────────────────────────────────────────────────────────────────────────── */
function unzip(buf: Uint8Array, inflateRaw: (b: Uint8Array) => Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This is not a valid .xlsx file.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('The .xlsx file is damaged.');
    const method = v.getUint16(p + 10, true); const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true); const xlen = v.getUint16(p + 30, true); const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nlen));
    const ln = v.getUint16(local + 26, true); const lx = v.getUint16(local + 28, true);
    const data = buf.slice(local + 30 + ln + lx, local + 30 + ln + lx + csize);
    if (/^xl\/(worksheets\/sheet1\.xml|sharedStrings\.xml)$/.test(name)) files.set(name, method === 0 ? data : inflateRaw(data));
    p += 46 + nlen + xlen + clen;
  }
  return files;
}
const xmlText = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
/** Reads the first sheet of an .xlsx file into rows of text. `inflateRaw` is injected (zlib.inflateRawSync) to keep this file browser-safe. */
export function readXlsx(bytes: Uint8Array, inflateRaw: (b: Uint8Array) => Uint8Array): string[][] {
  const files = unzip(bytes, inflateRaw);
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('No worksheet found in this .xlsx file.');
  const dec = new TextDecoder();
  const shared = [...dec.decode(files.get('xl/sharedStrings.xml') ?? new Uint8Array()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]!));
  const rows: string[][] = [];
  for (const rm of dec.decode(sheet).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]!; const body = cm[2] ?? '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]; const type = /t="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]; const is = /<is>([\s\S]*?)<\/is>/.exec(body)?.[1];
      const val = type === 's' ? shared[Number(v)] ?? '' : type === 'inlineStr' ? xmlText(is ?? '') : xmlText(v ?? '');
      row[ref ? colIndex(ref) : row.length] = val;
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/* ── Column mapping and previews ───────────────────────────────────────────────────────────────────────────────────────── */
export const FIELDS = ['question', 'answer', 'wrong1', 'wrong2', 'wrong3', 'wrong4', 'points', 'explanation', 'hint', 'topic', 'difficulty'] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, number>>;
const GUESS: Record<Field, RegExp> = {
  question: /^(question|prompt|câu hỏi|cau hoi|q|text)$/i,
  answer: /^(answer|correct( answer)?|right|đáp án|dap an|đúng|key)$/i,
  wrong1: /^(wrong ?1|distractor ?1|incorrect ?1|option ?2|sai ?1|b)$/i,
  wrong2: /^(wrong ?2|distractor ?2|incorrect ?2|option ?3|sai ?2|c)$/i,
  wrong3: /^(wrong ?3|distractor ?3|incorrect ?3|option ?4|sai ?3|d)$/i,
  wrong4: /^(wrong ?4|distractor ?4|incorrect ?4|option ?5|sai ?4|e)$/i,
  points: /^(points?|score|điểm|diem)$/i,
  explanation: /^(explanation|why|rationale|giải thích|giai thich)$/i,
  hint: /^(hint|clue|gợi ý|goi y)$/i,
  topic: /^(topic|subject|category|chủ đề|chu de)$/i,
  difficulty: /^(difficulty|level|độ khó|do kho)$/i,
};
export function suggestMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  headers.forEach((h, i) => { for (const f of FIELDS) if (m[f] === undefined && GUESS[f].test(h.trim())) { m[f] = i; break; } });
  return m;
}

export type ImportProblem = { row: number; field?: Field; message: string };
export type ImportPreview = { questions: Question[]; problems: ImportProblem[]; examples: string[][]; headers: string[]; rowCount: number };

const TF = new Map([['true', true], ['false', false], ['t', true], ['f', false], ['đúng', true], ['dung', true], ['sai', false], ['yes', true], ['no', false]]);

/** Build questions from mapped columns. Rows with problems are reported and skipped; nothing is applied until the person confirms. */
export function previewImport(rows: string[][], mapping: Mapping, opts: { hasHeader?: boolean } = {}): ImportPreview {
  const hasHeader = opts.hasHeader ?? true;
  const headers = hasHeader ? rows[0] ?? [] : [];
  const data = hasHeader ? rows.slice(1) : rows;
  const problems: ImportProblem[] = [];
  const questions: Question[] = [];
  if (mapping.question === undefined) problems.push({ row: 0, field: 'question', message: 'Choose which column holds the question text.' });
  if (mapping.answer === undefined) problems.push({ row: 0, field: 'answer', message: 'Choose which column holds the correct answer.' });
  if (problems.length) return { questions, problems, examples: data.slice(0, 3), headers, rowCount: data.length };
  const cell = (r: string[], f: Field) => (mapping[f] === undefined ? '' : (r[mapping[f]!] ?? '').trim());
  data.forEach((r, i) => {
    const row = i + (hasHeader ? 2 : 1);
    const prompt = cell(r, 'question'); const answer = cell(r, 'answer');
    if (!prompt) { problems.push({ row, field: 'question', message: 'The question is empty.' }); return; }
    if (!answer) { problems.push({ row, field: 'answer', message: 'The correct answer is empty.' }); return; }
    const wrongs = (['wrong1', 'wrong2', 'wrong3', 'wrong4'] as Field[]).map((f) => cell(r, f)).filter(Boolean);
    const pts = cell(r, 'points') ? Number(cell(r, 'points')) : 100;
    if (!Number.isInteger(pts) || pts < 0 || pts > 10000) { problems.push({ row, field: 'points', message: `Points must be a whole number from 0 to 10000 (found "${cell(r, 'points')}").` }); return; }
    const diff = cell(r, 'difficulty').toLowerCase();
    const meta: Record<string, unknown> = {};
    if (cell(r, 'topic')) meta.topic = cell(r, 'topic').slice(0, 80);
    if (['easy', 'medium', 'hard'].includes(diff)) meta.difficulty = diff;
    const secrets: Record<string, unknown> = {};
    if (cell(r, 'explanation')) secrets.explanation = cell(r, 'explanation').slice(0, 2000);
    if (cell(r, 'hint')) secrets.hint = cell(r, 'hint').slice(0, 500);
    let q: Question;
    if (wrongs.length >= 1) {
      const ids = [answer, ...wrongs].map(() => uid('o'));
      q = { kind: 'multiple_choice', prompt, basePoints: pts, payload: { options: [answer, ...wrongs].map((text, k) => ({ id: ids[k]!, text })), ...(Object.keys(meta).length ? { meta } : {}) }, answerKey: { correctIds: [ids[0]!], ...secrets } };
    } else if (TF.has(answer.toLowerCase())) {
      const id = uid('s');
      q = { kind: 'truth_hunt', prompt: 'Decide whether the statement is true or false.', basePoints: pts, payload: { statements: [{ id, text: prompt }], ...(Object.keys(meta).length ? { meta } : {}) }, answerKey: { truth: { [id]: TF.get(answer.toLowerCase())! }, ...secrets } };
    } else {
      q = { kind: 'answer_forge', prompt, basePoints: pts, payload: { placeholder: 'Your answer', caseSensitive: false, ...(Object.keys(meta).length ? { meta } : {}) }, answerKey: { accepted: answer.split('|').map((s) => s.trim()).filter(Boolean), ...secrets } };
    }
    const check = questionSchema.safeParse(q);
    if (!check.success) { problems.push({ row, message: explainIssue({ path: check.error.issues[0]!.path as (string | number)[], message: check.error.issues[0]!.message, code: check.error.issues[0]!.code }) }); return; }
    questions.push(q);
  });
  return { questions, problems, examples: data.slice(0, 3), headers, rowCount: data.length };
}

/* ── JSON backup: versioned schema (item 042) ──────────────────────────────────────────────────────────────────────────── */
export const EXPORT_SCHEMA = 'quiz-studio.quiz';
export const EXPORT_VERSION = 2;
export type QuizDoc = { title: string; description: string; meta?: Record<string, unknown>; questions: Question[] };

export function exportQuizJson(doc: QuizDoc, now = new Date()): string {
  return JSON.stringify({ schema: EXPORT_SCHEMA, version: EXPORT_VERSION, exportedAt: now.toISOString(), title: doc.title, description: doc.description, meta: doc.meta ?? {}, questions: doc.questions }, null, 2);
}
export type JsonImport = { ok: true; doc: QuizDoc; problems: ImportProblem[]; fromVersion: number } | { ok: false; error: string };
/** Reads current (v2) and earlier (v1: `{app:'quiz-studio', version:1}`) backups. Invalid questions are reported, never silently dropped into the quiz. */
export function importQuizJson(text: string): JsonImport {
  let raw: any;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'This is not a valid JSON file.' }; }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'This file does not look like a Quiz Studio backup.' };
  const v1 = raw.app === 'quiz-studio' && raw.version === 1;
  const v2 = raw.schema === EXPORT_SCHEMA;
  if (!v1 && !v2) return { ok: false, error: 'This file does not look like a Quiz Studio backup.' };
  if (v2 && (typeof raw.version !== 'number' || raw.version > EXPORT_VERSION)) return { ok: false, error: `This backup was made by a newer version (${raw.version}). Update Quiz Studio to open it.` };
  if (!Array.isArray(raw.questions)) return { ok: false, error: 'The backup has no questions list.' };
  const problems: ImportProblem[] = []; const questions: Question[] = [];
  raw.questions.forEach((q: unknown, i: number) => {
    const r = questionSchema.safeParse(q);
    if (r.success) questions.push(q as Question);
    else problems.push({ row: i + 1, message: explainIssue({ path: r.error.issues[0]!.path as (string | number)[], message: r.error.issues[0]!.message, code: r.error.issues[0]!.code }) });
  });
  const meta = quizMetaSchema.safeParse(raw.meta ?? {});
  return { ok: true, fromVersion: v1 ? 1 : raw.version, problems, doc: { title: String(raw.title ?? '').slice(0, 160), description: String(raw.description ?? '').slice(0, 2000), meta: meta.success ? (meta.data as Record<string, unknown>) : {}, questions } };
}

/* ── Bulk paste (item 043) ─────────────────────────────────────────────────────────────────────────────────────────────── */
export type PastedItem = { source: string; question: Question | null; warnings: string[] };
/** Accepts (a) numbered questions with lettered options, the right one marked with * or "Answer: B", and (b) "question | answer" lines. */
export function parseBulkPaste(text: string): PastedItem[] {
  const clean = text.replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  const blocks = clean.split(/\n(?=\s*(?:Q?\s*\d+\s*[.)\]:-]))/i).map((b) => b.trim()).filter(Boolean);
  const numbered = blocks.length > 1 || /^\s*Q?\s*\d+\s*[.)\]:-]/i.test(clean);
  const items: PastedItem[] = [];
  if (numbered) {
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      const prompt = (lines.shift() ?? '').replace(/^Q?\s*\d+\s*[.)\]:-]\s*/i, '').trim();
      const warnings: string[] = [];
      const opts: { text: string; star: boolean }[] = []; let answerLetter = ''; let inline: string | undefined;
      for (const l of lines) {
        const am = /^(?:answer|correct|đáp án|dap an)\s*[:=-]\s*(.+)$/i.exec(l);
        if (am) { const a = am[1]!.trim(); if (/^[A-Ha-h]$/.test(a)) answerLetter = a.toUpperCase(); else inline = a; continue; }
        const om = /^\(?([A-Ha-h])[.)\]:-]\s*(.+)$/.exec(l);
        if (om) { const star = /\*\s*$/.test(om[2]!) || /^\*/.test(om[2]!); opts.push({ text: om[2]!.replace(/^\*\s*|\s*\*$/g, '').trim(), star }); }
        else warnings.push(`Line not understood: "${l.slice(0, 60)}"`);
      }
      if (opts.length >= 2) {
        let ci = opts.findIndex((o) => o.star);
        if (ci < 0 && answerLetter) ci = answerLetter.charCodeAt(0) - 65;
        if (ci < 0 || ci >= opts.length) { warnings.push('Mark the correct option with * or add an "Answer: B" line.'); ci = 0; }
        const ids = opts.map(() => uid('o'));
        items.push({ source: block, warnings, question: { kind: 'multiple_choice', prompt, basePoints: 100, payload: { options: opts.map((o, k) => ({ id: ids[k]!, text: o.text })) }, answerKey: { correctIds: [ids[ci]!] } } });
      } else if (inline) {
        items.push({ source: block, warnings, question: { kind: 'answer_forge', prompt, basePoints: 100, payload: { placeholder: 'Your answer', caseSensitive: false }, answerKey: { accepted: inline.split('|').map((s) => s.trim()).filter(Boolean) } } });
      } else {
        items.push({ source: block, warnings: [...warnings, 'No answer found for this question.'], question: null });
      }
    }
    return items;
  }
  for (const line of clean.split('\n')) {
    const parts = line.split(/\s*(?:\||\t|=>|—|–| - )\s*/);
    if (parts.length >= 2 && parts[0]!.trim() && parts[1]!.trim()) {
      items.push({ source: line, warnings: [], question: { kind: 'answer_forge', prompt: parts[0]!.trim(), basePoints: 100, payload: { placeholder: 'Your answer', caseSensitive: false }, answerKey: { accepted: parts.slice(1).map((s) => s.trim()).filter(Boolean) } } });
    } else if (line.trim()) items.push({ source: line, warnings: ['Use "question | answer" on one line.'], question: null });
  }
  return items;
}
