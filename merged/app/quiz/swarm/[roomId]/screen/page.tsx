import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import SwarmScreen from '@/components/quiz/swarm/SwarmScreen';
import '../../swarm.css';
export const metadata: Metadata = { title: 'Swarm Survival — projector' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params; if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <SwarmScreen roomId={roomId} />;
}
