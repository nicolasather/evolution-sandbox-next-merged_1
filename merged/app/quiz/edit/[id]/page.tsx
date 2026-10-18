import { redirect } from 'next/navigation';
import { creatorHref } from '@/lib/quiz/creator-steps';

/** Existing quizzes and device drafts open in the routed creator, which loads them by id (owner-checked by the API). */
export default async function EditQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(creatorHref('details', id));
}
