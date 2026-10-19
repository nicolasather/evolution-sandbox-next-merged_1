'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/quiz/client';
import { prepare } from '@/lib/quiz/editor-model';
import { explainIssue } from '@/lib/quiz/explain';
import { deleteLocalDraft, exportDraftJson, listDeviceDrafts, storageIsMemoryOnly, type LocalDraft } from '@/lib/quiz/local-drafts';
import { currentSession, ensureCloudSession, type SessionInfo } from '@/lib/quiz/session-client';
import { saveQuizSchema } from '@/lib/quiz/validation';
import { modeLabels, type PlayMode } from '@/lib/quiz/types';

type Item = { id: string; title: string; description: string; status: 'draft' | 'published'; updated_at: string; questionCount: number; isMine: boolean };
type Sort = 'new' | 'title' | 'size';

const sorters: Record<Sort, (a: Item, b: Item) => number> = {
  new: (a, b) => b.updated_at.localeCompare(a.updated_at),
  title: (a, b) => a.title.localeCompare(b.title),
  size: (a, b) => b.questionCount - a.questionCount,
};
const when = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };

export default function QuizList({ mine, mode = null }: { mine: boolean; mode?: PlayMode | null }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [device, setDevice] = useState<LocalDraft[]>([]);
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const [tab, setTab] = useState<'draft' | 'published'>('draft');
  const [busyId, setBusyId] = useState('');
  const [reload, setReload] = useState(0);
  const [memoryOnly, setMemoryOnly] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await api<{ quizzes: Item[] }>(`/api/quiz/quizzes${mine ? '?mine=1' : ''}`);
        if (live) { setItems(d.quizzes); setError(''); }
      } catch (e) {
        if (!live) return;
        const status = (e as { status?: number }).status;
        setItems([]);
        // "My Quizzes" without a session is not an error: the person simply has no online quizzes (device drafts show below).
        if (!(mine && (status === 401 || status === 503))) setError((e as Error).message);
      }
    })();
    if (mine) {
      // device drafts live in browser storage, which only exists after hydration
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDevice(listDeviceDrafts()); setMemoryOnly(storageIsMemoryOnly());
      void currentSession().then((s) => { if (live) setSession(s); });
    }
    return () => { live = false; };
  }, [mine, reload]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (items ?? []).filter((x) => (!mine || x.status === tab) && (x.title + ' ' + x.description).toLowerCase().includes(q)).sort(sorters[sort]), [items, q, sort, mine, tab]);
  const shownDevice = useMemo(() => (mine && tab === 'draft' ? device.filter((d) => (d.title + ' ' + d.description).toLowerCase().includes(q)) : []), [device, q, mine, tab]);
  const counts = useMemo(() => ({ draft: (items ?? []).filter((x) => x.status === 'draft').length + device.length, published: (items ?? []).filter((x) => x.status === 'published').length }), [items, device]);

  async function toggle(it: Item) {
    setBusyId(it.id); setError('');
    try { await api(`/api/quiz/quizzes/${it.id}`, { method: 'PATCH', json: { status: it.status === 'published' ? 'draft' : 'published' } }); setReload((n) => n + 1); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  }
  async function remove(it: Item) {
    if (!window.confirm(`Permanently delete “${it.title}”? This cannot be undone.`)) return;
    setBusyId(it.id); setError('');
    try { await api(`/api/quiz/quizzes/${it.id}`, { method: 'DELETE' }); setReload((n) => n + 1); }
    catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  }
  function removeDevice(d: LocalDraft) {
    if (!window.confirm(`Delete the draft “${d.title || 'Untitled'}” from this device? It is not saved anywhere else.`)) return;
    deleteLocalDraft(d.key); setReload((n) => n + 1);
  }
  function exportDevice(d: LocalDraft) {
    const url = URL.createObjectURL(new Blob([exportDraftJson(d)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${(d.title || 'quiz').replace(/[^\w-]+/g, '-').slice(0, 40)}-backup.json`; a.click(); URL.revokeObjectURL(url);
  }
  /** Explicit migration: copy a device draft into the online account/guest session, and only remove the device copy after the server confirms. */
  async function migrate(d: LocalDraft) {
    setBusyId(d.key); setError(''); setNotice('');
    try {
      const parsed = saveQuizSchema.safeParse({ title: d.title.trim(), description: d.description, status: 'draft', questions: d.questions.map(prepare) });
      if (!parsed.success) { const is = parsed.error.issues[0]!; throw new Error(`Open the draft and finish it first. ${explainIssue({ path: is.path as (string | number)[], message: is.message, code: is.code })}`); }
      const cloud = await ensureCloudSession();
      if (cloud.status !== 'ready') throw new Error('Online saving needs an account. Sign in or create one, then come back here and press Save Online.');
      await api('/api/quiz/quizzes', { method: 'POST', json: parsed.data });
      deleteLocalDraft(d.key);
      setNotice(`“${d.title}” is now saved online.`);
      setReload((n) => n + 1);
    } catch (e) { setError((e as Error).message); } finally { setBusyId(''); }
  }

  const loading = items === null;
  const totalShown = shown.length + shownDevice.length;
  const playHref = (id: string) => `/quiz/setup/${id}${mode ? `?mode=${mode}` : ''}`;

  const controls = (
    <div className="qz-search">
      <label>Search quizzes<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or description" /></label>
      <label style={{ flex: '0 0 200px' }}>Sort by
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="new">Recently updated</option><option value="title">Title A–Z</option><option value="size">Most questions</option>
        </select>
      </label>
    </div>
  );

  return (
    <main id="main">
      {mine ? (
        <div className="page" style={{ marginBottom: 0 }}>
          <header className="page-header" style={{ marginBottom: 8 }}>
            <div><p className="eyebrow">Your workspace</p><h1>My Quizzes</h1></div>
            <Link className="btn" href="/quiz/new">Create a Quiz</Link>
          </header>
        </div>
      ) : (
        <section className="qz-banner" aria-labelledby="lib-h">
          <Image src="/quiz/art/library-shelves.svg" alt="" width={1600} height={420} unoptimized priority />
          <div className="inner">
            <h1 id="lib-h">Quiz Library</h1>
            <p style={{ maxWidth: '52ch', margin: 0 }}>Quizzes people have published. Anyone can play them.</p>
            {mode && <p className="info" style={{ marginTop: 16, maxWidth: 640 }}>Selected mode: <strong>{modeLabels[mode]}</strong>. Choose a quiz to play with it. <Link href="/quiz/modes">Change mode</Link></p>}
          </div>
        </section>
      )}

      <div className="page" style={{ marginTop: mine ? 8 : 24 }}>
        {mine && (
          <>
            <div className="tab-row" role="tablist" aria-label="My quizzes">
              <button role="tab" id="tab-draft" aria-selected={tab === 'draft'} aria-controls="list-panel" onClick={() => setTab('draft')}>Drafts ({counts.draft})</button>
              <button role="tab" id="tab-pub" aria-selected={tab === 'published'} aria-controls="list-panel" onClick={() => setTab('published')}>Published ({counts.published})</button>
            </div>
            {session === null && device.length > 0 && (
              <p className="info" role="status">Saved on this device. These drafts live only in this browser — they are not backed up or synced. <Link href="/quiz/login?next=/quiz/my">Save to an account</Link> whenever you like; nothing is required.</p>
            )}
            {memoryOnly && <p className="error" role="alert" style={{ marginTop: 10 }}>This browser is blocking storage, so drafts can’t be kept after you close the tab. Use Export Backup in the editor.</p>}
          </>
        )}
        {controls}
        {loading && <p className="sr-only" role="status">Loading quizzes…</p>}
        {error && (
          <div className="error stack" role="alert" style={{ margin: '14px 0' }}><span>{error}</span><div><button className="btn small ghost" onClick={() => setReload((n) => n + 1)}>Try again</button></div></div>
        )}
        {notice && <p className="success" role="status" style={{ margin: '14px 0' }}>{notice}</p>}
        {!loading && !error && <p className="note" role="status" style={{ margin: '4px 0 18px' }}>{totalShown} quiz{totalShown === 1 ? '' : 'zes'}{q ? ' match your search' : ''}.{!mine && (items?.length ?? 0) >= 100 ? ' Showing the 100 most recently updated.' : ''}</p>}

        <div id="list-panel" role={mine ? 'tabpanel' : undefined} aria-labelledby={mine ? (tab === 'draft' ? 'tab-draft' : 'tab-pub') : undefined}>
          {loading ? (
            <div className="cards" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="qz-skel" />)}</div>
          ) : totalShown === 0 && !error ? (
            <section className="empty">
              <h2>No quizzes found</h2>
              <p className="muted-text">{q ? 'Nothing matches your search.' : mine ? (tab === 'draft' ? 'You have no drafts yet.' : 'You have not published a quiz yet.') : 'No quizzes have been published yet.'}</p>
              <Link className="btn" href="/quiz/new">Create a Quiz</Link>
            </section>
          ) : (
            <div className="cards">
              {shownDevice.map((d) => (
                <article className="qz-tile" key={d.key} style={{ ['--c' as string]: 'var(--qz-paper)' }}>
                  <div className="stripe" />
                  <div className="body">
                    <h2>{d.title || 'Untitled quiz'}</h2>
                    <div className="meta"><span className="pill local">On this device</span><span>{d.questions.length} question{d.questions.length === 1 ? '' : 's'}</span><span>Edited {when(d.updatedAt)}</span></div>
                    <p className="note" style={{ margin: 0 }}>Saved on this device only.</p>
                    <div className="actions">
                      <Link className="btn small" href={`/quiz/edit/${d.key}`}>Edit</Link>
                      <button className="btn small cyan" disabled={busyId === d.key || !d.title.trim() || session === null} title={session === null ? 'Sign in or continue as a guest first' : undefined} onClick={() => migrate(d)}>{busyId === d.key ? 'Saving…' : 'Save Online'}</button>
                      <button className="btn small ghost" onClick={() => exportDevice(d)}>Export Backup</button>
                      <button className="btn small danger" onClick={() => removeDevice(d)}>Delete</button>
                    </div>
                    {session === null && <p className="note" style={{ margin: 0 }}><Link href="/quiz/login?next=/quiz/my">Sign in or create an account</Link> to save this online.</p>}
                  </div>
                </article>
              ))}
              {shown.map((it) => (
                <article className="qz-tile" key={it.id} style={{ ['--c' as string]: it.status === 'published' ? 'var(--qz-cyan)' : 'var(--qz-yellow)' }}>
                  <div className="stripe" />
                  <div className="body">
                    <h2>{it.title}</h2>
                    <div className="meta"><span className={`pill ${it.status}`}>{it.status}</span><span>{it.questionCount} question{it.questionCount === 1 ? '' : 's'}</span><span>Updated {when(it.updated_at)}</span></div>
                    <p className="muted-text" style={{ margin: 0 }}>{it.description || 'No description.'}</p>
                    <p className="note" style={{ margin: 0 }}>Playable: Solo, Classroom projector, Online.</p>
                    <div className="actions">
                      {it.questionCount > 0 ? <Link className="btn small" href={playHref(it.id)}>Play</Link> : <span className="note">Add questions to play</span>}
                      {mine && <>
                        <Link className="btn small ghost" href={`/quiz/edit/${it.id}`}>Edit</Link>
                        <button className="btn small ghost" disabled={busyId === it.id || (it.status === 'draft' && it.questionCount === 0)} onClick={() => toggle(it)}>{it.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                        <button className="btn small danger" disabled={busyId === it.id} onClick={() => remove(it)}>Delete</button>
                      </>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
