'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drift-free countdown. Stores an absolute `deadlineMs` and recomputes `remaining = max(0, deadline - Date.now())` on a
 * 100 ms ticker, so a throttled or frozen background tab can never leave the clock behind. A `visibilitychange` listener
 * snaps the display the moment the tab is visible again. Pausing shifts the deadline forward by the exact paused time.
 */
export function useDeadlineTimer() {
  const [remainingMs, setRemainingMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const deadline = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  const running = useRef(false);
  const onExpire = useRef<(() => void) | null>(null);
  const timerId = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    if (!running.current || pausedAt.current !== null) return;
    const rem = Math.max(0, deadline.current - Date.now());
    setRemainingMs(rem);
    if (rem === 0) { running.current = false; const cb = onExpire.current; onExpire.current = null; cb?.(); }
  }, []);

  useEffect(() => {
    timerId.current = setInterval(tick, 100);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      if (timerId.current) clearInterval(timerId.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [tick]);

  /** Starts (or restarts) a countdown of `durationMs`. */
  const start = useCallback((durationMs: number, expire: () => void) => {
    deadline.current = Date.now() + durationMs; pausedAt.current = null; running.current = true; onExpire.current = expire;
    setPaused(false); setRemainingMs(durationMs);
  }, []);
  const stop = useCallback(() => { running.current = false; onExpire.current = null; pausedAt.current = null; setPaused(false); }, []);
  const pause = useCallback(() => { if (running.current && pausedAt.current === null) { pausedAt.current = Date.now(); setPaused(true); } }, []);
  const resume = useCallback(() => {
    if (pausedAt.current === null) return;
    const gap = Date.now() - pausedAt.current;
    deadline.current += gap; pausedTotal.current += gap; pausedAt.current = null; setPaused(false); tick();
  }, [tick]);
  /** Total milliseconds spent paused since mount (including a pause still in progress). */
  const pausedMs = useCallback(() => pausedTotal.current + (pausedAt.current !== null ? Date.now() - pausedAt.current : 0), []);
  return { remainingMs, paused, start, stop, pause, resume, pausedMs };
}
