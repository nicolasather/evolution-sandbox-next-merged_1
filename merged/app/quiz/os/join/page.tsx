import type { Metadata } from 'next';
import OSJoin from '@/components/quiz/os/OSJoin';
import '../os.css';
export const metadata: Metadata = { title: 'Join Obstacle Survival' };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <OSJoin initialCode={(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} />;
}
