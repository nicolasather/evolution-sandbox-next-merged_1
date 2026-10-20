'use client';
/** One client interface for Tower Defense screens, two implementations:
 *   useTDRemote — a real room: GET state (catch-up happens on the server), idempotent commands (the same commandId is reused on retry),
 *                 a Realtime hint when available and polling always (1 s while active, 4 s in a background tab), server clock offset,
 *                 and an explicit connection state (connecting → connected → degraded → reconnecting → restored).
 *   useTDLocal  — offline practice: the SAME engine runs in this tab with the sample questions; nothing is saved, nothing is rewarded. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { api, ApiError } from '@/lib/quiz/client';
import { addSeat, advance, createMatch, reduceHost, reduceSeat, type CommittedAnswer } from '@/lib/quiz/td/engine';
import { project, type TDPublic } from '@/lib/quiz/td/public';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { gradeDetailed } from '@/lib/quiz/grading';
import { publicPayload } from '@/lib/quiz/public';
import type { TDConfig, TDHostAction, TDRole, TDSeatAction, TDState } from '@/lib/quiz/td/domain';

export type TDSnap = TDPublic & { revision: number; room: { id: string; code: string; status: string }; question: Record<string, unknown> | null };
export type Conn = 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'restored';
export type ActResult = { ok: boolean; code?: string; message?: string; note?: string };
export type AnswerResult = { accepted: boolean; private?: boolean; correct?: boolean; awarded?: number };
export type TDClient = {
  snap: TDSnap | null; conn: Conn; error: string; fatal: boolean; busy: boolean; local: boolean;
  serverNow: () => number;
  act: (a: TDSeatAction) => Promise<ActResult>;
  host: (a: TDHostAction) => Promise<ActResult>;
  answer: (roomQuestionId: string, response: unknown) => Promise<AnswerResult>;
  openPersonal: () => Promise<Record<string, unknown> | null>;
  refresh: () => Promise<void>;
};
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `c${Date.now()}${Math.random().toString(36).slice(2)}`);

// ── remote ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function useTDRemote(roomId: string, view: 'student' | 'host' | 'projector', opts: { screenToken?: string | null } = {}): TDClient {
  const [snap, setSnap] = useState<TDSnap | null>(null); const [conn, setConn] = useState<Conn>('connecting');
  const [error, setError] = useState(''); const [fatal, setFatal] = useState(false); const [busy, setBusy] = useState(false);
  const rev = useRef(-1); const offset = useRef(0); const alive = useRef(true); const fails = useRef(0); const hinted = useRef(0);
  const snapRef = useRef<TDSnap | null>(null);
  const url = `/api/quiz/td/rooms/${roomId}/state${view === 'host' ? '?view=host' : ''}`;
  const headers = useMemo<Record<string, string>>(() => { const h: Record<string, string> = {}; if (view === 'projector' && opts.screenToken) h['x-td-screen'] = opts.screenToken; return h; }, [view, opts.screenToken]);
  const accept = useCallback((d: TDSnap) => {
    // never let a slow, older response overwrite a newer one
    if (d.revision < rev.current) return;
    rev.current = d.revision; offset.current = d.serverNow - Date.now(); setSnap(d);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const d = await api<TDSnap>(url, { headers });
      if (!alive.current) return;
      accept(d); setError('');
      setConn((c) => (fails.current > 0 || c === 'reconnecting' ? 'restored' : 'connected')); fails.current = 0;
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(true); setError(e.message); return; }
      fails.current++; setConn(fails.current >= 3 ? 'reconnecting' : 'degraded');
    }
  }, [url, headers, accept]);
  useEffect(() => {
    alive.current = true; let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (!alive.current || fatal) return;
      const active = snapRef.current && !['lobby', 'finished'].includes(snapRef.current.phase);
      t = setTimeout(loop, document.hidden ? 4000 : active ? 1000 : 2000);
    };
    void loop();
    const vis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('online', vis);
    return () => { alive.current = false; clearTimeout(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', vis); };
  }, [refresh, fatal]);
  useEffect(() => { snapRef.current = snap; }, [snap]);
  // Realtime hint (optional): a public channel that only ever carries {revision, phase}. Duplicates and reordering are harmless: we re-read.
  useEffect(() => {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL; const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!u || !k) return;
    let stop = () => {};
    try {
      const sb = createClient(u, k, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = sb.channel(`td:${roomId}`).on('broadcast', { event: 'rev' }, (m) => {
        const r = Number((m.payload as { revision?: number })?.revision ?? -1);
        if (r > rev.current && r !== hinted.current) { hinted.current = r; setTimeout(() => void refresh(), 120); }
      }).subscribe();
      stop = () => { void sb.removeChannel(ch); };
    } catch { /* polling covers it */ }
    return () => stop();
  }, [roomId, refresh]);

  const post = useCallback(async <T,>(path: string, json: unknown): Promise<T> => api<T>(`/api/quiz/td/rooms/${roomId}/${path}`, { method: 'POST', json }), [roomId]);
  const command = useCallback(async (path: 'action' | 'host', payload: Record<string, unknown>): Promise<ActResult> => {
    setBusy(true); const commandId = uid(); // reused on retry: a double tap or a flaky network can never act twice
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const d = await post<{ ok: true; note?: string; state: TDSnap }>(path, { commandId, ...payload });
          accept(d.state); return { ok: true, note: d.note };
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) { await refresh(); return { ok: false, code: (e as ApiError & { code?: string }).code, message: e.message }; }
          if (attempt === 2) { setConn('reconnecting'); return { ok: false, message: 'Connection lost. Your action was not applied.' }; }
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      return { ok: false };
    } finally { setBusy(false); }
  }, [post, accept, refresh]);
  const act = useCallback((a: TDSeatAction) => command('action', { action: a, expectedRevision: Math.max(0, rev.current) }), [command]);
  const host = useCallback((a: TDHostAction) => command('host', { action: a }), [command]);
  const answer = useCallback(async (roomQuestionId: string, response: unknown) => {
    const r = await post<AnswerResult>('answer', { roomQuestionId, response, commandId: uid() }); void refresh(); return r;
  }, [post, refresh]);
  const openPersonal = useCallback(async () => (await post<{ question: Record<string, unknown> }>('personal', {})).question, [post]);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { snap, conn, error, fatal, busy, local: false, serverNow, act, host, answer, openPersonal, refresh };
}

