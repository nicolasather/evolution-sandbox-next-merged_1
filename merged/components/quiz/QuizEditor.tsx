'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/quiz/client';
import { questionSchema, saveQuizSchema } from '@/lib/quiz/validation';
import { explainIssue } from '@/lib/quiz/explain';
import { gradeQuestion } from '@/lib/quiz/grading';
import { publicPayload } from '@/lib/quiz/public';
import { blank, prepare } from '@/lib/quiz/editor-model';
import { deleteLocalDraft, exportDraftJson, getLocalDraft, newLocalId, saveLocalDraft, type LocalDraft } from '@/lib/quiz/local-drafts';
import { ensureCloudSession } from '@/lib/quiz/session-client';
import { kindLabels, QUESTION_KINDS, type Question, type QuestionKind } from '@/lib/quiz/types';
import KindEditor from './KindEditor';
import QuestionPlay from './QuestionPlay';
import AnswerView from './AnswerView';

type Initial = { id?: string; title: string; description: string; status: 'draft' | 'published'; questions: Question[]; updatedAt?: string };
type Active = 'details' | number;
type SaveState = { kind: 'idle' | 'pending' | 'saving' | 'device' | 'cloud' | 'error'; msg: string };

function questionIssue(q: Question, i: number): string | null {
  const r = questionSchema.safeParse(prepare(q));
  if (r.success) return null;
  const is = r.error.issues[0]!;
  return explainIssue({ path: ['questions', i, ...(is.path as (string | number)[])], message: is.message, code: is.code });
}

