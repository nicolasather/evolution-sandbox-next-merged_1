'use client';
import TDGame from './TDGame';
import { useTDRemote } from './useTD';
/** A student's device in a real match. */
export default function TDPlayer({ roomId }: { roomId: string }) {
  const client = useTDRemote(roomId, 'student');
  return <TDGame client={client} />;
}
