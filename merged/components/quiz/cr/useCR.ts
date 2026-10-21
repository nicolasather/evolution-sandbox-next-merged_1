'use client';
/** One client interface for every Clue Racing screen, two implementations:
 *  useCRRemote — a real room. GET state (the server catches the world up), idempotent commands (the command id is reused on retry), steering INTENT sent on change plus a 1 s
 *                heartbeat, local prediction of the student's own token for instant feel (reconciled to the server, never trusted), a Realtime hint when available and polling always,
 *                a server-clock offset and an explicit connection state.
 *  useCRLocal  — offline Practice: the same engine runs in this tab as a team of one (the Solo Pathfinder) against scripted rivals, with sample questions. Nothing is saved or rewarded. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { api, ApiError } from '@/lib/quiz/client';
import type { CRSnapshot } from '@/lib/quiz/cr/server';
import type { CommittedAnswer, CRState, Format, HostAction, IntentEntry, MapId, PoolEntry, SeatAction } from '@/lib/quiz/cr/domain';
import { addSeat, advance, createSession, reduceHost, reduceSeat, worldTarget } from '@/lib/quiz/cr/engine';
import { buildCourse, legGeo, resolveMove, walkable, type Course, type LegGeo } from '@/lib/quiz/cr/maps';
import { botAction, botIntent } from '@/lib/quiz/cr/bot';
import { planMatch } from '@/lib/quiz/cr/plan';
import { project } from '@/lib/quiz/cr/public';
import { cfgOf } from '@/lib/quiz/cr/testkit';
import { SPEED, TICK_MS } from '@/lib/quiz/cr/balance';
import { stationPlan } from '@/lib/quiz/cr/maps';
import type { Timelines } from '@/lib/quiz/cr/sim';
import { PRACTICE } from '@/lib/quiz/td/practice-bank';
import { gradeDetailed } from '@/lib/quiz/grading';
import { publicPayload } from '@/lib/quiz/public';
import type { QuestionKind } from '@/lib/quiz/types';
import type { CRFrame, DrawDot } from './render';

export type CRSnap = CRSnapshot;
export type Conn = 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'restored';
export type ActResult = { ok: boolean; code?: string; message?: string; note?: string };
export type AnswerResult = { accepted: boolean; private?: boolean };
export type FeedItem = { id: number; kind: 'good' | 'info' | 'warn'; text: string };
export type InputApi = { set: (x: number, y: number) => void; clear: () => void; dir: () => { x: number; y: number } };
export type CRClient = {
  snap: CRSnap | null; conn: Conn; error: string; fatal: boolean; busy: boolean; local: boolean; feed: FeedItem[];
  serverNow: () => number; input: InputApi; act: (a: SeatAction) => Promise<ActResult>; host: (a: HostAction) => Promise<ActResult>; answer: (roomQuestionId: string, response: unknown) => Promise<AnswerResult>;
  refresh: () => Promise<void>; frame: () => CRFrame | null; cooldown: () => { left: number; max: number }; resume?: () => void; course: Course | null;
};
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `c${Date.now()}${Math.random().toString(36).slice(2)}`);
const q2 = (n: number) => Math.round(n * 20) / 20;

/** Held keys/touch → one steering vector (analog magnitude from the joystick, 8-way from the keyboard). */
function useInputState() {
  const held = useRef({ x: 0, y: 0 });
  return useMemo<InputApi>(() => ({
    set: (x, y) => { const m = Math.hypot(x, y); const k = m > 1 ? 1 / m : 1; held.current = { x: q2(x * k), y: q2(y * k) }; },
    clear: () => { held.current = { x: 0, y: 0 }; }, dir: () => held.current,
  }), []);
}
export const legOf = (snap: CRSnap) => Math.min(snap.leg, snap.legs - 1);
const geoFor = (course: Course, snap: CRSnap): LegGeo | null => { const a = snap.stations[legOf(snap)]; const b = snap.stations[legOf(snap) + 1]; return a === undefined || b === undefined ? null : legGeo(course, a, b, legOf(snap)); };

