'use client';

import { useEffect, useRef } from 'react';
import { Glyph } from './Glyph';
import { TECH_BY_ID } from '@/lib/processing/techniques';
import type { Engine } from '@/lib/engine';

/* ============================================================================
   JOURNAL — a small, personal recap: "the history of their civilisation", not
   a scoreboard against anyone else. Reads engine.journal() + stats(), which
   read only what the engine already keeps (plus two small counters it adds).
   Same in-page-dialog shape as ConfirmDialog, read-only.
   ========================================================================== */

export function JournalPanel({ open, engine, onClose }: { open: boolean; engine: Engine; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const j = engine.journal();
  const s = engine.stats();
  const tech = j.mostUsedAction ? TECH_BY_ID[j.mostUsedAction] : null;

  return (
    <div
      id="journal"
      className="confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-t"
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div className="confirm-box journal-box">
        <p className="mono confirm-k" id="journal-t">Journal</p>
        <div className="jr-row">
          <span className="jr-k mono">FIRST DISCOVERY</span>
          {j.first ? (
            <span className="jr-v"><Glyph node={j.first} />{j.first.n}</span>
          ) : <span className="jr-v mono" style={{ color: 'var(--bone-4)' }}>Not yet</span>}
        </div>
        <div className="jr-row">
          <span className="jr-k mono">DEEPEST REACHED</span>
          <span className="jr-v"><Glyph node={s.deepest} />{s.deepest.n}</span>
        </div>
        <div className="jr-row">
          <span className="jr-k mono">MOST-USED TECHNIQUE</span>
          <span className="jr-v mono">{tech ? tech.label : '—'}</span>
        </div>
        <div className="jr-row">
          <span className="jr-k mono">DISCOVERED WITHOUT A HINT</span>
          <span className="jr-v mono">{j.noHintPercent === null ? '—' : `${j.noHintPercent}%`}</span>
        </div>
        <div className="jr-row">
          <span className="jr-k mono">ROUTES WALKED</span>
          <span className="jr-v mono">{s.routesFound} / {s.routesTotal}</span>
        </div>
        <div className="confirm-row">
          <button ref={closeRef} type="button" className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
