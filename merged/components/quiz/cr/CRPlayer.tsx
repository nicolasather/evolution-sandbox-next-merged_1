'use client';
import CRGame from './CRGame';
import { usePrefs } from './prefs';
import { useCRRemote } from './useCR';
/** A student's device in a real race. */
export default function CRPlayer({ roomId }: { roomId: string }) { const [, , reduced] = usePrefs(); return <CRGame client={useCRRemote(roomId, 'student', { reduced })} />; }
