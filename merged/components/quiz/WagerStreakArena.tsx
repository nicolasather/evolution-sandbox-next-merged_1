'use client';
/** Confidence wager dial and the 3-segment crystal shield ring for the player's question screen.
 *  Display and local preview only: the server still prices a wager (see lib/quiz/answer-pipeline.ts). */
import { useEffect, useState } from 'react';
import { useQuizMotion } from './useQuizMotion';

export const WAGER_LEVELS = [
  { mult: 1, label: '1x Safe', hz: 1.2 },
  { mult: 1.5, label: '1.5x Calculated', hz: 2.1 },
  { mult: 2, label: '2x High Voltage', hz: 2.8 },
  { mult: 3, label: '3x Supernova', hz: 3.5 },
] as const;

export type WagerMult = (typeof WAGER_LEVELS)[number]['mult'];

/** Points a tier puts at risk, on top of the base award. The server adds `wager` on a right answer and takes it off a wrong one
 *  (commit_answer_v2 / submit). So 1x risks nothing, and 2x on a 300-point question wins +600 or loses 300. */
export function wagerForTier(base: number, mult: WagerMult): number {
  return Math.round(base * (mult - 1));
}

/** The preview the player sees: what a right and a wrong answer change the score by. Matches the server's arithmetic. */
export function wagerMath(base: number, mult: WagerMult) {
  const wager = wagerForTier(base, mult);
  return { wager, win: base + wager, loss: wager === 0 ? 0 : -wager };
}

/** Border pulse rate in Hz, from 1.2 at 1x up to 3.5 at 3x. */
export function pulsePeriodMs(mult: WagerMult): number {
  const level = WAGER_LEVELS.find((w) => w.mult === mult) ?? WAGER_LEVELS[0];
  return Math.round(1000 / level.hz);
}

type DialProps = { stake: number; value: WagerMult; locked: boolean; maxWager: number; onChange: (m: WagerMult) => void };

export function WagerDial({ stake, value, locked, maxWager, onChange }: DialProps) {
  const { reduced } = useQuizMotion();
  const math = wagerMath(stake, value);
  const level = WAGER_LEVELS.find((w) => w.mult === value) ?? WAGER_LEVELS[0];
  const allIn = value === 3;
  return (
    <div
      className={`qz-wager${allIn ? ' qz-wager-allin' : ''}`}
      style={{ ['--pulse' as string]: `${pulsePeriodMs(value)}ms` }}
      data-pulse={reduced ? 'off' : 'on'}
    >
      <div role="radiogroup" aria-label="Confidence wager" className="qz-wager-chips">
        {WAGER_LEVELS.map((w) => (
          <button
            key={w.mult}
            type="button"
            role="radio"
            aria-checked={value === w.mult}
            disabled={locked || wagerForTier(stake, w.mult) > maxWager}
            className="qz-chip qz-wager-chip"
            onClick={() => onChange(w.mult)}
          >
            {w.label}
          </button>
        ))}
      </div>
      <p className="qz-wager-math" aria-live="polite">
        {locked ? 'Wager locked after a tab switch.' : <>Win: <strong>{`+${math.win}`}</strong> | Loss: <strong>{`${math.loss}`}</strong> <span className="qz-sr">({level.label})</span></>}
      </p>
    </div>
  );
}

/** Shield segments fill as answers come in. Three fills burst the shield. A deflected miss shatters it into 14 shards. */
export function ShieldRing({ shield, burst, deflect }: { shield: number; burst: boolean; deflect: boolean }) {
  const { reduced } = useQuizMotion();
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!deflect) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- replay the shatter for each deflected miss
    setKey((k) => k + 1);
    return undefined;
  }, [deflect]);
  const segs = [0, 1, 2];
  return (
    <div className="qz-shield" data-burst={burst && !reduced ? 'on' : 'off'} aria-label={`Streak shield ${shield} of 3`} role="img">
      <svg viewBox="-30 -30 60 60" width="44" height="44" aria-hidden="true">
        {segs.map((i) => (
          <path key={i} className={`qz-shield-seg${i < shield ? ' filled' : ''}`} d={segPath(i)} style={{ animationDelay: reduced ? '0ms' : `${i * 120}ms` }} />
        ))}
      </svg>
      {deflect && (
        <svg key={key} className="qz-shatter" viewBox="-40 -40 80 80" width="80" height="80" aria-hidden="true">
          {shards().map((d, i) => (
            <polygon key={i} points={d.points} style={{ ['--dx' as string]: `${d.dx}px`, ['--dy' as string]: `${d.dy}px` }} />
          ))}
        </svg>
      )}
    </div>
  );
}

/** One of three hexagon segments, each a 120-degree sector of a ring. */
function segPath(i: number): string {
  const a0 = (i * 120 - 90) * (Math.PI / 180);
  const a1 = ((i + 1) * 120 - 90) * (Math.PI / 180);
  const r = 26, ri = 14;
  const p = (a: number, rad: number) => `${(Math.cos(a) * rad).toFixed(2)} ${(Math.sin(a) * rad).toFixed(2)}`;
  return `M ${p(a0, ri)} L ${p(a0, r)} A ${r} ${r} 0 0 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 0 0 ${p(a0, ri)} Z`;
}

/** 14 triangular shards that fly outward. Deterministic, so the shatter looks the same every time. */
function shards(): { points: string; dx: number; dy: number }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const cx = Math.cos(a) * 18, cy = Math.sin(a) * 18;
    const s = 5 + (i % 3);
    const pts = [[cx, cy], [cx + Math.cos(a + 0.5) * s, cy + Math.sin(a + 0.5) * s], [cx + Math.cos(a - 0.5) * s, cy + Math.sin(a - 0.5) * s]];
    return { points: pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' '), dx: Math.cos(a) * 36, dy: Math.sin(a) * 36 };
  });
}

type ArenaProps = {
  stake: number;
  shield: number;
  wagerLocked: boolean;
  maxWager: number;
  wager: WagerMult;
  onWager: (m: WagerMult) => void;
  forged: 'none' | 'forged' | 'absorbed';
};

/** Wager dial and shield ring together, for the player's question screen. */
export default function WagerStreakArena({ stake, shield, wagerLocked, maxWager, wager, onWager, forged }: ArenaProps) {
  return (
    <div className="qz-arena-hud">
      <WagerDial stake={stake} value={wager} locked={wagerLocked} maxWager={maxWager} onChange={onWager} />
      <ShieldRing shield={shield} burst={forged === 'forged'} deflect={forged === 'absorbed'} />
      {forged === 'forged' && <p className="qz-forge-banner" role="status">STREAK SHIELD FORGED!</p>}
    </div>
  );
}
