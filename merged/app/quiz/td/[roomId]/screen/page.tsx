import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import TDScreen from '@/components/quiz/td/TDScreen';
import '../../td.css';
export const metadata: Metadata = { title: 'Tower Defense · projector', referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <TDScreen roomId={roomId} />;
}
