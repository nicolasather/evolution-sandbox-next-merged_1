import type { Metadata } from 'next';
import ReportView from '@/components/quiz/ReportView';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
export const metadata: Metadata = { title: 'Session report' };
export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`/quiz/report/${id}`);
  return <ReportView roomId={id} />;
}
