'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/quiz/client';
import { questionSchema, saveQuizSchema } from '@/lib/quiz/validation';
import { explainIssue } from '@/lib/quiz/explain';
import { blank, prepare } from '@/lib/quiz/editor-model';
import { deleteLocalDraft, exportDraftJson, getLocalDraft, newLocalId, saveLocalDraft, type LocalDraft } from '@/lib/quiz/local-drafts';
import { ensureCloudSession } from '@/lib/quiz/session-client';
import { kindLabels, QUESTION_KINDS, type Question, type QuestionKind } from '@/lib/quiz/types';
import { createHistory, canRedo, canUndo, record, recordCoalesced, redo as redoH, undo as undoH, serialize, parseHistory, type History } from '@/lib/quiz/history';
import { duplicateAt, fromClipboard, moveItem, removeMany, sectionOf, setSection, toClipboard, anchorId, fieldErrors } from '@/lib/quiz/editor-ops';
import { canPublish } from '@/lib/quiz/content';
import { estimateQuizSeconds, formatDuration, quizMaxPoints } from '@/lib/quiz/scoring';
import KindEditor from './KindEditor';
import QuestionExtras from './editor/QuestionExtras';
import QuizMetaForm, { type Meta } from './editor/QuizMetaForm';
import ReviewPanel from './editor/ReviewPanel';
import PreviewPane from './editor/PreviewPane';
import ImportExport from './editor/ImportExport';
import HelpPanel, { FirstRunTip } from './editor/HelpPanel';

type Doc = { title: string; description: string; meta: Meta; qs: Question[] };
type Initial = { id?: string; title: string; description: string; status: 'draft' | 'published'; questions: Question[]; updatedAt?: string; meta?: Meta };
type SaveState = { kind: 'idle' | 'pending' | 'saving' | 'device' | 'cloud' | 'error'; msg: string };
const STEPS = [
  { id: 'details', label: 'Details' }, { id: 'formats', label: 'Question formats' }, { id: 'questions', label: 'Questions' },
  { id: 'media', label: 'Media' }, { id: 'review', label: 'Review' }, { id: 'save', label: 'Save & publish' },
] as const;
type StepId = (typeof STEPS)[number]['id'];
const FORMAT_INFO: Record<QuestionKind, { what: string; good: string }> = {
  multiple_choice: { what: 'Players pick the right option from 2–8.', good: 'Facts, vocabulary, quick checks.' },
  answer_forge: { what: 'Players type the answer. Several spellings can be accepted.', good: 'Recall, spelling, numbers with units.' },
  connection_rush: { what: 'Players match items from two columns.', good: 'Terms and definitions, causes and effects.' },
  truth_hunt: { what: 'Players mark each statement true or false.', good: 'Misconceptions, fact-checking.' },
  fill_table: { what: 'Players complete the blanks in a table.', good: 'Timelines, comparisons, data.' },
};

function questionIssue(q: Question, i: number): string | null {
  const r = questionSchema.safeParse(prepare(q));
  if (r.success) return null;
  const is = r.error.issues[0]!;
  return explainIssue({ path: ['questions', i, ...(is.path as (string | number)[])], message: is.message, code: is.code });
}
const HIST_KEY = (k: string) => `qz:hist:${k}`;

