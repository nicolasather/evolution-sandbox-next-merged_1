import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import CRPlayer from '@/components/quiz/cr/CRPlayer';
import '../cr.css';
export const metadata: Metadata = { title: 'Clue Racing' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <CRPlayer roomId={roomId} />;
}
