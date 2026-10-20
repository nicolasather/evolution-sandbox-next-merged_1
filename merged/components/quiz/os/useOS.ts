'use client';
/** One client interface for Obstacle Survival screens, two implementations:
 *   useOSRemote — a real room. GET state (catch-up happens on the server), idempotent commands (a command id is reused on retry), input batches sent
 *                 every 100 ms with the SAME physics running locally for instant feel, a Realtime hint when available and polling always, a server clock
 *                 offset, and an explicit connection state (connecting → connected → degraded → reconnecting → restored).
 *   useOSLocal  — offline practice: the same physics in this tab with sample questions. Nothing is saved or rewarded. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { api, ApiError } from '@/lib/quiz/client';
import type { OSSnapshot } from '@/lib/quiz/os/server';
import type { Body, HostAction, Input, MapId, Role, SeatAction } from '@/lib/quiz/os/domain';
import { courseFor, hazardActive, tileOf, type CourseIndex } from '@/lib/quiz/os/course';
import { idleTo, newBody, type Ctx, type Ev } from '@/lib/quiz/os/physics';
import { Predictor, IDLE_INPUT } from '@/lib/quiz/os/predict';
import { HOP_COOLDOWN_TICKS, ROLE_COOLDOWNS, TICK_MS } from '@/lib/quiz/os/balance';
import { KIND_NAME } from './art';
import type { Dot } from './render';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { gradeDetailed } from '@/lib/quiz/grading';
import { publicPayload } from '@/lib/quiz/public';

export type OSSnap = OSSnapshot;
export type Conn = 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'restored';
export type ActResult = { ok: boolean; code?: string; message?: string; note?: string };
export type AnswerResult = { accepted: boolean; private?: boolean };
export type Feed = { id: number; kind: 'hit' | 'good' | 'info'; text: string };
export type Frame = { idx: CourseIndex; tick: number; dots: Dot[]; me: Body | null; gate: number; pulses: readonly Ctx['pulses'][number][]; peek: boolean; sockets: boolean; frozen: boolean };
export type InputApi = { set: (dx: -1 | 0 | 1, dy: -1 | 0 | 1) => void; hop: () => void; ability: () => void; clear: () => void };
export type OSClient = {
  snap: OSSnap | null; conn: Conn; error: string; fatal: boolean; busy: boolean; local: boolean; feed: Feed[];
  serverNow: () => number; input: InputApi;
  act: (a: SeatAction) => Promise<ActResult>; host: (a: HostAction) => Promise<ActResult>; answer: (roomQuestionId: string, response: unknown) => Promise<AnswerResult>;
  refresh: () => Promise<void>; frame: () => Frame | null; cooldowns: () => { hop: number; ability: number }; resume?: () => void;
};
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `c${Date.now()}${Math.random().toString(36).slice(2)}`);
const INF = (v: number) => (v < 0 ? Infinity : v);

/** Held keys/touches → one Input per tick. Hop and ability are one-shot: a held button can never fire them twice. */
function useInputState() {
  const held = useRef({ dx: 0 as -1 | 0 | 1, dy: 0 as -1 | 0 | 1, hop: false, ability: false });
  const api = useMemo<InputApi>(() => ({
    set: (dx, dy) => { held.current.dx = dx; held.current.dy = dy; },
    hop: () => { held.current.hop = true; }, ability: () => { held.current.ability = true; },
    clear: () => { held.current = { dx: 0, dy: 0, hop: false, ability: false }; },
  }), []);
  const read = useCallback((): Input => { const h = held.current; const i: Input = { dx: h.dx, dy: h.dy, hop: h.hop, ...(h.ability ? { ability: true } : {}) }; h.hop = false; h.ability = false; return i; }, []);
  return { api, read };
}
const describe = (e: Ev, idx: CourseIndex): Omit<Feed, 'id'> | null => {
  const kind = e.hazard ? idx.course.hazards.find((h) => h.id === e.hazard)?.kind : undefined; const nm = kind ? KIND_NAME[kind] : 'a hazard';
  switch (e.kind) {
    case 'hit': return { kind: 'hit', text: `Hit by ${nm}. You are stunned for a moment.` };
    case 'shield': return { kind: 'good', text: 'Safety rail absorbed the hit.' };
    case 'checkpoint': return { kind: 'good', text: `Checkpoint ${Number(e.what) + 1} reached.` };
    case 'rescued': return { kind: 'good', text: 'A teammate freed you.' };
    case 'goal': return { kind: 'good', text: 'You reached the goal!' };
    case 'denied': return { kind: 'info', text: e.what === 'hop' ? 'Hop is recharging.' : 'Ability is recharging.' };
    default: return null;
  }
};

