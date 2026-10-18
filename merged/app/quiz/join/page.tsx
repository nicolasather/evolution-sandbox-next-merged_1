import type { Metadata } from 'next';
import JoinForm from '@/components/quiz/JoinForm';
export const metadata: Metadata = { title: 'Join a Game' };
export default async function Join({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <main className="narrow" id="main"><JoinForm initialCode={(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} /></main>;
}
