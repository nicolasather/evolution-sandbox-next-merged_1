'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/quiz/client';
import { publicView, type ClockView, type ProjectorSnapshot, type View } from '@/lib/quiz/projector/public-view';
import { createState } from '@/lib/quiz/projector/session';
import { run } from '@/lib/quiz/projector/orchestrate';
import { labPool, labQuestions, type LabQuestion } from '@/lib/quiz/projector/lab-bank';
import type { GameKey, GameState, Locale, ProjectorConfig, VerifiedAnswer } from '@/lib/quiz/projector/types';
import { errText } from './i18n';

export type GameApi = {
  snap: ProjectorSnapshot | null; error: string; offline: boolean; busy: boolean; fatal: boolean;
  send: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  serverNow: () => number; local: boolean;
};
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`);

/** Polls the host-authenticated projection of a real room and sends one idempotent command per click. */
export function useRemoteGame(roomId: string, view: View, locale: Locale): GameApi {
  const [snap, setSnap] = useState<ProjectorSnapshot | null>(null);
  const [error, setError] = useState(''); const [offline, setOffline] = useState(false); const [busy, setBusy] = useState(false); const [fatal, setFatal] = useState(false);
  const rev = useRef(0); const offset = useRef(0); const alive = useRef(true); const inflight = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const d = await api<ProjectorSnapshot>(`/api/quiz/rooms/${roomId}/game/state?view=${view}`);
      if (!alive.current) return;
      rev.current = d.revision; offset.current = Date.parse(d.clock.serverNow) - Date.now(); setSnap(d); setOffline(false);
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(true); setError(errText(locale, e.message)); } else setOffline(true);
    }
  }, [roomId, view, locale]);
  useEffect(() => {
    alive.current = true; let t: ReturnType<typeof setTimeout>;
    const loop = async () => { if (!inflight.current) await refresh(); if (alive.current && !fatal) t = setTimeout(loop, document.hidden ? 5000 : 1500); };
    void loop(); return () => { alive.current = false; clearTimeout(t); };
  }, [refresh, fatal]);
  const send = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (inflight.current) return false;
    inflight.current = true; setBusy(true); setError('');
    const commandId = uid(); // reused on retry so a double-click or a flaky network can never commit twice
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const d = await api<ProjectorSnapshot>(`/api/quiz/rooms/${roomId}/game/action`, { method: 'POST', json: { commandId, expectedRevision: rev.current, action, payload } });
          rev.current = d.revision; offset.current = Date.parse(d.clock.serverNow) - Date.now(); setSnap(d); setOffline(false); return true;
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) { setError(errText(locale, e.message)); if (e.status === 409) await refresh(); return false; }
          if (attempt === 2) { setOffline(true); setError(errText(locale, 'projector:revisionConflict')); return false; }
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      return false;
    } finally { inflight.current = false; setBusy(false); }
  }, [roomId, refresh, locale]);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { snap, error, offline, busy, fatal, send, serverNow, local: false };
}

export type LabOpts = { game: GameKey; teamNames: string[]; minutes: number | null; focus: ProjectorConfig['focus']; seed?: string; settings?: ProjectorConfig['settings']; synchronized?: boolean };
/** The same engine, in the browser, with a sample question bank. For trying a game with no account and no database. */
export function useLocalGame(o: LabOpts, locale: Locale): GameApi {
  const seed = o.seed ?? 'lab-seed';
  const bank = useMemo(() => labQuestions(120, seed), [seed]);
  const pool = useMemo(() => labPool(bank), [bank]);
  const cfg = useMemo<ProjectorConfig>(() => ({ v: 1, game: o.game, focus: o.focus, minutes: o.minutes, seed, settings: o.settings ?? {} }), [o.game, o.focus, o.minutes, seed, o.settings]);
  const init = useMemo(() => createState(cfg, o.teamNames.map((name, i) => ({ id: `t${i + 1}`, name, order: i })), pool, { synchronized: o.synchronized }).state, [cfg, o.teamNames, pool, o.synchronized]);
  const [state, setState] = useState<GameState>(init);
  const [rev, setRev] = useState(0); const [clock, setClock] = useState({ startedAt: null as number | null, pausedAt: null as number | null, shift: 0, extra: 0, status: 'waiting' as ClockView['status'] });
  const [error, setError] = useState(''); const [busy] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the local game when its setup changes
  useEffect(() => { setState(init); setRev(0); setClock({ startedAt: null, pausedAt: null, shift: 0, extra: 0, status: 'waiting' }); }, [init]);
  const stateRef = useRef(state); const clockRef = useRef(clock);
  useEffect(() => { stateRef.current = state; clockRef.current = clock; });
  const send = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    setError(''); const now = Date.now(); const c = clockRef.current;
    if (action === 'start') { setClock({ ...c, startedAt: now, status: 'active' }); setRev((r) => r + 1); return true; }
    if (action === 'pause') { setClock({ ...c, pausedAt: now }); setRev((r) => r + 1); return true; }
    if (action === 'resume') { setClock({ ...c, shift: c.shift + (now - (c.pausedAt ?? now)), pausedAt: null }); setRev((r) => r + 1); return true; }
    if (c.status === 'waiting') { setError(errText(locale, 'projector:notRunning')); return false; }
    if (c.pausedAt) { setError(errText(locale, 'projector:paused')); return false; }
    const verdict = payload.verdict === 'correct' || payload.verdict === 'wrong' ? (payload.verdict as 'correct' | 'wrong') : undefined;
    const cmd = { action, payload: Object.fromEntries(Object.entries(payload).filter(([k]) => k !== 'verdict')) };
    const r = await run(stateRef.current, cmd, pool, {
      async open(p) { return { roomQuestionId: bank[p.position]!.id }; },
      async grade(teamId, ask): Promise<VerifiedAnswer> {
        if (!verdict) throw new Error('projector:needVerdict');
        const q = bank[ask.position]!; const entry = pool[ask.position]!;
        return { submissionId: `local-${ask.position}-${teamId}`, teamId, roomQuestionId: q.id, position: ask.position, grade: verdict, fraction: verdict === 'correct' ? 1 : 0, kind: entry.kind, topic: entry.topic, difficulty: entry.difficulty, teacherOverride: true };
      },
      async reveal() { /* nothing to flip locally */ },
    }).catch((e: Error) => ({ ok: false as const, code: e.message.replace(/^projector:/, '') }));
    if (!r.ok) { setError(errText(locale, `projector:${r.code}${'params' in r && r.params ? ':' + JSON.stringify(r.params) : ''}`)); return false; }
    if (action === 'extend') setClock({ ...c, extra: c.extra + Number(payload.minutes ?? 0) * 60_000 });
    setState(r.state); setRev((n) => n + 1);
    return true;
  }, [bank, pool, locale]);
  // eslint-disable-next-line react-hooks/purity -- the lab clock is wall time by design; `rev` re-renders it on every command and at the deadline
  const nowMs = Date.now();
  const snap = useMemo<ProjectorSnapshot>(() => {
    const now = nowMs;
    const deadline = clock.startedAt && o.minutes !== null ? clock.startedAt + clock.shift + clock.extra + o.minutes * 60_000 : null;
    const ref = clock.pausedAt ?? now;
    const status = state.core.phase === 'finished' ? 'ended' : clock.status;
    const view = publicView(state, 'host');
    const ask = state.core.ask; const q: LabQuestion | undefined = ask ? bank[ask.position] : undefined;
    const question = q && state.core.phase === 'asking' ? { id: q.id, position: q.position, kind: q.kind, prompt: q.prompt[locale], base_points: 100, payload: { options: q.options?.map((x) => ({ id: x.id, text: x.text[locale] })) }, answerKey: { correctIds: [q.correct], explanation: q.explanation[locale] } } : null;
    return {
      revision: rev, status: state.core.phase === 'finished' ? 'finished' : 'active', game: view, config: cfg, question,
      clock: { serverNow: new Date(now).toISOString(), deadlineAt: deadline ? new Date(deadline).toISOString() : null, paused: !!clock.pausedAt, pausedAt: clock.pausedAt ? new Date(clock.pausedAt).toISOString() : null, startedAt: clock.startedAt ? new Date(clock.startedAt).toISOString() : null, status, overtime: !!deadline && !clock.pausedAt && ref > deadline, untimed: o.minutes === null },
      room: { id: 'lab', code: 'LAB', status, paused: !!clock.pausedAt, teams: state.core.teams.map((t) => ({ id: t.id, name: t.name, points: 0 })) },
    };
  }, [state, rev, clock, bank, cfg, o.minutes, locale, nowMs]);
  // like the server, the lab turns an expired clock into `time_up` (finish this turn, then end) exactly once per overtime
  const overtime = snap.clock.overtime && snap.status !== 'finished';
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the lab mirrors the server: an expired clock sends time_up once
  useEffect(() => { if (overtime) void send('time_up'); }, [overtime, send]);
  useEffect(() => {
    if (!clock.startedAt || o.minutes === null || clock.pausedAt || state.core.phase === 'finished') return;
    const ms = clock.startedAt + clock.shift + clock.extra + o.minutes * 60_000 - Date.now();
    const h = setTimeout(() => setRev((n) => n + 1), Math.max(0, ms) + 50); return () => clearTimeout(h);
  }, [clock, o.minutes, state.core.phase]);
  const serverNow = useCallback(() => Date.now(), []);
  return { snap, error, offline: false, busy, fatal: false, send, serverNow, local: true };
}