// ── remote ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function useOSRemote(roomId: string, view: 'student' | 'host' | 'projector', opts: { screenToken?: string | null } = {}): OSClient {
  const [snap, setSnap] = useState<OSSnap | null>(null); const [conn, setConn] = useState<Conn>('connecting');
  const [error, setError] = useState(''); const [fatal, setFatal] = useState(false); const [busy, setBusy] = useState(false); const [feed, setFeed] = useState<Feed[]>([]);
  const rev = useRef(-1); const offset = useRef(0); const alive = useRef(true); const fails = useRef(0); const hinted = useRef(0); const snapRef = useRef<OSSnap | null>(null);
  const pred = useRef<Predictor | null>(null); const inflight = useRef<{ id: string; from: number; n: number } | null>(null); const lastBody = useRef<Body | null>(null);
  const feedId = useRef(0); const dotsRef = useRef(new Map<string, { x: number; y: number }>()); const { api: inputApi, read } = useInputState();
  const url = `/api/quiz/os/rooms/${roomId}/state${view === 'host' ? '?view=host' : ''}`;
  const headers = useMemo<Record<string, string>>(() => { const h: Record<string, string> = {}; if (view === 'projector' && opts.screenToken) h['x-os-screen'] = opts.screenToken; return h; }, [view, opts.screenToken]);
  const idx = useMemo(() => (snap ? courseFor(snap.course.mapId as MapId, snap.course.courseSeed, snap.course.lowPressure).idx : null), [snap?.course.mapId, snap?.course.courseSeed, snap?.course.lowPressure]); // eslint-disable-line react-hooks/exhaustive-deps
  const idxRef = useRef<CourseIndex | null>(null); useEffect(() => { idxRef.current = idx; }, [idx]);

  const ctxOf = useCallback((d: OSSnap, ix: CourseIndex): Ctx | null => {
    if (!d.you) return null; const team = d.teams.find((t) => t.id === d.you!.teamId); const perks: Ctx['perks'] = {}; for (const p of team?.perks ?? []) perks[p] = (perks[p] ?? 0) + 1;
    return { idx: ix, role: d.you.role, perks, pulses: team?.pulses ?? [], limits: d.limits.map(INF), chapterTicks: d.chapterTicks, seatId: d.you.seatId };
  }, []);
  const worldEstimate = useCallback(() => { const d = snapRef.current; if (!d) return 0; const adv = d.world.running ? Math.floor((Date.now() + offset.current - d.serverNow) / TICK_MS) : 0; const t = d.world.tick + Math.max(0, adv); return d.world.freezeTick != null ? Math.min(t, d.world.freezeTick) : t; }, []);

  const accept = useCallback((d: OSSnap) => {
    if (d.revision < rev.current) return; rev.current = d.revision; offset.current = d.serverNow - Date.now();
    snapRef.current = d; setSnap(d);
    for (const x of d.dots) { const m = dotsRef.current.get(x.id); if (!m) dotsRef.current.set(x.id, { x: x.x, y: x.y }); }
    const ix = courseFor(d.course.mapId as MapId, d.course.courseSeed, d.course.lowPressure).idx; idxRef.current = ix;
    if (view === 'student' && d.body && d.you) {
      const ctx = ctxOf(d, ix)!; lastBody.current = d.body;
      if (!pred.current || pred.current.ctx.seatId !== ctx.seatId) pred.current = new Predictor(d.body, ctx); else pred.current.rebase(d.body, ctx);
    }
  }, [view, ctxOf]);
  const refresh = useCallback(async () => {
    try {
      const d = await api<OSSnap>(url, { headers }); if (!alive.current) return; accept(d); setError('');
      setConn((c) => (fails.current > 0 || c === 'reconnecting' ? 'restored' : 'connected')); fails.current = 0;
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(true); setError(e.message); return; }
      fails.current++; setConn(fails.current >= 3 ? 'reconnecting' : 'degraded');
    }
  }, [url, headers, accept]);
  useEffect(() => {
    alive.current = true; let t: ReturnType<typeof setTimeout>;
    const loop = async () => { await refresh(); if (!alive.current || fatal) return; const ph = snapRef.current?.phase; t = setTimeout(loop, document.hidden ? 4000 : ph === 'traversing' ? 1000 : ph && ph !== 'lobby' && ph !== 'finished' ? 1200 : 2000); };
    void loop(); const vis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('online', vis);
    return () => { alive.current = false; clearTimeout(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', vis); };
  }, [refresh, fatal]);
  // Realtime hint: a public channel that only carries {revision, phase}. Duplicates and reordering are harmless: we re-read.
  useEffect(() => {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL; const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; if (!u || !k) return; let stop = () => {};
    try { const sb = createClient(u, k, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = sb.channel(`os:${roomId}`).on('broadcast', { event: 'rev' }, (m) => { const r = Number((m.payload as { revision?: number })?.revision ?? -1); if (r > rev.current && r !== hinted.current) { hinted.current = r; setTimeout(() => void refresh(), 120); } }).subscribe();
      stop = () => { void sb.removeChannel(ch); }; } catch { /* polling covers it */ }
    return () => stop();
  }, [roomId, refresh]);

  const pushFeed = useCallback((evs: Ev[]) => {
    const ix = idxRef.current; if (!ix || !evs.length) return; const add: Feed[] = [];
    for (const e of evs) { const d = describe(e, ix); if (d) add.push({ id: ++feedId.current, ...d }); }
    if (!add.length) return; setFeed((f) => [...f, ...add].slice(-3));
    for (const a of add) setTimeout(() => setFeed((f) => f.filter((x) => x.id !== a.id)), 3200);
  }, []);
  // local simulation: one fixed tick every 25 ms of catching up, never past the (estimated) world tick or the planned freeze
  useEffect(() => {
    if (view !== 'student') return;
    const h = setInterval(() => {
      const p = pred.current; const d = snapRef.current; if (!p || !d || d.paused || d.phase !== 'traversing' || !d.world.running) return;
      pushFeed(p.catchUp(worldEstimate(), read));
    }, 25);
    return () => clearInterval(h);
  }, [view, read, worldEstimate, pushFeed]);
  // sender: serial (one batch in flight); the same command id is reused if a request has to be repeated
  useEffect(() => {
    if (view !== 'student') return;
    const h = setInterval(async () => {
      const p = pred.current; const d = snapRef.current; if (!p || !d || inflight.current || d.paused || d.phase !== 'traversing') return;
      const b = p.batch(); if (!b) return; const id = uid(); inflight.current = { id, from: b.fromTick, n: b.samples.length };
      try {
        const r = await api<{ tick: number }>(`/api/quiz/os/rooms/${roomId}/input`, { method: 'POST', json: { commandId: id, fromTick: b.fromTick, samples: b.samples } });
        p.ack(r.tick);
      } catch (e) {
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(true); setError(e.message); }
        else if (e instanceof ApiError && e.status === 400 && lastBody.current && /Those ticks|Expected tick/.test(e.message)) {
          // the server idled this seat forward (long absence): follow it deterministically, then continue from there
          const m = /Expected tick (\d+)/.exec(e.message); const to = m ? Number(m[1]) - 1 : null; const ix = idxRef.current; const sn = snapRef.current;
          if (to != null && ix && sn) { const ctx = ctxOf(sn, ix); if (ctx) p.rebase(idleTo(lastBody.current, to, ctx).body, ctx); } else void refresh();
        } else void refresh();
      } finally { inflight.current = null; }
    }, 100);
    return () => clearInterval(h);
  }, [view, roomId, refresh, ctxOf]);

  const post = useCallback(async <T,>(path: string, json: unknown): Promise<T> => api<T>(`/api/quiz/os/rooms/${roomId}/${path}`, { method: 'POST', json }), [roomId]);
  const command = useCallback(async (path: 'action' | 'host', payload: Record<string, unknown>): Promise<ActResult> => {
    setBusy(true); const commandId = uid(); // reused on retry: a double tap or a flaky network can never act twice
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { const d = await post<{ ok: true; note?: string; state: OSSnap }>(path, { commandId, ...payload }); accept(d.state); return { ok: true, note: d.note }; }
        catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) { await refresh(); return { ok: false, code: (e as ApiError & { code?: string }).code, message: e.message }; }
          if (attempt === 2) { setConn('reconnecting'); return { ok: false, message: 'Connection lost. Your action was not applied.' }; }
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
      return { ok: false };
    } finally { setBusy(false); }
  }, [post, accept, refresh]);
  const act = useCallback((a: SeatAction) => command('action', { action: a, expectedRevision: Math.max(0, rev.current) }), [command]);
  const host = useCallback((a: HostAction) => command('host', { action: a }), [command]);
  const answer = useCallback(async (roomQuestionId: string, response: unknown) => { const r = await post<AnswerResult>('answer', { roomQuestionId, response, commandId: uid() }); void refresh(); return r; }, [post, refresh]);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const cooldowns = useCallback(() => { const p = pred.current; if (!p) return { hop: 0, ability: 0 }; const t = p.body.tick; return { hop: Math.max(0, p.body.hopReadyTick - t), ability: Math.max(0, p.body.abilityReadyTick - t) }; }, []);
  const frame = useCallback((): Frame | null => {
    const d = snapRef.current; const ix = idxRef.current; if (!d || !ix) return null;
    const p = pred.current; const smooth = dotsRef.current; const now = Date.now() + offset.current;
    const tick = p && view === 'student' ? p.body.tick : d.world.tick + (d.world.running && !d.paused ? (now - d.serverNow) / TICK_MS : 0);
    const dots: Dot[] = d.dots.filter((x) => !(x.mine && p)).map((x) => {
      const m = smooth.get(x.id) ?? { x: x.x, y: x.y }; m.x += (x.x - m.x) * 0.2; m.y += (x.y - m.y) * 0.2; smooth.set(x.id, m);
      return { id: x.id, x: m.x, y: m.y, role: x.role, team: Math.max(0, d.teams.findIndex((t) => t.id === x.teamId)), stunned: x.stunned, goal: x.goal, mine: x.mine, mate: x.mate };
    });
    if (p && d.you) dots.push({ id: d.you.seatId, x: p.body.x, y: p.body.y, role: d.you.role, team: Math.max(0, d.teams.findIndex((t) => t.id === d.you!.teamId)), stunned: p.body.stunUntil > p.body.tick, goal: p.body.goalTick != null, mine: true, mate: true, hop: p.body.hopUntil > p.body.tick, invincible: p.body.invincibleUntil > p.body.tick });
    const chapter = Math.max(0, Math.min(d.limits.length - 1, d.chapter)); const myTeam = d.teams.find((t) => t.id === d.you?.teamId);
    return { idx: ix, tick, dots, me: p?.body ?? null, gate: INF(d.limits[chapter] ?? -1), pulses: myTeam?.pulses ?? [], peek: (myTeam?.perks ?? []).includes('route_peek'), sockets: (myTeam?.perks ?? []).includes('bridge_socket'), frozen: d.phase !== 'traversing' || d.paused };
  }, [view]);
  useEffect(() => { snapRef.current = snap; }, [snap]);
  return { snap, conn, error, fatal, busy, local: false, feed, serverNow, input: inputApi, act, host, answer, refresh, frame, cooldowns };
}