/** Smooths other tokens and predicts the student's own. Presentation only: no game rule lives here. */
class Presenter {
  dots = new Map<string, { x: number; y: number; vx: number; vy: number; sx: number; sy: number; at: number }>();
  me: { x: number; y: number; id: string } | null = null; private lastFrame = 0;
  ingest(snap: CRSnap) {
    const now = performance.now();
    for (const d of snap.dots) {
      const m = this.dots.get(d.id);
      if (!m) { this.dots.set(d.id, { x: d.x, y: d.y, vx: 0, vy: 0, sx: d.x, sy: d.y, at: now }); continue; }
      const dt = Math.max(0.05, (now - m.at) / 1000); m.vx = (d.x - m.sx) / dt; m.vy = (d.y - m.sy) / dt; m.sx = d.x; m.sy = d.y; m.at = now;
    }
    const mine = snap.dots.find((d) => d.mine);
    if (mine && (!this.me || this.me.id !== mine.id)) this.me = { x: mine.x, y: mine.y, id: mine.id };
  }
  build(snap: CRSnap, segs: ReturnType<typeof walkable> | null, tick: number, intent: { x: number; y: number }, live: boolean, reduced: boolean, teamIndex: (id: string | null | undefined) => number): DrawDot[] {
    const now = performance.now(); const dt = Math.min(0.1, (now - this.lastFrame) / 1000 || 0.016); this.lastFrame = now;
    return snap.dots.map((d): DrawDot => {
      const m = this.dots.get(d.id) ?? { x: d.x, y: d.y, vx: 0, vy: 0, sx: d.x, sy: d.y, at: now }; this.dots.set(d.id, m);
      const lead = live && !reduced ? Math.min(0.35, (now - m.at) / 1000) : 0; const tx = m.sx + m.vx * lead; const ty = m.sy + m.vy * lead;
      if (d.mine && this.me) {
        const me = this.me; const k = SPEED * 20;
        if (live && !snap.paused && segs && (intent.x || intent.y)) { const [nx, ny] = resolveMove(segs, me.x, me.y, me.x + intent.x * k * dt, me.y + intent.y * k * dt, Math.round(tick)); me.x = nx; me.y = ny; }
        const ex = tx - me.x; const ey = ty - me.y; const far = Math.hypot(ex, ey);
        if (far > 90 || !live) { me.x = tx; me.y = ty; } else { const pull = intent.x || intent.y ? 0.06 : 0.2; me.x += ex * pull; me.y += ey * pull; }
        return { id: d.id, x: me.x, y: me.y, vx: intent.x, vy: intent.y, role: d.role, team: teamIndex(d.teamId), label: d.label, idle: d.idle, mine: true, mate: true, flag: d.flag };
      }
      m.x += (tx - m.x) * Math.min(1, dt * 12); m.y += (ty - m.y) * Math.min(1, dt * 12);
      return { id: d.id, x: m.x, y: m.y, vx: Math.sign(m.vx) * Math.min(1, Math.abs(m.vx) / 160), vy: Math.sign(m.vy) * Math.min(1, Math.abs(m.vy) / 160), role: d.role, team: teamIndex(d.teamId), label: d.label, idle: d.idle, mine: false, mate: d.mate, flag: d.flag };
    });
  }
}
function describeFx(snap: CRSnap, seen: Set<string>, push: (kind: FeedItem['kind'], text: string) => void) {
  const my = snap.you?.teamId; if (!snap.live) return;
  for (const e of snap.live.fx) {
    const key = `${snap.leg}:${e.tick}:${e.kind}:${Math.round(e.x)}:${Math.round(e.y)}`; if (seen.has(key)) continue; seen.add(key); if (seen.size > 200) seen.clear();
    const own = !e.teamId || e.teamId === my;
    if (e.kind === 'checkpoint' && own) push('good', 'Your team reached the checkpoint!');
    else if (e.kind === 'checkpoint') push('info', 'A rival reached the checkpoint.');
    else if (e.kind === 'arrive' && own) push('info', 'The guide carried your team to the checkpoint.');
    else if (e.kind === 'stamp' && own) push('good', 'Stamp collected!');
    else if (e.kind === 'wrong' && own) push('warn', 'Not that one — try again in a moment.');
    else if (e.kind === 'pass' && own) push('good', 'Lantern flag handed on.');
    else if (e.kind === 'bridge' && own) push('good', 'A bridge strip is open.');
    else if (e.kind === 'beacon' && own) push('info', 'A Rally Light is lit.');
  }
}
export const teamIndexOf = (snap: CRSnap | null) => (id: string | null | undefined) => Math.max(0, snap?.teams.findIndex((t) => t.id === id) ?? 0);

