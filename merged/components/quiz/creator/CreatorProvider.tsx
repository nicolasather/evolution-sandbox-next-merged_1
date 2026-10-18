'use client';
/** Holds one quiz while it is being created, across all seven routed steps.
 *  - Draft identity lives in the URL (`?draft=`), so refresh, back/forward and deep links all land on the same quiz.
 *  - Saving order is unchanged from the old editor: device copy first (always), then the cloud when it is available and the quiz validates.
 *  - Nothing here deletes a draft; a device copy is removed only after the server has confirmed the cloud save. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/quiz/client';
import { explainIssue } from '@/lib/quiz/explain';
import { prepare } from '@/lib/quiz/editor-model';
import { questionSchema, saveQuizSchema } from '@/lib/quiz/validation';
import { deleteLocalDraft, exportDraftJson, getLocalDraft, isLocalId, newLocalId, saveLocalDraft, type LocalDraft } from '@/lib/quiz/local-drafts';
import { ensureCloudSession } from '@/lib/quiz/session-client';
import { defaultSettings, normalizeSettings, parseSettings, type QuizSettings } from '@/lib/quiz/settings';
import type { Question } from '@/lib/quiz/types';
import type { CreatorStep } from '@/lib/quiz/creator-steps';

export type SaveState = { kind: 'idle' | 'pending' | 'saving' | 'device' | 'cloud' | 'error'; msg: string };
type Status = 'draft' | 'published';

export type Creator = {
  ready: boolean;
  /** true when the URL names a draft that is nowhere to be found */
  missing: boolean;
  cloudConfigured: boolean;
  draftKey: string | null;
  quizId: string | undefined;
  title: string; description: string; status: Status; questions: Question[]; settings: QuizSettings;
  save: SaveState; error: string; cloudNote: string; guest: boolean | null;
  recovered: LocalDraft | null;
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setQuestions: (update: Question[] | ((q: Question[]) => Question[])) => void;
  patchSettings: (patch: Partial<QuizSettings> | ((s: QuizSettings) => QuizSettings)) => void;
  /** Creates the draft record (and the URL) on first use. Returns its key. */
  ensureDraft: (seed?: { settings?: QuizSettings; title?: string }) => string;
  persist: (mode: 'draft' | 'publish') => Promise<boolean>;
  rememberStep: (step: CreatorStep) => void;
  restore: () => void; discard: () => void;
  backup: () => void;
  /** Every reason this quiz cannot be published yet, in plain words. */
  blockers: string[];
  questionIssues: (string | null)[];
};

const Ctx = createContext<Creator | null>(null);
export function useCreator(): Creator {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCreator must be used inside <CreatorProvider>');
  return c;
}

export function questionIssue(q: Question, i: number): string | null {
  const r = questionSchema.safeParse(prepare(q));
  if (r.success) return null;
  const is = r.error.issues[0]!;
  return explainIssue({ path: ['questions', i, ...(is.path as (string | number)[])], message: is.message, code: is.code });
}

