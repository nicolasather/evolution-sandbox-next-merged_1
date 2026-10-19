import type { Metadata } from 'next';
import QuizList from '@/components/quiz/QuizList';
export const metadata: Metadata = { title: 'My Quizzes' };

/** No sign-in gate: device drafts show for anyone; online quizzes show when a session exists. */
export default function MyQuizzes() {
  return <QuizList mine />;
}
