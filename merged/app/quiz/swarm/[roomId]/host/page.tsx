import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import SwarmHost from '@/components/quiz/swarm/SwarmHost';
import '../../swarm.css';
export const metadata: Metadata = { title: 'Swarm Survival — teacher' };
export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params; if (!z.string().uuid().safeParse(roomId).success) notFound();
  return <SwarmHost roomId={roomId} />;
}
