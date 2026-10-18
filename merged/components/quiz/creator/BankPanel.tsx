'use client';
import { useEffect, useMemo, useState } from 'react';
import { addToBank, listBank, removeFromBank, type BankItem } from '@/lib/quiz/question-bank';
import { kindLabels, type Question } from '@/lib/quiz/types';

/** Question Bank: save the open question for reuse, search, and insert copies into this quiz. */
export default function BankPanel({ questions, active, onInsert, onClose }: { questions: Question[]; active: number; onInsert: (qs: Question[]) => void; onClose: () => void }) {
  const [items, setItems] = useState<BankItem[] | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [tags, setTags] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const refresh = () => listBank().then((r) => { setItems(r.items); setNote(r.note ?? ''); });
  useEffect(() => { void refresh(); }, []);
  const shown = useMemo(() => (items ?? []).filter((i) => !search.trim() || `${i.question.prompt} ${i.tags.join(' ')} ${kindLabels[i.question.kind]}`.toLowerCase().includes(search.trim().toLowerCase())), [items, search]);
  const current = questions[active];

  async function save() {
    if (!current) return;
    try {
      const where = await addToBank(current, tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8));
      setMsg(where === 'account' ? 'Saved to your account’s bank.' : 'Saved to the bank on this device.'); setTags(''); await refresh();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <section className="panel stack cr-tool" aria-labelledby="bank-h">
      <div className="row spread"><h2 id="bank-h" style={{ margin: 0 }}>Question Bank</h2><button className="btn small ghost" onClick={onClose}>Close</button></div>
      {note && <p className="info" role="status">{note}</p>}
      <div className="stack">
        <h3 style={{ margin: 0 }}>Save the open question</h3>
        {current && current.prompt.trim() ? (
          <div className="row">
            <label style={{ flex: 1 }}>Tags (comma separated, optional)<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="biology, cells" /></label>
            <button className="btn" onClick={save}>Save “{current.prompt.slice(0, 24)}{current.prompt.length > 24 ? '…' : ''}”</button>
          </div>
        ) : <p className="note">Write the question first, then save it here.</p>}
        {msg && <p className="success" role="status">{msg}</p>}
      </div>
      <div className="stack">
        <h3 style={{ margin: 0 }}>Reuse a question</h3>
        <label>Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text, tag or format" /></label>
        {items === null ? <p className="muted-text" role="status">Loading…</p> : shown.length === 0 ? <p className="muted-text">{items.length ? 'Nothing matches.' : 'The bank is empty. Save a question above to start it.'}</p> : (
          <ul className="cr-bank">
            {shown.map((i) => (
              <li key={i.id}>
                <label className="row" style={{ flexWrap: 'nowrap' }}>
                  <input type="checkbox" checked={picked.has(i.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} />
                  <span><strong>{i.question.prompt.slice(0, 90)}</strong><br /><span className="note">{kindLabels[i.question.kind]} · {i.where === 'account' ? 'Account' : 'This device'}{i.tags.length ? ` · ${i.tags.join(', ')}` : ''}</span></span>
                </label>
                <button className="btn small ghost" onClick={async () => { if (window.confirm('Remove this question from the bank?')) { await removeFromBank(i).catch((e) => setMsg((e as Error).message)); await refresh(); } }}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <div><button className="btn" disabled={picked.size === 0} onClick={() => { onInsert((items ?? []).filter((i) => picked.has(i.id)).map((i) => ({ ...JSON.parse(JSON.stringify(i.question)), id: undefined }))); setPicked(new Set()); setMsg('Added to the quiz.'); }}>Add {picked.size || ''} selected to this quiz</button></div>
      </div>
    </section>
  );
}
