'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { prepare } from '@/lib/quiz/editor-model';
import { gradeQuestion } from '@/lib/quiz/grading';
import { publicPayload } from '@/lib/quiz/public';
import { applyResult, initGame, isActionMode, type GameState } from '@/lib/quiz/games/engine';
import { GAME_MODES } from '@/lib/quiz/game-modes';
import type { Question } from '@/lib/quiz/types';
import { questionSchema } from '@/lib/quiz/validation';
import AnswerView from '@/components/quiz/AnswerView';
import GameStage from '@/components/quiz/games/GameStage';
import QuestionPlay from '@/components/quiz/QuestionPlay';
import ThemeScope from '@/components/quiz/ThemeScope';
import CreatorChrome from '../CreatorChrome';
import { useCreator } from '../CreatorProvider';

type View = 'phone' | 'teacher' | 'projector';

/** Plays the quiz with the real player component and the real grader. Nothing here is saved or scored for anyone. */
export default function PreviewStep() {
  const c = useCreator();
  const s = c.settings;
  const [view, setView] = useState<View>('phone');
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState<null | { ok: boolean; pts: number; q: Question }>(null);
  const [run, setRun] = useState(0);
  const [others, setOthers] = useState(0); // simulated players who already answered correctly (limited_slots)
  const valid = useMemo(() => c.questions.map((q) => questionSchema.safeParse(prepare(q))).flatMap((r) => (r.success ? [r.data as Question] : [])), [c.questions]);
  const skipped = c.questions.length - valid.length;
  const cfg = useMemo(() => (isActionMode(s.gameMode) ? { mode: s.gameMode, options: s.gameOptions, seed: 'preview', totalQuestions: valid.length } : null), [s.gameMode, s.gameOptions, valid.length]);
  const [game, setGame] = useState<GameState | null>(null);
  const state = game ?? (cfg ? initGame(cfg) : null);
  const slots = s.rules.modifiers.includes('limited_slots') ? s.rules.slotLimit : null;

  const reset = () => { setI(0); setScore(0); setLast(null); setGame(null); setRun((n) => n + 1); };

  if (!c.ready) return <CreatorChrome step="preview"><p className="muted-text" role="status">Loading your draft…</p></CreatorChrome>;
  if (!c.draftKey) return <CreatorChrome step="preview" canContinue={false} continueHint="Choose a game mode first."><p className="info">Start with <Link href="/quiz/create/mode">choosing a game mode</Link>.</p></CreatorChrome>;
  if (valid.length === 0) return <CreatorChrome step="preview"><div className="panel stack"><h2>Nothing to preview yet</h2><p className="muted-text">Finish at least one question in the Questions step. Then you can play it here exactly as players will.</p></div></CreatorChrome>;

  const q = valid[i];
  const done = i >= valid.length;
  const pq = q ? { id: `pv-${run}-${i}`, kind: q.kind, prompt: q.prompt, payload: publicPayload(q.kind, q.payload, 'preview'), base_points: q.basePoints } : null;

  async function submit(resp: unknown) {
    if (!q) return;
    let ok = false;
    try { ok = gradeQuestion(q, resp as never); } catch { ok = false; }
    const full = slots !== null && others >= slots;
    const pts = ok && !full ? q.basePoints : 0;
    setScore((n) => n + pts);
    setLast({ ok, pts, q });
    if (cfg) setGame((g) => applyResult(g ?? initGame(cfg), { correct: ok }, cfg));
  }

  return (
    <CreatorChrome step="preview">
      <div className="stack">
        <div className="row spread">
          <div className="seg" role="group" aria-label="Preview as">
            {(['phone', 'teacher', 'projector'] as View[]).map((v) => <button key={v} className={`btn small ${view === v ? '' : 'ghost'}`} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'phone' ? 'Player phone' : v === 'teacher' ? 'Teacher screen' : 'Projector'}</button>)}
          </div>
          <button className="btn small ghost" onClick={reset}>Restart preview</button>
        </div>
        {skipped > 0 && <p className="info" role="status">{skipped} unfinished question{skipped === 1 ? ' is' : 's are'} left out of this preview.</p>}
        {slots !== null && (
          <label className="cr-sim">Simulation: players who already answered correctly
            <input type="number" min={0} max={slots + 2} value={others} onChange={(e) => setOthers(Math.max(0, Number(e.target.value) || 0))} />
            <span className="note">Limited Slots allows {slots}. This is only a simulation to show what a late player sees; no real players are involved.</span>
          </label>
        )}
        <ThemeScope theme={s.theme} className={`cr-pv cr-pv-${view}`}>
          <div className="cr-pv-frame">
            <p className="note" style={{ color: 'inherit', opacity: 0.8 }}>{GAME_MODES[s.gameMode].title} · {view === 'teacher' ? 'Teacher screen shows the question and the answer after reveal' : view === 'projector' ? 'Projector hides controls and shows large text' : 'What one player sees'}</p>
            {state && <GameStage state={state} totalQuestions={valid.length} title="Preview" />}
            {done ? (
              <div className="stack" role="status"><h2>Preview finished</h2><p>You scored {score} points in this simulation.</p><button className="btn" onClick={reset}>Play again</button></div>
            ) : pq && (
              <div className="stack">
                <p className="note" style={{ color: 'inherit' }}>Question {i + 1} of {valid.length} · {q!.basePoints} points</p>
                {view === 'teacher' && <details open><summary>Answer key (teacher only)</summary><AnswerView kind={q!.kind} payload={q!.payload} answerKey={q!.answerKey} /></details>}
                {last ? (
                  <div className="stack" role="status">
                    <p className={last.ok ? 'success' : 'error'}>{last.ok ? (last.pts ? `Correct — ${last.pts} points.` : 'Correct, but the slots were already full — no points.') : 'Not correct.'}</p>
                    <AnswerView kind={last.q.kind} payload={last.q.payload} answerKey={last.q.answerKey} />
                    {typeof (last.q.answerKey as any).explanation === 'string' && (last.q.answerKey as any).explanation && <p className="note" style={{ color: 'inherit' }}>Why: {(last.q.answerKey as any).explanation}</p>}
                    <div><button className="btn" onClick={() => { setLast(null); setI((n) => n + 1); }}>{i + 1 >= valid.length ? 'Finish' : 'Next question'}</button></div>
                  </div>
                ) : <QuestionPlay key={pq.id} question={pq} onSubmit={submit} />}
              </div>
            )}
            <p className="note" style={{ color: 'inherit' }}>Score: {score}</p>
          </div>
        </ThemeScope>
      </div>
    </CreatorChrome>
  );
}