export default function QuizEditor({ initial, localKey, cloudConfigured }: { initial?: Initial; localKey?: string; cloudConfigured: boolean }) {
  const [id, setId] = useState(initial?.id);
  const [storeKey, setStoreKey] = useState<string | undefined>(initial?.id ?? localKey);
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [hist, setHist] = useState<History<Doc>>(() => createHistory<Doc>({ title: initial?.title ?? '', description: initial?.description ?? '', meta: initial?.meta ?? {}, qs: initial?.questions ?? [] }));
  const lastKey = useRef<string | null>(null);
  const doc = hist.present;
  const { title, description, meta, qs } = doc;

  const [step, setStep] = useState<StepId>(initial?.questions?.length ? 'questions' : 'details');
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(!localKey);
  const [missing, setMissing] = useState(false);
  const [recovered, setRecovered] = useState<LocalDraft | null>(null);
  const [rev, setRev] = useState(0);
  const [save, setSave] = useState<SaveState>({ kind: 'idle', msg: '' });
  const [error, setError] = useState('');
  const [cloudNote, setCloudNote] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<{ id: string; label: string; created_at: string }[] | null>(null);

  const latest = useRef({ id, storeKey, status, doc, hist });
  useEffect(() => { latest.current = { id, storeKey, status, doc, hist }; });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const touch = useCallback(() => { dirty.current = true; setRev((r) => r + 1); setSave((s) => (s.kind === 'error' ? s : { kind: 'pending', msg: 'Unsaved changes…' })); }, []);
  /** Every edit goes through here so undo/redo sees it. Typing in the same field is merged into one undo step. */
  const edit = useCallback((fn: (d: Doc) => Doc, key?: string) => {
    setHist((h) => { const next = fn(h.present); if (key) { const r = recordCoalesced(h, next, key, lastKey.current, true); lastKey.current = r.key; return r.h; } lastKey.current = null; return record(h, next); });
    touch();
  }, [touch]);
  const setQs = (fn: (a: Question[]) => Question[], key?: string) => edit((d) => ({ ...d, qs: fn(d.qs) }), key);
  const setQ = (i: number, patch: Partial<Question>) => setQs((a) => a.map((q, j) => (j === i ? { ...q, ...patch } : q)), `q${i}:${Object.keys(patch).join()}`);
  const undo = useCallback(() => { setHist((h) => undoH(h)); lastKey.current = null; touch(); setAnnounce('Undone'); }, [touch]);
  const redo = useCallback(() => { setHist((h) => redoH(h)); lastKey.current = null; touch(); setAnnounce('Redone'); }, [touch]);

  /* load a device-only draft, or look for unsaved changes left on this device for a cloud quiz */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (localKey) {
      const d = getLocalDraft(localKey);
      if (!d) { setMissing(true); setLoaded(true); return; }
      setHist(createHistory<Doc>({ title: d.title, description: d.description, meta: (d.meta ?? {}) as Meta, qs: d.questions })); setLoaded(true);
      if (d.questions.length) setStep('questions');
    } else if (initial?.id) {
      const b = getLocalDraft(initial.id);
      if (b && b.cloudId === initial.id && (!initial.updatedAt || b.updatedAt > initial.updatedAt)) setRecovered(b);
    }
    try { const k = localKey ?? initial?.id; const h = k ? parseHistory<Doc>(sessionStorage.getItem(HIST_KEY(k))) : null; if (h && JSON.stringify(h.present) === JSON.stringify(createHistory<Doc>(latest.current.doc).present)) setHist(h); } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = useMemo(() => qs.map((q, i) => questionIssue(q, i)), [qs]);
  const errorsCount = issues.filter(Boolean).length;

  /* ---- saving: device buffer first (always), then the cloud when it is available and the quiz validates ---- */
  const persist = useCallback(async (mode: 'auto' | 'draft' | 'publish'): Promise<void> => {
    const L = latest.current;
    const manual = mode !== 'auto';
    if (!manual && !dirty.current) return;
    dirty.current = false;
    setError('');
    setSave({ kind: 'saving', msg: 'Saving…' });
    const D = L.doc;

    let key = L.storeKey;
    if (!key) { key = newLocalId(); latest.current.storeKey = key; setStoreKey(key); }
    const hasContent = D.title.trim() || D.description.trim() || D.qs.length;
    let deviceOk = true; let deviceMsg = '';
    if (hasContent) {
      const w = saveLocalDraft({ key, cloudId: L.id, title: D.title, description: D.description, questions: D.qs, meta: D.meta as Record<string, unknown> });
      if (!w.ok) { deviceOk = false; deviceMsg = w.reason === 'quota' ? 'This browser’s storage is full' : 'This browser is blocking storage (private mode?)'; }
      // A brand-new quiz now exists on this device: make the address bar point at it, so a reload (or the Back button) reopens THIS draft instead of a blank editor.
      else if (!L.id && window.location.pathname === '/quiz/new') { try { window.history.replaceState(null, '', `/quiz/edit/${key}`); } catch { /* ignore */ } }
    }
    try { const h = serialize(L.hist); if (h) sessionStorage.setItem(HIST_KEY(key), h); } catch { /* ignore */ }

    const target: 'draft' | 'published' = mode === 'publish' ? 'published' : 'draft';
    const skipCloud = !cloudConfigured || (mode === 'auto' && L.status === 'published');
    if (skipCloud) {
      if (mode === 'publish') { setError('Publishing needs the quiz service, which is not connected on this deployment.'); setSave({ kind: 'error', msg: 'Not published' }); return; }
      setSave(deviceOk ? { kind: 'device', msg: L.status === 'published' && mode === 'auto' ? 'Edits saved on this device — use Save Draft or Publish to update the published quiz' : 'Saved on this device' } : { kind: 'error', msg: `${deviceMsg}. Export a backup so nothing is lost.` });
      return;
    }
    if (mode === 'publish') {
      const gate = canPublish(D.qs.map(prepare));
      if (!gate.ok) { setError(`Question${gate.blocked.length > 1 ? 's' : ''} ${gate.blocked.map((i) => i + 1).join(', ')} still need your check before publishing (AI-drafted).`); setSave({ kind: 'error', msg: 'Not published' }); return; }
    }
    const payload = { id: L.id, title: D.title.trim(), description: D.description, status: target, meta: D.meta, questions: D.qs.map(prepare) };
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
      const out = await api<{ id: string; metaStored?: boolean }>('/api/quiz/quizzes', { method: 'POST', json: check.data });
      const wasNew = !latest.current.id;
      latest.current.id = out.id; latest.current.status = target;
      setId(out.id); setStatus(target);
      if (key) deleteLocalDraft(key);
      latest.current.storeKey = out.id; setStoreKey(out.id);
      if (wasNew) { try { window.history.replaceState(null, '', `/quiz/edit/${out.id}`); } catch { /* ignore */ } }
      setSave({ kind: 'cloud', msg: (target === 'published' ? 'Published and saved' : cloud.user.guest ? 'Saved to your guest session' : 'Saved to your account') + (out.metaStored === false ? ' (quiz details will be saved after the next update of the service)' : '') });
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

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = (e.target as HTMLElement)?.matches?.('input, textarea, select');
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void enqueue('draft'); }
      else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && step === 'questions') { e.preventDefault(); move(active, e.key === 'ArrowUp' ? -1 : 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, enqueue, step, active, qs.length]);

  /* ---- question operations ---- */
  const focusCanvas = () => setTimeout(() => canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  const add = (k: QuestionKind) => { setQs((a) => [...a, blank(k)]); setActive(qs.length); setStep('questions'); setPreview(false); focusCanvas(); setAnnounce(`${kindLabels[k]} question added`); };
  const addMany = (list: Question[]) => { if (!list.length) return; setQs((a) => [...a, ...list]); setAnnounce(`${list.length} questions added`); };
  function move(i: number, d: -1 | 1) { const j = i + d; if (j < 0 || j >= qs.length) return; setQs((a) => moveItem(a, i, j)); setActive(j); setAnnounce(`Question moved to position ${j + 1}`); }
  const dup = (i: number) => { setQs((a) => duplicateAt(a, i)); setActive(i + 1); };
  const remove = (i: number) => {
    if (qs[i]!.prompt.trim() && !window.confirm(`Remove question ${i + 1}? You can undo this with Ctrl+Z.`)) return;
    setQs((a) => a.filter((_, j) => j !== i)); setActive(Math.max(0, i - 1)); setSelected(new Set());
  };
  const removeSelected = () => {
    const n = selected.size; if (!n) return;
    if (!window.confirm(`Remove ${n} question${n === 1 ? '' : 's'}? You can undo this with Ctrl+Z.`)) return;
    setQs((a) => removeMany(a, selected)); setSelected(new Set()); setActive(0);
  };
  const toggleSel = (i: number) => setSelected((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  async function copySelected() {
    const list = (selected.size ? [...selected].sort((a, b) => a - b) : [active]).map((i) => qs[i]!).filter(Boolean);
    try { await navigator.clipboard.writeText(toClipboard(list, null)); setAnnounce(`${list.length} question${list.length === 1 ? '' : 's'} copied`); } catch { setAnnounce('Copying is blocked by this browser'); }
  }
  async function pasteQuestions() {
    try {
      const text = await navigator.clipboard.readText();
      const r = fromClipboard(text, null);
      if (!r.ok) { setAnnounce(r.error); setError(r.error); return; }
      addMany(r.questions);
      if (r.dropped.length) setError(`${r.dropped.length} media file${r.dropped.length === 1 ? ' was' : 's were'} left out because it belongs to another account.`);
    } catch { setError('Pasting is blocked by this browser. Use Import instead.'); }
  }
  function jumpTo(i: number, anchor?: string) {
    setActive(i); setStep('questions'); setPreview(false);
    setTimeout(() => { const el = anchor ? document.getElementById(anchor) : null; (el ?? canvasRef.current)?.scrollIntoView({ block: 'center' }); (el as HTMLElement | null)?.focus?.(); }, 60);
  }

  function restore() {
    if (!recovered) return;
    edit(() => ({ title: recovered.title, description: recovered.description, meta: (recovered.meta ?? {}) as Meta, qs: recovered.questions }));
    setRecovered(null);
  }
  function discard() { if (recovered) deleteLocalDraft(recovered.key); setRecovered(null); }
  function backup() {
    const blob = new Blob([exportDraftJson({ title, description, questions: qs })], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(title || 'quiz').replace(/[^\w-]+/g, '-').slice(0, 40)}-backup.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function loadRevisions() {
    if (!id) return;
    try { const r = await api<{ revisions: { id: string; label: string; created_at: string }[] }>(`/api/quiz/quizzes/${id}/revisions`); setRevisions(r.revisions); } catch { setRevisions([]); }
  }
  async function restoreRevision(rid: string) {
    if (!id || !window.confirm('Restore this earlier version? Your current version stays in the undo history.')) return;
    try {
      const r = await api<{ revision: { doc: { title: string; description: string; meta?: Meta; questions: Question[] } } }>(`/api/quiz/quizzes/${id}/revisions`, { method: 'POST', json: { revisionId: rid } });
      const d = r.revision.doc; edit(() => ({ title: d.title, description: d.description, meta: d.meta ?? {}, qs: d.questions })); setAnnounce('Earlier version restored');
    } catch (e) { setError((e as Error).message); }
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

  const activeQ = qs[Math.min(active, qs.length - 1)];
  const ai = Math.min(active, Math.max(0, qs.length - 1));
  const stateClass = save.kind === 'error' ? 'bad' : save.kind === 'cloud' ? 'ok' : '';
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const mediaCount = qs.filter((q) => (q.payload as { media?: unknown }).media).length;
  const counters: Record<StepId, string> = {
    details: title.trim() ? '✓' : '!', formats: String(new Set(qs.map((q) => q.kind)).size), questions: String(qs.length),
    media: String(mediaCount), review: errorsCount ? `${errorsCount}!` : qs.length ? '✓' : '–', save: status === 'published' ? 'Live' : 'Draft',
  };
  const sections = [...new Set(qs.map(sectionOf).filter(Boolean))];
  const errsForActive = activeQ ? fieldErrors([prepare(activeQ)]) : [];

  return (
    <main className="page" id="main">
      <header className="page-header">
        <div><p className="eyebrow">{id ? 'Edit Quiz' : 'Create a Quiz'}</p><h1>{title.trim() || (id ? 'Edit Quiz' : 'New Quiz')}</h1></div>
        <div className="row">
          <button className="btn small ghost" onClick={undo} disabled={!canUndo(hist)} aria-label="Undo">↶ Undo</button>
          <button className="btn small ghost" onClick={redo} disabled={!canRedo(hist)} aria-label="Redo">↷ Redo</button>
          <button className="btn small ghost" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen}>Help</button>
          <Link className="btn ghost" href="/quiz/my">My Quizzes</Link>
        </div>
      </header>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <FirstRunTip id="editor-intro">Work through the steps in order, or jump to any step. Everything saves on this device as you type, and Ctrl+Z undoes a mistake.</FirstRunTip>

      <nav aria-label="Quiz steps" style={{ margin: '14px 0' }}>
        <ol className="row" style={{ listStyle: 'none', padding: 0, gap: 6, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button className={`btn small ${s.id === step ? '' : 'ghost'}`} aria-current={s.id === step ? 'step' : undefined} onClick={() => { setStep(s.id); if (s.id === 'save') void loadRevisions(); }}>
                {i + 1}. {s.label} <span className="pill">{counters[s.id]}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {recovered && (
        <div className="info stack" role="status" style={{ marginBottom: 16 }}>
          <span>Unsaved changes from {new Date(recovered.updatedAt).toLocaleString()} were found on this device.</span>
          <div className="row"><button className="btn small" onClick={restore}>Restore them</button><button className="btn small ghost" onClick={discard}>Discard them</button></div>
        </div>
      )}
      {cloudNote && <p className="info" role="status" style={{ marginBottom: 16 }}>{cloudNote} <Link href={`/quiz/login?next=${encodeURIComponent(id ? `/quiz/edit/${id}` : '/quiz/my')}`}>Sign in or create an account</Link> to keep it online.</p>}
      {error && <p className="error" role="alert" style={{ marginBottom: 14 }}>{error}</p>}

      <div ref={canvasRef}>
        {step === 'details' && (
          <section className="panel stack" aria-labelledby="det-h">
            <h2 id="det-h">1 · Quiz details</h2>
            <label>Quiz title
              <input id="qf-title" value={title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }), 'title')} maxLength={160} placeholder="Give your quiz a title" aria-invalid={!title.trim() && qs.length > 0 ? true : undefined} />
            </label>
            <label>Description (optional)<textarea value={description} onChange={(e) => edit((d) => ({ ...d, description: e.target.value }), 'description')} rows={3} maxLength={2000} /></label>
            <QuizMetaForm meta={meta} title={title} onChange={(m) => edit((d) => ({ ...d, meta: m }), 'meta')} />
            <p className="note">Visibility: <span className={`pill ${status}`}>{status === 'published' ? 'Published — listed in Quiz Library' : 'Private draft'}</span></p>
            <div className="row"><button className="btn" onClick={() => setStep('formats')}>Next: choose formats →</button></div>
          </section>
        )}

        {step === 'formats' && (
          <section className="panel stack" aria-labelledby="fm-h">
            <h2 id="fm-h">2 · Question formats</h2>
            <p className="note">Mix any of the five formats in one quiz. Pick one to add a question.</p>
            <div className="grid2">
              {QUESTION_KINDS.map((k) => (
                <div key={k} className="panel stack" style={{ margin: 0 }}>
                  <h3>{kindLabels[k]} <span className="pill">{qs.filter((q) => q.kind === k).length}</span></h3>
                  <p className="note" style={{ margin: 0 }}>{FORMAT_INFO[k].what}</p>
                  <p className="note" style={{ margin: 0 }}>Good for: {FORMAT_INFO[k].good}</p>
                  <div><button className="btn small" onClick={() => add(k)}>+ Add {kindLabels[k]}</button></div>
                </div>
              ))}
            </div>
            <div className="row"><button className="btn ghost" onClick={() => setStep('details')}>← Back</button><button className="btn" onClick={() => setStep('questions')}>Next: write questions →</button></div>
          </section>
        )}

        {step === 'questions' && (
          <div className="qz-editor">
            <aside className="qz-nav-col" aria-label="Question navigator">
              <div className="row spread"><h2 style={{ margin: 0, fontSize: '1.6rem' }}>Questions <span className="pill">{qs.length}</span></h2></div>
              {selected.size > 0 && (
                <div className="row" role="group" aria-label="Actions for selected questions">
                  <span className="note">{selected.size} selected</span>
                  <button className="btn small ghost" onClick={() => void copySelected()}>Copy</button>
                  <button className="btn small danger" onClick={removeSelected}>Remove</button>
                  <button className="btn small ghost" onClick={() => { const s = window.prompt('Section name for the selected questions (leave empty to clear):', ''); if (s !== null) setQs((a) => setSection(a, [...selected], s.trim())); }}>Section…</button>
                  <button className="btn small ghost" onClick={() => setSelected(new Set())}>Clear</button>
                </div>
              )}
              <ol>
                {qs.map((q, i) => (
                  <li key={q.id ?? `n${i}`} draggable onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragFrom !== null && dragFrom !== i) { setQs((a) => moveItem(a, dragFrom, i)); setActive(i); setAnnounce(`Question moved to position ${i + 1}`); } setDragFrom(null); }} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                    <input type="checkbox" aria-label={`Select question ${i + 1}`} checked={selected.has(i)} onChange={() => toggleSel(i)} />
                    <button className="q" style={{ flex: 1 }} aria-current={ai === i} onClick={() => { setActive(i); setPreview(false); focusCanvas(); }}>
                      <span className="n">{i + 1}</span>
                      <span className="t">{q.prompt.trim() || 'Untitled question'}<span className="k">{kindLabels[q.kind]}{sectionOf(q) ? ` · ${sectionOf(q)}` : ''}{issues[i] ? <> · <span className="bad">Needs attention</span></> : null}</span></span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="actions stack">
                <p className="note" style={{ margin: 0 }}>Add a question</p>
                {QUESTION_KINDS.map((k) => <button key={k} className="btn small ghost" onClick={() => add(k)}>+ {kindLabels[k]}</button>)}
                <button className="btn small ghost" onClick={() => void pasteQuestions()}>Paste copied questions</button>
              </div>
              {sections.length > 0 && <p className="note">Sections: {sections.join(' · ')}</p>}
            </aside>

            <div className="qz-canvas">
              {!activeQ && <section className="panel stack"><h2>No questions yet</h2><p className="note">Add one from the list, or import questions in the Review step.</p><div className="row">{QUESTION_KINDS.map((k) => <button key={k} className="btn small" onClick={() => add(k)}>+ {kindLabels[k]}</button>)}</div></section>}
              {activeQ && (
                <section className="qcard active" key={activeQ.id ?? `q${ai}`} aria-labelledby="q-h">
                  <header>
                    <h2 id="q-h">Question {ai + 1} · {kindLabels[activeQ.kind]}</h2>
                    <div className="row">
                      <button className="btn small ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? 'Back to editing' : 'Preview'}</button>
                      <button className="btn small ghost" onClick={() => move(ai, -1)} disabled={ai === 0} aria-label={`Move question ${ai + 1} up`}>Up</button>
                      <button className="btn small ghost" onClick={() => move(ai, 1)} disabled={ai === qs.length - 1} aria-label={`Move question ${ai + 1} down`}>Down</button>
                      <button className="btn small ghost" onClick={() => dup(ai)}>Duplicate</button>
                      <button className="btn small danger" onClick={() => remove(ai)}>Remove</button>
                    </div>
                  </header>
                  {errsForActive.length > 0 && (
                    <div className="info" role="status" style={{ marginBottom: 12 }}>
                      <p style={{ margin: 0 }}>Needs attention before it can be saved online or published:</p>
                      <ul>{errsForActive.slice(0, 5).map((e, k) => <li key={k}><a href={`#${anchorId(ai, e.path)}`} onClick={(ev) => { ev.preventDefault(); jumpTo(ai, anchorId(ai, e.path)); }}>{explainIssue({ path: ['questions', ai, ...e.path], message: e.message, code: 'custom' })}</a></li>)}</ul>
                    </div>
                  )}
                  {preview ? <PreviewPane q={activeQ} /> : (
                    <div className="stack">
                      <div className="grid2">
                        <label>Answer format
                          <select value={activeQ.kind} onChange={(e) => { if (activeQ.prompt || window.confirm('Changing the format resets this question’s answers. Keep the question text?')) setQ(ai, { ...blank(e.target.value as QuestionKind), prompt: activeQ.prompt, basePoints: activeQ.basePoints, id: activeQ.id }); }}>
                            {QUESTION_KINDS.map((k) => <option key={k} value={k}>{kindLabels[k]}</option>)}
                          </select>
                        </label>
                        <label>Points for a correct answer<input type="number" min={0} max={10000} value={activeQ.basePoints} onChange={(e) => setQ(ai, { basePoints: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })} /></label>
                      </div>
                      <label>Question<textarea id={`qf-${ai}-prompt`} rows={3} value={activeQ.prompt} maxLength={3000} placeholder="Write your question" onChange={(e) => setQ(ai, { prompt: e.target.value })} /></label>
                      <KindEditor q={activeQ} onChange={(patch) => setQ(ai, patch)} />
                      <QuestionExtras q={activeQ} index={ai} onChange={(patch) => setQ(ai, patch)} />
                    </div>
                  )}
                </section>
              )}
              <div className="row" style={{ marginTop: 14 }}><button className="btn ghost" onClick={() => setStep('formats')}>← Back</button><button className="btn" onClick={() => setStep('media')}>Next: media →</button></div>
            </div>
          </div>
        )}

        {step === 'media' && (
          <section className="panel stack" aria-labelledby="md-h">
            <h2 id="md-h">4 · Media</h2>
            <p className="note">Pictures, audio and video are added inside each question. This list shows where they are and what still needs a description.</p>
            {qs.length === 0 ? <p className="info">Add questions first.</p> : (
              <div className="tablewrap"><table>
                <thead><tr><th>Question</th><th>Media</th><th>Description</th><th /></tr></thead>
                <tbody>{qs.map((q, i) => {
                  const m = (q.payload as { media?: { type: string; alt?: string; decorative?: boolean } }).media;
                  return (
                    <tr key={i}>
                      <td>{i + 1}. {q.prompt.slice(0, 50) || 'Untitled'}</td>
                      <td>{m ? m.type : '—'}</td>
                      <td>{m ? (m.decorative ? 'Decorative' : m.alt?.trim() ? 'Described' : <span className="bad">Missing</span>) : '—'}</td>
                      <td><button className="btn small ghost" onClick={() => jumpTo(i, `qf-${i}-media-alt`)}>{m ? 'Edit' : 'Add'}</button></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
            <div className="row"><button className="btn ghost" onClick={() => setStep('questions')}>← Back</button><button className="btn" onClick={() => setStep('review')}>Next: review →</button></div>
          </section>
        )}

        {step === 'review' && (
          <div className="stack">
            <ReviewPanel title={title} qs={qs} onJump={jumpTo} />
            <ImportExport doc={{ title, description, meta: meta as Record<string, unknown>, questions: qs }} existing={qs} onAdd={addMany} onReplace={(d) => edit(() => ({ title: d.title, description: d.description, meta: (d.meta ?? {}) as Meta, qs: d.questions }))} />
            <div className="row"><button className="btn ghost" onClick={() => setStep('media')}>← Back</button><button className="btn" onClick={() => { setStep('save'); void loadRevisions(); }}>Next: save & publish →</button></div>
          </div>
        )}

        {step === 'save' && (
          <section className="panel stack" aria-labelledby="sv-h">
            <h2 id="sv-h">6 · Save & publish</h2>
            <ul>
              <li>{qs.length} question{qs.length === 1 ? '' : 's'}, up to {quizMaxPoints(qs.map(prepare), { questionSeconds: 30 })} points, about {formatDuration(estimateQuizSeconds(qs))}.</li>
              <li>{errorsCount ? <span className="bad">{errorsCount} question{errorsCount === 1 ? ' needs' : 's need'} attention — the draft stays on this device until fixed.</span> : 'Every question is complete.'}</li>
              <li>{status === 'published' ? 'This quiz is published in the library.' : 'This quiz is a private draft.'}</li>
            </ul>
            <p className="note">Save Draft keeps it private. Publish lists it in the library so others can play and copy it. Your name is shown only if you are signed in with an account.</p>
            <div className="row">
              <button className="btn ghost" disabled={save.kind === 'saving' || !title.trim()} onClick={() => void enqueue('draft')}>Save Draft</button>
              <button className="btn" disabled={save.kind === 'saving' || !title.trim()} onClick={() => void enqueue('publish')}>{status === 'published' ? 'Publish Changes' : 'Publish'}</button>
              {id && qs.length > 0 && <Link className="btn cyan" href={`/quiz/setup/${id}`}>Play</Link>}
              {status === 'published' && id && <button className="btn ghost" onClick={async () => { if (window.confirm('Take this quiz out of the library? Sessions already running are not affected.')) { try { await api(`/api/quiz/quizzes/${id}`, { method: 'PATCH', json: { status: 'draft' } }); setStatus('draft'); setSave({ kind: 'cloud', msg: 'Unpublished — now a private draft' }); } catch (e) { setError((e as Error).message); } } }}>Unpublish</button>}
            </div>
            {id && (
              <div className="stack">
                <h3>Earlier versions</h3>
                {revisions === null ? <p className="note">Loading…</p> : revisions.length === 0 ? <p className="note">Versions are saved each time you publish. None yet.</p> : (
                  <ul>{revisions.map((r) => <li key={r.id}>{new Date(r.created_at).toLocaleString()} — {r.label || 'Published'} <button className="btn small ghost" onClick={() => void restoreRevision(r.id)}>Restore</button></li>)}</ul>
                )}
              </div>
            )}
            <div className="row"><button className="btn ghost" onClick={() => setStep('review')}>← Back</button></div>
          </section>
        )}
      </div>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} topic={step === 'details' ? 'start' : step === 'formats' ? 'formats' : step === 'media' ? 'media' : step === 'review' ? 'import' : step === 'save' ? 'publish' : 'scoring'} />

      <div className="qz-savebar" role="region" aria-label="Save">
        <span className={`state ${stateClass}`} role="status" aria-live="polite">{save.msg || (id ? 'All changes saved' : 'Nothing to save yet')}</span>
        <span className="note">Step {stepIndex + 1} of {STEPS.length}</span>
        <button className="btn small ghost" onClick={backup} disabled={!title.trim() && qs.length === 0} title="Download a JSON copy of this quiz">Export Backup</button>
        <button className="btn ghost small" disabled={save.kind === 'saving' || !title.trim()} onClick={() => void enqueue('draft')}>Save Draft</button>
        <button className="btn small" disabled={save.kind === 'saving' || !title.trim()} onClick={() => void enqueue('publish')}>{status === 'published' ? 'Publish Changes' : 'Publish'}</button>
      </div>
    </main>
  );
}
