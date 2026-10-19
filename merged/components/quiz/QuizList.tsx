'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/quiz/client';
import { prepare } from '@/lib/quiz/editor-model';
import { explainIssue } from '@/lib/quiz/explain';
import { deleteLocalDraft, exportDraftJson, listDeviceDrafts, storageIsMemoryOnly, type LocalDraft } from '@/lib/quiz/local-drafts';
import { currentSession, ensureCloudSession, type SessionInfo } from '@/lib/quiz/session-client';
import { saveQuizSchema } from '@/lib/quiz/validation';
import { kindLabels, modeLabels, QUESTION_KINDS, type PlayMode } from '@/lib/quiz/types';
import { addFolder, emptyCollections, facets, isVerified, moveToFolder, parseCollections, planBulk, searchLibrary, toggleFavorite, type BulkAction, type Collections, type Filters, type LibraryQuiz, type SortKey } from '@/lib/quiz/library';
import { coverSvg } from '@/lib/quiz/art';
import { formatDuration } from '@/lib/quiz/scoring';
import { MODES } from '@/lib/quiz/projector/modes';
import type { GameKey } from '@/lib/quiz/projector/types';

type Item = { id: string; title: string; description: string; status: 'draft' | 'published'; updated_at: string; questionCount: number; isMine: boolean; meta?: LibraryQuiz['meta']; reviewState?: string; archived?: boolean; kinds?: string[] };
type Tab = 'draft' | 'published' | 'favorites' | 'archived';
const COLL_KEY = 'qz:collections:v1';
const when = (iso: string) => { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };
const AGES = ['5-7', '8-10', '11-13', '14-17', '18+'];

const toLib = (i: Item): LibraryQuiz => ({
  id: i.id, title: i.title, description: i.description, updatedAt: i.updated_at, questionCount: i.questionCount, meta: i.meta,
  questions: (i.kinds ?? []).map((kind) => ({ kind: kind as never, prompt: '', payload: {} })), estimatedSeconds: i.questionCount * 25,
  verified: i.reviewState === 'approved', reviewState: (i.reviewState as LibraryQuiz['reviewState']) ?? 'unreviewed',
});

