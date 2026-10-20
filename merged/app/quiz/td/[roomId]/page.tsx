import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import TDPlayer from '@/components/quiz/td/TDPlayer';
import '../td.css';
export const metadata: Metadata = { title: 'Tower Defense' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <TDPlayer roomId={roomId} />;
}
