import type { Metadata } from 'next';
import ArenaJoin from '@/components/quiz/arena/ArenaJoin';
import '../arena.css';
export const metadata: Metadata = { title: 'Join Arena Clash' };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <ArenaJoin initialCode={(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} />;
}
