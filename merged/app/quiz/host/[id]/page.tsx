import type { Metadata } from 'next';
import HostConsole from '@/components/quiz/HostConsole';
import { HostGame } from '@/components/quiz/projector/HostGame';
import { requireUserOrRedirect } from '@/lib/quiz/guard';
import { serviceDB } from '@/lib/quiz/supabase';
export const metadata: Metadata = { title: 'Host a game' };

/** Rooms created by the projector wizard carry config.projector and open the game console; everything else keeps the classic console. */
async function isProjectorRoom(id: string) {
  const { data } = await serviceDB().from('rooms').select('config').eq('id', id).maybeSingle();
  return !!(data?.config as { projector?: unknown } | null)?.projector;
}
export default async function Host({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`/quiz/host/${id}`);
  return (await isProjectorRoom(id)) ? <HostGame roomId={id} /> : <HostConsole roomId={id} />;
}
