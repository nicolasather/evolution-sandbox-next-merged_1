import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import ProjectorSetup from '@/components/quiz/projector/ProjectorSetup';
import { maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { quizConfigured } from '@/lib/quiz/config';
export const metadata: Metadata = { title: 'Projector game setup' };

export default async function GameSetupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ game?: string }> }) {
  const { id } = await params; const { game } = await searchParams;
  if (!quizConfigured() || !z.string().uuid().safeParse(id).success) notFound();
  const { data: quiz } = await serviceDB().from('quizzes').select('title,status,owner_id,quiz_questions(count)').eq('id', id).maybeSingle();
  const user = await maybeUser();
  if (!quiz || (quiz.status !== 'published' && quiz.owner_id !== user?.id)) notFound();
  const count = (quiz.quiz_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
  return <ProjectorSetup quizId={id} quizTitle={quiz.title} questionCount={count} signedIn={!!user} initialGame={game ?? null} />;
}
