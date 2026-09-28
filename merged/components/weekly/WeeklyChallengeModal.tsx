'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { buildGraph } from '@/lib/minpath/graph';
import { isComplete as isTraceComplete, legalNeighbors, MODIFIER_LABEL } from '@/lib/minpath/modifiers';
import { clicksOf, startSession, type MinPathSession } from '@/lib/minpath/session';
import { satisfiesClues } from '@/lib/techsudoku/generate';
import { generateWeeklyChallenge } from '@/lib/weekly/generate';
import { completeGauntlet, completeSudoku, completeTrace, startProgress } from '@/lib/weekly/simulate';
import { weeklyStore } from '@/lib/weekly/store';
import { weeklyKey } from '@/lib/seed';
import type { Engine } from '@/lib/engine';
import type { GauntletStage, SudokuStage, TraceStage, WeeklyProgress } from '@/lib/weekly/types';

/* ============================================================================
   WEEKLY MEGA CHALLENGE MODAL — three real stages in a fixed order (trace,
   sudoku, gauntlet), gated by lib/weekly/simulate.ts's own order-guarded
   reducers so a stage can never be skipped or redone out of turn. Same
   secondary-link treatment as Tech Sudoku (components/ModeHub.tsx), and the
   same "local state mirrors the store, sync on every action" pattern every
   full mode screen uses (see components/archaeology/ArchaeologyMode.tsx) —
   this modal is the sole writer to lib/weekly/store.ts while it's open.
   ========================================================================== */

function StageHeader({ label, index }: { label: string; index: number }) {
  return (
    <div className="wk-stage-head">
      <p className="mono wk-stage-count">Stage {index} of 3</p>
      <p className="wk-stage-label">{label}</p>
    </div>
  );
}

function TraceStageView({ stage, engine, onDone }: { stage: TraceStage; engine: Engine; onDone: (clicks: number) => void }) {
  const graph = useMemo(() => buildGraph(engine.db), [engine.db]);
  const [session, setSession] = useState<MinPathSession>(() => startSession(stage.startId, stage.targetId));
  const curNode = engine.get(session.path[session.path.length - 1]);
  const startNode = engine.get(stage.startId);
  const targetNode = engine.get(stage.targetId);
  const neighbors = legalNeighbors(engine.db, graph, session, stage.modifier);

  const click = (id: string) => {
    if (!neighbors.includes(id)) return;
    const path = [...session.path, id];
    const next: MinPathSession = { ...session, path, done: isTraceComplete(engine.db, { ...session, path }, stage.modifier) };
    setSession(next);
    if (next.done) onDone(clicksOf(next));
  };

  return (
    <>
      <StageHeader label="Trace a route" index={1} />
      <p className="wk-modifier-tag mono">{MODIFIER_LABEL[stage.modifier.kind]}</p>
      <div className="wk-endpoints">
        <div><span className="mono">Start</span><b>{startNode?.n}</b></div>
        <div><span className="mono">Target</span><b>{targetNode?.n}</b></div>
        <div>
          <span className="mono">Clicks</span>
          <b>{stage.modifier.kind === 'exactly-n-clicks' ? `${clicksOf(session)} / ${stage.modifier.n}` : clicksOf(session)}</b>
        </div>
      </div>
      <article className="wk-page">
        <p className="mono wk-page-kicker">{curNode?.era}</p>
        <h3 className="wk-page-title">{curNode?.n}</h3>
      </article>
      <div className="wk-links">
        {neighbors.map(id => {
          const n = engine.get(id);
          if (!n) return null;
          return <button key={id} className="wk-link" onClick={() => click(id)}>{n.n}</button>;
        })}
      </div>
    </>
  );
}

