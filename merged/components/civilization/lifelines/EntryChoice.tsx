'use client';

/** Shown once when a legacy Civilization settlement exists. Choosing never touches the legacy save. */
export function EntryChoice({ onLegacy, onLifelines, onExit }: { onLegacy: () => void; onLifelines: () => void; onExit: () => void }) {
  return (
    <div className="ll-screen ll-center">
      <p className="ll-eyebrow">Civilization</p>
      <h1 className="ll-h1">Two ways in</h1>
      <p className="ll-lede">You have a settlement from the earlier Civilization mode. It stays exactly as it is. Lifelines is a new campaign with its own progress.</p>
      <div className="ll-choice-row">
        <button type="button" className="ll-card-btn" onClick={onLegacy}>
          <b>Continue legacy settlement</b>
          <span>Pick up the earlier mode where you left it. Nothing is changed or converted.</span>
        </button>
        <button type="button" className="ll-card-btn primary" onClick={onLifelines} autoFocus>
          <b>Start Lifelines</b>
          <span>A 24-chapter campaign about the connections that keep a settlement working.</span>
        </button>
      </div>
      <button type="button" className="ll-btn ghost" onClick={onExit}>← Hub</button>
    </div>
  );
}
