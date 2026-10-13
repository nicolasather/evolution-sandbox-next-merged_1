'use client';

import { useEffect, useState } from 'react';
import { CONCEPT_GLOSS, NOUN_CONCEPTS, NUMBER_VALUE } from '@/lib/decipher/catalog';
import { generatePuzzle } from '@/lib/decipher/generate';
import { decipherExhibit, summarizeAttempt } from '@/lib/decipher/memory';
import { assignGlyph, blankAttempt, checkAttempt, revealAnswer, type CheckResult } from '@/lib/decipher/simulate';
import { decipherStore } from '@/lib/decipher/store';
import { generateTutorial } from '@/lib/decipher/tutorial';
import type { DecipherAttempt, DecipherPuzzle, Glyph, NounConceptId, NumberConceptId } from '@/lib/decipher/types';
import { notebook } from '@/lib/notebook/store';
import { profile } from '@/lib/profile/store';

/* ============================================================================
   DECIPHER — "Read the Lost". A fourth, genuinely different interaction
   language: no crafting, no allocation, no spatial grid, no excavation
   budgets. The player is given a fixed corpus of short inscriptions in an
   invented writing system and works out which glyph means which concept
   using exactly the kind of evidence real epigraphy uses — a directly
   given context anchor, and each glyph's own frequency across the corpus.
   See docs/ROADMAP-UNIVERSE.md's Phase 9 section for what this slice does
   and does not attempt.
   ========================================================================== */

interface Game { puzzle: DecipherPuzzle; attempt: DecipherAttempt }

function investigationId(puzzleId: string): string { return `dec-${puzzleId}`; }

function GlyphIcon({ glyph, size = 34 }: { glyph: Glyph; size?: number }) {
  if (glyph.role === 'number') {
    const n = NUMBER_VALUE[glyph.conceptId as NumberConceptId];
    return (
      <span className="dph-glyph dph-glyph-number" style={{ width: size, height: size }}>
        {Array.from({ length: n }).map((_, i) => <span key={i} className="dph-dot" />)}
      </span>
    );
  }
  return (
    <svg className="dph-glyph-svg" width={size} height={size} viewBox="-0.6 -0.6 5.2 5.2" aria-hidden="true">
      {glyph.shape.strokes.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />)}
    </svg>
  );
}

function glyphLabel(glyph: Glyph, attempt: DecipherAttempt): string | null {
  if (glyph.role === 'noun') {
    const guess = attempt.assignments[glyph.id];
    return guess ? CONCEPT_GLOSS[guess] : null;
  }
  return CONCEPT_GLOSS[glyph.conceptId];
}

