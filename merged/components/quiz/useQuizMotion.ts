'use client';
/** Quiz Studio motion and feedback preferences, shared by every quiz view.
 *  Motion follows the OS "reduce motion" setting unless the player overrides it in the dock. */
import { useCallback, useEffect, useState } from 'react';

export const MOTION_KEY = 'qz:motion';
export const HAPTICS_KEY = 'qz:haptics';

function readFlag(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? null : v === '1';
  } catch {
    return null; // private mode or blocked storage: fall back to the system setting
  }
}

function writeFlag(key: string, on: boolean) {
  try { window.localStorage.setItem(key, on ? '1' : '0'); } catch { /* storage blocked: the choice lasts for this page only */ }
}

export function readHaptics(): boolean {
  return readFlag(HAPTICS_KEY) === true;
}

export function writeHaptics(on: boolean) {
  writeFlag(HAPTICS_KEY, on);
}

/** A short vibration for correct/wrong feedback. Silent unless the player turned haptics on. */
export function buzz(ms: number) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (!readHaptics()) return;
  try { navigator.vibrate(ms); } catch { /* unsupported */ }
}

/** Motion state for Quiz Studio: follows the OS "reduce motion" setting unless the player chooses otherwise on the Settings page. */
export function useQuizMotion(): { reduced: boolean; setReduced: (on: boolean) => void } {
  const [system, setSystem] = useState(false);
  const [override, setOverride] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the system and stored preference once on mount
    setSystem(!!mq?.matches);
    setOverride(readFlag(MOTION_KEY));
    if (!mq) return undefined;
    const onChange = () => setSystem(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const setReduced = useCallback((on: boolean) => {
    writeFlag(MOTION_KEY, on);
    setOverride(on);
  }, []);
  const reduced = override ?? system;
  useEffect(() => {
    // CSS calms every quiz animation off this attribute, wherever the player is in Quiz Studio
    document.documentElement.dataset.qzMotion = reduced ? 'reduce' : 'auto';
  }, [reduced]);
  return { reduced, setReduced };
}
