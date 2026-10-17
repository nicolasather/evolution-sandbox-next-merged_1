'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/quiz/client';
import { saveQuizSchema } from '@/lib/quiz/validation';
import { explainIssue } from '@/lib/quiz/explain';
import { kindLabels, QUESTION_KINDS, type Question, type QuestionKind } from '@/lib/quiz/types';

type Initial = { id?: string; title: string; description: string; status: 'draft' | 'published'; questions: Question[] };
let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

function blank(kind: QuestionKind): Question {
  const base = { kind, prompt: '', basePoints: 100 };
  switch (kind) {
    case 'multiple_choice': { const ids = [uid('o'), uid('o'), uid('o'), uid('o')]; return { ...base, payload: { options: ids.map((id) => ({ id, text: '' })) }, answerKey: { correctIds: [ids[0]] } }; }
    case 'answer_forge': return { ...base, payload: { placeholder: 'Type your answer', caseSensitive: false }, answerKey: { accepted: [''] } };
    case 'connection_rush': { const a = [uid('l'), uid('l')], b = [uid('r'), uid('r')]; return { ...base, payload: { left: a.map((id) => ({ id, label: '' })), right: b.map((id) => ({ id, label: '' })) }, answerKey: { pairs: a.map((l, i) => ({ leftId: l, rightId: b[i] })) } }; }
    case 'truth_hunt': { const a = [uid('s'), uid('s')]; return { ...base, payload: { statements: a.map((id) => ({ id, text: '' })) }, answerKey: { truth: { [a[0]!]: true, [a[1]!]: false } } }; }
    case 'fill_table': return { ...base, payload: { columns: ['Column 1', 'Column 2'], rows: [[{ text: '', blank: true }, { text: '', blank: false }]] }, answerKey: { cells: { '0:0': [''] } } };
  }
}

/** Tidy what the author typed before validation: drop empty accepted answers, never ship a blank cell's text. */
function prepare(q: Question): Question {
  const pl: any = q.payload, ak: any = q.answerKey;
  if (q.kind === 'answer_forge') return { ...q, answerKey: { ...ak, accepted: (ak.accepted as string[]).map((s) => s.trim()).filter(Boolean) } };
  if (q.kind === 'fill_table') {
    return { ...q,
      payload: { ...pl, rows: pl.rows.map((r: any[]) => r.map((c) => (c.blank ? { text: '', blank: true } : c))) },
      answerKey: { cells: Object.fromEntries(Object.entries(ak.cells as Record<string, string[]>).map(([k, v]) => [k, v.map((s) => s.trim()).filter(Boolean)])) } };
  }
  return q;
}

