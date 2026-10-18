'use client';
import { useState } from 'react';
import { kindLabels, type Question } from '@/lib/quiz/types';

/** The list of every question. Drag to reorder with a pointer, or use the Up/Down buttons from the keyboard. */
export default function QuestionOutline({ questions, issues, active, onSelect, onMove }: {
  questions: Question[]; issues: (string | null)[]; active: number; onSelect: (i: number) => void; onMove: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <ol className="cr-outline" aria-label="Questions">
      {questions.map((q, i) => (
        <li key={q.id ?? `n${i}`} data-over={over === i && drag !== null && drag !== i ? 'true' : undefined} data-dragging={drag === i ? 'true' : undefined}
          draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* some browsers */ } }}
          onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver((o) => (o === i ? null : o))}
          onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) onMove(drag, i); setDrag(null); setOver(null); }} onDragEnd={() => { setDrag(null); setOver(null); }}>
          <button className="q" aria-current={active === i} onClick={() => onSelect(i)}>
            <span className="n">{i + 1}</span>
            <span className="t">{q.prompt.trim() || 'Untitled question'}<span className="k">{kindLabels[q.kind]}{(q.payload as any).media ? ' · media' : ''}{issues[i] ? <> · <span className="bad">Needs attention</span></> : null}</span></span>
          </button>
          <span className="cr-move">
            <button className="btn small ghost" onClick={() => onMove(i, i - 1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>↑</button>
            <button className="btn small ghost" onClick={() => onMove(i, i + 1)} disabled={i === questions.length - 1} aria-label={`Move question ${i + 1} down`}>↓</button>
          </span>
        </li>
      ))}
    </ol>
  );
}
