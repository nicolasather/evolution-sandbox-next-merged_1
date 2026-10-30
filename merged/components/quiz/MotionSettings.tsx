'use client';
/** Settings for Quiz Studio motion and feedback. Both choices are saved in this browser. */
import { useEffect, useState } from 'react';
import { readHaptics, useQuizMotion, writeHaptics } from './useQuizMotion';

export default function MotionSettings() {
  const { reduced, setReduced } = useQuizMotion();
  const [haptics, setHaptics] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the stored preference once on mount
    setHaptics(readHaptics());
  }, []);

  return (
    <section className="panel" aria-labelledby="motion-settings-h">
      <h2 id="motion-settings-h">Motion and feedback</h2>
      <p className="muted-text">Saved in this browser only.</p>
      <div className="row">
        <button type="button" className="btn ghost" aria-pressed={reduced} onClick={() => setReduced(!reduced)}>
          <span aria-hidden="true">{reduced ? '◻' : '◼'}</span> Reduced motion: {reduced ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className="btn ghost"
          aria-pressed={haptics}
          onClick={() => { writeHaptics(!haptics); setHaptics(!haptics); }}
        >
          <span aria-hidden="true">📳</span> Haptics: {haptics ? 'on' : 'off'}
        </button>
      </div>
    </section>
  );
}
