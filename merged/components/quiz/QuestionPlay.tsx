'use client';
import { useMemo, useState } from 'react';
import { kindLabels, type QuestionKind } from '@/lib/quiz/types';

export type PlayQuestion = { id: string; kind: QuestionKind; prompt: string; payload: any; base_points: number };

/** Renders one question in any of the five formats and returns the player's response. It never knows the answer. */
export default function QuestionPlay({ question: q, onSubmit, busy = false, disabled = false, submitLabel = 'Submit answer' }: {
  question: PlayQuestion; onSubmit: (response: unknown) => Promise<unknown>; busy?: boolean; disabled?: boolean; submitLabel?: string;
}) {
  const p = q.payload;
  const [choice, setChoice] = useState('');
  const [forge, setForge] = useState('');
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [truth, setTruth] = useState<Record<string, boolean>>({});
  const [cells, setCells] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const leftIds: string[] = useMemo(() => (q.kind === 'connection_rush' ? p.left.map((a: any) => a.id) : []), [q.kind, p]);

  const response = (): unknown => {
    switch (q.kind) {
      case 'multiple_choice': return { kind: q.kind, selectedIds: choice ? [choice] : [] };
      case 'answer_forge': return { kind: q.kind, text: forge };
      case 'connection_rush': return { kind: q.kind, pairs: leftIds.map((l) => ({ leftId: l, rightId: pairs[l] ?? '' })) };
      case 'truth_hunt': return { kind: q.kind, truth };
      case 'fill_table': return { kind: q.kind, cells };
    }
  };
  const valid =
    q.kind === 'multiple_choice' ? !!choice :
    q.kind === 'answer_forge' ? !!forge.trim() :
    q.kind === 'connection_rush' ? leftIds.every((x) => pairs[x]) && new Set(Object.values(pairs)).size === leftIds.length :
    q.kind === 'truth_hunt' ? p.statements.every((x: any) => x.id in truth) :
    p.rows.every((row: any[], r: number) => row.every((cell: any, c: number) => !cell.blank || (cells[`${r}:${c}`] ?? '').trim().length > 0));

  async function submit() {
    if (!valid || disabled || busy || sent) return;
    setSent(true);
    try { await onSubmit(response()); } catch { setSent(false); } // the parent shows the error; allow another try
  }
  const off = disabled || sent;
  const usedRights = new Set(Object.values(pairs));

  return (
    <div className="stack">
      <div><p className="eyebrow">{kindLabels[q.kind]} · {q.base_points} points</p><p className="prompt">{q.prompt}</p></div>
      {q.kind === 'multiple_choice' && (
        <div className="answers" role="radiogroup" aria-label="Answer options">
          {p.options.map((o: any) => <button key={o.id} role="radio" aria-checked={choice === o.id} className="choice" aria-pressed={choice === o.id} onClick={() => setChoice(o.id)} disabled={off}>{o.text}</button>)}
        </div>
      )}
      {q.kind === 'answer_forge' && (
        <label>Your answer<input value={forge} onChange={(e) => setForge(e.target.value)} disabled={off} maxLength={500} autoComplete="off" placeholder={p.placeholder ?? 'Your answer'} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} /></label>
      )}
      {q.kind === 'connection_rush' && (
        <div className="stack">
          <p className="note">Connect every item on the left to one item on the right. Each can be used once.</p>
          {p.left.map((l: any) => (
            <div className="grid2" key={l.id} style={{ alignItems: 'center' }}>
              <strong>{l.label}</strong>
              <select aria-label={`Match for ${l.label}`} disabled={off} value={pairs[l.id] ?? ''} onChange={(e) => setPairs((s) => ({ ...s, [l.id]: e.target.value }))}>
                <option value="">Choose a match…</option>
                {p.right.map((r: any) => <option key={r.id} value={r.id} disabled={usedRights.has(r.id) && pairs[l.id] !== r.id}>{r.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {q.kind === 'truth_hunt' && (
        <div className="stack">
          <p className="note">Decide whether each statement is true or false.</p>
          {p.statements.map((s: any) => (
            <div className="row spread" key={s.id}>
              <span style={{ flex: '1 1 260px' }}>{s.text}</span>
              <div className="row" role="group" aria-label={`Is this true? ${s.text}`}>
                <button className="btn small ghost" aria-pressed={truth[s.id] === true} disabled={off} onClick={() => setTruth((v) => ({ ...v, [s.id]: true }))}>True</button>
                <button className="btn small ghost" aria-pressed={truth[s.id] === false} disabled={off} onClick={() => setTruth((v) => ({ ...v, [s.id]: false }))}>False</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {q.kind === 'fill_table' && (
        <div className="tablewrap"><table>
          <thead><tr>{p.columns.map((c: string, i: number) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{p.rows.map((row: any[], r: number) => (
            <tr key={r}>{row.map((cell: any, c: number) => (
              <td key={c}>{cell.blank
                ? <input aria-label={`Fill row ${r + 1}, column ${c + 1}`} placeholder="Fill in" disabled={off} maxLength={500} value={cells[`${r}:${c}`] ?? ''} onChange={(e) => setCells((s) => ({ ...s, [`${r}:${c}`]: e.target.value }))} />
                : cell.text}</td>
            ))}</tr>
          ))}</tbody>
        </table></div>
      )}
      <div><button className="btn" onClick={submit} disabled={!valid || off || busy}>{sent ? 'Answer sent' : busy ? 'Checking…' : submitLabel}</button></div>
    </div>
  );
}
