'use client';

import { useEffect, useRef, useState } from 'react';
import type { CombineResult } from '@/lib/types';
import { markGuideDone, type GuideVariant } from '@/lib/sandbox/guideStore';

/* ============================================================================
   FIRST-TIME GUIDE — about a minute, no slides. It names one thing at a time,
   highlights only the element that matters for that step, and then waits for
   the player to do it. Steps advance on the player's own actions (a rail
   click, a technique click, a combine result), never on a timer.
   ========================================================================== */

type Step = {
  text: string;
  /** Selector of the one element to highlight while this step is open. */
  target?: string;
  /** Which player action moves the guide on. `next` shows a Continue button instead. */
  advance: 'pick' | 'tool' | 'combine' | 'next' | 'none';
};

const STEPS: Step[] = [
  { text: 'This is your workspace. Four raw materials to start: stone, wood, bone and fibre.', advance: 'next' },
  { text: 'Choose a material. Tap Stone in your inventory.', target: '#inv [data-id="stone"]', advance: 'pick' },
  { text: 'Work it with your hands: pick a technique on the right, then use it on the stone.', target: '.wb-rail .wb-act', advance: 'tool' },
  { text: 'Now bring a second material to the bench and combine two. Try Wood.', target: '#inv [data-id="wood"]', advance: 'combine' },
  { text: 'That is a discovery. Read its card, then carry on.', target: '#outcome', advance: 'next' },
  { text: 'You are free now. Experiment as you like. Help (?) explains the tools, Archive, Graph and Timeline.', advance: 'next' },
];

/* Civilization runs the same bench. Its guide teaches the same moves, framed as the first settlement needs. */
const CIV_STEPS: Step[] = [
  { text: 'Civilization uses the same bench. Your goal: turn raw materials into the tools and crafts that let a settlement feed and shelter itself.', advance: 'next' },
  { text: 'Start with what a settlement needs first. Tap Stone in your inventory.', target: '#inv [data-id="stone"]', advance: 'pick' },
  { text: 'Use a technique on it: pick one on the right, then use it on the stone.', target: '.wb-rail .wb-act', advance: 'tool' },
  { text: 'Settlements combine materials into new things. Bring Wood to the bench and combine it with the stone.', target: '#inv [data-id="wood"]', advance: 'combine' },
  { text: 'Each discovery opens the next step toward a settlement. Read this card, then carry on.', target: '#outcome', advance: 'next' },
  { text: 'Keep combining. Help (?) shows the Timeline, Graph and Archive, where the settlement routes are recorded.', advance: 'next' },
];

const HL = 'sx-guide-hl';

export function SandboxGuide({ onFinish, combineKey, lastResult, variant = 'main' }: {
  /** Ends the guide; it is then never shown automatically again. */
  onFinish: () => void;
  /** Changes every time the player makes a combine attempt. */
  combineKey: number;
  lastResult: (CombineResult & { key: number }) | null;
  /** Which guide text and completion flag to use. */
  variant?: GuideVariant;
}) {
  const steps = variant === 'civilization' ? CIV_STEPS : STEPS;
  const [i, setI] = useState(0);
  const [failNote, setFailNote] = useState(false);
  const step = steps[i];
  const seenKey = useRef(combineKey);

  const finish = () => { markGuideDone(variant); onFinish(); };
  const go = (n: number) => setI(n);

  // the one element a step points at, lit until the step changes
  useEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    el?.classList.add(HL);
    return () => { el?.classList.remove(HL); };
  }, [step]);

  // rail and technique clicks are the player's own choices: listen once, read the current step
  const cur = useRef(step);
  cur.current = step;
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (cur.current.advance === 'pick' && t.closest('#rail [data-id]')) setI(n => (n === 1 ? 2 : n));
      if (cur.current.advance === 'tool' && t.closest('.wb-rail .wb-act')) setI(n => (n === 2 ? 3 : n));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // a combine: a new discovery moves on; a dud stays here and says why
  useEffect(() => {
    if (combineKey === seenKey.current) return;
    seenKey.current = combineKey;
    if (cur.current.advance !== 'combine') return;
    if (lastResult?.status === 'new' || lastResult?.status === 'known') { setFailNote(false); setI(4); }
    else if (lastResult?.status === 'fail') setFailNote(true);
  }, [combineKey, lastResult]);

  const last = i === steps.length - 1;
  return (
    <aside className="sx-guide" role="region" aria-label="Introduction" data-step={i}>
      <p className="sx-guide-text">{failNote && step.advance === 'combine' ? 'That pair does not make anything. Try another.' : step.text}</p>
      <div className="sx-guide-row">
        <span className="sx-guide-count mono" aria-hidden="true">{i + 1} / {steps.length}</span>
        <div className="sx-guide-acts">
          <button type="button" className="chip" onClick={finish}>Skip</button>
          {step.advance === 'next' && (
            <button type="button" className="chip" onClick={() => (last ? finish() : go(i + 1))}>
              {last ? 'Start exploring' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
