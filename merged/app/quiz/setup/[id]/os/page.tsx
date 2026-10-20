import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import OSSetup from '@/components/quiz/os/OSSetup';
import { maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { quizConfigured } from '@/lib/quiz/config';
import '../../../os/os.css';
export const metadata: Metadata = { title: 'Obstacle Survival setup' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!quizConfigured() || !z.string().uuid().safeParse(id).success) notFound();
  const { data: quiz } = await serviceDB().from('quizzes').select('title,status,owner_id,quiz_questions(count)').eq('id', id).maybeSingle();
  const user = await maybeUser();
  if (!quiz || (quiz.status !== 'published' && quiz.owner_id !== user?.id)) notFound();
  const count = (quiz.quiz_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
  return <OSSetup quizId={id} quizTitle={quiz.title} questionCount={count} signedIn={!!user} />;
}