function SudokuStageView({ stage, engine, onDone }: { stage: SudokuStage; engine: Engine; onDone: (checks: number) => void }) {
  const [order, setOrder] = useState<string[]>(stage.puzzle.scrambled);
  const [checks, setChecks] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<number | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setLastCorrect(null);
  };
  const check = () => {
    const n = checks + 1;
    setChecks(n);
    if (satisfiesClues(order, stage.puzzle.clues)) { onDone(n); return; }
    setLastCorrect(order.filter((id, i) => id === stage.puzzle.solution[i].id).length);
  };

  return (
    <>
      <StageHeader label="Reconstruct the order" index={2} />
      <ol className="wk-clues mono">
        {stage.puzzle.clues.map((c, i) => {
          const before = engine.get(c.beforeId)?.n ?? c.beforeId;
          const after = engine.get(c.afterId)?.n ?? c.afterId;
          return <li key={i}>{before} predates {after}</li>;
        })}
      </ol>
      <ol className="wk-order">
        {order.map((id, i) => {
          const n = engine.get(id);
          return (
            <li key={id} className="wk-order-row">
              <span className="mono wk-order-pos">{i + 1}</span>
              <span className="wk-order-name">{n?.n ?? id}</span>
              <span className="wk-order-move">
                <button type="button" aria-label={`Move ${n?.n} up`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" aria-label={`Move ${n?.n} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      {lastCorrect !== null && <p className="wk-result">{lastCorrect} of {order.length} in the right place.</p>}
      <button className="chip" onClick={check}>Check</button>
    </>
  );
}

function GauntletStageView({ stage, engine, onDone }: { stage: GauntletStage; engine: Engine; onDone: (correct: number, now: number) => void }) {
  const [index, setIndex] = useState(0);
  const [correctSoFar, setCorrectSoFar] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const clue = stage.clues[index];

  const choose = (id: string) => { if (answer === null) setAnswer(id); };
  const next = (now: number) => {
    const gotItRight = answer === clue.targetId ? 1 : 0;
    const total = correctSoFar + gotItRight;
    if (index + 1 >= stage.clues.length) { onDone(total, now); return; }
    setCorrectSoFar(total);
    setIndex(index + 1);
    setAnswer(null);
  };

  return (
    <>
      <StageHeader label="Name the discovery" index={3} />
      <p className="mono wk-gauntlet-count">Riddle {index + 1} of {stage.clues.length}</p>
      <p className="wk-riddle">“{clue.riddle}”</p>
      <div className="wk-choices">
        {clue.optionIds.map(id => {
          const n = engine.get(id);
          const isAnswer = id === clue.targetId;
          const chosen = answer === id;
          const revealed = answer !== null;
          const cls = 'chip wk-choice' + (revealed && isAnswer ? ' wk-correct' : revealed && chosen ? ' wk-wrong' : '');
          return <button key={id} className={cls} disabled={revealed} onClick={() => choose(id)}>{n?.n ?? id}</button>;
        })}
      </div>
      {answer !== null && (
        <button className="chip" onClick={() => next(Date.now())}>
          {index + 1 >= stage.clues.length ? 'Finish' : 'Next riddle'}
        </button>
      )}
    </>
  );
}

export function WeeklyChallengeModal({ open, engine, onClose }: { open: boolean; engine: Engine; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const week = weeklyKey();
  const challenge = useMemo(() => generateWeeklyChallenge(engine.db), [engine.db]);

  const [progress, setProgress] = useState<WeeklyProgress>(() => {
    weeklyStore.load();
    const cur = weeklyStore.get().current;
    return cur && cur.week === week ? cur : startProgress(week);
  });

  if (!open || !challenge) return null;
  const [traceStage, sudokuStage, gauntletStage] = challenge.stages;

  const advance = (next: WeeklyProgress) => {
    setProgress(next);
    weeklyStore.setProgress(next);
    weeklyStore.archiveIfComplete(challenge.scenario.id);
  };

  let body: ReactNode;
  if (progress.completedStages === 0) {
    body = <TraceStageView stage={traceStage} engine={engine} onDone={clicks => advance(completeTrace(progress, clicks))} />;
  } else if (progress.completedStages === 1) {
    body = <SudokuStageView stage={sudokuStage} engine={engine} onDone={checks => advance(completeSudoku(progress, checks))} />;
  } else if (progress.completedStages === 2) {
    body = <GauntletStageView stage={gauntletStage} engine={engine} onDone={(correct, now) => advance(completeGauntlet(progress, correct, now))} />;
  } else {
    body = (
      <>
        <StageHeader label="This week's challenge is complete" index={3} />
        <dl className="wk-summary">
          <div><dt className="mono">Trace</dt><dd>{progress.stageResults.trace?.clicks ?? '—'} clicks</dd></div>
          <div><dt className="mono">Reconstruct</dt><dd>{progress.stageResults.sudoku?.checks ?? '—'} checks</dd></div>
          <div><dt className="mono">Name the discovery</dt><dd>{progress.stageResults.gauntlet?.correct ?? '—'} / 3 correct</dd></div>
        </dl>
      </>
    );
  }

  return (
    <div id="weekly-modal" className="confirm" role="dialog" aria-modal="true" aria-labelledby="wk-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="confirm-box wk-box">
        <p className="mono confirm-k" id="wk-t">{challenge.scenario.title}</p>
        <p className="confirm-d">{challenge.scenario.blurb}</p>
        {body}
        <div className="confirm-row">
          <button className="chip" ref={closeRef} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
