'use client';

import { heroStone } from '@/lib/glyphs';
import { cn } from '@/lib/utils';
import type { Db } from '@/lib/types';

export function Landing({
  db, gone, resumedCount, onBegin,
}: { db: Db; gone: boolean; resumedCount: number; onBegin: () => void }) {
  const routes = db.nodes.reduce((a, n) => a + (n.rec?.length || 0), 0);

  return (
    <section id="landing" className={cn(gone && 'gone')} aria-label="Introduction">
      <div className="landing-inner">
        <div>
          <h1 className="landing-q">
            How did we<br />get <em>here</em>?
          </h1>
          <p className="landing-sub">
            {resumedCount > 0 ? (
              <>
                You were here before — <b style={{ color: 'var(--bone)' }}>{resumedCount}</b> discoveries
                deep. Pick up where you stopped, or start again from four raw materials.
              </>
            ) : (
              <>
                Start with almost nothing — a stone, a stick, a bone, a length of fibre.
                Tap two things together and see what comes out. Most things can be reached
                more than one way, and when you get stuck the game nudges — it never hands
                you the answer.
              </>
            )}
          </p>
          <div className="landing-meta mono">
            <div><b>{db.counts.core}</b>discoveries</div>
            <div><b>{db.counts.hidden}</b>hidden</div>
            <div><b>{routes}</b>routes</div>
            <div><b>{Object.keys(db.sources).length}</b>cited sources</div>
          </div>
          <button className="begin" id="begin" onClick={onBegin}>
            <span>{resumedCount > 0 ? 'CONTINUE' : 'BEGIN'}</span>
            <span className="arrow">→</span>
          </button>
        </div>
        <div
          className="landing-stone"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: heroStone() }}
        />
      </div>
      <div className="landing-foot mono">
        <span>No account. No tutorial. Nothing to read first.</span>
        <span>Every entry shows its evidence. Missing sources are flagged, never invented.</span>
      </div>
    </section>
  );
}
