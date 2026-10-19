'use client';
import type { Loose } from '@/lib/quiz/loose';
import { uid } from '@/lib/quiz/editor-model';
import type { Question } from '@/lib/quiz/types';

/** The per-format answer editor. Each of the five formats keeps its own data shape, exactly as the server validates it. */
export default function KindEditor({ q, onChange }: { q: Question; onChange: (p: Partial<Question>) => void }) {
  const pl: Loose = q.payload, ak: Loose = q.answerKey;
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
