import type { Metadata } from 'next';
import QuizEditor from '@/components/quiz/QuizEditor';
import { quizConfigured } from '@/lib/quiz/config';
export const metadata: Metadata = { title: 'Create a Quiz' };

/** No sign-in gate: the editor opens immediately. Drafts live on this device (and, when the quiz service is available,
 *  in a silent guest session). See lib/quiz/local-drafts.ts and lib/quiz/session-client.ts. */
export default function NewQuiz() {
  return <QuizEditor cloudConfigured={quizConfigured()} />;
}