export function DecipherMode({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<Game>(() => {
    decipherStore.load();
    const saved = decipherStore.get();
    if (saved.activePuzzle && saved.activeAttempt) return { puzzle: saved.activePuzzle, attempt: saved.activeAttempt };
    const puzzle = saved.tutorialCompleted ? generatePuzzle(`dec-${Date.now()}`) : generateTutorial();
    return { puzzle, attempt: blankAttempt(puzzle) };
  });
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    if (!decipherStore.get().activePuzzle) decipherStore.setActive(game.puzzle, game.attempt);
    notebook.ensureInvestigation(investigationId(game.puzzle.id), 'Decipherment — ' + game.puzzle.id, 'decipher');
    profile.recordModeVisit('decipher');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishPuzzle = (puzzle: DecipherPuzzle, attempt: DecipherAttempt) => {
    const memory = summarizeAttempt(puzzle, attempt);
    decipherStore.archiveActive(memory);
    const exhibit = decipherExhibit(memory);
    profile.unlockExhibit({ exhibitId: exhibit.id, sourceMode: 'decipher', unlockedAt: Date.now() });
    if (puzzle.kind === 'tutorial') decipherStore.markTutorialCompleted();
    notebook.addHypothesis(investigationId(puzzle.id), memory.headline, attempt.solved ? 0.95 : 0.3);
  };

  const check = () => {
    const { attempt: nextAttempt, result } = checkAttempt(game.puzzle, game.attempt);
    const next = { ...game, attempt: nextAttempt };
    setGame(next);
    setCheckResult(result);
    if (nextAttempt.solved) finishPuzzle(next.puzzle, nextAttempt);
    else decipherStore.setActive(next.puzzle, nextAttempt);
  };

  const reveal = () => {
    const nextAttempt = revealAnswer(game.puzzle, game.attempt);
    const next = { ...game, attempt: nextAttempt };
    setGame(next);
    finishPuzzle(next.puzzle, nextAttempt);
  };

  const startNew = () => {
    const puzzle = generatePuzzle(`dec-${Date.now()}`);
    const attempt = blankAttempt(puzzle);
    setGame({ puzzle, attempt });
    setCheckResult(null);
    decipherStore.setActive(puzzle, attempt);
  };

  const assign = (glyphId: string, conceptId: NounConceptId | null) => {
    const nextAttempt = assignGlyph(game.attempt, glyphId, conceptId);
    const next = { ...game, attempt: nextAttempt };
    setGame(next);
    setCheckResult(null);
    decipherStore.setActive(next.puzzle, nextAttempt);
  };

  const { puzzle, attempt } = game;
  const finished = attempt.solved || attempt.revealedAnswer;

  if (finished) {
    const memory = summarizeAttempt(puzzle, attempt);
    return (
      <div id="decipher-mode" className={`dph-ending dph-${memory.outcome}`}>
        <div className="dph-ending-box">
          <p className="mono dph-eyebrow">Decipher — Read the Lost</p>
          <h1 className="dph-ending-title">{memory.outcome === 'solved' ? 'The tablets are read.' : 'The reading was revealed.'}</h1>
          <p className="dph-ending-line">{memory.headline}</p>
          <dl className="dph-ending-answer">
            {puzzle.glyphs.filter(g => g.role === 'noun').map(g => (
              <div key={g.id}><GlyphIcon glyph={g} size={26} /><dd>{CONCEPT_GLOSS[g.conceptId]}</dd></div>
            ))}
          </dl>
          <div className="dph-ending-actions">
            <button className="chip" onClick={startNew}>Read another set of tablets</button>
            <button className="chip" onClick={onExit}>Return to the Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const nounGlyphs = puzzle.glyphs.filter(g => g.role === 'noun');
  const usedConcepts = new Set(Object.values(attempt.assignments).filter((v): v is NounConceptId => !!v));

  return (
    <div id="decipher-mode">
      <header className="dph-top">
        <button className="chip dph-exit" onClick={onExit}>← Hub</button>
        <p className="mono dph-eyebrow">Decipher — Read the Lost</p>
        <p className="dph-checks mono">Checks used: {attempt.checksUsed}</p>
      </header>

      <div className="dph-body">
        {puzzle.tutorialSteps && (
          <section className="dph-tutorial">
            <p className="mono dph-h">How to read this</p>
            <ol className="dph-tutorial-steps">
              {puzzle.tutorialSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </section>
        )}

        <p className="dph-intro">{puzzle.introText}</p>

        <section className="dph-anchor">
          <p className="mono dph-h">Known from context</p>
          {puzzle.anchors.map(a => {
            const g = puzzle.glyphs.find(x => x.id === a.glyphId)!;
            return (
              <div key={a.glyphId} className="dph-anchor-row">
                <GlyphIcon glyph={g} />
                <div>
                  <p className="dph-anchor-word">{CONCEPT_GLOSS[a.conceptId]}</p>
                  <p className="dph-anchor-note">{a.note}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="dph-corpus">
          <p className="mono dph-h">The tablets ({puzzle.inscriptions.length})</p>
          <div className="dph-inscriptions">
            {puzzle.inscriptions.map(insc => (
              <div key={insc.id} className="dph-inscription">
                {insc.glyphIds.map((gid, i) => {
                  const g = puzzle.glyphs.find(x => x.id === gid)!;
                  const label = glyphLabel(g, attempt);
                  return (
                    <span key={`${insc.id}-${i}`} className="dph-token">
                      <GlyphIcon glyph={g} />
                      <span className={'dph-token-label' + (label ? '' : ' dph-token-label-empty')}>{label ?? '?'}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="dph-legend">
          <p className="mono dph-h">Mystery glyphs — assign a meaning to each</p>
          <p className="dph-legend-note">Assigning a word to a second glyph clears it from wherever else you placed it — count how often each glyph appears above to guide your first guess.</p>
          <div className="dph-legend-rows">
            {nounGlyphs.map(g => {
              const current = attempt.assignments[g.id];
              return (
                <div key={g.id} className="dph-legend-row">
                  <GlyphIcon glyph={g} size={40} />
                  <div className="dph-legend-options">
                    {NOUN_CONCEPTS.map(c => (
                      <button
                        key={c}
                        className={'chip' + (current === c ? ' dph-chosen' : '') + (usedConcepts.has(c) && current !== c ? ' dph-used-elsewhere' : '')}
                        onClick={() => assign(g.id, current === c ? null : c)}
                      >{CONCEPT_GLOSS[c]}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {checkResult && (
          <p className="dph-check-result">
            {checkResult.correctCount} of {checkResult.total} correct.
          </p>
        )}

        <div className="dph-actions-row">
          <button className="chip dph-check-btn" onClick={check}>Check</button>
          <button className="chip dph-reveal-btn" onClick={reveal}>Reveal the reading</button>
        </div>
      </div>
    </div>
  );
}
