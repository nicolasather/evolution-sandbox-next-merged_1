'use client';

import { useEffect, useState } from 'react';
import { episodeExhibit, summarizeEpisode } from '@/lib/escaperoom/memory';
import { DEFAULT_EPISODE_ID, getEpisode } from '@/lib/escaperoom/registry';
import { applyAction, blankState } from '@/lib/escaperoom/simulate';
import { escapeRoomStore } from '@/lib/escaperoom/store';
import type {
  CodePuzzle, EpisodeState, EscapeRoomEpisode, MatchPuzzle, Puzzle, RatioPuzzle, SequencePuzzle,
} from '@/lib/escaperoom/types';
import { profile } from '@/lib/profile/store';

/* ============================================================================
   HISTORICAL ESCAPE ROOM — "Enter the Past". A fifth genuinely different
   interaction language, and the first mode with NO procedural generation
   at all: one hand-authored episode (lib/escaperoom/episodes/), rendered
   entirely through four generic, reusable puzzle-station components (one
   per PuzzleKind) rather than a bespoke component per puzzle instance —
   the brief's own explicit requirement for this mode's architecture. See
   docs/ROADMAP-UNIVERSE.md's Phase 10 section.
   ========================================================================== */

function RatioStation({ puzzle, solved, hint, onSubmit, onHint }: {
  puzzle: RatioPuzzle; solved: boolean; hint: boolean;
  onSubmit: (value: number) => void; onHint: () => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className={'er-station' + (solved ? ' er-solved' : '')}>
      <p className="mono er-station-title">{puzzle.title}</p>
      <p className="er-station-prompt">{puzzle.prompt}</p>
      {solved ? (
        <p className="er-station-solved-line">Solved — mark revealed: <b>{puzzle.unlockFragment}</b></p>
      ) : (
        <div className="er-station-controls">
          <div className="er-ratio-row">
            <input type="number" value={draft} onChange={e => setDraft(e.target.value)} placeholder="0" />
            <span className="mono">{puzzle.unit}</span>
          </div>
          <div className="er-station-actions">
            <button className="chip" onClick={() => draft !== '' && onSubmit(Number(draft))} disabled={draft === ''}>Submit</button>
            <button className="chip er-hint-btn" onClick={onHint}>{hint ? 'Hint shown' : 'Show a hint'}</button>
          </div>
          {hint && <p className="er-hint-text">{puzzle.hint}</p>}
        </div>
      )}
    </div>
  );
}

