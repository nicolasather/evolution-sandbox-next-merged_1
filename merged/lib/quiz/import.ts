/** Smart Paste and CSV import. Both produce STAGED questions for review: nothing is added to a quiz until the creator
 *  confirms, and an answer is never guessed. A question whose key cannot be read is flagged and must be fixed by hand. */
import { blank, uid } from './editor-model';
import type { Question } from './types';

export type Staged = {
  /** the question as it would be added; for a flagged question, a best-effort shell the creator completes */
  question: Question;
  /** plain-words problems; empty = ready to add */
  issues: string[];
  /** where it came from, for the review list ("line 12", "row 4") */
  source: string;
};

const LETTERS = 'ABCDEFGH';
const letterIndex = (s: string) => { const i = LETTERS.indexOf(s.trim().toUpperCase()); return s.trim().length === 1 && i >= 0 ? i : -1; };

function mc(prompt: string, options: string[], correct: number | null, points: number, source: string, extraIssues: string[] = []): Staged {
  const q = blank('multiple_choice');
  const ids = options.map(() => uid('o'));
  q.prompt = prompt; q.basePoints = points;
  q.payload = { options: options.map((text, i) => ({ id: ids[i]!, text })) };
  const issues = [...extraIssues];
  if (options.length < 2) issues.push('Needs at least two options.');
  if (options.length > 8) issues.push('More than 8 options.');
  if (correct === null || correct < 0 || correct >= options.length) { if (!extraIssues.length) issues.push('The correct answer could not be read — choose it after adding.'); q.answerKey = { correctIds: [ids[0]!] }; }
  else q.answerKey = { correctIds: [ids[correct]!] };
  return { question: q, issues, source };
}
function forge(prompt: string, accepted: string[], points: number, source: string): Staged {
  const q = blank('answer_forge');
  q.prompt = prompt; q.basePoints = points; q.answerKey = { accepted: accepted.length ? accepted : [''] };
  return { question: q, issues: accepted.length ? [] : ['No answer was given.'], source };
}

/** Understands the common shapes: "1. Question", "Q: Question", options "A) ..", "A. ..", "A: ..", "- ..", then "Answer: B" (letter, or the option text, or free text). */
export function parseSmartPaste(text: string, points = 100): Staged[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: { start: number; lines: string[] }[] = [];
  let cur: { start: number; lines: string[] } | null = null;
  lines.forEach((raw, i) => {
    if (!raw.trim()) { cur = null; return; }
    if (!cur) { cur = { start: i + 1, lines: [] }; blocks.push(cur); }
    cur.lines.push(raw.trim());
  });
  const out: Staged[] = [];
  for (const b of blocks) {
    const source = `line ${b.start}`;
    let prompt = ''; const options: string[] = []; let answer = '';
    for (const line of b.lines) {
      const a = /^(?:answer|ans|correct|key)\s*[:=\-]\s*(.+)$/i.exec(line);
      const opt = /^(?:\(?([A-Ha-h])[).:]|[-*•])\s+(.+)$/.exec(line);
      if (a) answer = a[1]!.trim();
      else if (opt && prompt) options.push(opt[2]!.trim());
      else if (!prompt) prompt = line.replace(/^(?:q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)])\s*/i, '').trim();
      else prompt += ` ${line}`;
    }
    if (!prompt) continue;
    if (options.length >= 2) {
      let idx: number | null = null;
      if (answer) {
        const li = letterIndex(answer.replace(/[).:]$/, ''));
        const byText = options.findIndex((o) => o.toLowerCase() === answer.toLowerCase());
        idx = li >= 0 && li < options.length ? li : byText >= 0 ? byText : null;
      }
      out.push(mc(prompt, options, idx, points, source, answer && idx === null ? [`The answer “${answer}” does not match any option.`] : []));
    } else if (answer) {
      out.push(forge(prompt, answer.split(/\s*[|;]\s*/).map((s) => s.trim()).filter(Boolean), points, source));
    } else {
      const s = forge(prompt, [], points, source);
      s.issues = ['Needs options and an answer, or an “Answer:” line.'];
      out.push(s);
    }
  }
  return out;
}

/** RFC-4180-style parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else f += ch;
  }
  row.push(f); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Columns: kind, prompt, option_a … option_h, correct (letter, or accepted answers separated by | for answer_forge), points. Unknown kinds are flagged. */
export function parseQuestionCsv(text: string): { staged: Staged[]; error?: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { staged: [], error: 'The file needs a header row and at least one question.' };
  const head = rows[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (n: string) => head.indexOf(n);
  if (col('prompt') < 0) return { staged: [], error: 'The header row must include a “prompt” column. Expected: kind, prompt, option_a … option_d, correct, points.' };
  const optCols = LETTERS.split('').map((l) => col(`option_${l.toLowerCase()}`)).filter((i) => i >= 0);
  const staged: Staged[] = [];
  rows.slice(1).forEach((r, n) => {
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const source = `row ${n + 2}`;
    const prompt = get(col('prompt'));
    if (!prompt) return;
    const kind = (get(col('kind')) || (optCols.some((c) => get(c)) ? 'multiple_choice' : 'answer_forge')).toLowerCase();
    const pts = Number(get(col('points')) || 100);
    const points = Number.isFinite(pts) ? Math.max(0, Math.min(10000, Math.round(pts))) : 100;
    const correct = get(col('correct'));
    if (kind === 'multiple_choice') {
      const options = optCols.map((c) => get(c)).filter((x) => x !== '');
      const li = letterIndex(correct); const byText = options.findIndex((o) => o.toLowerCase() === correct.toLowerCase());
      const idx = li >= 0 && li < options.length ? li : byText >= 0 ? byText : null;
      staged.push(mc(prompt, options, idx, points, source, correct && idx === null ? [`The correct value “${correct}” does not match any option.`] : []));
    } else if (kind === 'answer_forge') {
      staged.push(forge(prompt, correct.split(/\s*[|;]\s*/).map((x) => x.trim()).filter(Boolean), points, source));
    } else {
      const b = blank('multiple_choice'); b.prompt = prompt;
      staged.push({ question: b, issues: [`Format “${kind}” cannot be imported from a CSV. Use multiple_choice or answer_forge, or build it by hand.`], source });
    }
  });
  return { staged };
}

/** Plain-text DOCX/PDF extraction happens on the server (/api/quiz/import/document); its text goes through the same Smart Paste parser. */
export const ready = (s: Staged[]) => s.filter((x) => x.issues.length === 0);
