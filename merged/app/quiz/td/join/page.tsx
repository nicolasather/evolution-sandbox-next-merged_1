import type { Metadata } from 'next';
import TDJoin from '@/components/quiz/td/TDJoin';
import '../td.css';
export const metadata: Metadata = { title: 'Join Tower Defense' };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <TDJoin initialCode={(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} />;
}
