'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SwarmGame from './SwarmGame';
import { useSwarm } from './useSwarm';
import { usePrefs } from './prefs';
import { wsUrlOf } from '@/lib/swarm/client/urls';

export const seatKey = (roomId: string) => `swarm:seat:${roomId}`;
export type Seat = { token: string; workerUrl: string; name: string; code: string };
export function readSeat(roomId: string): Seat | null { try { return JSON.parse(localStorage.getItem(seatKey(roomId)) ?? 'null') as Seat | null; } catch { return null; } }

/** An online match as a student: the seat (a signed token from joining) lives in this browser; reloading or losing the connection resumes the same avatar. */
export default function SwarmPlayer({ roomId }: { roomId: string }) {
  const [seat, setSeat] = useState<Seat | null | undefined>(undefined); const [prefs, setPrefs] = usePrefs();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSeat(readSeat(roomId)); }, [roomId]);
  const opts = useMemo(() => (seat ? { wsUrl: wsUrlOf(seat.workerUrl), token: seat.token, view: 'play' as const } : null), [seat]);
  const { conn } = useSwarm(opts, seat?.token ?? 'none'); void conn;
  if (seat === undefined) return <main className="sw" id="main"><section className="sw-card" role="status"><h2>Loading…</h2></section></main>;
  if (!seat) return <main className="sw" id="main"><section className="sw-card"><h1>Join this match first</h1><p>This browser does not have a seat in the match. Enter the code your teacher shows.</p><Link className="sw-btn primary" href="/quiz/swarm/join">Join with a code</Link></section></main>;
  if (!conn) return <main className="sw" id="main"><section className="sw-card" role="status"><h2>Connecting…</h2></section></main>;
  return <SwarmGame conn={conn} prefs={prefs} setPrefs={setPrefs} roomId={roomId} token={seat.token} />;
}
