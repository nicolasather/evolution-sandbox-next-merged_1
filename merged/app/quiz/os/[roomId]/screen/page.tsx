import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import OSScreen from '@/components/quiz/os/OSScreen';
import '../../os.css';
export const metadata: Metadata = { title: 'Obstacle Survival · projector', referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <OSScreen roomId={roomId} />;
}
