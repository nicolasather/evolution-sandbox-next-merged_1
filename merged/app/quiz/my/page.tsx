import type { Metadata } from 'next';
import QuizList from '@/components/quiz/QuizList';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
export const metadata: Metadata = { title: 'My Quizzes' };
export default async function MyQuizzes() {
  await requireUserOrRedirect('/quiz/my');
  return <QuizList mine />;
}
