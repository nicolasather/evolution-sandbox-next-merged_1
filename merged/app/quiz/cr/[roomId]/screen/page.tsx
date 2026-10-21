import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import CRScreen from '@/components/quiz/cr/CRScreen';
import '../../cr.css';
export const metadata: Metadata = { title: 'Clue Racing · projector', referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <CRScreen roomId={roomId} />;
}
