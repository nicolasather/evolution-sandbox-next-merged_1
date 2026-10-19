'use client';
import { useMemo, useState } from 'react';
import { FIELDS, exportQuizJson, importQuizJson, parseBulkPaste, parseCsv, previewImport, suggestMapping, type Field, type Mapping, type QuizDoc } from '@/lib/quiz/portability';
import { findDuplicates } from '@/lib/quiz/content';
import type { Question } from '@/lib/quiz/types';

const FIELD_LABEL: Record<Field, string> = { question: 'Question', answer: 'Correct answer', wrong1: 'Wrong answer 1', wrong2: 'Wrong answer 2', wrong3: 'Wrong answer 3', wrong4: 'Wrong answer 4', points: 'Points', explanation: 'Explanation', hint: 'Hint', topic: 'Topic', difficulty: 'Difficulty' };

/** Bring questions in from a spreadsheet, a JSON backup or pasted text — always shown as a preview first — and take a quiz out as JSON.
 *  Nothing changes in the quiz until the person presses the add button. */
export default function ImportExport({ doc, existing, onAdd, onReplace }: { doc: QuizDoc; existing: Question[]; onAdd: (qs: Question[]) => void; onReplace: (d: QuizDoc) => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({});
  const [pasted, setPasted] = useState('');
  const [msg, setMsg] = useState('');
  const [jsonDoc, setJsonDoc] = useState<{ doc: QuizDoc; problems: string[] } | null>(null);

  const preview = useMemo(() => (rows ? previewImport(rows, mapping, { hasHeader }) : null), [rows, mapping, hasHeader]);
  const dupes = useMemo(() => (preview ? findDuplicates(preview.questions, existing.map((q, i) => ({ id: i, q }))) : []), [preview, existing]);
  const pastedItems = useMemo(() => parseBulkPaste(pasted), [pasted]);
  const pastedOk = pastedItems.filter((p) => p.question);

  async function onFile(file: File) {
    setMsg(''); setJsonDoc(null); setRows(null);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.json')) {
        const r = importQuizJson(await file.text());
        if (!r.ok) { setMsg(r.error); return; }
        setJsonDoc({ doc: r.doc, problems: r.problems.map((p) => `Question ${p.row}: ${p.message}`) });
      } else if (name.endsWith('.xlsx')) {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/quiz/import', { method: 'POST', body: fd }); const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? 'Could not read the spreadsheet');
        start(j.rows);
      } else if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
        start(parseCsv(await file.text()));
      } else setMsg('Choose a .csv, .xlsx or .json file.');
    } catch (e) { setMsg((e as Error).message); }
  }
  function start(r: string[][]) {
    if (!r.length) { setMsg('That file is empty.'); return; }
    setRows(r); setMapping(suggestMapping(r[0] ?? []));
  }
  function download() {
    const blob = new Blob([exportQuizJson(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(doc.title || 'quiz').replace(/[^\w-]+/g, '-').slice(0, 40)}.quiz.json`; a.click(); URL.revokeObjectURL(url);
  }
  const cols = rows?.[0]?.map((h, i) => (hasHeader ? h || `Column ${i + 1}` : `Column ${i + 1}`)) ?? [];

  return (
    <section className="panel stack" aria-labelledby="ie-h">
      <h2 id="ie-h">Import and export</h2>
      <div className="stack">
        <label>Import from a file (.csv, .xlsx or a Quiz Studio .json backup)
          <input type="file" accept=".csv,.tsv,.txt,.xlsx,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
        </label>
        {msg && <p className="error" role="alert">{msg}</p>}
      </div>

      {jsonDoc && (
        <div className="stack" role="region" aria-label="Backup preview">
          <p><strong>{jsonDoc.doc.title || 'Untitled quiz'}</strong> — {jsonDoc.doc.questions.length} question{jsonDoc.doc.questions.length === 1 ? '' : 's'}.</p>
          {jsonDoc.problems.length > 0 && <ul className="note">{jsonDoc.problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="row">
            <button className="btn small" onClick={() => { onAdd(jsonDoc.doc.questions); setJsonDoc(null); }}>Add these questions</button>
            <button className="btn small ghost" onClick={() => { if (window.confirm('Replace the whole quiz with this backup? You can undo this.')) { onReplace(jsonDoc.doc); setJsonDoc(null); } }}>Replace the quiz</button>
            <button className="btn small ghost" onClick={() => setJsonDoc(null)}>Cancel</button>
          </div>
        </div>
      )}

      {rows && preview && (
        <div className="stack" role="region" aria-label="Spreadsheet import preview">
          <label className="inline"><input type="checkbox" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); if (e.target.checked) setMapping(suggestMapping(rows[0] ?? [])); }} /> First row contains column names</label>
          <div className="grid2">
            {FIELDS.map((f) => (
              <label key={f}>{FIELD_LABEL[f]}{f === 'question' || f === 'answer' ? ' *' : ''}
                <select value={mapping[f] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                  <option value="">— none —</option>
                  {cols.map((c, i) => <option key={i} value={i}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p role="status"><strong>{preview.questions.length}</strong> of {preview.rowCount} rows are ready. {preview.problems.length > 0 && <span className="bad">{preview.problems.length} need attention and will be skipped.</span>}</p>
          {preview.problems.length > 0 && <ul className="note">{preview.problems.slice(0, 8).map((p, i) => <li key={i}>{p.row ? `Row ${p.row}: ` : ''}{p.message}</li>)}{preview.problems.length > 8 && <li>…and {preview.problems.length - 8} more.</li>}</ul>}
          {dupes.length > 0 && <p className="info" role="status">{dupes.length} of these look like questions you already have. They are kept unless you remove them.</p>}
          {preview.questions.slice(0, 3).map((q, i) => <p key={i} className="note">Example {i + 1}: {q.prompt}</p>)}
          <div className="row">
            <button className="btn small" disabled={!preview.questions.length} onClick={() => { onAdd(preview.questions); setRows(null); }}>Add {preview.questions.length} question{preview.questions.length === 1 ? '' : 's'}</button>
            <button className="btn small ghost" onClick={() => setRows(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stack">
        <label>…or paste questions
          <textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'1. Capital of France?\nA. Paris*\nB. Rome\nC. Madrid\n\n2. 2 + 2? | 4'} />
        </label>
        {pasted.trim() && (
          <>
            <p className="note" role="status">{pastedOk.length} question{pastedOk.length === 1 ? '' : 's'} recognised{pastedItems.length - pastedOk.length > 0 ? `, ${pastedItems.length - pastedOk.length} could not be read` : ''}.</p>
            <ul className="note">{pastedItems.filter((p) => p.warnings.length || !p.question).slice(0, 5).map((p, i) => <li key={i}>{p.source.slice(0, 50)} — {p.warnings[0] ?? 'could not be read'}</li>)}</ul>
            <div><button className="btn small" disabled={!pastedOk.length} onClick={() => { onAdd(pastedOk.map((p) => p.question!)); setPasted(''); }}>Add {pastedOk.length} question{pastedOk.length === 1 ? '' : 's'}</button></div>
          </>
        )}
      </div>

      <div className="row">
        <button className="btn small ghost" onClick={download} disabled={!doc.title.trim() && !doc.questions.length}>Download quiz as JSON</button>
        <span className="note">The JSON file includes answers and notes, so keep it private. Imported files never run code.</span>
      </div>
    </section>
  );
}
