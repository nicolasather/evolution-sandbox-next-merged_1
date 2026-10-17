import type { Metadata } from 'next';
import PlayerRoom from '@/components/quiz/PlayerRoom';
export const metadata: Metadata = { title: 'Play' };
export default async function Play({ params }: { params: Promise<{ id: string }> }) {
  return <PlayerRoom roomId={(await params).id} />;
}
