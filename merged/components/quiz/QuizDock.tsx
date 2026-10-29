'use client';
/** Persistent top-right dock: one-tap reduced motion and haptics. Applies motion state to <html> so CSS can calm every quiz animation. */
import { useEffect, useState } from 'react';
import { readHaptics, useQuizMotion, writeHaptics } from './useQuizMotion';

export default function QuizDock() {
  const { reduced, setReduced } = useQuizMotion();
  const [haptics, setHaptics] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.qzMotion = reduced ? 'reduce' : 'auto';
  }, [reduced]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the stored preference once on mount
    setHaptics(readHaptics());
  }, []);

  return (
    <div className="qz-dock" role="group" aria-label="Motion and feedback">
      <button type="button" className="qz-dock-btn" aria-pressed={reduced} onClick={() => setReduced(!reduced)}>
        <span aria-hidden="true">{reduced ? '◻' : '◼'}</span> Reduced motion
      </button>
      <button
        type="button"
        className="qz-dock-btn"
        aria-pressed={haptics}
        onClick={() => { writeHaptics(!haptics); setHaptics(!haptics); }}
      >
        <span aria-hidden="true">📳</span> Haptics
      </button>
    </div>
  );
}