export default function QuizEditor({ initial, localKey, cloudConfigured }: { initial?: Initial; localKey?: string; cloudConfigured: boolean }) {
  const [id, setId] = useState(initial?.id);
  const [storeKey, setStoreKey] = useState<string | undefined>(initial?.id ?? localKey);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [qs, setQs] = useState<Question[]>(initial?.questions ?? []);
  const [active, setActive] = useState<Active>('details');
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(!localKey);
  const [missing, setMissing] = useState(false);
  const [recovered, setRecovered] = useState<LocalDraft | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const [rev, setRev] = useState(0);
  const [save, setSave] = useState<SaveState>({ kind: 'idle', msg: '' });
  const [error, setError] = useState('');
  const [cloudNote, setCloudNote] = useState('');

  const latest = useRef({ id, storeKey, title, description, status, qs });
  useEffect(() => { latest.current = { id, storeKey, title, description, status, qs }; });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* load a device-only draft, or look for unsaved changes left on this device for a cloud quiz */
  /* reads browser storage, which does not exist during server rendering, so it can only run after hydration */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (localKey) {
      const d = getLocalDraft(localKey);
      if (!d) { setMissing(true); setLoaded(true); return; }
      setTitle(d.title); setDescription(d.description); setQs(d.questions); setLoaded(true);
    } else if (initial?.id) {
      const b = getLocalDraft(initial.id);
      if (b && b.cloudId === initial.id && (!initial.updatedAt || b.updatedAt > initial.updatedAt)) setRecovered(b);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = useCallback(() => { dirty.current = true; setRev((r) => r + 1); setSave((s) => (s.kind === 'error' ? s : { kind: 'pending', msg: 'Unsaved changes…' })); }, []);
  const editTitle = (v: string) => { setTitle(v); touch(); };
  const editDescription = (v: string) => { setDescription(v); touch(); };
  const setQ = (i: number, patch: Partial<Question>) => { setQs((a) => a.map((q, j) => (j === i ? { ...q, ...patch } : q))); touch(); };

  const issues = useMemo(() => qs.map((q, i) => questionIssue(q, i)), [qs]);

  /* ---- saving: device buffer first (always), then the cloud when it is available and the quiz validates ---- */
  const persist = useCallback(async (mode: 'auto' | 'draft' | 'publish'): Promise<void> => {
    const L = latest.current;
    const manual = mode !== 'auto';
    if (!manual && !dirty.current) return;
    dirty.current = false;
    setError('');
    setSave({ kind: 'saving', msg: 'Saving…' });

    // 1. device buffer — works with no account, no network
    let key = L.storeKey;
    if (!key) { key = newLocalId(); latest.current.storeKey = key; setStoreKey(key); }
    const hasContent = L.title.trim() || L.description.trim() || L.qs.length;
    let deviceOk = true; let deviceMsg = '';
    if (hasContent) {
      const w = saveLocalDraft({ key, cloudId: L.id, title: L.title, description: L.description, questions: L.qs });
      if (!w.ok) { deviceOk = false; deviceMsg = w.reason === 'quota' ? 'This browser’s storage is full' : 'This browser is blocking storage (private mode?)'; }
    }

    // 2. cloud
    const target: 'draft' | 'published' = mode === 'publish' ? 'published' : mode === 'draft' ? 'draft' : 'draft';
    const skipCloud = !cloudConfigured || (mode === 'auto' && L.status === 'published');
    if (skipCloud) {
      if (mode === 'publish') { setError('Publishing needs the quiz service, which is not connected on this deployment.'); setSave({ kind: 'error', msg: 'Not published' }); return; }
      setSave(deviceOk ? { kind: 'device', msg: L.status === 'published' && mode === 'auto' ? 'Edits saved on this device — use Save Draft or Publish to update the published quiz' : 'Saved on this device' } : { kind: 'error', msg: `${deviceMsg}. Export a backup so nothing is lost.` });
      return;
    }
    const payload = { id: L.id, title: L.title.trim(), description: L.description, status: target, questions: L.qs.map(prepare) };
    const check = saveQuizSchema.safeParse(payload);
    if (!check.success) {
      const is = check.error.issues[0]!;
      const why = explainIssue({ path: is.path as (string | number)[], message: is.message, code: is.code });
      if (manual) { setError(why); setSave(deviceOk ? { kind: 'device', msg: 'Saved on this device — fix the problem above to save it online' } : { kind: 'error', msg: deviceMsg }); }
      else setSave(deviceOk ? { kind: 'device', msg: 'Saved on this device' } : { kind: 'error', msg: deviceMsg });
      return;
    }
    const cloud = await ensureCloudSession();
    if (cloud.status !== 'ready') {
      setCloudNote('Online saving is not available right now, so this quiz stays on this device.');
      if (mode === 'publish') { setError('Publishing needs an account. Sign in or create one — your draft stays on this device and is not lost.'); setSave({ kind: 'error', msg: 'Not published' }); return; }
      setSave(deviceOk ? { kind: 'device', msg: 'Saved on this device' } : { kind: 'error', msg: deviceMsg });
      return;
    }
    setCloudNote('');
    try {
      const out = await api<{ id: string }>('/api/quiz/quizzes', { method: 'POST', json: check.data });
      const wasNew = !latest.current.id;
      latest.current.id = out.id; latest.current.status = target;
      setId(out.id); setStatus(target);
      // the cloud copy is now the source of truth: drop the device buffer (and the local-* draft it migrated from)
      if (key) deleteLocalDraft(key);
      latest.current.storeKey = out.id; setStoreKey(out.id);
      if (wasNew) { try { window.history.replaceState(null, '', `/quiz/edit/${out.id}`); } catch { /* ignore */ } }
      setSave({ kind: 'cloud', msg: target === 'published' ? 'Published and saved' : cloud.user.guest ? 'Saved to your guest session' : 'Saved to your account' });
    } catch (e) {
      dirty.current = true;
      setError((e as Error).message);
      setSave({ kind: 'error', msg: deviceOk ? 'Online save failed — your work is kept on this device. Press Save Draft to retry.' : `Online save failed and ${deviceMsg.toLowerCase()}.` });
    }
  }, [cloudConfigured]);

  const enqueue = useCallback((mode: 'auto' | 'draft' | 'publish') => {
    queue.current = queue.current.then(() => persist(mode)).catch(() => undefined);
    return queue.current;
  }, [persist]);

  useEffect(() => {
    if (rev === 0) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void enqueue('auto'); }, 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [rev, enqueue]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current || save.kind === 'error') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save.kind]);

  /* ---- question operations ---- */
  const focusCanvas = () => setTimeout(() => canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  const add = (k: QuestionKind) => { setQs((a) => [...a, blank(k)]); setActive(qs.length); setPreview(false); touch(); focusCanvas(); };
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= qs.length) return; setQs((a) => { const c = [...a]; [c[i], c[j]] = [c[j]!, c[i]!]; return c; }); setActive(j); touch(); };
  const dup = (i: number) => { setQs((a) => { const c = JSON.parse(JSON.stringify(a[i])) as Question; delete c.id; const out = [...a]; out.splice(i + 1, 0, c); return out; }); setActive(i + 1); touch(); };
  const remove = (i: number) => {
    if ((qs[i]!.prompt.trim()) && !window.confirm(`Remove question ${i + 1}? This cannot be undone.`)) return;
    setQs((a) => a.filter((_, j) => j !== i)); setActive(i > 0 ? i - 1 : 'details'); touch();
  };

  function restore() {
    if (!recovered) return;
    setTitle(recovered.title); setDescription(recovered.description); setQs(recovered.questions); setRecovered(null); touch();
  }
  function discard() { if (recovered) deleteLocalDraft(recovered.key); setRecovered(null); }
  function backup() {
    const blob = new Blob([exportDraftJson({ title, description, questions: qs })], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(title || 'quiz').replace(/[^\w-]+/g, '-').slice(0, 40)}-backup.json`; a.click(); URL.revokeObjectURL(url);
  }

  if (!loaded) return <main className="page"><p className="muted-text" role="status">Loading your draft…</p></main>;
  if (missing) {
    return (
      <main className="narrow"><div className="panel stack">
        <h1 style={{ fontSize: '2.4rem' }}>Draft not found</h1>
        <p className="muted-text">This draft isn’t stored in this browser. Drafts created without an account live only on the device and browser that made them.</p>
        <div className="row"><Link className="btn" href="/quiz/new">Create a Quiz</Link><Link className="btn ghost" href="/quiz/my">My Quizzes</Link></div>
      </div></main>
    );
  }

  const activeQ = typeof active === 'number' ? qs[active] : undefined;
  const stateClass = save.kind === 'error' ? 'bad' : save.kind === 'cloud' ? 'ok' : '';

  return (
    <main className="page" id="main">
      <header className="page-header">
        <div><p className="eyebrow">{id ? 'Edit Quiz' : 'Create a Quiz'}</p><h1>{title.trim() || (id ? 'Edit Quiz' : 'New Quiz')}</h1></div>
        <Link className="btn ghost" href="/quiz/my">My Quizzes</Link>
      </header>

      {recovered && (
        <div className="info stack" role="status" style={{ marginBottom: 16 }}>
          <span>Unsaved changes from {new Date(recovered.updatedAt).toLocaleString()} were found on this device.</span>
          <div className="row"><button className="btn small" onClick={restore}>Restore them</button><button className="btn small ghost" onClick={discard}>Discard them</button></div>
        </div>
      )}
      {cloudNote && <p className="info" role="status" style={{ marginBottom: 16 }}>{cloudNote} <Link href={`/quiz/login?next=${encodeURIComponent(id ? `/quiz/edit/${id}` : '/quiz/my')}`}>Sign in or create an account</Link> to keep it online.</p>}

      <div className="qz-editor">
        <aside className="qz-nav-col" aria-label="Question navigator" data-collapsed={navCollapsed}>
          <div className="row spread">
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Questions <span className="pill">{qs.length}</span></h2>
            <button className="btn small ghost qz-mobile-only" aria-expanded={!navCollapsed} onClick={() => setNavCollapsed((v) => !v)}>{navCollapsed ? 'Show list' : 'Hide list'}</button>
          </div>
          <ol>
            <li><button className="q" aria-current={active === 'details'} onClick={() => { setActive('details'); setPreview(false); focusCanvas(); }}><span className="n">★</span><span className="t">Quiz details<span className="k">{title.trim() || 'No title yet'}</span></span></button></li>
            {qs.map((q, i) => (
              <li key={q.id ?? `n${i}`}>
                <button className="q" aria-current={active === i} onClick={() => { setActive(i); focusCanvas(); }}>
                  <span className="n">{i + 1}</span>
                  <span className="t">{q.prompt.trim() || 'Untitled question'}<span className="k">{kindLabels[q.kind]}{issues[i] ? <> · <span className="bad">Needs attention</span></> : null}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="actions stack">
            <p className="note" style={{ margin: 0 }}>Add a question</p>
            {QUESTION_KINDS.map((k) => <button key={k} className="btn small ghost" onClick={() => add(k)}>+ {kindLabels[k]}</button>)}
          </div>
        </aside>

        <div className="qz-canvas" ref={canvasRef}>
          {active === 'details' && (
            <section className="panel stack" aria-labelledby="det-h">
              <h2 id="det-h">Quiz Details</h2>
              <label>Quiz title
                <input value={title} onChange={(e) => editTitle(e.target.value)} maxLength={160} placeholder="Give your quiz a title" aria-invalid={!title.trim() && qs.length > 0 ? true : undefined} />
              </label>
              <label>Description (optional)<textarea value={description} onChange={(e) => editDescription(e.target.value)} rows={3} maxLength={2000} /></label>
              <p className="note">Visibility: <span className={`pill ${status}`}>{status === 'published' ? 'Published — listed in Quiz Library' : 'Private draft'}</span></p>
              <p className="note">Write every question yourself. Mix any of the five formats in one quiz. {qs.length === 0 && 'Use “Add a question” on the left to start.'}</p>
              {qs.length === 0 && <div className="row">{QUESTION_KINDS.map((k) => <button key={k} className="btn small" onClick={() => add(k)}>+ {kindLabels[k]}</button>)}</div>}
            </section>
          )}

          {activeQ && typeof active === 'number' && (
            <section className="qcard active" key={activeQ.id ?? `q${active}`} aria-labelledby="q-h">
              <header>
                <h2 id="q-h">Question {active + 1} · {kindLabels[activeQ.kind]}</h2>
                <div className="row">
                  <button className="btn small ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? 'Back to editing' : 'Preview'}</button>
                  <button className="btn small ghost" onClick={() => move(active, -1)} disabled={active === 0} aria-label={`Move question ${active + 1} up`}>Up</button>
                  <button className="btn small ghost" onClick={() => move(active, 1)} disabled={active === qs.length - 1} aria-label={`Move question ${active + 1} down`}>Down</button>
                  <button className="btn small ghost" onClick={() => dup(active)}>Duplicate</button>
                  <button className="btn small danger" onClick={() => remove(active)}>Remove</button>
                </div>
              </header>
              {issues[active] && <p className="info" role="status" style={{ marginBottom: 12 }}>Needs attention before it can be saved online or published: {issues[active]}</p>}
              {preview ? <PreviewPane q={activeQ} /> : (
                <div className="stack">
                  <div className="grid2">
                    <label>Answer format
                      <select value={activeQ.kind} onChange={(e) => { if (activeQ.prompt || window.confirm('Changing the format resets this question’s answers. Keep the question text?')) setQ(active, { ...blank(e.target.value as QuestionKind), prompt: activeQ.prompt, basePoints: activeQ.basePoints, id: activeQ.id }); }}>
                        {QUESTION_KINDS.map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
                      </select>
                    </label>
                    <label>Points for a correct answer<input type="number" min={0} max={10000} value={activeQ.basePoints} onChange={(e) => setQ(active, { basePoints: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })} /></label>
                  </div>
                  <label>Question<textarea rows={3} value={activeQ.prompt} maxLength={3000} placeholder="Write your question" onChange={(e) => setQ(active, { prompt: e.target.value })} /></label>
                  <KindEditor q={activeQ} onChange={(patch) => setQ(active, patch)} />
                </div>
              )}
            </section>
          )}

          {error && <p className="error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
          {qs.length > 0 && <p className="note" style={{ marginTop: 14 }}>{qs.length} question{qs.length === 1 ? '' : 's'}. A draft can be unfinished; publishing needs at least one complete question.</p>}
        </div>
      </div>

      <div className="qz-savebar" role="region" aria-label="Save">
        <span className={`state ${stateClass}`} role="status" aria-live="polite">{save.msg || (id ? 'All changes saved' : 'Nothing to save yet')}</span>
        <button className="btn small ghost" onClick={backup} disabled={!title.trim() && qs.length === 0} title="Download a JSON copy of this quiz">Export Backup</button>
        <button className="btn ghost small" disabled={save.kind === 'saving' || !title.trim()} onClick={() => void enqueue('draft')}>Save Draft</button>
        <button className="btn small" disabled={save.kind === 'saving' || !title.trim()} onClick={() => void enqueue('publish')}>{status === 'published' ? 'Publish Changes' : 'Publish'}</button>
        {id && qs.length > 0
          ? <Link className="btn small cyan" href={`/quiz/setup/${id}`}>Play</Link>
          : <button className="btn small cyan" disabled title="Save the quiz online first: Play needs a saved quiz">Play</button>}
      </div>
    </main>
  );
}

/** Preview uses the real player component (QuestionPlay) and the real grader, so what the author sees is what players get. */
function PreviewPane({ q }: { q: Question }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<null | boolean>(null);
  const parsed = useMemo(() => questionSchema.safeParse(prepare(q)), [q]);
  if (!parsed.success) {
    const is = parsed.error.issues[0]!;
    return <p className="info" role="status">Finish this question to preview it: {explainIssue({ path: is.path as (string | number)[], message: is.message, code: is.code })}</p>;
  }
  const v = parsed.data as Question;
  const pq = { id: `preview-${attempt}`, kind: v.kind, prompt: v.prompt, payload: publicPayload(v.kind, v.payload, 'preview'), base_points: v.basePoints };
  return (
    <div className="stack">
      <p className="note">This is exactly how a player sees the question. Answers are checked against your key; nothing is saved or scored.</p>
      <QuestionPlay key={attempt} question={pq} submitLabel="Check answer" onSubmit={async (resp) => { try { setResult(gradeQuestion(v, resp)); } catch { setResult(false); } }} />
      {result !== null && (
        <div className="stack" role="status">
          <p className={result ? 'success' : 'error'} style={{ margin: 0 }}>{result ? `Correct — ${v.basePoints} points.` : 'Not correct.'}</p>
          <AnswerView kind={v.kind} payload={v.payload} answerKey={v.answerKey} />
          <div><button className="btn small ghost" onClick={() => { setResult(null); setAttempt((n) => n + 1); }}>Try again</button></div>
        </div>
      )}
    </div>
  );
}
