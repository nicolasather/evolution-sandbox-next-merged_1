'use client';
import type { LifelinesStore, Snapshot } from '@/lib/civilization/lifelines/store';

function download(name: string, text: string): void {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* download unavailable */ }
}
export function exportNow(store: LifelinesStore): void { download('civilization-lifelines-export.json', store.exportText()); }

/** Honest storage / tab status. Never blocks play except when a conflict needs a decision. */
export function Banners({ store, snap }: { store: LifelinesStore; snap: Snapshot }) {
  return (
    <div className="ll-banners" aria-live="polite">
      {snap.persistence === 'memory-only' && (
        <p className="ll-banner warn" role="status">
          <span>{snap.persistenceNote ?? 'Progress is not being saved'}. You can keep playing; export keeps a copy.</span>
          <button type="button" className="ll-btn small" onClick={() => exportNow(store)}>Export progress</button>
        </p>
      )}
      {snap.readOnly && (
        <p className="ll-banner" role="status">
          <span>{snap.persistenceNote ?? 'This settlement is open in another tab.'} You are viewing it read-only.</span>
          <button type="button" className="ll-btn small" onClick={() => { void store.takeOver(); }}>Take over editing</button>
        </p>
      )}
      {snap.conflict && (
        <div className="ll-banner warn" role="alertdialog" aria-label="Conflicting save">
          <span>This settlement changed in another tab (season {snap.conflict.state.turn}). Choose which copy to keep.</span>
          <span className="ll-banner-actions">
            <button type="button" className="ll-btn small" onClick={() => store.resolveConflict('keep-mine')}>Keep mine</button>
            <button type="button" className="ll-btn small" onClick={() => store.resolveConflict('use-theirs')}>Use theirs</button>
            <button type="button" className="ll-btn small ghost" onClick={() => exportNow(store)}>Export both</button>
          </span>
        </div>
      )}
      {snap.problem && (
        <p className="ll-banner warn" role="status">
          <span>An earlier Lifelines save could not be read ({snap.problem.error}). It was kept safely and is not overwritten.</span>
          <span className="ll-banner-actions">
            <button type="button" className="ll-btn small" onClick={() => exportNow(store)}>Export it</button>
            <button type="button" className="ll-btn small ghost" onClick={() => store.discardProblem()}>Dismiss</button>
          </span>
        </p>
      )}
    </div>
  );
}
