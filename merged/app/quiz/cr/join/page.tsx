import type { Metadata } from 'next';
import CRJoin from '@/components/quiz/cr/CRJoin';
import '../cr.css';
export const metadata: Metadata = { title: 'Join Clue Racing' };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <CRJoin initialCode={(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} />;
}
