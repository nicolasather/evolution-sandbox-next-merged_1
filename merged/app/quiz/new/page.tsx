import type { Metadata } from 'next';
import QuizEditor from '@/components/quiz/QuizEditor';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
export const metadata: Metadata = { title: 'Create a quiz' };
export default async function NewQuiz() {
  await requireUserOrRedirect('/quiz/new');
  return <QuizEditor />;
}