// ── local practice ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export type PracticeOpts = { mapId: MapId; role: Role; lowPressure: boolean };
const SELF = 'practice-seat';
export function useOSLocal(o: PracticeOpts): OSClient {
  const seed = `practice-${o.mapId}`;
  const idx = useMemo(() => courseFor(o.mapId, seed, o.lowPressure).idx, [o.mapId, seed, o.lowPressure]);
  const ctx = useMemo<Ctx>(() => ({ idx, role: o.role, perks: {}, pulses: [], limits: [Infinity], chapterTicks: 1e9, seatId: SELF }), [idx, o.role]);
  const p = useRef<Predictor | null>(null); const { api: inputApi, read } = useInputState();
  const [phase, setPhase] = useState<'traversing' | 'barrier' | 'reveal' | 'finished'>('traversing'); const [qn, setQn] = useState(0); const [verdict, setVerdict] = useState<number | null>(null);
  // everything the render needs is copied into state by the loop; refs are only read in effects and callbacks
  const [view, setView] = useState<{ body: Body; clock: number; pulses: Ctx['pulses'] }>(() => ({ body: newBody(idx), clock: 0, pulses: [] }));
  const [feed, setFeed] = useState<Feed[]>([]); const feedId = useRef(0); const t0 = useRef(0);
  const phaseRef = useRef(phase); useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    p.current = new Predictor(newBody(idx), ctx); t0.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new practice setup restarts the local run
    setPhase('traversing'); setQn(0); setVerdict(null); setView({ body: newBody(idx), clock: 0, pulses: [] });
  }, [idx, ctx]);
  const note = useCallback((evs: Ev[]) => { const add: Feed[] = []; for (const e of evs) { const d = describe(e, idx); if (d) add.push({ id: ++feedId.current, ...d }); } if (add.length) { setFeed((f) => [...f, ...add].slice(-3)); for (const a of add) setTimeout(() => setFeed((f) => f.filter((x) => x.id !== a.id)), 3200); } }, [idx]);
  useEffect(() => {
    const h = setInterval(() => {
      const pr = p.current; if (!pr) return;
      if (phaseRef.current !== 'traversing') { t0.current = Date.now() - pr.tick * TICK_MS; return; }
      const target = Math.floor((Date.now() - t0.current) / TICK_MS); const before = pr.body.checkpoint;
      note(pr.catchUp(target, read, 8)); const b = pr.body;
      setView({ body: { ...b }, clock: Date.now() - t0.current, pulses: [...pr.ctx.pulses] });
      if (b.goalTick != null) { setPhase('finished'); return; }
      if (b.checkpoint > before) { inputApi.clear(); setPhase('barrier'); setVerdict(null); }
    }, 25);
    return () => clearInterval(h);
  }, [note, read, inputApi]);
  const question = useMemo(() => {
    if (!['barrier', 'reveal'].includes(phase)) return null; const base = PRACTICE[qn % PRACTICE.length];
    return { id: base.id, position: base.position, kind: base.kind, prompt: base.prompt, base_points: 100, payload: publicPayload(base.kind, base.payload, `${base.id}:me`), ...(phase === 'reveal' ? { answerKey: base.answerKey } : {}) } as Record<string, unknown>;
  }, [phase, qn]);
  const snap = useMemo<OSSnap>(() => {
    const b = view.body;
    return {
      view: 'student', phase, format: 'cooperative_escape', paused: false, locked: false, chapter: Math.min(b.checkpoint, idx.course.checkpoints.length), chapters: idx.course.checkpoints.length + 1, chapterTicks: 1e9,
      world: { tick: b.tick, freezeTick: null, running: phase === 'traversing' }, deadlineMs: null, phaseStartedMs: 0, serverNow: view.clock,
      teams: [{ id: 'sq1', name: 'Practice squad', players: 1, progress: idx.totalDist ? Math.round((b.maxDist * 1000) / idx.totalDist) : 0, escaped: b.goalTick != null ? 1 : 0, mastery: 0, points: 0, perks: [], pulses: [], spent: 0, earned: 0, wasted: 0, chaptersCleared: Math.min(b.checkpoint, idx.course.checkpoints.length) }],
      seats: [{ id: SELF, name: 'You', teamId: 'sq1', role: o.role, ready: true }], dots: [], you: { seatId: SELF, teamId: 'sq1', role: o.role, ready: true, tick: b.tick },
      barrier: question ? { chapter: b.checkpoint, phaseId: `local-${qn}`, deadlineMs: Number.MAX_SAFE_INTEGER, position: qn, help: false, eligible: 1, answered: phase === 'reveal' ? 1 : 0 } : null,
      finish: phase === 'finished' ? { reason: 'escaped', standings: [{ teamId: 'sq1', name: 'Practice squad', rank: 1, outcome: 'escaped', progress: 1000, mastery: 0, teamwork: 0, score: 0, hits: b.hits, cleared: 0, assists: 0, spent: 0, players: 1, escaped: 1 }] } : null,
      limits: [-1], revision: qn * 10 + (phase === 'reveal' ? 1 : 0), room: { id: 'practice', code: 'PRACTICE', status: phase === 'finished' ? 'ended' : 'active' }, course: { mapId: o.mapId, courseSeed: seed, lowPressure: o.lowPressure }, question, body: b, tip: null, perks: {},
      mine: phase === 'reveal' ? verdict : null, award: null,
    } as unknown as OSSnap;
  }, [phase, qn, question, idx, o.role, o.mapId, o.lowPressure, seed, view, verdict]);
  const answer = useCallback(async (roomQuestionId: string, response: unknown): Promise<AnswerResult> => {
    const base = PRACTICE.find((x) => x.id === roomQuestionId); if (!base) return { accepted: false };
    const g = gradeDetailed(base, response); setVerdict(g.correct ? 1000 : Math.round(g.fraction * 1000)); setPhase('reveal'); return { accepted: true, private: true };
  }, []);
  const resume = useCallback(() => { setQn((n) => n + 1); setPhase('traversing'); }, []);
  const viewRef = useRef(view); useEffect(() => { viewRef.current = view; }, [view]);
  const frame = useCallback((): Frame => {
    const pr = p.current; const b = pr?.body ?? viewRef.current.body; const tick = b.tick;
    return { idx, tick, me: b, gate: Infinity, pulses: viewRef.current.pulses, peek: false, sockets: false, frozen: phaseRef.current !== 'traversing',
      dots: [{ id: SELF, x: b.x, y: b.y, role: o.role, team: 0, stunned: b.stunUntil > tick, goal: b.goalTick != null, mine: true, mate: true, hop: b.hopUntil > tick, invincible: b.invincibleUntil > tick }] };
  }, [idx, o.role]);
  const cooldowns = useCallback(() => { const b = p.current?.body; return b ? { hop: Math.max(0, b.hopReadyTick - b.tick), ability: Math.max(0, b.abilityReadyTick - b.tick) } : { hop: 0, ability: 0 }; }, []);
  const serverNow = useCallback(() => Date.now() - t0.current, []);
  const act = useCallback(async () => ({ ok: true }), []); const hostFn = useCallback(async () => ({ ok: true }), []); const refresh = useCallback(async () => {}, []);
  return { snap, conn: 'connected', error: '', fatal: false, busy: false, local: true, feed, serverNow, input: inputApi, act, host: hostFn, answer, refresh, frame, cooldowns, resume };
}
export const HOP_RECHARGE = HOP_COOLDOWN_TICKS; export const ABILITY_RECHARGE = ROLE_COOLDOWNS;
export { hazardActive, tileOf, IDLE_INPUT };
