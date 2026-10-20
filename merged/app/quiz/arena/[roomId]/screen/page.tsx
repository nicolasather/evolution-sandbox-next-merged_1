import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import ArenaScreen from '@/components/quiz/arena/ArenaScreen';
import '../../arena.css';
export const metadata: Metadata = { title: 'Arena Clash · projector', referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <ArenaScreen roomId={roomId} />;
}
