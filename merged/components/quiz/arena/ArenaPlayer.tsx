'use client';
import ArenaGame from './ArenaGame';
import { usePrefs } from './prefs';
import { useArenaRemote } from './useArena';
/** A student's device in a real match. */
export default function ArenaPlayer({ roomId }: { roomId: string }) { const [, , reduced] = usePrefs(); return <ArenaGame client={useArenaRemote(roomId, 'student', { reduced })} />; }
