'use client';
import { useRef, useState } from 'react';
import { parseQuestionCsv, parseSmartPaste, type Staged } from '@/lib/quiz/import';
import type { Question } from '@/lib/quiz/types';
import { questionSchema } from '@/lib/quiz/validation';
import { prepare } from '@/lib/quiz/editor-model';

type Tab = 'paste' | 'csv' | 'doc';
const LIMIT = 200;

/** Smart Paste, CSV and document import. Everything lands in a review list first; questions are added only when the creator confirms,
 *  and a question whose answer could not be read stays out until the creator picks it. */
export default function ImportPanel({ points, existing, onAdd, onClose }: { points: number; existing: number; onAdd: (qs: Question[]) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('paste');
  const [text, setText] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const stage = (list: Staged[], note = '') => { setStaged(list); setMsg(list.length ? note : 'Nothing that looks like a question was found.'); };
  function fromPaste() { stage(parseSmartPaste(text, points)); }
  async function fromFile(f: File | undefined) {
    if (!f) return;
    setBusy(true); setMsg('');
    try {
      if (tab === 'csv') {
        if (f.size > 1_000_000) throw new Error('That file is larger than 1 MB.');
        const r = parseQuestionCsv(await f.text());
        if (r.error) { setStaged([]); setMsg(r.error); } else stage(r.staged);
      } else {
        if (f.size > 5_000_000) throw new Error('That file is larger than 5 MB.');
        const fd = new FormData(); fd.set('file', f);
        const res = await fetch('/api/quiz/import/document', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Could not read that file.');
        setText(data.text as string);
        stage(parseSmartPaste(data.text as string, points), data.truncated ? 'The document was long, so only the first part was read.' : '');
      }
    } catch (e) { setStaged([]); setMsg((e as Error).message); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  }

  const setCorrect = (i: number, idx: number) => setStaged((a) => a.map((s, j) => {
    if (j !== i || s.question.kind !== 'multiple_choice') return s;
    const opts = (s.question.payload as any).options as { id: string }[];
    return { ...s, question: { ...s.question, answerKey: { correctIds: [opts[idx]!.id] } }, issues: s.issues.filter((m) => !/correct answer|correct value|does not match any option/.test(m)) };
  }));
  const valid = (s: Staged) => s.issues.length === 0 && questionSchema.safeParse(prepare(s.question)).success;
  const ready = staged.filter(valid);
  const room = LIMIT - existing;

  function add() {
    const out = ready.slice(0, Math.max(0, room)).map((s) => { const q = JSON.parse(JSON.stringify(s.question)) as Question; delete q.id; return q; });
    if (out.length) onAdd(out);
    onClose();
  }

  return (
    <section className="panel stack" aria-labelledby="imp-h">
      <div className="row spread"><h2 id="imp-h" style={{ margin: 0 }}>Import questions</h2><button className="btn small ghost" onClick={onClose}>Close</button></div>
      <div className="tab-row" role="tablist" aria-label="Import source">
        {([['paste', 'Smart Paste'], ['csv', 'CSV file'], ['doc', 'Word or PDF']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setStaged([]); setMsg(''); }}>{l}</button>
        ))}
      </div>
      {tab === 'paste' && (
        <div className="stack">
          <p className="note">Paste questions as plain text. Separate questions with a blank line. Options start with A) B) C) …, and an “Answer:” line gives the key (a letter, the option text, or the answer for a typed question).</p>
          <label>Text<textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1. Which planet has rings?\nA) Mars\nB) Saturn\nC) Venus\nAnswer: B'} /></label>
          <div><button className="btn small" onClick={fromPaste} disabled={!text.trim()}>Review questions</button></div>
        </div>
      )}
      {tab !== 'paste' && (
        <div className="stack">
          <p className="note">{tab === 'csv' ? 'Columns: kind, prompt, option_a … option_h, correct, points. “kind” may be multiple_choice or answer_forge. Up to 1 MB.' : 'A .docx or .pdf with questions written in the Smart Paste layout. The file is read on the server and the text is shown for review. Up to 5 MB.'}</p>
          <label>{tab === 'csv' ? 'CSV file' : 'Word or PDF file'}<input ref={file} type="file" accept={tab === 'csv' ? '.csv,text/csv' : '.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'} disabled={busy} onChange={(e) => void fromFile(e.target.files?.[0])} /></label>
          {tab === 'csv' && <p className="note"><a href="data:text/csv;charset=utf-8,kind%2Cprompt%2Coption_a%2Coption_b%2Coption_c%2Coption_d%2Ccorrect%2Cpoints%0Amultiple_choice%2CWhich%20planet%20has%20rings%3F%2CMars%2CSaturn%2CVenus%2CMercury%2CB%2C100%0Aanswer_forge%2CCapital%20of%20France%3F%2C%2C%2C%2C%2CParis%20%7C%20paris%2C100" download="quiz-import-example.csv">Download an example CSV</a></p>}
        </div>
      )}
      {busy && <p className="muted-text" role="status">Reading the file…</p>}
      {msg && <p className="info" role="status">{msg}</p>}
      {staged.length > 0 && (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Review · {ready.length} of {staged.length} ready</h3>
          <ol className="cr-staged">
            {staged.map((s, i) => {
              const ok = valid(s);
              const q = s.question; const opts = q.kind === 'multiple_choice' ? ((q.payload as any).options as { id: string; text: string }[]) : [];
              const key = (q.answerKey as any).correctIds?.[0];
              return (
                <li key={i} data-ok={ok}>
                  <p><strong>{q.prompt}</strong> <span className="note">({s.source})</span></p>
                  {opts.length > 0 && (
                    <div className="stack" role="radiogroup" aria-label={`Correct option for “${q.prompt}”`}>
                      {opts.map((o, k) => <label key={o.id} className="inline"><input type="radio" name={`st-${i}`} checked={!s.issues.some((m) => /correct|does not match/.test(m)) && key === o.id} onChange={() => setCorrect(i, k)} /> {String.fromCharCode(65 + k)}. {o.text}</label>)}
                    </div>
                  )}
                  {q.kind === 'answer_forge' && <p className="note">Accepted: {((q.answerKey as any).accepted as string[]).join(' · ') || '—'}</p>}
                  {s.issues.map((m) => <p key={m} className="error" role="alert">{m}</p>)}
                </li>
              );
            })}
          </ol>
          {room < ready.length && <p className="info">A quiz holds up to {LIMIT} questions, so only the first {Math.max(0, room)} ready questions will be added.</p>}
          <div className="row"><button className="btn" onClick={add} disabled={!ready.length || room <= 0}>Add {Math.min(ready.length, Math.max(0, room))} question{ready.length === 1 ? '' : 's'}</button>
            {ready.length < staged.length && <span className="note">Questions with problems are left out until fixed.</span>}</div>
        </div>
      )}
    </section>
  );
}
