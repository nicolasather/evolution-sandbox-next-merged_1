'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzle } from '@/lib/techsudoku/generate';
import { dailyRng } from '@/lib/seed';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   TECH SUDOKU — a small, optional, few-minutes logic puzzle: put five real
   discoveries back in chronological order from a handful of "X predates Y"
   clues. Deliberately not a major mode — no top-bar entry, reached from a
   small link in the Mode Hub (components/ModeHub.tsx), same as the brief's
   "offer one optional puzzle in Daily rotations" framing.
   ========================================================================== */

export function TechSudokuModal({ open, engine, onClose }: { open: boolean; engine: Engine; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const puzzle = useMemo(() => generatePuzzle(engine.db, dailyRng('tech-sudoku')), [engine.db]);
  const [order, setOrder] = useState<string[]>(() => puzzle?.scrambled ?? []);
  const [checked, setChecked] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  if (!open || !puzzle) return null;

  const solved = order.every((id, i) => id === puzzle.solution[i].id);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setChecked(null);
  };
  const check = () => {
    const correctPositions = order.filter((id, i) => id === puzzle.solution[i].id).length;
    setChecked(correctPositions);
  };

  return (
    <div id="techsudoku-modal" className="confirm" role="dialog" aria-modal="true" aria-labelledby="ts-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="confirm-box ts-box">
        <p className="mono confirm-k" id="ts-t">Today&rsquo;s Tech Sudoku</p>
        <p className="confirm-d">Put these five back in the order they were actually discovered, using only the clues below.</p>

        <ol className="ts-clues mono">
          {puzzle.clues.map((c, i) => {
            const before = engine.get(c.beforeId)?.n ?? c.beforeId;
            const after = engine.get(c.afterId)?.n ?? c.afterId;
            return <li key={i}>{before} predates {after}</li>;
          })}
        </ol>

        <ol className="ts-order">
          {order.map((id, i) => {
            const n = engine.get(id);
            const revealed = solved;
            return (
              <li key={id} className="ts-row">
                <span className="ts-pos mono">{i + 1}</span>
                <span className="ts-name">{n?.n ?? id}</span>
                {revealed && <span className="ts-date mono">{n?.date}</span>}
                <span className="ts-move">
                  <button type="button" aria-label={`Move ${n?.n} up`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" aria-label={`Move ${n?.n} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
                </span>
              </li>
            );
          })}
        </ol>

        {solved ? (
          <p className="ts-result ts-solved">Solved — that is the real order.</p>
        ) : checked !== null ? (
          <p className="ts-result">{checked} of {order.length} in the right place.</p>
        ) : null}

        <div className="confirm-row">
          {!solved && <button className="chip" onClick={check}>Check</button>}
          <button className="chip" ref={closeRef} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