// ── local practice ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export type PracticeOpts = { mapId: TDConfig['mapId']; minutes: number; role: TDRole | null; lowPressure: boolean };
const SELF = 'practice-seat';
export function useTDLocal(o: PracticeOpts): TDClient {
  const pool = useMemo(() => PRACTICE.map((p) => ({ position: p.position, id: p.id, kind: p.kind, repeat: false })), []);
  const seed = useMemo(() => `practice-${o.mapId}-${o.minutes}`, [o.mapId, o.minutes]);
  const init = useMemo(() => {
    const cfg: TDConfig = { schemaVersion: 1, format: 'coop', mapId: o.mapId, durationMinutes: o.minutes, questionFlow: 'synchronized', focus: 'balanced', lowPressure: o.lowPressure, readAloud: false, teamSizeCap: 1, teamCount: 1, teamNames: ['Practice squad'], approvalAbove: 0, hideNames: false, modifiers: [], allowReviewCycle: true };
    // the practice clock starts at 0 and only moves while the tab runs, so a practice can never be "late"
    let s = createMatch(cfg, [...pool, ...pool.map((p) => ({ ...p, position: p.position + 100, id: `${p.id}-r`, repeat: true }))], ['sq1'], 0);
    const r = addSeat(s, SELF, 'You', 0, 'sq1'); if (r.ok) s = r.state;
    if (o.role) { const rr = reduceSeat(s, SELF, { kind: 'role', role: o.role }); if (rr.ok) s = rr.state; }
    return s;
  }, [o.mapId, o.minutes, o.role, o.lowPressure, pool]);
  const [state, setState] = useState<TDState>(init); const answers = useRef<CommittedAnswer[]>([]); const [error, setError] = useState('');
  const t0 = useRef<number | null>(null); const [clock, setClock] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new practice setup restarts the local match
  useEffect(() => { setState(init); answers.current = []; t0.current = null; }, [init]);
  const now = useCallback(() => (t0.current === null ? 0 : Date.now() - t0.current), []);
  const stateRef = useRef(state); useEffect(() => { stateRef.current = state; }, [state]);
  const fullPool = useMemo(() => [...pool, ...pool.map((p) => ({ ...p, position: p.position + 100, id: `${p.id}-r`, repeat: true }))], [pool]);
  useEffect(() => {
    const h = setInterval(() => {
      if (t0.current === null) return;
      const s = stateRef.current;
      const out = advance(s, { now: now(), seed, pool: fullPool, answers: answers.current });
      if (out.changed) setState(out.state); setClock(now());
    }, 250);
    return () => clearInterval(h);
  }, [now, seed, fullPool]);
  const snap = useMemo<TDSnap>(() => {
    const pub = project(state, 'student', SELF, clock);
    const r = state.rounds.find((x) => x.n === state.round);
    let question: Record<string, unknown> | null = null;
    if (r?.question && ['quiz_open', 'reveal'].includes(state.phase)) {
      const base = PRACTICE.find((p) => p.id === r.question!.roomQuestionId.replace(/-r$/, ''))!;
      question = { id: r.question.roomQuestionId, position: r.question.position, kind: base.kind, prompt: base.prompt, base_points: 100, payload: publicPayload(base.kind, base.payload, `${base.id}:me`), ...(state.phase === 'reveal' ? { answerKey: base.answerKey } : {}) };
    }
    return { ...pub, revision: state.seq, room: { id: 'practice', code: 'PRACTICE', status: state.phase === 'finished' ? 'ended' : state.phase === 'lobby' ? 'waiting' : 'active' }, question };
  }, [state, clock]);
  const act = useCallback(async (a: TDSeatAction): Promise<ActResult> => {
    const r = reduceSeat(stateRef.current, SELF, a);
    if (!r.ok) { setError(r.message); return { ok: false, code: r.code, message: r.message }; }
    setError(''); setState(r.state); return { ok: true, note: r.note };
  }, []);
  const host = useCallback(async (a: TDHostAction): Promise<ActResult> => {
    if (a.kind === 'start' && t0.current === null) t0.current = Date.now();
    const { result } = reduceHost(stateRef.current, a, now());
    if (!result.ok) { setError(result.message); return { ok: false, code: result.code, message: result.message }; }
    setError(''); setState(result.state); return { ok: true };
  }, [now]);
  const answer = useCallback(async (roomQuestionId: string, response: unknown): Promise<AnswerResult> => {
    const base = PRACTICE.find((p) => p.id === roomQuestionId.replace(/-r$/, ''));
    if (!base) return { accepted: false };
    if (answers.current.some((x) => x.roomQuestionId === roomQuestionId)) return { accepted: false };
    const g = gradeDetailed(base, response);
    answers.current = [...answers.current, { id: `local-${roomQuestionId}`, seatId: SELF, roomQuestionId, correct: g.correct, awardedFraction: g.correct ? 1000 : Math.round(g.fraction * 1000) }];
    const out = advance(stateRef.current, { now: now(), seed, pool: fullPool, answers: answers.current });
    if (out.changed) setState(out.state);
    return { accepted: true, private: true };
  }, [now, seed, fullPool]);
  return { snap, conn: 'connected', error, fatal: false, busy: false, local: true, serverNow: now, act, host, answer, openPersonal: async () => null, refresh: async () => {} };
}
