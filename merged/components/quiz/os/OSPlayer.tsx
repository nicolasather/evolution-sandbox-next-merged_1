'use client';
import OSGame from './OSGame';
import { useOSRemote } from './useOS';
/** A student's device in a real match. */
export default function OSPlayer({ roomId }: { roomId: string }) { return <OSGame client={useOSRemote(roomId, 'student')} />; }
