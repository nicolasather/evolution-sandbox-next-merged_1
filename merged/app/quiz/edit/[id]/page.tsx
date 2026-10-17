import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import QuizEditor from '@/components/quiz/QuizEditor';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
import { serviceDB } from '@/lib/quiz/supabase';
import type { Question } from '@/lib/quiz/types';
export const metadata: Metadata = { title: 'Edit quiz' };

export default async function EditQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/quiz/edit/${id}`);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = serviceDB();
  // Owner filter in the query itself: another user's quiz is indistinguishable from a missing one.
  const { data: quiz } = await db.from('quizzes').select('id,title,description,status').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (!quiz) notFound();
  const { data: rows, error } = await db.from('quiz_questions').select('id,kind,prompt,payload,answer_key,base_points').eq('quiz_id', id).order('position');
  if (error) throw new Error('Could not load questions');
  const questions: Question[] = (rows ?? []).map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, payload: q.payload, answerKey: q.answer_key, basePoints: q.base_points }));
  return <QuizEditor initial={{ id: quiz.id, title: quiz.title, description: quiz.description, status: quiz.status, questions }} />;
}
