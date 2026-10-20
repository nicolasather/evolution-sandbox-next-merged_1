import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import TDHost from '@/components/quiz/td/TDHost';
import '../../td.css';
export const metadata: Metadata = { title: 'Tower Defense · teacher console' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <TDHost roomId={roomId} />;
}