export default function QuizList({ mine, mode = null, game = null }: { mine: boolean; mode?: PlayMode | null; game?: GameKey | null }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [device, setDevice] = useState<LocalDraft[]>([]);
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey | 'title'>('relevance');
  const [tab, setTab] = useState<Tab>('draft');
  const [filters, setFilters] = useState<Filters>({});
  const [coll, setColl] = useState<Collections>(emptyCollections());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reload, setReload] = useState(0);
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await api<{ quizzes: Item[] }>(`/api/quiz/quizzes${mine ? '?mine=1' : ''}`);
        if (live) { setItems(d.quizzes); setError(''); setOffline(false); }
      } catch (e) {
        if (!live) return;
        const status = (e as { status?: number }).status;
        setItems([]);
        setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
        // "My Quizzes" without a session is not an error: the person simply has no online quizzes (device drafts show below).
        if (!(mine && (status === 401 || status === 503))) setError((e as Error).message);
      }
    })();
    /* browser storage only exists after hydration */
    /* eslint-disable react-hooks/set-state-in-effect */
    try { setColl(parseCollections(localStorage.getItem(COLL_KEY))); } catch { /* ignore */ }
    if (mine) {
      setDevice(listDeviceDrafts()); setMemoryOnly(storageIsMemoryOnly());
      void currentSession().then((s) => { if (live) setSession(s); });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { live = false; };
  }, [mine, reload]);

  const saveColl = useCallback((c: Collections) => { setColl(c); try { localStorage.setItem(COLL_KEY, JSON.stringify(c)); } catch { /* ignore */ } }, []);

  const lib = useMemo(() => (items ?? []).map(toLib), [items]);
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const fac = useMemo(() => facets(lib), [lib]);

  const shown = useMemo(() => {
    let base = items ?? [];
    if (mine) {
      const inFolder = folder ? new Set(coll.folders.find((f) => f.id === folder)?.quizIds ?? []) : null;
      base = base.filter((x) => (tab === 'archived' ? x.archived : !x.archived && (tab === 'favorites' ? coll.favorites.includes(x.id) : x.status === tab)) && (!inFolder || inFolder.has(x.id)));
    } else base = base.filter((x) => !x.archived);
    const ids = new Set(base.map((b) => b.id));
    if (sort === 'title') return base.filter((x) => (x.title + ' ' + x.description).toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.title.localeCompare(b.title));
    const ranked = searchLibrary(lib.filter((l) => ids.has(l.id)), { query, filters, sort: sort as SortKey });
    return ranked.map((r) => byId.get(r.id)!).filter(Boolean);
  }, [items, mine, tab, folder, coll, sort, query, filters, lib, byId]);
  const q = query.trim().toLowerCase();
  const shownDevice = useMemo(() => (mine && tab === 'draft' ? device.filter((d) => (d.title + ' ' + d.description).toLowerCase().includes(q)) : []), [device, q, mine, tab]);
  const counts = useMemo(() => {
    const live = (items ?? []).filter((x) => !x.archived);
    return { draft: live.filter((x) => x.status === 'draft').length + device.length, published: live.filter((x) => x.status === 'published').length, favorites: live.filter((x) => coll.favorites.includes(x.id)).length, archived: (items ?? []).filter((x) => x.archived).length };
  }, [items, device, coll]);

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
  async function bulk(action: BulkAction) {
    const ids = [...picked]; if (!ids.length) return;
    const plan = planBulk(action, ids);
    if (plan.needsConfirm && !window.confirm(plan.message)) return;
    setError(''); setNotice('');
    try {
      if (action === 'archive' || action === 'unarchive') for (const id of ids) await api(`/api/quiz/quizzes/${id}`, { method: 'PATCH', json: { archived: action === 'archive' } });
      else if (action === 'duplicate') for (const id of ids) await api(`/api/quiz/quizzes/${id}/remix`, { method: 'POST', json: {} });
      else if (action === 'delete') for (const id of ids) await api(`/api/quiz/quizzes/${id}`, { method: 'DELETE' });
      else if (action === 'move') {
        const name = window.prompt('Folder name:', coll.folders.find((f) => f.id === folder)?.name ?? ''); if (!name?.trim()) return;
        let c = coll; const existing = c.folders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
        const fid = existing?.id ?? `f${Date.now().toString(36)}`;
        if (!existing) c = addFolder(c, name, fid);
        saveColl(moveToFolder(c, ids, fid));
      } else if (action === 'export') {
        const out = [] as unknown[];
        for (const id of ids) { const d = await api<{ quiz: { title: string; description: string; meta?: unknown }; questions: unknown[] }>(`/api/quiz/quizzes/${id}`); out.push({ title: d.quiz.title, description: d.quiz.description, meta: d.quiz.meta, questions: d.questions }); }
        const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'quiz-studio', bulk: true, quizzes: out }, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'quizzes-backup.json'; a.click(); URL.revokeObjectURL(url);
      }
      setNotice(plan.undoable ? `${plan.message.replace(/\.$/, '')} — done. You can undo this from the Archived list or by deleting the copy.` : 'Done.');
      setPicked(new Set()); setReload((n) => n + 1);
    } catch (e) { setError((e as Error).message); }
  }
  async function duplicate(it: Item) {
    setBusyId(it.id); setError('');
    try { const r = await api<{ id: string }>(`/api/quiz/quizzes/${it.id}/remix`, { method: 'POST', json: {} }); window.location.assign(new URL(`/quiz/edit/${r.id}`, window.location.origin).toString()); }
    catch (e) { setError((e as Error).message); setBusyId(''); }
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
      const parsed = saveQuizSchema.safeParse({ title: d.title.trim(), description: d.description, status: 'draft', meta: d.meta, questions: d.questions.map(prepare) });
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
  const playHref = (id: string) => (game ? `/quiz/setup/${id}/game?game=${game}` : `/quiz/setup/${id}${mode ? `?mode=${mode}` : ''}`);
  const setF = (k: keyof Filters, v: unknown) => setFilters((f) => { const n = { ...f, [k]: v === '' || v === false ? undefined : v } as Filters; return n; });
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  const controls = (
    <div className="stack">
      <div className="qz-search">
        <label>Search quizzes<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, subject, tag or question" /></label>
        <label style={{ flex: '0 0 200px' }}>Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey | 'title')}>
            <option value="relevance">Best match</option><option value="recent">Recently updated</option><option value="title">Title A–Z</option>{!mine && <option value="verified">Reviewed first</option>}
          </select>
        </label>
      </div>
      <details open={hasFilters}>
        <summary>Filters{hasFilters ? ' (active)' : ''}</summary>
        <div className="grid2" style={{ marginTop: 10 }}>
          <label>Subject<select value={filters.subject ?? ''} onChange={(e) => setF('subject', e.target.value)}><option value="">Any</option>{fac.subjects.map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}</select></label>
          <label>Age group<select value={filters.ageBand ?? ''} onChange={(e) => setF('ageBand', e.target.value)}><option value="">Any</option>{AGES.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <label>Language<select value={filters.language ?? ''} onChange={(e) => setF('language', e.target.value)}><option value="">Any</option>{fac.languages.map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}</select></label>
          <label>Question format<select value={filters.kind ?? ''} onChange={(e) => setF('kind', e.target.value)}><option value="">Any</option>{QUESTION_KINDS.map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
          <label>Length<select value={filters.maxSeconds ?? ''} onChange={(e) => setF('maxSeconds', e.target.value ? Number(e.target.value) : undefined)}><option value="">Any</option><option value="300">Up to 5 minutes</option><option value="600">Up to 10 minutes</option><option value="1200">Up to 20 minutes</option></select></label>
          {!mine && <label className="inline"><input type="checkbox" checked={!!filters.verifiedOnly} onChange={(e) => setF('verifiedOnly', e.target.checked)} /> Reviewed by a moderator only</label>}
        </div>
        {hasFilters && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setFilters({})}>Clear filters</button>}
      </details>
    </div>
  );

  return (
    <main id="main">
      {mine ? (
        <div className="page" style={{ marginBottom: 0 }}>
          <nav aria-label="Breadcrumb" className="note"><Link href="/quiz">Quiz Studio</Link> › My Quizzes</nav>
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
            <p style={{ maxWidth: '52ch', margin: 0 }}>Quizzes people have published. Anyone can play them. A “Reviewed” badge means a moderator checked it — popularity alone never makes a quiz correct.</p>
            {mode && <p className="info" style={{ marginTop: 16, maxWidth: 640 }}>Selected mode: <strong>{game ? MODES[game].name.en : modeLabels[mode]}</strong>. Choose a quiz to play with it. <Link href="/quiz/modes">Change mode</Link></p>}
          </div>
        </section>
      )}

      <div className="page" style={{ marginTop: mine ? 8 : 24 }}>
        {mine && (
          <>
            <div className="tab-row" role="tablist" aria-label="My quizzes">
              {([['draft', `Drafts (${counts.draft})`], ['published', `Published (${counts.published})`], ['favorites', `Favorites (${counts.favorites})`], ['archived', `Archived (${counts.archived})`]] as [Tab, string][]).map(([t, label]) => (
                <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls="list-panel" onClick={() => { setTab(t); setPicked(new Set()); }}>{label}</button>
              ))}
            </div>
            {coll.folders.length > 0 && (
              <label style={{ maxWidth: 260 }}>Folder<select value={folder} onChange={(e) => setFolder(e.target.value)}><option value="">All quizzes</option>{coll.folders.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.quizIds.length})</option>)}</select></label>
            )}
            {session === null && device.length > 0 && (
              <p className="info" role="status">Saved on this device. These drafts live only in this browser — they are not backed up or synced. <Link href="/quiz/login?next=/quiz/my">Save to an account</Link> whenever you like; nothing is required.</p>
            )}
            {memoryOnly && <p className="error" role="alert" style={{ marginTop: 10 }}>This browser is blocking storage, so drafts can’t be kept after you close the tab. Use Export Backup in the editor.</p>}
          </>
        )}
        {controls}
        {loading && <p className="sr-only" role="status">Loading quizzes…</p>}
        {offline && <p className="info" role="status" style={{ margin: '14px 0' }}>You appear to be offline. Drafts saved on this device are still available.</p>}
        {error && (
          <div className="error stack" role="alert" style={{ margin: '14px 0' }}><span>{error}</span><div><button className="btn small ghost" onClick={() => setReload((n) => n + 1)}>Try again</button></div></div>
        )}
        {notice && <p className="success" role="status" style={{ margin: '14px 0' }}>{notice}</p>}
        {mine && picked.size > 0 && (
          <div className="row panel" role="group" aria-label="Actions for selected quizzes" style={{ margin: '12px 0' }}>
            <span>{picked.size} selected</span>
            <button className="btn small ghost" onClick={() => void bulk(tab === 'archived' ? 'unarchive' : 'archive')}>{tab === 'archived' ? 'Restore' : 'Archive'}</button>
            <button className="btn small ghost" onClick={() => void bulk('duplicate')}>Duplicate</button>
            <button className="btn small ghost" onClick={() => void bulk('move')}>Move to folder…</button>
            <button className="btn small ghost" onClick={() => void bulk('export')}>Export</button>
            <button className="btn small danger" onClick={() => void bulk('delete')}>Delete…</button>
            <button className="btn small ghost" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}
        {!loading && !error && <p className="note" role="status" style={{ margin: '4px 0 18px' }}>{totalShown} quiz{totalShown === 1 ? '' : 'zes'}{q || hasFilters ? ' match' : ''}.{!mine && (items?.length ?? 0) >= 200 ? ' Showing the 200 most recently updated.' : ''}</p>}

        <div id="list-panel" role={mine ? 'tabpanel' : undefined} aria-labelledby={mine ? `tab-${tab}` : undefined}>
          {loading ? (
            <div className="cards" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="qz-skel" />)}</div>
          ) : totalShown === 0 && !error ? (
            <section className="empty">
              <h2>No quizzes found</h2>
              <p className="muted-text">{q || hasFilters ? 'Nothing matches. Try fewer filters or different words.' : mine ? (tab === 'draft' ? 'You have no drafts yet.' : tab === 'published' ? 'You have not published a quiz yet.' : tab === 'favorites' ? 'Tap the star on a quiz to keep it here.' : 'Nothing is archived.') : 'No quizzes have been published yet.'}</p>
              {(q || hasFilters) ? <button className="btn" onClick={() => { setQuery(''); setFilters({}); }}>Clear search</button> : <Link className="btn" href="/quiz/new">Create a Quiz</Link>}
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
              {shown.map((it) => {
                const fav = coll.favorites.includes(it.id);
                const verified = isVerified(toLib(it));
                return (
                  <article className="qz-tile" key={it.id} style={{ ['--c' as string]: it.status === 'published' ? 'var(--qz-cyan)' : 'var(--qz-yellow)' }}>
                    <div className="stripe" />
                    <div className="body">
                      <div aria-hidden style={{ borderRadius: 6, overflow: 'hidden', maxHeight: 110 }} dangerouslySetInnerHTML={{ __html: coverSvg(it.meta && (it.meta as { cover?: { seed?: string } }).cover?.seed || it.id, it.meta?.subject ?? '') }} />
                      <div className="row spread" style={{ flexWrap: 'nowrap' }}>
                        <h2 style={{ margin: 0 }}>{mine ? <label className="inline"><input type="checkbox" aria-label={`Select ${it.title}`} checked={picked.has(it.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })} /> {it.title}</label> : <Link href={`/quiz/library/${it.id}`}>{it.title}</Link>}</h2>
                        <button className="btn small ghost" aria-pressed={fav} aria-label={fav ? `Remove ${it.title} from favorites` : `Add ${it.title} to favorites`} onClick={() => saveColl(toggleFavorite(coll, it.id))}>{fav ? '★' : '☆'}</button>
                      </div>
                      <div className="meta"><span className={`pill ${it.status}`}>{it.status}</span>{verified && <span className="pill published" title="A moderator reviewed this quiz">Reviewed</span>}<span>{it.questionCount} question{it.questionCount === 1 ? '' : 's'}</span><span>about {formatDuration(it.questionCount * 25)}</span><span>Updated {when(it.updated_at)}</span></div>
                      {(it.meta?.subject || it.meta?.ageBand || it.meta?.language) && <p className="note" style={{ margin: 0 }}>{[it.meta?.subject, it.meta?.ageBand && `Ages ${it.meta.ageBand}`, it.meta?.language?.toUpperCase()].filter(Boolean).join(' · ')}</p>}
                      <p className="muted-text" style={{ margin: 0 }}>{it.description || 'No description.'}</p>
                      {(it.kinds?.length ?? 0) > 0 && <p className="note" style={{ margin: 0 }}>{it.kinds!.map((k) => (kindLabels as Record<string, string>)[k]).join(' · ')}</p>}
                      <div className="actions">
                        {it.questionCount > 0 ? <Link className="btn small" href={playHref(it.id)}>Play</Link> : <span className="note">Add questions to play</span>}
                        {!mine && <Link className="btn small ghost" href={`/quiz/library/${it.id}`}>Details</Link>}
                        {mine && <>
                          <Link className="btn small ghost" href={`/quiz/edit/${it.id}`}>Edit</Link>
                          <button className="btn small ghost" disabled={busyId === it.id} onClick={() => duplicate(it)}>Duplicate</button>
                          <button className="btn small ghost" disabled={busyId === it.id || (it.status === 'draft' && it.questionCount === 0)} onClick={() => toggle(it)}>{it.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                          <button className="btn small danger" disabled={busyId === it.id} onClick={() => remove(it)}>Delete</button>
                        </>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
