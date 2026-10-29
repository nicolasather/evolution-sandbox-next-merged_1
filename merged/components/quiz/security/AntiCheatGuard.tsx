'use client';
/** Anti-cheat pieces for live rounds: a hidden honeypot, a focus-loss curtain with strikes, and the moderator drawer.
 *  The rules live in lib/quiz/anti-cheat.ts. Everything here reports to the teacher; nothing here grades an answer. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FOCUS_COOLDOWN_MS, HONEYPOT_TEXT, avgSpeedMs, focusPct, isTrapFlag, strikeFor,
  type Moderation, type Telemetry,
} from '@/lib/quiz/anti-cheat';

/** A zero-size element a person never sees or hears (aria-hidden, off-screen). Only a script or an AI agent that reads the DOM would click it. */
export function Honeypot({ shownAt, onTrap }: { shownAt: number; onTrap: (fast: boolean) => void }) {
  return (
    <span
      aria-hidden="true"
      data-trap="honeypot"
      tabIndex={-1}
      onClick={() => onTrap(isTrapFlag(Date.now() - shownAt))}
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'auto', clipPath: 'inset(50%)' }}
    >
      {HONEYPOT_TEXT}
    </span>
  );
}

/** Counts departures from the round (tab switch, split screen, another window). Shows a curtain at once and keeps it for the re-entry cooldown. */
export function useFocusGuard(enabled: boolean, onLeave?: (strikes: number) => void) {
  const [away, setAway] = useState(false);
  const [curtain, setCurtain] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const awayRef = useRef(false);
  const strikeRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = useRef(onLeave);
  useEffect(() => { leaveRef.current = onLeave; }, [onLeave]);

  const leave = useCallback(() => {
    if (awayRef.current) return;
    awayRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    setAway(true);
    setCurtain(true);
    strikeRef.current += 1;
    setStrikes(strikeRef.current);
    leaveRef.current?.(strikeRef.current);
  }, []);

  const back = useCallback(() => {
    if (!awayRef.current) return;
    awayRef.current = false;
    setAway(false);
    timer.current = setTimeout(() => setCurtain(false), FOCUS_COOLDOWN_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onVis = () => (document.hidden ? leave() : back());
    const onBlur = () => leave();
    const onFocus = () => { if (!document.hidden) back(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, leave, back]);

  return { curtain: curtain || away, strikes, strike: strikeFor(strikes), away };
}

export function FocusCurtain({ strikes }: { strikes: number }) {
  const s = strikeFor(strikes);
  return (
    <div className="qz-curtain" role="alertdialog" aria-modal="true" aria-label="Focus lost">
      <div>
        <p>Focus lost. Return to the quiz window.</p>
        {s.label && <small>{s.label}</small>}
      </div>
    </div>
  );
}

export type ModeratorPlayer = { id: string; name: string; telemetry: Telemetry; moderation: Moderation };

type DrawerProps = {
  players: ModeratorPlayer[];
  open: boolean;
  onClose: () => void;
  onAction: (playerId: string, action: 'warn' | 'freeze' | 'reset' | 'kick' | 'shadow', on?: boolean) => void;
};

/** Live telemetry and one-click moderation for each player. Shadow-mute hides a player from the classroom screen only. */
export default function ModeratorDrawer({ players, open, onClose, onAction }: DrawerProps) {
  if (!open) return null;
  return (
    <aside className="qz-mod-drawer" aria-label="Moderator console">
      <header>
        <strong>Moderator console</strong>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </header>
      <ul>
        {players.map((p) => {
          const avg = avgSpeedMs(p.telemetry);
          const trapText = p.telemetry.trap === 'flagged' ? 'Flagged' : p.telemetry.trap === 'clean' ? 'Clean' : 'Untested';
          return (
            <li key={p.id} className="qz-mod-row" data-flagged={p.telemetry.trap === 'flagged' ? 'true' : undefined}>
              <div className="qz-mod-stats">
                <strong>{p.name}</strong>
                <span>Focus {focusPct(p.telemetry)}%</span>
                <span>Tab switches {p.telemetry.tabSwitches}</span>
                <span>Avg speed {avg === null ? '–' : `${(avg / 1000).toFixed(1)}s`}</span>
                <span>AI trap {trapText}</span>
                {p.moderation.frozen && <span>Score frozen</span>}
                {p.moderation.shadowMuted && <span>Shadow-muted</span>}
              </div>
              <div className="qz-mod-actions">
                <button type="button" className="qz-chip" onClick={() => onAction(p.id, 'warn')}>Warn</button>
                <button type="button" className="qz-chip" aria-pressed={p.moderation.frozen} onClick={() => onAction(p.id, 'freeze', !p.moderation.frozen)}>Freeze Score</button>
                <button type="button" className="qz-chip" onClick={() => onAction(p.id, 'reset')}>Reset Question</button>
                <button type="button" className="qz-chip" onClick={() => onAction(p.id, 'kick')}>Kick</button>
                <button type="button" className="qz-chip" aria-pressed={p.moderation.shadowMuted} onClick={() => onAction(p.id, 'shadow', !p.moderation.shadowMuted)}>Shadow-Mute (Ghost Mode)</button>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