export default function CreatorProvider({ cloudConfigured, children }: { cloudConfigured: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const urlDraft = params.get('draft');

  const [draftKey, setDraftKey] = useState<string | null>(urlDraft);
  const [quizId, setQuizId] = useState<string | undefined>(urlDraft && !isLocalId(urlDraft) ? urlDraft : undefined);
  const [title, setTitleState] = useState('');
  const [description, setDescriptionState] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [questions, setQuestionsState] = useState<Question[]>([]);
  const [settings, setSettings] = useState<QuizSettings>(() => defaultSettings());
  const [ready, setReady] = useState(!urlDraft);
  const [missing, setMissing] = useState(false);
  const [recovered, setRecovered] = useState<LocalDraft | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle', msg: '' });
  const [error, setError] = useState('');
  const [cloudNote, setCloudNote] = useState('');
  const [guest, setGuest] = useState<boolean | null>(null);
  const [rev, setRev] = useState(0);

  const latest = useRef({ draftKey, quizId, title, description, status, questions, settings });
  useEffect(() => { latest.current = { draftKey, quizId, title, description, status, questions, settings }; });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const stepRef = useRef<string | undefined>(undefined);
  const loadedFor = useRef<string | null>(null);

  const touch = useCallback(() => { dirty.current = true; setRev((r) => r + 1); setSave((s) => (s.kind === 'error' ? s : { kind: 'pending', msg: 'Unsaved changes…' })); }, []);

  /* ── load whatever the URL points at (device draft, or the owner's cloud quiz) ── */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!urlDraft) { setReady(true); return; }
    if (loadedFor.current === urlDraft) return;
    loadedFor.current = urlDraft;
    let cancelled = false;
    (async () => {
      if (isLocalId(urlDraft)) {
        const d = getLocalDraft(urlDraft);
        if (cancelled) return;
        if (!d) { setMissing(true); setReady(true); return; }
        setDraftKey(urlDraft); setTitleState(d.title); setDescriptionState(d.description); setQuestionsState(d.questions);
        setSettings(d.settings ? parseSettings(d.settings) : defaultSettings()); stepRef.current = d.step; setReady(true);
        return;
      }
      setDraftKey(urlDraft); setQuizId(urlDraft);
      const buffer = getLocalDraft(urlDraft);
      try {
        const out = await api<{ quiz: { title: string; description: string; status: Status; updated_at: string; isMine: boolean }; settings: unknown; questions: Question[] }>(`/api/quiz/quizzes/${urlDraft}`);
        if (cancelled) return;
        if (!out.quiz.isMine) { setMissing(true); setReady(true); return; }
        setTitleState(out.quiz.title); setDescriptionState(out.quiz.description); setStatus(out.quiz.status);
        setQuestionsState(out.questions); setSettings(out.settings ? parseSettings(out.settings) : defaultSettings());
        if (buffer && buffer.cloudId === urlDraft && buffer.updatedAt > out.quiz.updated_at) setRecovered(buffer);
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        // Offline, or the session is gone: fall back to the unsaved-changes buffer on this device if there is one.
        if (buffer) {
          setTitleState(buffer.title); setDescriptionState(buffer.description); setQuestionsState(buffer.questions);
          setSettings(buffer.settings ? parseSettings(buffer.settings) : defaultSettings());
          setCloudNote(e instanceof ApiError && e.status === 404 ? 'This quiz could not be loaded from your account, so the copy kept on this device is shown.' : 'You appear to be offline. Showing the copy kept on this device.');
        } else setMissing(true);
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [urlDraft]);

  const setTitle = useCallback((v: string) => { setTitleState(v); touch(); }, [touch]);
  const setDescription = useCallback((v: string) => { setDescriptionState(v); touch(); }, [touch]);
  const setQuestions = useCallback((u: Question[] | ((q: Question[]) => Question[])) => { setQuestionsState(u); touch(); }, [touch]);
  const patchSettings = useCallback((p: Partial<QuizSettings> | ((s: QuizSettings) => QuizSettings)) => {
    setSettings((s) => normalizeSettings(typeof p === 'function' ? p(s) : { ...s, ...p }));
    touch();
  }, [touch]);

  const ensureDraft = useCallback((seed?: { settings?: QuizSettings; title?: string }) => {
    const existing = latest.current.draftKey;
    if (existing) return existing;
    const key = newLocalId();
    const s = seed?.settings ?? latest.current.settings;
    latest.current.draftKey = key; latest.current.settings = s;
    setDraftKey(key); setSettings(s); loadedFor.current = key;
    if (seed?.title) { setTitleState(seed.title); latest.current.title = seed.title; }
    saveLocalDraft({ key, title: seed?.title ?? latest.current.title, description: '', questions: [], settings: s });
    return key;
  }, []);

  const rememberStep = useCallback((step: CreatorStep) => {
    stepRef.current = step;
    const k = latest.current.draftKey;
    const d = k ? getLocalDraft(k) : null;
    if (k && d && d.step !== step) saveLocalDraft({ key: k, cloudId: d.cloudId, title: d.title, description: d.description, questions: d.questions, settings: d.settings, step });
  }, []);

  /* ── saving: device first, then the cloud ── */
  const persistNow = useCallback(async (mode: 'auto' | 'draft' | 'publish'): Promise<boolean> => {
    const L = latest.current;
    const manual = mode !== 'auto';
    if (!manual && !dirty.current) return true;
    dirty.current = false;
    setError('');
    setSave({ kind: 'saving', msg: 'Saving…' });

    let key = L.draftKey;
    if (!key) { key = newLocalId(); latest.current.draftKey = key; setDraftKey(key); }
    const hasContent = L.title.trim() || L.description.trim() || L.questions.length;
    let deviceOk = true; let deviceMsg = '';
    if (hasContent) {
      const w = saveLocalDraft({ key, cloudId: L.quizId, title: L.title, description: L.description, questions: L.questions, settings: L.settings, step: stepRef.current });
      if (!w.ok) { deviceOk = false; deviceMsg = w.reason === 'quota' ? 'This browser’s storage is full' : 'This browser is blocking storage (private mode?)'; }
    }

    const target: Status = mode === 'publish' ? 'published' : 'draft';
    const skipCloud = !cloudConfigured || (mode === 'auto' && L.status === 'published');
    if (skipCloud) {
      if (mode === 'publish') { setError('Publishing needs the quiz service, which is not connected on this deployment. Your draft is safe on this device.'); setSave({ kind: 'error', msg: 'Not published' }); return false; }
      setSave(deviceOk ? { kind: 'device', msg: L.status === 'published' && mode === 'auto' ? 'Edits saved on this device — use Save Draft or Publish to update the published quiz' : 'Saved on this device' } : { kind: 'error', msg: `${deviceMsg}. Export a backup so nothing is lost.` });
      return deviceOk;
    }
    const payload = { id: L.quizId, title: L.title.trim(), description: L.description, status: target, questions: L.questions.map(prepare), settings: L.settings };
    const check = saveQuizSchema.safeParse(payload);
    if (!check.success) {
      const is = check.error.issues[0]!;
      const why = explainIssue({ path: is.path as (string | number)[], message: is.message, code: is.code });
      if (manual) { setError(why); setSave(deviceOk ? { kind: 'device', msg: 'Saved on this device — fix the problem above to save it online' } : { kind: 'error', msg: deviceMsg }); }
      else setSave(deviceOk ? { kind: 'device', msg: 'Saved on this device' } : { kind: 'error', msg: deviceMsg });
      return mode !== 'publish' && deviceOk;
    }
    const cloud = await ensureCloudSession();
    if (cloud.status !== 'ready') {
      setCloudNote('Online saving is not available right now, so this quiz stays on this device.');
      if (mode === 'publish') { setError('Publishing needs an online session. Your draft stays on this device and is not lost.'); setSave({ kind: 'error', msg: 'Not published' }); return false; }
      setSave(deviceOk ? { kind: 'device', msg: 'Saved on this device' } : { kind: 'error', msg: deviceMsg });
      return deviceOk;
    }
    setCloudNote(''); setGuest(!!cloud.user.guest);
    try {
      const out = await api<{ id: string; settingsSaved?: boolean }>('/api/quiz/quizzes', { method: 'POST', json: check.data });
      latest.current.quizId = out.id; latest.current.status = target;
      setQuizId(out.id); setStatus(target);
      // the cloud copy is now the source of truth: drop the device draft that migrated, but keep settings if the server could not store them yet
      if (key && out.settingsSaved !== false) deleteLocalDraft(key);
      latest.current.draftKey = out.id; setDraftKey(out.id); loadedFor.current = out.id;
      if (out.settingsSaved === false) {
        saveLocalDraft({ key: out.id, cloudId: out.id, title: L.title, description: L.description, questions: L.questions, settings: L.settings, step: stepRef.current });
      }
      if (key !== out.id) { try { window.history.replaceState(null, '', `${window.location.pathname}?draft=${encodeURIComponent(out.id)}`); } catch { /* ignore */ } }
      setSave({
        kind: 'cloud',
        msg: (target === 'published' ? 'Published and saved' : cloud.user.guest ? 'Saved to your guest session' : 'Saved to your account') + (out.settingsSaved === false ? ' — game settings stay on this device until the database update is applied' : ''),
      });
      return true;
    } catch (e) {
      dirty.current = true;
      setError((e as Error).message);
      setSave({ kind: 'error', msg: deviceOk ? 'Online save failed — your work is kept on this device. Press Save Draft to retry.' : `Online save failed and ${deviceMsg.toLowerCase()}.` });
      return mode !== 'publish' && deviceOk;
    }
  }, [cloudConfigured]);

  const enqueue = useCallback((mode: 'auto' | 'draft' | 'publish') => {
    const run = queue.current.then(() => persistNow(mode)).catch(() => false);
    queue.current = run;
    return run as Promise<boolean>;
  }, [persistNow]);

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

  // First substantive edit on a route with no `?draft=` yet: give the work a URL so a refresh finds it again.
  useEffect(() => {
    // replaceState (not router.replace) so it can never cancel a router.push that the step started in the same tick
    if (draftKey && !urlDraft && pathname.startsWith('/quiz/create/') && window.location.pathname === pathname) {
      try { window.history.replaceState(window.history.state, '', `${pathname}?draft=${encodeURIComponent(draftKey)}`); } catch { /* ignore */ }
    }
  }, [draftKey, urlDraft, pathname]);

  const restore = useCallback(() => {
    if (!recovered) return;
    setTitleState(recovered.title); setDescriptionState(recovered.description); setQuestionsState(recovered.questions);
    if (recovered.settings) setSettings(parseSettings(recovered.settings));
    setRecovered(null); touch();
  }, [recovered, touch]);
  const discard = useCallback(() => { if (recovered) deleteLocalDraft(recovered.key); setRecovered(null); }, [recovered]);
  const backup = useCallback(() => {
    const blob = new Blob([exportDraftJson({ title, description, questions, settings })], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(title || 'quiz').replace(/[^\w-]+/g, '-').slice(0, 40)}-backup.json`; a.click(); URL.revokeObjectURL(url);
  }, [title, description, questions, settings]);

  const questionIssues = useMemo(() => questions.map((q, i) => questionIssue(q, i)), [questions]);
  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!title.trim()) out.push('Give the quiz a title (Step 2).');
    if (!questions.length) out.push('Add at least one question (Step 3).');
    questionIssues.forEach((m) => { if (m) out.push(m); });
    return out;
  }, [title, questions.length, questionIssues]);

  const value: Creator = {
    ready, missing, cloudConfigured, draftKey, quizId, title, description, status, questions, settings, save, error, cloudNote, guest, recovered,
    setTitle, setDescription, setQuestions, patchSettings, ensureDraft,
    persist: (m) => enqueue(m), rememberStep, restore, discard, backup, blockers, questionIssues,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
