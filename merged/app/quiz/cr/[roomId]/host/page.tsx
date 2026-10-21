import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import CRHost from '@/components/quiz/cr/CRHost';
import '../../cr.css';
export const metadata: Metadata = { title: 'Clue Racing · teacher console' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <CRHost roomId={roomId} />;
}
