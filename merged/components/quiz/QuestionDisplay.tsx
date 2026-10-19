import type { Loose } from '@/lib/quiz/loose';
import { kindLabels } from '@/lib/quiz/types';

/** Read-only view of a question for a projector screen. */
export default function QuestionDisplay({ q }: { q: { kind: string; prompt: string; payload: Loose; base_points: number } }) {
  const p = q.payload;
  return (
    <div className="stack">
      <p className="eyebrow">{(kindLabels as Loose)[q.kind]} · {q.base_points} points</p>
      <p className="prompt">{q.prompt}</p>
      {q.kind === 'multiple_choice' && <div className="answers">{p.options.map((o: Loose, i: number) => <div key={o.id} className="choice" style={{ cursor: 'default' }}><strong>{String.fromCharCode(65 + i)}</strong> {o.text}</div>)}</div>}
      {q.kind === 'answer_forge' && <p className="note">Teams write or say their answer.</p>}
      {q.kind === 'connection_rush' && (
        <div className="grid2"><div className="stack">{p.left.map((l: Loose, i: number) => <div key={l.id} className="choice" style={{ cursor: 'default' }}><strong>{i + 1}</strong> {l.label}</div>)}</div>
          <div className="stack">{p.right.map((r: Loose, i: number) => <div key={r.id} className="choice" style={{ cursor: 'default' }}><strong>{String.fromCharCode(65 + i)}</strong> {r.label}</div>)}</div></div>
      )}
      {q.kind === 'truth_hunt' && <ol>{p.statements.map((s: Loose) => <li key={s.id} style={{ marginBottom: 6 }}>{s.text} <span className="note">(true or false?)</span></li>)}</ol>}
      {q.kind === 'fill_table' && (
        <div className="tablewrap"><table><thead><tr>{p.columns.map((c: string, i: number) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{p.rows.map((row: Loose[], r: number) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell.blank ? <em className="note">＿＿＿＿</em> : cell.text}</td>)}</tr>)}</tbody></table></div>
      )}
    </div>
  );
}