function SequenceStation({ puzzle, solved, hint, onSubmit, onHint }: {
  puzzle: SequencePuzzle; solved: boolean; hint: boolean;
  onSubmit: (order: string[]) => void; onHint: () => void;
}) {
  const [order, setOrder] = useState<string[]>(() => puzzle.steps.map(s => s.id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const textOf = (id: string) => puzzle.steps.find(s => s.id === id)!.text;
  return (
    <div className={'er-station' + (solved ? ' er-solved' : '')}>
      <p className="mono er-station-title">{puzzle.title}</p>
      <p className="er-station-prompt">{puzzle.prompt}</p>
      {solved ? (
        <p className="er-station-solved-line">Solved — mark revealed: <b>{puzzle.unlockFragment}</b></p>
      ) : (
        <div className="er-station-controls">
          <ol className="er-sequence-list">
            {order.map((id, i) => (
              <li key={id}>
                <span>{textOf(id)}</span>
                <span className="er-sequence-arrows">
                  <button className="chip" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                  <button className="chip" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">↓</button>
                </span>
              </li>
            ))}
          </ol>
          <div className="er-station-actions">
            <button className="chip" onClick={() => onSubmit(order)}>Submit order</button>
            <button className="chip er-hint-btn" onClick={onHint}>{hint ? 'Hint shown' : 'Show a hint'}</button>
          </div>
          {hint && <p className="er-hint-text">{puzzle.hint}</p>}
        </div>
      )}
    </div>
  );
}

function MatchStation({ puzzle, solved, hint, onSubmit, onHint }: {
  puzzle: MatchPuzzle; solved: boolean; hint: boolean;
  onSubmit: (matches: Record<string, string>) => void; onHint: () => void;
}) {
  const [matches, setMatches] = useState<Record<string, string>>({});
  const allChosen = puzzle.items.every(it => matches[it.id]);
  return (
    <div className={'er-station' + (solved ? ' er-solved' : '')}>
      <p className="mono er-station-title">{puzzle.title}</p>
      <p className="er-station-prompt">{puzzle.prompt}</p>
      {solved ? (
        <p className="er-station-solved-line">Solved — mark revealed: <b>{puzzle.unlockFragment}</b></p>
      ) : (
        <div className="er-station-controls">
          <div className="er-match-rows">
            {puzzle.items.map(item => (
              <div key={item.id} className="er-match-row">
                <p className="er-match-item">{item.label}</p>
                <div className="er-choice-group">
                  {puzzle.targets.map(t => (
                    <button
                      key={t.id}
                      className={'chip' + (matches[item.id] === t.id ? ' er-chosen' : '')}
                      onClick={() => setMatches(m => ({ ...m, [item.id]: t.id }))}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="er-station-actions">
            <button className="chip" onClick={() => onSubmit(matches)} disabled={!allChosen}>Submit matches</button>
            <button className="chip er-hint-btn" onClick={onHint}>{hint ? 'Hint shown' : 'Show a hint'}</button>
          </div>
          {hint && <p className="er-hint-text">{puzzle.hint}</p>}
        </div>
      )}
    </div>
  );
}

function CodeStation({ puzzle, solved, hint, unlocked, onSubmit, onHint }: {
  puzzle: CodePuzzle; solved: boolean; hint: boolean; unlocked: boolean;
  onSubmit: (code: string) => void; onHint: () => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className={'er-station er-exit-station' + (solved ? ' er-solved' : '')}>
      <p className="mono er-station-title">{puzzle.title}</p>
      <p className="er-station-prompt">{puzzle.prompt}</p>
      {!unlocked && !solved && <p className="er-locked-note">Solve the other stations to fill the tray.</p>}
      {solved ? (
        <p className="er-station-solved-line">The door is open.</p>
      ) : (
        <div className="er-station-controls">
          <div className="er-code-row">
            <input type="text" value={draft} onChange={e => setDraft(e.target.value)} placeholder="___-_-__" disabled={!unlocked} />
          </div>
          <div className="er-station-actions">
            <button className="chip" onClick={() => draft && onSubmit(draft)} disabled={!unlocked || !draft}>Open the door</button>
            <button className="chip er-hint-btn" onClick={onHint}>{hint ? 'Hint shown' : 'Show a hint'}</button>
          </div>
          {hint && <p className="er-hint-text">{puzzle.hint}</p>}
        </div>
      )}
    </div>
  );
}

export function EscapeRoomMode({ onExit }: { onExit: () => void }) {
  const episode: EscapeRoomEpisode = getEpisode(DEFAULT_EPISODE_ID)!;
  const [state, setState] = useState<EpisodeState>(() => {
    escapeRoomStore.load();
    const saved = escapeRoomStore.get();
    return saved.activeState && saved.activeState.episodeId === episode.id ? saved.activeState : blankState(episode);
  });

  useEffect(() => {
    if (!escapeRoomStore.get().activeState) escapeRoomStore.setActive(state);
    profile.recordModeVisit('escape-room');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (action: Parameters<typeof applyAction>[2]) => {
    const { state: next } = applyAction(episode, state, action);
    setState(next);
    escapeRoomStore.setActive(next);
  };

  // Each directly referenced as its own onClick (never wrapped in an
  // extra inline arrow) so the impure Date.now() call inside stays
  // reachable from exactly one real event, the same pattern every other
  // mode's ending screen uses.
  const finishAndRestart = () => {
    const memory = summarizeEpisode(episode, state);
    escapeRoomStore.archiveActive(memory);
    const exhibit = episodeExhibit(memory, episode.title);
    profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'escape-room', unlockedAt: Date.now() });
    const fresh = blankState(episode);
    setState(fresh);
    escapeRoomStore.setActive(fresh);
  };

  const finishAndExit = () => {
    const memory = summarizeEpisode(episode, state);
    escapeRoomStore.archiveActive(memory);
    const exhibit = episodeExhibit(memory, episode.title);
    profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'escape-room', unlockedAt: Date.now() });
    onExit();
  };

  if (state.completed) {
    return (
      <div id="escaperoom-mode" className="er-ending">
        <div className="er-ending-box">
          <p className="mono er-eyebrow">Historical Escape Room — Enter the Past</p>
          <h1 className="er-ending-title">The door opens.</h1>
          <p className="er-ending-line">{episode.successText}</p>
          <p className="er-ending-stats">{Object.values(state.attempts).reduce((a, b) => a + b, 0)} attempts across the room · {Object.values(state.hintsRevealed).filter(Boolean).length} hints used.</p>
          <div className="er-ending-actions">
            <button className="chip" onClick={finishAndRestart}>Reopen the workshop</button>
            <button className="chip" onClick={finishAndExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const exitPuzzle = episode.puzzles.find(p => p.id === episode.finalPuzzleId) as CodePuzzle;
  const exitUnlocked = exitPuzzle.requires.every(id => state.solvedPuzzleIds.includes(id));

  return (
    <div id="escaperoom-mode">
      <header className="er-top">
        <button className="chip er-exit" onClick={onExit}>← Hub</button>
        <p className="mono er-eyebrow">{episode.title}</p>
        <p className="er-progress mono">{state.solvedPuzzleIds.length} of {episode.puzzles.length} stations solved</p>
      </header>

      <div className="er-body">
        <p className="er-intro">{episode.introText}</p>

        <div className="er-stations">
          {episode.puzzles.map((puzzle: Puzzle) => {
            const solved = state.solvedPuzzleIds.includes(puzzle.id);
            const hintShown = !!state.hintsRevealed[puzzle.id];
            const onHint = () => run({ kind: 'revealHint', puzzleId: puzzle.id });
            if (puzzle.kind === 'ratio') {
              return <RatioStation key={puzzle.id} puzzle={puzzle} solved={solved} hint={hintShown} onHint={onHint}
                onSubmit={value => run({ kind: 'submitRatio', puzzleId: puzzle.id, value })} />;
            }
            if (puzzle.kind === 'sequence') {
              return <SequenceStation key={puzzle.id} puzzle={puzzle} solved={solved} hint={hintShown} onHint={onHint}
                onSubmit={order => run({ kind: 'submitSequence', puzzleId: puzzle.id, order })} />;
            }
            if (puzzle.kind === 'match') {
              return <MatchStation key={puzzle.id} puzzle={puzzle} solved={solved} hint={hintShown} onHint={onHint}
                onSubmit={matches => run({ kind: 'submitMatch', puzzleId: puzzle.id, matches })} />;
            }
            return <CodeStation key={puzzle.id} puzzle={puzzle} solved={solved} hint={hintShown} unlocked={exitUnlocked} onHint={onHint}
              onSubmit={code => run({ kind: 'submitCode', puzzleId: puzzle.id, code })} />;
          })}
        </div>

        <section className="er-log-section">
          <p className="mono er-h">What&rsquo;s happened so far</p>
          <ol className="er-log">
            {state.log.slice(-5).map((e, i) => <li key={i}>{e.text}</li>)}
          </ol>
        </section>
      </div>
    </div>
  );
}
