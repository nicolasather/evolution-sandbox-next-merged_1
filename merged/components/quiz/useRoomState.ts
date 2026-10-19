'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/quiz/client';

export type RoomState = any;

/** Polls the server for room state. (Live updates every ~1.5 s; slower when the tab is hidden.) */
export function useRoomState(roomId: string, opts: { token?: string | null; host?: boolean; peek?: boolean; ready: boolean }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState(false);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!opts.ready) return;
    try {
      const headers: Record<string, string> = opts.token ? { 'x-player-token': opts.token } : {};
      const d = await api<RoomState>(`/api/quiz/rooms/${roomId}/state${opts.peek ? '?peek=1' : ''}`, { headers });
      if (!alive.current) return;
      offset.current = Date.parse(d.serverNow) - Date.now();
      setState(d); setError('');
    } catch (e) {
      if (!alive.current) return;
      setError((e as Error).message);
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) setFatal(true);
    }
  }, [roomId, opts.token, opts.peek, opts.ready]);

  useEffect(() => {
    alive.current = true;
    if (!opts.ready || fatal) return;
    const loop = async () => {
      await refresh();
      if (!alive.current) return;
      timer.current = setTimeout(loop, typeof document !== 'undefined' && document.hidden ? 5000 : 1500);
    };
    void loop();
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); };
  }, [refresh, opts.ready, fatal]);

  /** "Now" according to the server clock, frozen while the game is paused. */
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { state, error, fatal, refresh, serverNow };
}

export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
