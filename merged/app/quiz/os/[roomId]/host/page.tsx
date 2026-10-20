import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import OSHost from '@/components/quiz/os/OSHost';
import '../../os.css';
export const metadata: Metadata = { title: 'Obstacle Survival · teacher console' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <OSHost roomId={roomId} />;
}
