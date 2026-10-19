import type { Metadata } from 'next';
import HostConsole from '@/components/quiz/HostConsole';
import { ProjectorGame } from '@/components/quiz/projector/HostGame';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
import { serviceDB } from '@/lib/quiz/supabase';
export const metadata: Metadata = { title: 'Projector view' };

/** A separate window for the classroom screen. It shows the question, the scores and the join code — never the answer key or any host control. */
export default async function Projector({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`/quiz/projector/${id}`);
  const { data } = await serviceDB().from('rooms').select('config').eq('id', id).maybeSingle();
  return (data?.config as { projector?: unknown } | null)?.projector ? <ProjectorGame roomId={id} /> : <HostConsole roomId={id} projectorOnly />;
}
