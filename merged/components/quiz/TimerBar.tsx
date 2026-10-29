'use client';
/** Question countdown bar: calm cyan above half, focused amber to 20%, critical crimson below, a heartbeat pulse in the last 5 seconds, and a spark on the leading edge. */
import { useQuizMotion } from './useQuizMotion';

export function timerZone(fraction: number): { color: string; name: 'calm' | 'focused' | 'critical' } {
  if (fraction > 0.5) return { color: '#22d3ee', name: 'calm' };
  if (fraction > 0.2) return { color: '#f59e0b', name: 'focused' };
  return { color: '#f43f5e', name: 'critical' };
}

export default function TimerBar({ seconds, limit }: { seconds: number; limit: number }) {
  const { reduced } = useQuizMotion();
  const fraction = Math.max(0, Math.min(1, limit > 0 ? seconds / limit : 0));
  const zone = timerZone(fraction);
  const heartbeat = seconds <= 5 && seconds > 0 && !reduced;
  return (
    <div className="qz-timer" aria-hidden="true">
      <div className={`qz-timer-track${heartbeat ? ' qz-heartbeat' : ''}`}>
        <div className="qz-timer-fill" data-zone={zone.name} style={{ transform: `scaleX(${fraction})`, background: zone.color }} />
        {!reduced && fraction > 0 && <span className="qz-spark" style={{ transform: `translateX(${fraction * 100}%)`, background: zone.color }} />}
      </div>
    </div>
  );
}
