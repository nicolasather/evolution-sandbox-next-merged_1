import { kindLabels } from '@/lib/quiz/types';

/** Human-readable correct answer, shown only after reveal. */
export default function AnswerView({ kind, payload, answerKey }: { kind: string; payload: any; answerKey: any }) {
  let body: React.ReactNode = null;
  if (!answerKey) return null;
  if (kind === 'multiple_choice') body = <>{(answerKey.correctIds as string[]).map((cid) => payload.options.find((o: any) => o.id === cid)?.text).filter(Boolean).join(' · ')}</>;
  else if (kind === 'answer_forge') body = <ul>{(answerKey.accepted as string[]).map((a, i) => <li key={i}>{a}</li>)}{answerKey.numericTolerance ? <li>(±{answerKey.numericTolerance} accepted)</li> : null}</ul>;
  else if (kind === 'connection_rush') body = <ul>{(answerKey.pairs as any[]).map((pr, i) => <li key={i}>{payload.left.find((x: any) => x.id === pr.leftId)?.label} → {payload.right.find((x: any) => x.id === pr.rightId)?.label}</li>)}</ul>;
  else if (kind === 'truth_hunt') body = <ul>{payload.statements.map((s: any) => <li key={s.id}>{s.text} — <strong>{answerKey.truth[s.id] ? 'True' : 'False'}</strong></li>)}</ul>;
  else if (kind === 'fill_table') body = (
    <div className="tablewrap"><table><thead><tr>{payload.columns.map((c: string, i: number) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>{payload.rows.map((row: any[], r: number) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell.blank ? <strong>{(answerKey.cells[`${r}:${c}`] ?? []).join(' / ')}</strong> : cell.text}</td>)}</tr>)}</tbody></table></div>
  );
  const notes = kind === 'multiple_choice' && answerKey.distractorNotes ? Object.entries(answerKey.distractorNotes as Record<string, string>).filter(([, t]) => t) : [];
  return (
    <div className="answer-key" role="note">
      <strong>Correct answer ({(kindLabels as any)[kind]}):</strong> {body}
      {answerKey.explanation && <p style={{ margin: '8px 0 0' }}><strong>Why:</strong> {answerKey.explanation}</p>}
      {notes.length > 0 && <ul className="note" style={{ margin: '8px 0 0' }}>{notes.map(([id, t]) => <li key={id}><em>{payload.options.find((o: any) => o.id === id)?.text}</em> — {t}</li>)}</ul>}
    </div>
  );
}