// ── remote ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function useCRRemote(roomId: string, view: 'student' | 'host' | 'projector', opts: { screenToken?: string | null; reduced?: boolean } = {}): CRClient {
  const [snap, setSnap] = useState<CRSnap | null>(null); const [conn, setConn] = useState<Conn>('connecting');
  const [error, setError] = useState(''); const [fatal, setFatal] = useState(false); const [busy, setBusy] = useState(false); const [feed, setFeed] = useState<FeedItem[]>([]);
  const rev = useRef(-1); const lastNow = useRef(0); const offset = useRef(0); const alive = useRef(true); const fails = useRef(0); const hinted = useRef(0); const snapRef = useRef<CRSnap | null>(null);
  const feedId = useRef(0); const seenFx = useRef(new Set<string>()); const pres = useRef(new Presenter()); const input = useInputState();
  const seq = useRef(0); const sending = useRef(false); const sent = useRef({ x: 0, y: 0, at: 0 }); const courseRef = useRef<Course | null>(null);
  const url = `/api/quiz/clue/rooms/${roomId}/state${view === 'host' ? '?view=host' : ''}`;
  const headers = useMemo<Record<string, string>>(() => { const h: Record<string, string> = {}; if (view === 'projector' && opts.screenToken) h['x-cr-screen'] = opts.screenToken; return h; }, [view, opts.screenToken]);
  const course = useMemo(() => (snap ? buildCourse(snap.mapId, snap.difficulty) : null), [snap?.mapId, snap?.difficulty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { courseRef.current = course; }, [course]);
  const pushFeed = useCallback((kind: FeedItem['kind'], text: string) => { const id = ++feedId.current; setFeed((f) => [...f, { id, kind, text }].slice(-3)); setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 3600); }, []);
  const accept = useCallback((d: CRSnap) => {
    if (d.revision < rev.current || (d.revision === rev.current && d.serverNow < lastNow.current)) return;
    if (typeof d.lastSeq === 'number' && d.lastSeq > seq.current) seq.current = d.lastSeq; /* continue after the server's counter (AC-02) */ rev.current = d.revision; lastNow.current = d.serverNow; offset.current = d.serverNow - Date.now(); snapRef.current = d; pres.current.ingest(d); setSnap(d);
    if (view === 'student') describeFx(d, seenFx.current, pushFeed);
  }, [view, pushFeed]);
  const refresh = useCallback(async () => {
    try {
      const d = await api<CRSnap>(url, { headers }); if (!alive.current) return; accept(d); setError('');
      setConn((c) => (fails.current > 0 || c === 'reconnecting' ? 'restored' : 'connected')); fails.current = 0;
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(true); setError(e.message); return; }
      fails.current++; setConn(fails.current >= 3 ? 'reconnecting' : 'degraded');
    }
  }, [url, headers, accept]);
  useEffect(() => {
    alive.current = true; let t: ReturnType<typeof setTimeout>;
    const loop = async () => { await refresh(); if (!alive.current || fatal) return; const ph = snapRef.current?.phase; t = setTimeout(loop, document.hidden ? 4000 : ph === 'race' ? (view === 'student' ? 350 : 450) : ph && ph !== 'lobby' && ph !== 'finished' ? 1000 : 1800); };
    void loop(); const vis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('online', vis);
    return () => { alive.current = false; clearTimeout(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', vis); };
  }, [refresh, fatal, view]);
  // Realtime hint: a public channel that only carries {revision, phase}. Duplicates and reordering are harmless: we re-read.
  useEffect(() => {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL; const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; if (!u || !k) return undefined; let stop = () => {};
    try { const sb = createClient(u, k, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = sb.channel(`cr:${roomId}`).on('broadcast', { event: 'rev' }, (m) => { const r = Number((m.payload as { revision?: number })?.revision ?? -1); if (r > rev.current && r !== hinted.current) { hinted.current = r; setTimeout(() => void refresh(), 120); } }).subscribe();
      stop = () => { void sb.removeChannel(ch); }; } catch { /* polling covers it */ }
    return () => stop();
  }, [roomId, refresh]);
  // intent sender: on change (≤ 10/s) and a 1 s heartbeat while the world is live; serial, newest wins
  useEffect(() => {
    if (view !== 'student') return undefined;
    const h = setInterval(async () => {
      const d = snapRef.current; if (!d || sending.current) return; const live = d.phase === 'race' && !d.paused;
      if (!live) { if (sent.current.x || sent.current.y) sent.current = { x: 0, y: 0, at: 0 }; input.clear(); return; }
      const v = input.dir(); const now = Date.now(); const changed = v.x !== sent.current.x || v.y !== sent.current.y;
      if (!changed && now - sent.current.at < 1000) return; if (changed && now - sent.current.at < 100) return;
      sending.current = true; seq.current += 1; const body = { p: 'cr/1', seq: seq.current, x: v.x, y: v.y };
      try { const r = await api<{ seq?: number; replayed?: boolean }>(`/api/quiz/clue/rooms/${roomId}/input`, { method: 'POST', json: body }); if (r.replayed && typeof r.seq === 'number') seq.current = Math.max(seq.current, r.seq); sent.current = { x: v.x, y: v.y, at: now }; }
      catch (e) { if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { setFatal(true); setError(e.message); } else if (e instanceof ApiError && e.status === 409) { sent.current = { ...sent.current, at: now }; } else sent.current = { ...sent.current, at: 0 }; }
      finally { sending.current = false; }
    }, 60);
    return () => clearInterval(h);
  }, [view, roomId, input]);

  const post = useCallback(async <T,>(path: string, json: unknown): Promise<T> => api<T>(`/api/quiz/clue/rooms/${roomId}/${path}`, { method: 'POST', json }), [roomId]);
  const command = useCallback(async (path: 'action' | 'host', payload: Record<string, unknown>): Promise<ActResult> => {
    setBusy(true); const commandId = uid(); // reused on retry: a double tap or a flaky network can never act twice
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { const d = await post<{ ok: true; note?: string; state: CRSnap }>(path, { p: 'cr/1', commandId, ...payload }); accept(d.state); return { ok: true, note: d.note }; }
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
  const answer = useCallback(async (roomQuestionId: string, response: unknown) => { const r = await post<AnswerResult>('answer', { p: 'cr/1', roomQuestionId, response, commandId: uid() }); void refresh(); return r; }, [post, refresh]);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const cooldown = useCallback(() => { const d = snapRef.current; if (!d?.you) return { left: 0, max: 1 }; const adv = d.phase === 'race' && !d.paused ? Math.floor((Date.now() + offset.current - d.serverNow) / TICK_MS) : 0; return { left: Math.max(0, d.you.cooldownTicks - Math.max(0, adv)), max: d.you.cooldownMax }; }, []);
  const frame = useCallback((): CRFrame | null => {
    const d = snapRef.current; const c = courseRef.current; if (!d || !c) return null; const ti = teamIndexOf(d); const live = d.phase === 'race' && !d.paused;
    const est = d.live ? Math.min(d.live.endTick, d.live.tick + (live ? Math.max(0, (Date.now() + offset.current - d.serverNow) / TICK_MS) : 0)) : 0;
    const geo = geoFor(c, d); const segs = geo ? walkable(geo, d.live?.option ?? 'a', !!d.live?.bridge?.open) : null;
    return { pub: d, course: c, geo, dots: pres.current.build(d, segs, est, view === 'student' ? input.dir() : { x: 0, y: 0 }, live, !!opts.reduced, ti), tick: est, teamIndex: ti };
  }, [view, input, opts.reduced]);
  return { snap, conn, error, fatal, busy, local: false, feed, serverNow, input, act, host, answer, refresh, frame, cooldown, course };
}

// ── local practice ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export type PracticeOpts = { format: Format; mapId: MapId; lowPressure: boolean; difficulty?: 'easy' | 'normal' | 'challenge' };
const SELF = 'practice-seat'; const BOTS = ['bot-b', 'bot-c'];
const POOL: PoolEntry[] = PRACTICE.map((p, i) => ({ position: i, id: p.id, kind: p.kind, repeat: false }));
export function useCRLocal(o: PracticeOpts): CRClient {
  const input = useInputState(); const [snap, setSnap] = useState<CRSnap | null>(null); const [feed, setFeed] = useState<FeedItem[]>([]); const feedId = useRef(0);
  const st = useRef<CRState | null>(null); const snapRef = useRef<CRSnap | null>(null); const lines = useRef<Timelines>({}); const seq = useRef(0); const pres = useRef(new Presenter());
  const answers = useRef<Map<number, CommittedAnswer[]>>(new Map()); const verdict = useRef<number | null>(null); const seen = useRef(new Set<string>());
  const course = useMemo(() => buildCourse(o.mapId, o.difficulty ?? 'normal'), [o.mapId, o.difficulty]);
  const push = useCallback((kind: FeedItem['kind'], text: string) => { const id = ++feedId.current; setFeed((f) => [...f, { id, kind, text }].slice(-3)); setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 3600); }, []);
  const build = useCallback((now: number): CRSnap | null => {
    const s = st.current; if (!s) return null;
    const win = s.question?.window ?? -1; const answered = new Set((answers.current.get(win) ?? []).map((a) => a.seatId));
    const pub = project(s, 'student', SELF, now, answered);
    let questionView: Record<string, unknown> | null = null;
    if (s.question && ['barrier', 'reveal'].includes(s.phase)) { const base = PRACTICE.find((p) => p.id === s.question!.questionId); if (base) questionView = { id: base.id, position: base.position, kind: base.kind, prompt: base.prompt, base_points: 100, payload: publicPayload(base.kind, base.payload, `${base.id}:me`), ...(s.phase === 'reveal' ? { answerKey: base.answerKey } : {}) }; }
    const award = s.phase === 'reveal' ? s.teams[0]?.awards.at(-1) ?? null : null;
    return { ...pub, lastSeq: null, revision: s.tick + win * 1000 + ['lobby', 'countdown', 'race', 'checkpoint', 'barrier', 'reveal', 'route_choice', 'finished'].indexOf(s.phase), room: { id: 'practice', code: 'PRACTICE', status: s.phase === 'finished' ? 'ended' : 'active' }, map: { mapId: s.mapId, format: s.format }, questionView, tip: null, mine: s.phase === 'reveal' ? verdict.current : null, award };
  }, []);
  useEffect(() => {
    const cfg = { ...cfgOf({ format: o.format, mapId: o.mapId, sizes: [1, 2], minutes: 10, lowPressure: o.lowPressure, seed: `practice${o.mapId}${o.format}`, difficulty: o.difficulty ?? 'easy' }), teamNames: ['Your team', 'Rivals'] };
    const base = planMatch(cfg, POOL.map((p) => p.kind as QuestionKind)); const plan = { ...base, windows: 3, legs: 4, stations: stationPlan(3), legSeconds: Math.min(base.legSeconds, 90) };
    let s = createSession(cfg, plan, POOL, ['t1', 't2'], Date.now());
    const add = (id: string, name: string, team: string) => { const r = addSeat(s, id, name, Date.now(), team); if (r.ok) { s = r.state; if (id !== SELF) s.seats.find((x) => x.id === id)!.ready = true; } };
    add(SELF, 'You', 't1'); add(BOTS[0]!, 'Bot B', 't2'); add(BOTS[1]!, 'Bot C', 't2');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new practice setup restarts the local run
    st.current = s; answers.current = new Map(); verdict.current = null; lines.current = {}; seen.current = new Set(); const first = build(Date.now()); snapRef.current = first; setSnap(first); if (first) pres.current.ingest(first);
    let last = 0; const h = setInterval(() => {
      const cur = st.current; if (!cur) return; const now = Date.now();
      if (cur.phase === 'race' && !cur.paused) {
        const t = worldTarget(cur, now); const v = input.dir(); const mine = cur.seats.find((x) => x.id === SELF)!;
        if (v.x !== (lines.current[SELF]?.at(-1)?.x ?? 0) || v.y !== (lines.current[SELF]?.at(-1)?.y ?? 0) || (cur.live && cur.live.tick - mine.seenTick > 20)) { const e: IntentEntry = { tick: t + 1, x: v.x, y: v.y, seq: ++seq.current }; lines.current[SELF] = [...(lines.current[SELF] ?? []).slice(-8), e]; }
        for (const id of BOTS) { const b = botIntent(cur, id); const prev = lines.current[id]?.at(-1); if (!prev || prev.x !== b.x || prev.y !== b.y || cur.live!.tick % 20 === 0) lines.current[id] = [...(lines.current[id] ?? []).slice(-8), { tick: t + 1, x: b.x, y: b.y, seq: ++seq.current }]; }
        for (const id of BOTS) { const a = botAction(st.current!, id); if (a) { const r = reduceSeat(st.current!, id, a); if (r.ok) st.current = r.state; } }
      }
      if (cur.phase === 'barrier' && cur.question && !answers.current.has(cur.question.window)) {
        // rivals answer at once with ~70% accuracy, deterministically per question
        const w = cur.question.window; const list: CommittedAnswer[] = BOTS.map((id, i) => { const ok = ((w * 7 + i * 3) % 10) < 7; return { id: `bot-${w}-${id}`, seatId: id, roomQuestionId: cur.question!.questionId ?? 'x', correct: ok, awardedFraction: ok ? 1000 : 0 }; }); answers.current.set(w, list); verdict.current = null;
      }
      const w = cur.question?.window ?? -1;
      const out = advance(st.current!, { now, pool: POOL, answers: cur.phase === 'barrier' ? answers.current.get(w) ?? [] : [], timelines: lines.current }); if (out.changed) st.current = out.state;
      if (st.current!.phase === 'route_choice' && st.current !== cur) { /* rivals vote for the main road */ }
      const b = build(now); if (b) { snapRef.current = b; pres.current.ingest(b); describeFx(b, seen.current, push); if (now - last > 200 || out.changed) { last = now; setSnap(b); } }
    }, 50);
    return () => clearInterval(h);
  }, [o.format, o.mapId, o.lowPressure, o.difficulty, build, input, push]);
  const act = useCallback(async (a: SeatAction): Promise<ActResult> => {
    const s = st.current; if (!s) return { ok: false }; const r = reduceSeat(s, SELF, a);
    if (!r.ok) return { ok: false, code: r.code, message: r.message }; st.current = r.state; return { ok: true, note: r.note };
  }, []);
  const host = useCallback(async (a: HostAction): Promise<ActResult> => { const s = st.current; if (!s) return { ok: false }; const { result } = reduceHost(s, a, Date.now(), POOL); if (!result.ok) return { ok: false, code: result.code, message: result.message }; st.current = result.state; return { ok: true }; }, []);
  const answer = useCallback(async (roomQuestionId: string, response: unknown): Promise<AnswerResult> => {
    const s = st.current; const base = PRACTICE.find((x) => x.id === roomQuestionId); if (!s || !base || s.phase !== 'barrier' || !s.question) return { accepted: false };
    const g = gradeDetailed(base, response); const frac = g.correct ? 1000 : Math.round(g.fraction * 1000); verdict.current = frac;
    const w = s.question.window; const list = answers.current.get(w) ?? []; list.push({ id: `me-${w}`, seatId: SELF, roomQuestionId, correct: !!g.correct, awardedFraction: frac }); answers.current.set(w, list); return { accepted: true, private: true };
  }, []);
  const serverNow = useCallback(() => Date.now(), []);
  const cooldown = useCallback(() => { const d = snapRef.current; return d?.you ? { left: d.you.cooldownTicks, max: d.you.cooldownMax } : { left: 0, max: 1 }; }, []);
  const frame = useCallback((): CRFrame | null => {
    const d = snapRef.current; if (!d) return null; const ti = teamIndexOf(d); const live = d.phase === 'race' && !d.paused; const geo = geoFor(course, d); const segs = geo ? walkable(geo, d.live?.option ?? 'a', !!d.live?.bridge?.open) : null;
    return { pub: d, course, geo, dots: pres.current.build(d, segs, d.live?.tick ?? 0, input.dir(), live, false, ti), tick: d.live?.tick ?? 0, teamIndex: ti };
  }, [course, input]);
  const refresh = useCallback(async () => {}, []);
  const resume = useCallback(() => {}, []);
  return { snap, conn: 'connected', error: '', fatal: false, busy: false, local: true, feed, serverNow, input, act, host, answer, refresh, frame, cooldown, resume, course };
}
