'use client';
/**
 * Sandbox Remix quiz: solo or classroom-projector (pass-and-play) game built from the Sandbox discovery database.
 * All grading is server-side (/api/quiz/grade); this component only renders, times and sends picks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useHasMounted } from '@/lib/useHasMounted';
import { transition, type Phase, type PhaseEvent } from '@/lib/quiz/remix/phase';
import { GRACE_MS, QUESTION_MS, REDEMPTION_MS, MAX_SHIELDS, type Wager } from '@/lib/quiz/remix/scoring';
import { findTraps } from '@/lib/quiz/remix/telemetry';
import { gradebookCsv, type GradeRow } from '@/lib/quiz/remix/gradebook';
import { randomRoomCode } from '@/lib/roomCode';
import { checkUserText, generateSafeNickname } from '@/lib/legalCompliance';
import { playCorrect, playShield, playTick, playWrong } from '@/lib/soundEffects';
import { addXp, awardBadge, masteryEarned, readShared, readUnlockedIds, VERIFIED_SCIENTIST, type PublicRemixQuestion } from '@/lib/sandboxQuizBridge';
import type { AnswerResult, Summary } from '@/lib/quiz/remix/server';
import { useDeadlineTimer } from './useDeadlineTimer';
import { LegalPanel, MuteButton, Odometer, QrModal } from './parts';

type Source = 'auto' | 'mine';
type Mode = 'solo' | 'class';
type Sub = 'active' | 'locked' | 'reveal';
type Reveal = Exclude<AnswerResult, { error: string }>;
type Player = { id: string; name: string; score: number; correct: number; answered: number; streak: number; maxStreak: number; redeemed: number; missedIds: string[] };

const SS_KEY = 'evo.remix.session.v1';
const PLAYER_KEY = 'evo.quiz.playerKey';
const MAX_AGE = 30 * 60 * 1000;
const SHAPES = ['▲', '◆', '●', '■'] as const;
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const tierOf = (s: number) => (s >= 10 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0);

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
const store = {
  get(k: string) { try { return window.sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { window.sessionStorage.setItem(k, v); } catch { /* blocked */ } },
  del(k: string) { try { window.sessionStorage.removeItem(k); } catch { /* blocked */ } },
};
function playerKey(): string {
  try {
    let k = window.localStorage.getItem(PLAYER_KEY);
    if (!k) { k = `p${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; window.localStorage.setItem(PLAYER_KEY, k); }
    return k;
  } catch { return `p${Math.random().toString(36).slice(2, 12)}`; }
}

function Particles({ n }: { n: number }) {
  // deterministic spread (no Math.random during render): a golden-ratio sequence covers the width evenly
  const items = useMemo(() => Array.from({ length: n }, (_, i) => { const f = (i * 0.61803398875) % 1; const g = (i * 0.7548776662) % 1; return { id: i, x: f * 100, dx: (g - 0.5) * 160, delay: (i % 6) * 0.04, hue: n > 30 ? Math.floor(f * 360) : 45 }; }), [n]);
  return <div className="rx-particles" aria-hidden="true">{items.map((p) => <i key={p.id} style={{ left: `${p.x}%`, ['--dx' as string]: `${p.dx}px`, animationDelay: `${p.delay}s`, background: `hsl(${p.hue} 95% 60%)` }} />)}</div>;
}

export default function RemixGame() {
  const mounted = useHasMounted();
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [sub, setSub] = useState<Sub>('active');
  const [redeem, setRedeem] = useState(false);
  const [cfg, setCfg] = useState<{ source: Source; count: number; mode: Mode }>({ source: 'auto', count: 10, mode: 'solo' });
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [seed, setSeed] = useState<number | null>(null);
  const [room, setRoom] = useState('');
  const [token, setToken] = useState('');
  const [total, setTotal] = useState(0);
  const [question, setQuestion] = useState<PublicRemixQuestion | null>(null);
  const [leagueOk, setLeagueOk] = useState(false);
  const [prog, setProg] = useState({ score: 0, streak: 0, maxStreak: 0, shields: 0 });
  const [wager, setWager] = useState<Wager>('standard');
  const [picked, setPicked] = useState(-1);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState({ n: 0, key: 0 });
  const [banner, setBanner] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState(0);
  const [hideNames, setHideNames] = useState(false);
  const [locked, setLocked] = useState(false);
  const [qr, setQr] = useState(false);
  const [newName, setNewName] = useState('');
  const [rewards, setRewards] = useState<{ xp: number; badge: boolean } | null>(null);
  const [submitState, setSubmitState] = useState<{ consent: boolean; nick: string; done?: string; err?: string }>({ consent: false, nick: '' });
  const [restoring, setRestoring] = useState(true);

  const timer = useDeadlineTimer();
  // Bug 1: synchronous guards. State updates are async; these refs close the double-tap window completely.
  const submissionLockRef = useRef<boolean>(false);
  const submittedQuestionIdsRef = useRef<Set<string>>(new Set());
  const pausedBaseRef = useRef(0);
  const redemptionDeadlineRef = useRef(0);
  const startedRef = useRef(false);

  const tier = tierOf(prog.streak);
  const hb = sub === 'active' && !timer.paused && timer.remainingMs > 0 && timer.remainingMs <= 5000;
  const secs = Math.ceil(timer.remainingMs / 1000);
  const current = players.length ? players[turn % players.length]! : null;
  const display = (p: Player, i: number) => (hideNames && phase !== 'COMPLETED' ? `Explorer #${i + 1}` : p.name);

  const go = useCallback((e: PhaseEvent) => setPhase((p) => transition(p, e)), []);

  /* ── final-5-second tick ─────────────────────────────────────────────────────────────────────────────────────────── */
  useEffect(() => { if (hb) playTick(); }, [hb, secs]);

  /* ── a question becomes active ───────────────────────────────────────────────────────────────────────────────────── */
  const beginQuestion = useCallback((q: PublicRemixQuestion, durationMs: number, isRedemption: boolean) => {
    submissionLockRef.current = false;
    setQuestion(q); setPicked(-1); setReveal(null); setWager('standard'); setSub('active'); setError('');
    pausedBaseRef.current = timer.pausedMs();
    timer.start(durationMs, () => { void submitRef.current(-1); });
    void isRedemption;
  }, [timer]);

  /* ── submit one answer ───────────────────────────────────────────────────────────────────────────────────────────── */
  const submitRef = useRef<(i: number) => Promise<void>>(async () => undefined);
  const submit = useCallback(async (optionIndex: number) => {
    if (submissionLockRef.current) return;                      // line 1: synchronous re-entry guard
    if (!question || !token) return;
    const key = `${question.id}#${redeem ? 'r' : 'm'}`;
    if (submittedQuestionIdsRef.current.has(key)) return;       // a question can be graded only once
    submissionLockRef.current = true; submittedQuestionIdsRef.current.add(key);
    setPicked(optionIndex); setSub('locked'); setPhase((p) => (p === 'QUESTION_ACTIVE' ? transition(p, 'LOCK') : p)); setBusy(true);
    const pausedMs = cfg.mode === 'class' ? Math.max(0, timer.pausedMs() - pausedBaseRef.current) : 0;
    try {
      const r = await post<{ success: boolean } & Reveal>('/api/quiz/grade', { action: 'answer', token, optionIndex, wager: redeem ? 'standard' : wager, pausedMs });
      timer.stop();
      setToken(r.token); store.set(SS_KEY, JSON.stringify({ ...JSON.parse(store.get(SS_KEY) ?? '{}'), token: r.token, savedAt: Date.now() }));
      setReveal(r); setProg({ score: r.score, streak: r.streak, maxStreak: r.maxStreak, shields: r.shields });
      setSub('reveal'); setPhase((p) => (p === 'ANSWER_LOCKED' ? transition(p, 'REVEAL') : p));
      if (r.correct) { playCorrect(); setBurst((b) => ({ n: tierOf(r.streak) >= 3 ? 60 : tierOf(r.streak) >= 2 ? 24 : 0, key: b.key + 1 })); }
      else if (r.shieldUsed) { playShield(); setBanner('🛡️ SHIELD ABSORBED THE HIT!'); setTimeout(() => setBanner(''), 2600); }
      else playWrong();
      if (r.shieldGained) { setBanner('🛡️ STREAK SHIELD EARNED!'); setTimeout(() => setBanner(''), 2200); }
      if (cfg.mode === 'class' && current) {
        setPlayers((ps) => ps.map((p) => p.id !== current.id ? p : {
          ...p, answered: p.answered + 1, score: p.score + r.delta,
          correct: p.correct + (r.correct && !r.wasRedemption ? 1 : 0), streak: r.correct ? p.streak + 1 : 0, maxStreak: Math.max(p.maxStreak, r.correct ? p.streak + 1 : 0),
          redeemed: p.redeemed + (r.wasRedemption ? r.delta : 0), missedIds: !r.correct && !r.wasRedemption ? [...p.missedIds, r.evidence.discoveryId] : p.missedIds,
        }));
      }
      if (r.summary) setSummary(r.summary);
    } catch (e) {
      // Not graded: release both guards so the player can try again.
      submittedQuestionIdsRef.current.delete(key); submissionLockRef.current = false;
      setSub('active'); setPhase((p) => (p === 'ANSWER_LOCKED' ? 'QUESTION_ACTIVE' : p)); setPicked(-1);
      setError(e instanceof Error ? e.message : 'Network error. Tap an option to try again.');
    } finally { setBusy(false); }
  }, [question, token, redeem, wager, cfg.mode, current, timer]);
  useEffect(() => { submitRef.current = submit; }, [submit]);

  /* ── continue after reveal ───────────────────────────────────────────────────────────────────────────────────────── */
  const next = useCallback(() => {
    if (sub !== 'reveal' || !reveal) return;
    setTurn((t) => t + 1);
    if (reveal.phase === 'done') {
      go('FINISH'); setPhase('COMPLETED'); setRedeem(false); store.del(SS_KEY);
      return;
    }
    if (reveal.redemptionStarting) {
      go('START_REDEMPTION'); setPhase('REDEMPTION_ROUND'); setRedeem(true);
      redemptionDeadlineRef.current = Date.now() + REDEMPTION_MS;
      beginQuestion(reveal.next!, REDEMPTION_MS, true);
      return;
    }
    if (reveal.next) {
      if (!redeem) go('NEXT_QUESTION');
      beginQuestion(reveal.next, redeem ? Math.max(1000, redemptionDeadlineRef.current - Date.now()) : QUESTION_MS, redeem);
    }
  }, [sub, reveal, go, redeem, beginQuestion]);

  /* ── start / restore ─────────────────────────────────────────────────────────────────────────────────────────────── */
  const start = useCallback(async (over?: Partial<{ mode: Mode; source: Source; count: number }>) => {
    if (startedRef.current) return;
    startedRef.current = true; setBusy(true); setError('');
    try {
      const c = { ...cfg, ...over }; setCfg(c);
      const unlocked = c.source === 'mine' ? readUnlockedIds() : undefined;
      const s = seed ?? (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
      const r = await post<{ token: string; total: number; question: PublicRemixQuestion; seed: number; leagueEligible: boolean }>('/api/quiz/grade', { action: 'start', source: c.source, count: c.count, unlocked, seed: s });
      submittedQuestionIdsRef.current = new Set(); setSeed(r.seed);
      setToken(r.token); setTotal(r.total); setLeagueOk(r.leagueEligible); setProg({ score: 0, streak: 0, maxStreak: 0, shields: 0 }); setSummary(null); setRewards(null); setTurn(0); setRedeem(false);
      go('START'); setPhase('QUESTION_ACTIVE');
      store.set(SS_KEY, JSON.stringify({ token: r.token, cfg: c, players, room, seed: r.seed, savedAt: Date.now(), total: r.total, leagueOk: r.leagueEligible }));
      beginQuestion(r.question, QUESTION_MS, false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start'); startedRef.current = false; }
    finally { setBusy(false); }
  }, [cfg, seed, players, room, go, beginQuestion]);

  // Bug 4: restore an interrupted game (< 30 min old) after F5 / pull-to-refresh. Also reads ?seed= for late joiners.
  useEffect(() => {
    if (!mounted) return;
    const q = new URLSearchParams(window.location.search);
    const urlSeed = Number(q.get('seed')); const urlRoom = (q.get('room') ?? '').toUpperCase();
    if (Number.isInteger(urlSeed) && urlSeed > 0) setSeed(urlSeed);
    if (/^[2-9A-HJKMNP-Z]{6}$/.test(urlRoom)) setRoom(urlRoom);
    if (q.get('source') === 'mine') setCfg((c) => ({ ...c, source: 'mine' }));
    setUnlockedCount(readUnlockedIds().length);
    const saved = (() => { try { return JSON.parse(store.get(SS_KEY) ?? 'null') as { token: string; cfg: typeof cfg; players: Player[]; room: string; seed: number; savedAt: number; total: number; leagueOk: boolean } | null; } catch { return null; } })();
    if (!saved || Date.now() - saved.savedAt > MAX_AGE) {
      store.del(SS_KEY); setRestoring(false);
      if (q.get('autostart') === '1') { const src: Source = q.get('source') === 'mine' ? 'mine' : 'auto'; if (src === 'auto' || readUnlockedIds().length >= 3) void start({ mode: 'solo', source: src }); }
      return;
    }
    startedRef.current = true;
    post<{ token: string; total: number; phase: string; question: PublicRemixQuestion; score: number; streak: number; maxStreak: number; shields: number; qAt: number; rAt: number; serverNow: number }>('/api/quiz/grade', { action: 'resume', token: saved.token })
      .then((r) => {
        setCfg(saved.cfg); setPlayers(saved.players ?? []); setRoom(saved.room ?? ''); setSeed(saved.seed); setToken(r.token); setTotal(r.total); setLeagueOk(!!saved.leagueOk);
        setProg({ score: r.score, streak: r.streak, maxStreak: r.maxStreak, shields: r.shields });
        const isRedeem = r.phase === 'redemption'; setRedeem(isRedeem);
        const limit = isRedeem ? r.rAt + REDEMPTION_MS : r.qAt + QUESTION_MS;
        redemptionDeadlineRef.current = Date.now() + (r.rAt + REDEMPTION_MS - r.serverNow);
        setPhase(isRedeem ? 'REDEMPTION_ROUND' : 'QUESTION_ACTIVE');
        beginQuestion(r.question, Math.max(0, limit - r.serverNow), isRedeem);
      })
      .catch(() => { store.del(SS_KEY); startedRef.current = false; })
      .finally(() => setRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after mount
  }, [mounted]);

  /* ── persist roster changes (turn/score) for refresh recovery ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mounted || !token || phase === 'COMPLETED' || phase === 'IDLE') return;
    const cur = JSON.parse(store.get(SS_KEY) ?? '{}') as object;
    store.set(SS_KEY, JSON.stringify({ ...cur, players, cfg, room, seed, total, leagueOk, token, savedAt: Date.now() }));
  }, [mounted, token, players, cfg, room, seed, total, leagueOk, phase, sub]);

  /* ── completion rewards (XP, badge) once ─────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'COMPLETED' || !summary || rewards) return;
    const mainCorrect = Math.max(0, summary.total - summary.missedIds.length);
    const badge = cfg.source === 'mine' && masteryEarned(mainCorrect, summary.total);
    addXp(summary.xp); if (badge) awardBadge(VERIFIED_SCIENTIST);
    setRewards({ xp: summary.xp, badge });
  }, [phase, summary, rewards, cfg.source]);

  /* ── host controls ───────────────────────────────────────────────────────────────────────────────────────────────── */
  const togglePause = useCallback(() => { if (cfg.mode !== 'class' || sub !== 'active') return; if (timer.paused) timer.resume(); else timer.pause(); }, [cfg.mode, sub, timer]);
  const openLobby = () => { setCfg((c) => ({ ...c, mode: 'class' })); setRoom((r) => r || randomRoomCode()); setSeed((s) => s ?? (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1)); go('OPEN_LOBBY'); };
  const addPlayer = (raw?: string) => {
    if (locked || players.length >= 60) return;
    let name = generateSafeNickname();
    if (raw && raw.trim()) {
      const v = checkUserText(raw);
      if (!v.ok) { setError(v.message); return; }
      name = v.value.slice(0, 24);
    }
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) name = generateSafeNickname();
    setError(''); setNewName('');
    setPlayers((ps) => [...ps, { id: `${Date.now()}${ps.length}`, name, score: 0, correct: 0, answered: 0, streak: 0, maxStreak: 0, redeemed: 0, missedIds: [] }]);
  };
  const reroll = (id: string) => setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, name: generateSafeNickname() } : p)));
  const exportCsv = () => {
    const ts = new Date().toISOString(); const sid = summary?.sid ?? room ?? 'session';
    const rows: GradeRow[] = cfg.mode === 'class'
      ? players.map((p) => ({ sessionId: sid, timestamp: ts, nickname: p.name, total: p.answered, correct: p.correct, finalScore: p.score, maxStreak: p.maxStreak, redemptionRecovered: p.redeemed, missedIds: p.missedIds }))
      : summary ? [{ sessionId: sid, timestamp: ts, nickname: 'Solo explorer', total: summary.total, correct: summary.total - summary.missedIds.length, finalScore: summary.score, maxStreak: summary.maxStreak, redemptionRecovered: summary.redeemed, missedIds: summary.missedIds }] : [];
    const blob = new Blob([gradebookCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `remix-gradebook-${sid}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // Keyboard: A–D/1–4 answer; Enter continues; Space/H/L/N host shortcuts (class mode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (sub === 'active' && question && ['1', '2', '3', '4', 'a', 'b', 'c', 'd'].includes(k)) {
        const i = '1234'.includes(k) ? Number(k) - 1 : 'abcd'.indexOf(k); void submit(i); return;
      }
      if (k === 'enter' && sub === 'reveal') { next(); return; }
      if (cfg.mode !== 'class' || phase === 'IDLE' || phase === 'COMPLETED') return;
      if (k === ' ') { e.preventDefault(); togglePause(); }
      else if (k === 'h') setHideNames((h) => !h);
      else if (k === 'l') setLocked((l) => !l);
      else if (k === 'n') { if (sub === 'reveal') next(); else if (sub === 'active' && question) void submit(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sub, question, cfg.mode, phase, submit, next, togglePause]);

  const reset = () => { store.del(SS_KEY); startedRef.current = false; submittedQuestionIdsRef.current = new Set(); submissionLockRef.current = false; timer.stop(); setPhase('IDLE'); setToken(''); setSummary(null); setQuestion(null); setReveal(null); setRedeem(false); setSeed(null); setPlayers([]); setSubmitState({ consent: false, nick: '' }); };

  const submitRank = async () => {
    setSubmitState((s) => ({ ...s, err: undefined }));
    try {
      const r = await post<{ league: string; composite: number; nickname: string }>('/api/quiz/rank?action=submit', { token, consentToPublicName: submitState.consent, nickname: submitState.nick, playerKey: playerKey() });
      setSubmitState((s) => ({ ...s, done: `Submitted to the ${r.league === 'official' ? 'Official Ranked League' : 'Community Custom Arena'} as ${r.nickname} (composite ${r.composite}).` }));
    } catch (e) { setSubmitState((s) => ({ ...s, err: e instanceof Error ? e.message : 'Submission failed' })); }
  };

  /* ── render ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
  if (!mounted || restoring) {
    return <section className="rx-root" aria-busy="true" aria-label="Loading quiz"><div className="rx-skeleton rx-sk-h" /><div className="rx-skeleton rx-sk-card" /><div className="rx-skeleton rx-sk-card" /></section>;
  }
  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/quiz/remix?seed=${seed ?? ''}&room=${room}&source=${cfg.source}`;
  const classMode = cfg.mode === 'class';
  const traps = summary ? findTraps(summary.telemetry) : [];

  return (
    <section className={`rx-root rx-tier-${tier}${hb ? ' rx-hb' : ''}`} aria-label="Sandbox Remix quiz">
      <div className="rx-orb rx-orb-a" aria-hidden="true" /><div className="rx-orb rx-orb-b" aria-hidden="true" />
      {burst.n > 0 && <Particles key={burst.key} n={burst.n} />}
      {banner && <div className="rx-toast" role="status">{banner}</div>}

      <header className="rx-top">
        <h1>⚡ Sandbox Remix Quiz</h1>
        <div className="rx-top-right">
          {phase !== 'IDLE' && phase !== 'LOBBY' && phase !== 'COMPLETED' && (
            <>
              <span className="rx-chip" title="Streak">{tier >= 2 ? '🔥 ' : ''}{prog.streak}x</span>
              <span className="rx-chip rx-shields" title={`Streak Shields (max ${MAX_SHIELDS})`}>{Array.from({ length: MAX_SHIELDS }, (_, i) => <span key={i} className={i < prog.shields ? 'on' : ''}>🛡️</span>)}</span>
            </>
          )}
          <MuteButton />
        </div>
      </header>

      {tier >= 3 && phase !== 'COMPLETED' && <div className="rx-unstoppable" role="status">⚡ UNSTOPPABLE EVOLUTION!</div>}

      {/* IDLE: choose a quiz */}
      {phase === 'IDLE' && (
        <div className="rx-card rx-setup">
          <h2>Choose your quiz</h2>
          <div className="rx-choices" role="radiogroup" aria-label="Quiz source">
            <button type="button" role="radio" aria-checked={cfg.source === 'auto'} className={`rx-choice${cfg.source === 'auto' ? ' on' : ''}`} onClick={() => setCfg({ ...cfg, source: 'auto' })}>
              <strong>⚡ Auto-Generate from 1,917 Sandbox Discoveries</strong><span>10 questions from three templates: synthesis formula, empirical evidence, evolutionary milestone. Same-tier distractors.</span>
            </button>
            <button type="button" role="radio" aria-checked={cfg.source === 'mine'} className={`rx-choice${cfg.source === 'mine' ? ' on' : ''}`} onClick={() => setCfg({ ...cfg, source: 'mine' })}>
              <strong>🌟 My Unlocked Discoveries Boss Quiz</strong><span>{unlockedCount >= 3 ? `Built from the ${unlockedCount} discoveries you unlocked in the Sandbox. Score 80% or more for the ${VERIFIED_SCIENTIST} badge.` : 'Unlock at least 3 discoveries in the Sandbox first.'}</span>
            </button>
          </div>
          <div className="rx-row">
            <label>Questions{' '}
              <select value={cfg.count} onChange={(e) => setCfg({ ...cfg, count: Number(e.target.value) })}>
                <option value={10}>10 (Official Ranked League)</option><option value={5}>5 (Community Arena only)</option>
              </select>
            </label>
          </div>
          <div className="rx-row">
            <button type="button" className="rx-btn big" disabled={busy || (cfg.source === 'mine' && unlockedCount < 3)} onClick={() => void start({ mode: 'solo' })}>▶ Play solo</button>
            <button type="button" className="rx-btn alt" onClick={openLobby}>🍎 Classroom projector (teacher host)</button>
          </div>
          {seed ? <p className="rx-note">You opened a shared quiz{room ? ` (room ${room})` : ''}: you will get the same questions as the class.</p> : null}
          {error && <p className="rx-err" role="alert">{error}</p>}
        </div>
      )}

      {/* LOBBY (class mode) */}
      {phase === 'LOBBY' && (
        <div className="rx-card">
          <h2>Lobby: add the explorers</h2>
          <p className="rx-note">Explorers take turns answering on this shared screen. Names are generated science handles; custom names pass the PII/profanity filter. Click a name to reroll it.</p>
          <div className="rx-row">
            <input className="rx-input" value={newName} maxLength={24} placeholder="Optional nickname" aria-label="Nickname" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(newName); }} disabled={locked} />
            <button type="button" className="rx-btn" disabled={locked} onClick={() => addPlayer(newName)}>＋ Add</button>
            <button type="button" className="rx-btn alt" disabled={locked} onClick={() => addPlayer()}>🎲 Add generated</button>
          </div>
          {error && <p className="rx-err" role="alert">{error}</p>}
          <ul className="rx-roster">{players.map((p, i) => <li key={p.id}><button type="button" onClick={() => reroll(p.id)} title="Reroll this name">{display(p, i)} 🎲</button></li>)}</ul>
          <div className="rx-row">
            <button type="button" className="rx-btn big" disabled={busy || players.length === 0} onClick={() => void start()}>▶ Start ({players.length} explorers)</button>
            <button type="button" className="rx-btn ghost" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {/* PLAY */}
      {(phase === 'QUESTION_ACTIVE' || phase === 'ANSWER_LOCKED' || phase === 'REVEAL' || phase === 'REDEMPTION_ROUND') && question && (
        <div className={`rx-card rx-question rx-aura-${tier}`}>
          <div className="rx-qhead">
            <span className="rx-chip">{redeem ? '🔁 Redemption Round · 50% recovery' : `Question ${question.index + 1} / ${total}`}</span>
            <span className={`rx-timer${hb ? ' beat' : ''}`} aria-live="off">{timer.paused ? '⏸' : `${Math.ceil(timer.remainingMs / 1000)}s`}</span>
          </div>
          <div className="rx-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (timer.remainingMs / (redeem ? REDEMPTION_MS : QUESTION_MS)) * 100)}%` }} /></div>
          {sub === 'active' && !redeem && timer.remainingMs > QUESTION_MS - GRACE_MS && <p className="rx-grace">📖 Reading time: answers in the first 3 seconds earn the full speed bonus.</p>}
          {classMode && current && <p className="rx-turn">Your turn: <strong>{display(current, turn % players.length)}</strong></p>}
          <h2 className="rx-prompt">{question.prompt}</h2>

          {sub === 'active' && !redeem && (
            <div className="rx-wager" role="radiogroup" aria-label="Confidence wager">
              <button type="button" role="radio" aria-checked={wager === 'standard'} className={wager === 'standard' ? 'on' : ''} onClick={() => setWager('standard')}>Standard (1x)<small>Right = full points · Wrong = 0 (a shield can absorb it)</small></button>
              <button type="button" role="radio" aria-checked={wager === 'high'} className={wager === 'high' ? 'on hot' : 'hot'} onClick={() => setWager('high')}>High Confidence (1.5x)<small>Evidence All-In: right = +150% · wrong = −400 pts and breaks a shield</small></button>
            </div>
          )}

          <div className="rx-options">
            {question.options.map((o, i) => {
              const state = reveal ? (i === reveal.correctIndex ? 'right' : i === picked ? 'wrong' : 'dim') : picked === i ? 'sel' : '';
              return (
                <button key={i} type="button" className={`rx-opt rx-opt-${i} ${state}`} disabled={sub !== 'active' || timer.paused} onClick={() => void submit(i)} aria-label={`Option ${LETTERS[i]}: ${o}`}>
                  <span className="rx-shape" aria-hidden="true">{SHAPES[i]}</span><span className="rx-opt-text">{o}</span>
                </button>
              );
            })}
          </div>
          {timer.paused && <p className="rx-paused" role="status">⏸ Timer paused by the host</p>}
          {error && <p className="rx-err" role="alert">{error}</p>}

          {sub === 'reveal' && reveal && (
            <div className="rx-reveal">
              <p className={`rx-verdict ${reveal.correct ? 'ok' : 'no'}`}>
                {reveal.correct ? `Correct! +${reveal.delta}` : picked < 0 ? `Time's up` : reveal.shieldUsed ? '🛡️ Shield absorbed the hit: streak kept' : `Not quite${reveal.delta < 0 ? `: ${reveal.delta}` : ''}`}
                {reveal.streakReset && ' · streak reset'}
              </p>
              {!reveal.correct && picked >= 0 && <p className="rx-why">{reveal.why[picked]}</p>}
              <article className="rx-evidence" aria-label="Evidence micro-card">
                <h3>🔬 {reveal.evidence.name} <small>{reveal.evidence.era}</small></h3>
                <p><strong>Evidence:</strong> {reveal.evidence.evidence}</p>
                {reveal.evidence.detail && <p className="rx-detail">{reveal.evidence.detail}</p>}
                <a className="rx-deeplink" href={reveal.evidence.deepLink} target="_blank" rel="noopener noreferrer">[🔬 Inspect Discovery #{reveal.evidence.discoveryId} in Sandbox]</a>
              </article>
              <button type="button" className="rx-btn big" onClick={next} autoFocus>{reveal.phase === 'done' ? 'See results ↵' : reveal.redemptionStarting ? '🔁 Start 60-second Redemption Round ↵' : 'Next ↵'}</button>
            </div>
          )}
          <div className="rx-score">Score <Odometer value={prog.score} /></div>
        </div>
      )}

      {/* COMPLETED */}
      {phase === 'COMPLETED' && summary && (
        <div className="rx-card rx-summary">
          <h2>🏁 Post-game summary</h2>
          <ul className="rx-stats">
            <li><b>{summary.score}</b><span>final score</span></li>
            <li><b>{summary.total - summary.missedIds.length}/{summary.total}</b><span>correct</span></li>
            <li><b>{summary.maxStreak}x</b><span>max streak</span></li>
            <li><b>+{summary.redeemed}</b><span>redemption</span></li>
            <li><b>{summary.xp}</b><span>XP earned</span></li>
          </ul>
          {rewards?.badge && <p className="rx-badge" role="status">{VERIFIED_SCIENTIST} badge earned!</p>}
          {cfg.source === 'mine' && !rewards?.badge && <p className="rx-note">Score 80% or more on your Boss Quiz to earn {VERIFIED_SCIENTIST}.</p>}
          <p className="rx-note">XP can be spent on <Link href="/sandbox">Catalyst Hints in the Sandbox</Link> (available: {readShared().xp - readShared().spent}).</p>

          <h3>Misconception Telemetry Matrix</h3>
          {traps.length > 0 ? traps.map((t) => <p key={t.questionId + t.optionIndex} className="rx-trap" role="alert">{t.banner}</p>) : <p className="rx-note">No cognitive trap found: no wrong option attracted 35% or more of players (needs at least 3 responses per question).</p>}
          <ul className="rx-matrix">
            {summary.telemetry.map((q) => {
              const sum = q.counts.reduce((a, b) => a + b, 0) || 1;
              return (
                <li key={q.questionId}>
                  <div className="rx-mq">{q.prompt}</div>
                  {q.options.map((o, i) => <div key={i} className={`rx-mrow${i === q.correctIndex ? ' ok' : ''}`}><span>{LETTERS[i]}</span><i style={{ width: `${Math.round((q.counts[i]! / sum) * 100)}%` }} /><em>{Math.round((q.counts[i]! / sum) * 100)}% · {o}</em></div>)}
                </li>
              );
            })}
          </ul>

          {classMode ? (
            <ol className="rx-board">{[...players].sort((a, b) => b.score - a.score).map((p) => <li key={p.id}><span>{p.name}</span><b>{p.score}</b></li>)}</ol>
          ) : (
            <div className="rx-submit">
              <h3>{leagueOk ? '👑 Official Ranked League' : '🛠️ Community Custom Arena'}</h3>
              <p className="rx-note">{leagueOk ? 'Ten or more questions: this run counts for the Official Ranked League.' : 'Fewer than 10 questions: this run is recorded in the Community Custom Arena only.'} Your score is verified on the server.</p>
              <label className="rx-check"><input type="checkbox" checked={submitState.consent} onChange={(e) => setSubmitState({ ...submitState, consent: e.target.checked })} /> I consent to showing a custom nickname publicly (otherwise a generated handle is used).</label>
              {submitState.consent && <input className="rx-input" maxLength={24} placeholder="Public nickname (no real names, emails or phone numbers)" value={submitState.nick} onChange={(e) => setSubmitState({ ...submitState, nick: e.target.value })} />}
              {!submitState.done ? <button type="button" className="rx-btn" onClick={() => void submitRank()}>Submit to rank board</button> : <p className="rx-ok" role="status">{submitState.done} <Link href="/quiz/rank">View the rank board</Link></p>}
              {submitState.err && <p className="rx-err" role="alert">{submitState.err}</p>}
            </div>
          )}
          <div className="rx-row">
            <button type="button" className="rx-btn" onClick={exportCsv}>📥 Export CSV</button>
            <button type="button" className="rx-btn big" onClick={reset}>Play again</button>
            <Link className="rx-btn alt" href="/quiz/rank">Rank board</Link>
          </div>
        </div>
      )}

      {phase !== 'COMPLETED' && classMode && players.length > 0 && phase !== 'LOBBY' && (
        <aside className="rx-class-board" aria-label="Class leaderboard">
          <h3>Leaderboard {hideNames && <small>(names hidden)</small>}</h3>
          <ol>{players.map((p, i) => [p, i] as const).sort((a, b) => b[0].score - a[0].score).map(([p, i]) => <li key={p.id} className={current?.id === p.id ? 'turn' : ''}><button type="button" title="Reroll this explorer's name" onClick={() => reroll(p.id)}>{display(p, i)}</button><b>{p.score}</b></li>)}</ol>
        </aside>
      )}

      <LegalPanel />
      <p className="rx-foot"><Link href="/quiz/rank">Rank board</Link> · <Link href="/sandbox">Back to Sandbox</Link></p>

      {classMode && phase !== 'IDLE' && (
        <div className="rx-hud" role="toolbar" aria-label="Teacher host controls">
          <div className="rx-room">ROOM: {room || '------'}</div>
          <button type="button" className="rx-btn" onClick={() => setQr(true)}>▦ QR code</button>
          <button type="button" className="rx-btn" onClick={togglePause} disabled={sub !== 'active'}>{timer.paused ? '▶ Resume' : '⏸️ Pause'} (Space)</button>
          <button type="button" className="rx-btn" aria-pressed={hideNames} onClick={() => setHideNames((h) => !h)}>👁️ {hideNames ? 'Reveal' : 'Hide'} Names (H)</button>
          <button type="button" className="rx-btn" aria-pressed={locked} onClick={() => setLocked((l) => !l)}>🔒 {locked ? 'Unlock' : 'Lock'} Room (L)</button>
          <button type="button" className="rx-btn" onClick={() => { const t = players[turn % Math.max(1, players.length)]; if (t) reroll(t.id); }} disabled={!players.length}>🎲 Reroll Player Name</button>
          <button type="button" className="rx-btn" onClick={() => (sub === 'reveal' ? next() : sub === 'active' && question ? void submit(-1) : undefined)} disabled={phase === 'LOBBY' || phase === 'COMPLETED'}>⏭️ Force Next (N)</button>
          <button type="button" className="rx-btn" onClick={exportCsv} disabled={!players.length}>📥 Export CSV</button>
        </div>
      )}
      {qr && <QrModal url={shareUrl} code={room || '------'} onClose={() => setQr(false)} />}
    </section>
  );
}
