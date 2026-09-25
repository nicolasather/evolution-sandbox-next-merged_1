'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ERA_ORDER } from '@/lib/learn/knowledge';
import type { Tutor } from '@/lib/learn/tutor';
import type { Engine } from '@/lib/engine';
import { TECH_BY_ID } from '@/lib/processing/techniques';
import { TechniqueIcon } from './TechniqueIcon';

/* ============================================================================
   QUESTION CARD — a small question in the top-right corner. Not a modal: it
   takes no focus and blocks nothing. Ignored, it folds to a "?"; answer it and
   it may open a technique. No score, no streak — a wrong answer just fades.
   Sources are shown with the answer, and where the record is thin the card
   says so.
   ========================================================================== */

const CONF: Record<string, string> = { high: 'Well documented', medium: 'Reasonably documented', contested: 'Disputed' };
const era = (n: number) => (n < 0 ? `${Math.abs(n).toLocaleString('en-GB')} BCE` : `${n} CE`);
const span = (r: [number, number]) => (r[0] === r[1] ? era(r[0]) : `${era(r[0])} – ${era(r[1])}`);

export function QuestionCard({ tutor, engine, busy }: { tutor: Tutor; engine: Engine; busy: boolean }) {
  useSyncExternalStore(tutor.subscribe, tutor.getVersion, () => 0);
  const phase = tutor.phase;
  const shown = tutor.shown;

  // what was answered before is not asked again
  useEffect(() => { tutor.load(); }, [tutor]);

  // the tutor keeps no timers of its own: one gentle tick a second drives it
  useEffect(() => {
    const id = window.setInterval(() => {
      tutor.tick(Date.now(), {
        eraIndex: Math.max(0, ERA_ORDER.indexOf(engine.currentEra().id)),
        discoveries: engine.found.size,
        busy,
        knows: a => engine.knows(a),
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [tutor, engine, busy]);

  if (phase === 'idle' || !shown) return null;
  const q = shown.q;

  if (phase === 'folded') {
    return (
      <button type="button" className="qc-fold" aria-label="A question is waiting — open it"
        onClick={() => tutor.expand(Date.now())}>
        <span aria-hidden="true">?</span>
      </button>
    );
  }

  const done = phase === 'right';
  const cites = q.source.map(id => engine.db.sources[id]).filter(Boolean);
  const taught = shown.taught ? TECH_BY_ID[shown.taught] : null;

  return (
    <aside className="qc" data-phase={phase} data-conf={q.confidence} aria-label="A question" role="region">
      <header className="qc-h">
        <span className="mono qc-k">{done ? 'Noted' : 'A question'}</span>
        {!done && <button type="button" className="qc-x" aria-label="Not now — fold this question" onClick={() => tutor.fold(Date.now())}>–</button>}
        {done && <button type="button" className="qc-x" aria-label="Close" onClick={() => tutor.close(Date.now())}>×</button>}
      </header>

      <p className="qc-q">{q.question}</p>

      {!done && (
        <ul className="qc-a">
          {shown.order.map(a => (
            <li key={a}>
              <button type="button" className={shown.faded.includes(a) ? 'is-faded' : ''} disabled={phase === 'wrong'}
                onClick={() => { tutor.answer(a, Date.now(), { knows: k => engine.knows(k) }, k => engine.teach(k)); }}>
                {a}
              </button>
            </li>
          ))}
        </ul>
      )}

      {done && (
        <div className="qc-done">
          <p className="qc-right"><b>{q.correctAnswer}</b></p>
          <p className="qc-why">{q.explanation}</p>
          {(q.region || q.range) && (
            <p className="qc-ctx mono">{[q.region, q.range ? span(q.range) : null].filter(Boolean).join(' · ')}</p>
          )}
          <p className="qc-conf mono" data-conf={q.confidence}>
            {CONF[q.confidence]}{q.uncertainty ? ` — ${q.uncertainty}` : ''}
          </p>
          {taught && (
            <p className="qc-taught">
              <TechniqueIcon id={taught.id} size={18} />
              <span className="mono">{taught.label} learned</span>
            </p>
          )}
          {q.checked && <p className="qc-conf mono">Source read {new Date(q.checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
          <p className="qc-src mono">
            Source{cites.length > 1 ? 's' : ''}:{' '}
            {cites.map((c, i) => (
              <span key={c.title}>{i > 0 && ' · '}<a href={c.url} target="_blank" rel="noopener noreferrer">{c.org}</a></span>
            ))}
          </p>
        </div>
      )}
    </aside>
  );
}
