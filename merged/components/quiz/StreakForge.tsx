'use client';
/** Streak counter with a 3-segment shield forge and five aura tiers.
 *  Display only: the streak and shield live on this device and never change the server's scoring. */
import { useEffect, useState } from 'react';
import { useQuizMotion } from './useQuizMotion';

export type ForgeState = { streak: number; shield: number; forged: 'none' | 'forged' | 'absorbed' };

export const FORGE_START: ForgeState = { streak: 0, shield: 0, forged: 'none' };

/** One answer's effect. A full shield absorbs the first miss and keeps the streak. Three correct answers forge the shield. */
export function nextForge(s: ForgeState, correct: boolean): ForgeState {
  if (correct) {
    const shield = Math.min(3, s.shield + 1);
    return { streak: s.streak + 1, shield, forged: shield === 3 && s.shield < 3 ? 'forged' : 'none' };
  }
  if (s.shield === 3) return { streak: s.streak, shield: 0, forged: 'absorbed' };
  return { streak: 0, shield: 0, forged: 'none' };
}

export function auraTier(streak: number): 'none' | 'amber' | 'orange' | 'blue' | 'prism' {
  if (streak >= 10) return 'prism';
  if (streak >= 6) return 'blue';
  if (streak >= 4) return 'orange';
  if (streak >= 2) return 'amber';
  return 'none';
}

export default function StreakForge({ state }: { state: ForgeState }) {
  const { reduced } = useQuizMotion();
  const [banner, setBanner] = useState<'' | 'forged' | 'absorbed'>('');
  useEffect(() => {
    if (state.forged === 'none') return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the banner for each new forge or absorb event
    setBanner(state.forged);
    const t = setTimeout(() => setBanner(''), 1600);
    return () => clearTimeout(t);
  }, [state]);

  const tier = auraTier(state.streak);
  return (
    <div className="qz-forge" data-aura={tier} aria-label={`Streak ${state.streak}, shield ${state.shield} of 3`}>
      <span className="qz-forge-count" aria-hidden="true">🔥 {state.streak}</span>
      <svg className="qz-forge-ring" viewBox="0 0 120 40" width="120" height="40" aria-hidden="true">
        {[0, 1, 2].map((i) => {
          const filled = i < state.shield;
          return (
            <g key={i} transform={`translate(${12 + i * 36},20)`}>
              <polygon points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7" fill="none" stroke="#475569" strokeWidth="2" />
              <polygon
                points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7"
                fill="#facc15"
                style={{ opacity: filled ? 1 : 0, transform: `scale(${filled ? 1 : 0.4})`, transition: reduced ? 'none' : 'opacity 450ms ease-out, transform 450ms cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: 'center' }}
              />
            </g>
          );
        })}
      </svg>
      {banner === 'forged' && <p className="qz-forge-banner" role="status">STREAK SHIELD FORGED!</p>}
      {banner === 'absorbed' && <p className="qz-forge-banner absorbed" role="status">Shield absorbed the miss. Streak kept.</p>}
    </div>
  );
}
