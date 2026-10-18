'use client';
import { useMemo, useState } from 'react';
import type { GameModeId } from '@/lib/quiz/compatibility';
import { applyResult, initGame, isActionMode, type EngineConfig, type GameState } from '@/lib/quiz/games/engine';
import { defaultGameOptions } from '@/lib/quiz/settings';
import GameStage from './GameStage';

const SAMPLES = 8;

/** A hands-on sample: three buttons drive the real engine so a creator sees what a right and a wrong answer does in this mode. Nothing is saved. */
export default function ModeDemo({ mode }: { mode: GameModeId }) {
  const cfg = useMemo<EngineConfig | null>(() => (isActionMode(mode) ? { mode, options: defaultGameOptions(), seed: 'demo', totalQuestions: SAMPLES } : null), [mode]);
  const [state, setState] = useState<GameState | null>(() => (cfg ? initGame(cfg) : null));
  const [points, setPoints] = useState(0);
  const [n, setN] = useState(0);
  if (!cfg || !state) {
    return (
      <div className="qg-demo stack">
        <p className="note">Sample: the question appears, players answer, and the correct answer adds points.</p>
        <div className="row"><button className="btn small" onClick={() => { setPoints((p) => p + 100); setN((x) => x + 1); }}>Answer correctly</button><button className="btn small ghost" onClick={() => setN((x) => x + 1)}>Answer wrongly</button><button className="btn small ghost" onClick={() => { setPoints(0); setN(0); }}>Reset</button></div>
        <p role="status" aria-live="polite" className="note"><strong>{points} points</strong> after {n} sample question{n === 1 ? '' : 's'}.</p>
      </div>
    );
  }
  const step = (correct: boolean) => { setState((s) => (s ? applyResult(s, { correct }, cfg) : s)); if (correct) setPoints((p) => p + 100); setN((x) => x + 1); };
  const over = state.outcome !== 'playing';
  return (
    <div className="qg-demo stack">
      <GameStage state={state} totalQuestions={SAMPLES} />
      <div className="row">
        <button className="btn small" disabled={over} onClick={() => step(true)}>Answer correctly</button>
        <button className="btn small ghost" disabled={over} onClick={() => step(false)}>Answer wrongly</button>
        <button className="btn small ghost" onClick={() => { setState(initGame(cfg)); setPoints(0); setN(0); }}>Reset</button>
      </div>
      <p className="note" role="status" aria-live="polite">Sample with {SAMPLES} placeholder questions — {points} points, {n} answered. Nothing here is saved.</p>
    </div>
  );
}
