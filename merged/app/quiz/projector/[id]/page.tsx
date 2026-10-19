import type { Metadata } from 'next';
import HostConsole from '@/components/quiz/HostConsole';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
export const metadata: Metadata = { title: 'Projector view' };

/** A separate window for the classroom screen. It shows the question, the scores and the join code — never the answer key or any host control. */
export default async function Projector({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`/quiz/projector/${id}`);
  return <HostConsole roomId={id} projectorOnly />;
}
