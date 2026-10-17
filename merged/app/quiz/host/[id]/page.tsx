import type { Metadata } from 'next';
import HostConsole from '@/components/quiz/HostConsole';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
export const metadata: Metadata = { title: 'Host a game' };
export default async function Host({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`/quiz/host/${id}`);
  return <HostConsole roomId={id} />;
}
