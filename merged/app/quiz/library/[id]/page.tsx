import type { Metadata } from 'next';
import QuizDetail from '@/components/quiz/QuizDetail';
export const metadata: Metadata = { title: 'Quiz details' };
export default async function Details({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizDetail id={id} />;
}
