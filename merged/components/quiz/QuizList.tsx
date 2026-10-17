'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/quiz/client';

type Item = { id: string; title: string; description: string; status: 'draft' | 'published'; updated_at: string; questionCount: number; isMine: boolean };

export default function QuizList({ mine }: { mine: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try { const d = await api<{ quizzes: Item[] }>(`/api/quiz/quizzes${mine ? '?mine=1' : ''}`); setItems(d.quizzes); setError(''); }
    catch (e) { setItems([]); setError((e as Error).message); }
  }, [mine]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (items ?? []).filter((q) => (q.title + ' ' + q.description).toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  async function toggle(q: Item) {
    setBusyId(q.id); setError('');
    try { await api(`/api/quiz/quizzes/${q.id}`, { method: 'PATCH', json: { status: q.status === 'published' ? 'draft' : 'published' } }); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  }
  async function remove(q: Item) {
    if (!confirm(`Permanently delete “${q.title}”? This cannot be undone.`)) return;
    setBusyId(q.id); setError('');
    try { await api(`/api/quiz/quizzes/${q.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div><p className="eyebrow">{mine ? 'Your workspace' : 'Community library'}</p><h1>{mine ? 'My Quizzes' : 'Quiz library'}</h1>
          <p className="muted-text">{mine ? 'Drafts and published quizzes you own.' : 'Quizzes that other people have published. Anyone can play them.'}</p></div>
        <Link className="btn" href="/quiz/new">Create a quiz</Link>
      </header>
      <label style={{ maxWidth: 360, marginBottom: 16 }}>Search<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {items === null ? <p className="muted-text">Loading…</p> : shown.length === 0 ? (
        <section className="panel"><h2>{items.length ? 'No quiz matches your search' : mine ? 'You haven’t created a quiz yet' : 'No quizzes have been published yet'}</h2>
          <p className="muted-text">Quizzes are written by people like you — there is no preloaded content.</p>
          <Link className="btn" href="/quiz/new">Create the first one</Link></section>
      ) : (
        <div className="cards">
          {shown.map((q) => (
            <article className="panel stack" key={q.id}>
              <div className="row spread"><h2 style={{ margin: 0 }}>{q.title}</h2><span className={`pill ${q.status}`}>{q.status}</span></div>
              <p className="muted-text">{q.description || 'No description'}</p>
              <p className="note">{q.questionCount} question{q.questionCount === 1 ? '' : 's'}</p>
              <div className="row">
                {q.questionCount > 0 ? <Link className="btn small" href={`/quiz/setup/${q.id}`}>Play / host</Link> : <span className="note">Add questions to play</span>}
                {mine && <>
                  <Link className="btn small ghost" href={`/quiz/edit/${q.id}`}>Edit</Link>
                  <button className="btn small ghost" disabled={busyId === q.id || (q.status === 'draft' && q.questionCount === 0)} onClick={() => toggle(q)}>{q.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                  <button className="btn small danger" disabled={busyId === q.id} onClick={() => remove(q)}>Delete</button>
                </>}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
