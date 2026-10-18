import type { Metadata } from 'next';
import QuizList from '@/components/quiz/QuizList';
import type { PlayMode } from '@/lib/quiz/types';
export const metadata: Metadata = { title: 'Quiz Library' };

export default async function Library({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const m = mode === 'solo' || mode === 'classroom' || mode === 'online' ? (mode as PlayMode) : null;
  return <QuizList mine={false} mode={m} />;
}
