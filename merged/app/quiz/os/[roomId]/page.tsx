import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import OSPlayer from '@/components/quiz/os/OSPlayer';
import '../os.css';
export const metadata: Metadata = { title: 'Obstacle Survival' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <OSPlayer roomId={roomId} />;
}
