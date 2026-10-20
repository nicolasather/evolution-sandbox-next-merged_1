'use client';
import { useEffect, useRef, useState } from 'react';
import { SwarmConnection, type ConnOpts } from '@/lib/swarm/client/connection';

/** Owns one connection for the lifetime of the page. `key` changes recreate it. State changes re-render at most once per snapshot. */
export function useSwarm(opts: ConnOpts | null, key: string): { conn: SwarmConnection | null; tick: number } {
  const [tick, setTick] = useState(0); const ref = useRef<SwarmConnection | null>(null); const [conn, setConn] = useState<SwarmConnection | null>(null);
  useEffect(() => {
    if (!opts) return; const c = new SwarmConnection(opts); ref.current = c;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConn(c);
    let raf = 0, last = -1; const un = c.subscribe(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (c.version !== last) { last = c.version; setTick((n) => n + 1); } }); });
    c.start(); return () => { un(); if (raf) cancelAnimationFrame(raf); c.stop(); ref.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { conn, tick };
}
