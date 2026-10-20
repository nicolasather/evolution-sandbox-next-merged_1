import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import ArenaPlayer from '@/components/quiz/arena/ArenaPlayer';
import '../arena.css';
export const metadata: Metadata = { title: 'Arena Clash' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <ArenaPlayer roomId={roomId} />;
}
