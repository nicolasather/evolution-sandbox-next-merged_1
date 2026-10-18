import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import GameSetup from '@/components/quiz/GameSetup';
import { maybeUser, serviceDB } from '@/lib/quiz/supabase';
import { loadOneSettings } from '@/lib/quiz/settings-db';
import { quizConfigured } from '@/lib/quiz/config';
export const metadata: Metadata = { title: 'Game Settings' };

export default async function Setup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { id } = await params;
  const { mode } = await searchParams;
  const initialMode = mode === 'solo' || mode === 'classroom' || mode === 'online' ? mode : null;
  if (!quizConfigured() || !z.string().uuid().safeParse(id).success) notFound();
  const { data: quiz } = await serviceDB().from('quizzes').select('title,status,owner_id,quiz_questions(count)').eq('id', id).maybeSingle();
  const user = await maybeUser();
  if (!quiz || (quiz.status !== 'published' && quiz.owner_id !== user?.id)) notFound();
  const settings = await loadOneSettings(id);
  if (settings?.visibility === 'private' && quiz.owner_id !== user?.id) notFound();
  const count = (quiz.quiz_questions as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
  return <GameSetup quizId={id} quizTitle={quiz.title} questionCount={count} signedIn={!!user} initialMode={initialMode} settings={settings} />;
}
