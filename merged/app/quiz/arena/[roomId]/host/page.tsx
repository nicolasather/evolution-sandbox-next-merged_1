import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import ArenaHost from '@/components/quiz/arena/ArenaHost';
import '../../arena.css';
export const metadata: Metadata = { title: 'Arena Clash · teacher console' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <ArenaHost roomId={roomId} />;
}
