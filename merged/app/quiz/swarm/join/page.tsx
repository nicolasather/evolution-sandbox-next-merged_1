import type { Metadata } from 'next';
import SwarmJoin from '@/components/quiz/swarm/SwarmJoin';
import '../swarm.css';
export const metadata: Metadata = { title: 'Join Swarm Survival' };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <SwarmJoin initialCode={(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} />;
}