export default function QuizEditor({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [qs, setQs] = useState<Question[]>(initial?.questions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const lastRef = useRef<HTMLElement | null>(null);

  const set = (i: number, patch: Partial<Question>) => setQs((a) => a.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => setQs((a) => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; });
  const dup = (i: number) => setQs((a) => { const c = JSON.parse(JSON.stringify(a[i])) as Question; delete c.id; const out = [...a]; out.splice(i + 1, 0, c); return out; });

  async function save(target: 'draft' | 'published') {
    setError(''); setSaved('');
    const payload = { id, title: title.trim(), description, status: target, questions: qs.map(prepare) };
    const check = saveQuizSchema.safeParse(payload);
    if (!check.success) { const i = check.error.issues[0]!; setError(explainIssue({ path: i.path as (string | number)[], message: i.message, code: i.code })); return; }
    setBusy(true);
    try {
      const out = await api<{ id: string }>('/api/quiz/quizzes', { method: 'POST', json: check.data });
      setId(out.id); setStatus(target);
      setSaved(target === 'published' ? 'Saved and published.' : 'Saved as a private draft.');
      if (!id) router.replace(`/quiz/edit/${out.id}`);
      else router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div><p className="eyebrow">{id ? 'Editing' : 'New quiz'}</p><h1>{id ? 'Edit your quiz' : 'Create your quiz'}</h1>
          <p className="muted-text">Write every question yourself. Mix any of the five formats in one quiz.</p></div>
        <Link className="btn ghost" href="/quiz/my">My Quizzes</Link>
      </header>

      <section className="panel stack">
        <label>Quiz title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Give your quiz a title" /></label>
        <label>Description (optional)<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} /></label>
        <p className="note">Status: <span className={`pill ${status}`}>{status === 'published' ? 'published — visible in the library' : 'private draft'}</span></p>
      </section>

      {qs.map((q, i) => (
        <section className="qcard" key={q.id ?? `new-${i}-${q.kind}`} ref={i === qs.length - 1 ? (el) => { lastRef.current = el; } : undefined}>
          <header>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Question {i + 1} · {kindLabels[q.kind]}</h2>
            <div className="row">
              <button className="btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>↑</button>
              <button className="btn small ghost" onClick={() => move(i, 1)} disabled={i === qs.length - 1} aria-label={`Move question ${i + 1} down`}>↓</button>
              <button className="btn small ghost" onClick={() => dup(i)}>Duplicate</button>
              <button className="btn small danger" onClick={() => setQs((a) => a.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </header>
          <div className="stack">
            <div className="grid2">
              <label>Answer format
                <select value={q.kind} onChange={(e) => { if (q.prompt || confirm('Changing the format resets this question’s answers. Keep the question text?')) set(i, { ...blank(e.target.value as QuestionKind), prompt: q.prompt, basePoints: q.basePoints, id: q.id }); }}>
                  {QUESTION_KINDS.map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
                </select>
              </label>
              <label>Points for a correct answer<input type="number" min={0} max={10000} value={q.basePoints} onChange={(e) => set(i, { basePoints: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })} /></label>
            </div>
            <label>Question<textarea rows={2} value={q.prompt} maxLength={3000} placeholder="Write your question" onChange={(e) => set(i, { prompt: e.target.value })} /></label>
            <KindEditor q={q} onChange={(patch) => set(i, patch)} />
          </div>
        </section>
      ))}

      <section className="panel stack">
        <h2>Add a question</h2>
        <div className="row">{QUESTION_KINDS.map((k) => (
          <button key={k} className="btn small ghost" onClick={() => { setQs((a) => [...a, blank(k)]); setTimeout(() => lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}>+ {kindLabels[k]}</button>
        ))}</div>
        <p className="note">{qs.length} question{qs.length === 1 ? '' : 's'}. Drafts may be empty; a published quiz needs at least one complete question.</p>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {saved && <p className="success" role="status">{saved}</p>}
      <div className="row">
        <button className="btn ghost" disabled={busy || !title.trim()} onClick={() => save('draft')}>{status === 'published' ? 'Save & unpublish (back to draft)' : 'Save as draft'}</button>
        <button className="btn" disabled={busy || !title.trim()} onClick={() => save('published')}>{status === 'published' ? 'Save changes (stay published)' : 'Save & publish'}</button>
        {id && <Link className="btn ghost" href={`/quiz/setup/${id}`}>Play this quiz</Link>}
      </div>
    </main>
  );
}

function KindEditor({ q, onChange }: { q: Question; onChange: (p: Partial<Question>) => void }) {
  const pl: any = q.payload, ak: any = q.answerKey;
  switch (q.kind) {
    case 'multiple_choice': {
      const opts = pl.options as { id: string; text: string }[];
      return (
        <div className="stack">
          <p className="note">Type the options and select the one correct answer.</p>
          {opts.map((o, j) => (
            <div className="row" key={o.id} style={{ flexWrap: 'nowrap' }}>
              <input type="radio" name={`correct-${opts[0]!.id}`} checked={ak.correctIds[0] === o.id} onChange={() => onChange({ answerKey: { correctIds: [o.id] } })} aria-label={`Option ${j + 1} is correct`} />
              <input aria-label={`Option ${j + 1}`} value={o.text} placeholder={`Option ${j + 1}`} maxLength={500} onChange={(e) => onChange({ payload: { options: opts.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) } })} />
              <button className="btn small ghost" disabled={opts.length <= 2} aria-label={`Remove option ${j + 1}`} onClick={() => { const rest = opts.filter((x) => x.id !== o.id); onChange({ payload: { options: rest }, answerKey: { correctIds: [ak.correctIds[0] === o.id ? rest[0]!.id : ak.correctIds[0]] } }); }}>✕</button>
            </div>
          ))}
          <div><button className="btn small ghost" disabled={opts.length >= 8} onClick={() => onChange({ payload: { options: [...opts, { id: uid('o'), text: '' }] } })}>+ Add option</button></div>
        </div>
      );
    }
    case 'answer_forge':
      return (
        <div className="stack">
          <label>Accepted answers (one per line — any of them is correct)<textarea rows={3} value={(ak.accepted as string[]).join('\n')} onChange={(e) => onChange({ answerKey: { ...ak, accepted: e.target.value.split('\n') } })} /></label>
          <div className="grid2">
            <label className="inline"><input type="checkbox" checked={!!pl.caseSensitive} onChange={(e) => onChange({ payload: { ...pl, caseSensitive: e.target.checked } })} /> Case-sensitive</label>
            <label>Numeric tolerance (optional, ± this much)<input type="number" min={0} step="any" value={ak.numericTolerance ?? ''} onChange={(e) => { const k = { ...ak }; if (e.target.value === '') delete k.numericTolerance; else k.numericTolerance = Math.max(0, Number(e.target.value)); onChange({ answerKey: k }); }} /></label>
          </div>
        </div>
      );
    case 'connection_rush': {
      const L = pl.left as { id: string; label: string }[], R = pl.right as { id: string; label: string }[];
      const pairs = ak.pairs as { leftId: string; rightId: string }[];
      return (
        <div className="stack">
          <p className="note">Each row is a correct pair. Players see the right-hand column shuffled and must connect them.</p>
          {L.map((l, j) => (
            <div className="grid2" key={l.id}>
              <label>Left {j + 1}<input value={l.label} maxLength={500} onChange={(e) => onChange({ payload: { ...pl, left: L.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) } })} /></label>
              <label>Matches right {j + 1}<input value={R[j]?.label ?? ''} maxLength={500} onChange={(e) => onChange({ payload: { ...pl, right: R.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) } })} /></label>
            </div>
          ))}
          <div className="row">
            <button className="btn small ghost" disabled={L.length >= 12} onClick={() => { const a = uid('l'), b = uid('r'); onChange({ payload: { left: [...L, { id: a, label: '' }], right: [...R, { id: b, label: '' }] }, answerKey: { pairs: [...pairs, { leftId: a, rightId: b }] } }); }}>+ Add pair</button>
            <button className="btn small ghost" disabled={L.length <= 2} onClick={() => onChange({ payload: { left: L.slice(0, -1), right: R.slice(0, -1) }, answerKey: { pairs: pairs.slice(0, -1) } })}>Remove last pair</button>
          </div>
        </div>
      );
    }
    case 'truth_hunt': {
      const S = pl.statements as { id: string; text: string }[];
      return (
        <div className="stack">
          <p className="note">Write statements and mark whether each one is true or false.</p>
          {S.map((s, j) => (
            <div className="row" key={s.id} style={{ flexWrap: 'nowrap' }}>
              <input aria-label={`Statement ${j + 1}`} value={s.text} placeholder={`Statement ${j + 1}`} maxLength={500} onChange={(e) => onChange({ payload: { statements: S.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) } })} />
              <select aria-label={`Statement ${j + 1} is`} style={{ width: 110 }} value={ak.truth[s.id] ? 'true' : 'false'} onChange={(e) => onChange({ answerKey: { truth: { ...ak.truth, [s.id]: e.target.value === 'true' } } })}><option value="true">True</option><option value="false">False</option></select>
            </div>
          ))}
          <div className="row">
            <button className="btn small ghost" disabled={S.length >= 20} onClick={() => { const n = uid('s'); onChange({ payload: { statements: [...S, { id: n, text: '' }] }, answerKey: { truth: { ...ak.truth, [n]: true } } }); }}>+ Add statement</button>
            <button className="btn small ghost" disabled={S.length <= 1} onClick={() => { const last = S[S.length - 1]!.id; const t = { ...ak.truth }; delete t[last]; onChange({ payload: { statements: S.slice(0, -1) }, answerKey: { truth: t } }); }}>Remove last</button>
          </div>
        </div>
      );
    }
    case 'fill_table': {
      const cols = pl.columns as string[], rows = pl.rows as { text: string; blank: boolean }[][];
      const cells = ak.cells as Record<string, string[]>;
      const setCell = (r: number, c: number, patch: Partial<{ text: string; blank: boolean }>) => rows.map((row, rr) => row.map((cell, cc) => (rr === r && cc === c ? { ...cell, ...patch } : cell)));
      return (
        <div className="stack">
          <p className="note">Tick “Blank” for cells players must fill in, then type the accepted answers (separate alternatives with “ | ”).</p>
          <div className="tablewrap"><table>
            <thead><tr>{cols.map((c, j) => <th key={j}><input aria-label={`Column ${j + 1} heading`} value={c} onChange={(e) => onChange({ payload: { ...pl, columns: cols.map((x, k) => (k === j ? e.target.value : x)) } })} /></th>)}</tr></thead>
            <tbody>{rows.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => {
                const k = `${r}:${c}`;
                return (
                  <td key={c}>
                    <label className="inline"><input type="checkbox" checked={cell.blank} onChange={(e) => {
                      const nc = { ...cells };
                      if (e.target.checked) nc[k] = ['']; else delete nc[k];
                      onChange({ payload: { ...pl, rows: setCell(r, c, { blank: e.target.checked, text: e.target.checked ? '' : cell.text }) }, answerKey: { cells: nc } });
                    }} /> Blank</label>
                    {cell.blank
                      ? <input aria-label={`Accepted answers for row ${r + 1}, column ${c + 1}`} placeholder="Accepted answer(s)" value={(cells[k] ?? ['']).join(' | ')} onChange={(e) => onChange({ answerKey: { cells: { ...cells, [k]: e.target.value.split('|').map((s) => s.trimStart()) } } })} />
                      : <input aria-label={`Cell text row ${r + 1}, column ${c + 1}`} placeholder="Visible text" value={cell.text} onChange={(e) => onChange({ payload: { ...pl, rows: setCell(r, c, { text: e.target.value }) } })} />}
                  </td>
                );
              })}</tr>
            ))}</tbody>
          </table></div>
          <div className="row">
            <button className="btn small ghost" disabled={rows.length >= 30} onClick={() => onChange({ payload: { ...pl, rows: [...rows, cols.map(() => ({ text: '', blank: false }))] } })}>+ Row</button>
            <button className="btn small ghost" disabled={rows.length <= 1} onClick={() => { const last = rows.length - 1; const nc = { ...cells }; Object.keys(nc).filter((k) => k.startsWith(`${last}:`)).forEach((k) => delete nc[k]); onChange({ payload: { ...pl, rows: rows.slice(0, -1) }, answerKey: { cells: nc } }); }}>− Row</button>
            <button className="btn small ghost" disabled={cols.length >= 12} onClick={() => onChange({ payload: { columns: [...cols, `Column ${cols.length + 1}`], rows: rows.map((r) => [...r, { text: '', blank: false }]) } })}>+ Column</button>
            <button className="btn small ghost" disabled={cols.length <= 1} onClick={() => { const last = cols.length - 1; const nc = { ...cells }; Object.keys(nc).filter((k) => k.endsWith(`:${last}`)).forEach((k) => delete nc[k]); onChange({ payload: { columns: cols.slice(0, -1), rows: rows.map((r) => r.slice(0, -1)) }, answerKey: { cells: nc } }); }}>− Column</button>
          </div>
        </div>
      );
    }
  }
}
