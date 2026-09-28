import type { MuseumExhibit } from '../museum/types';
import type { EpisodeState, EscapeMemory, EscapeRoomEpisode } from './types';

/* ============================================================================
   EPISODE MEMORY — what a finished escape room leaves behind. Unlike
   every other mode, this content is authored, not procedural — so its
   Museum exhibit is a real record of the player's own reconstructed
   history, not a fictional-run summary; still tagged honestly by
   provenance, since the escape room framing (a sealed workshop, an
   unbroken door) is itself fictional staging, not literal fact.
   ========================================================================== */

export function summarizeEpisode(episode: EscapeRoomEpisode, state: EpisodeState): EscapeMemory {
  const totalAttempts = Object.values(state.attempts).reduce((a, b) => a + b, 0);
  const hintsUsed = Object.values(state.hintsRevealed).filter(Boolean).length;
  const headline = hintsUsed === 0
    ? `Reconstructed ${episode.title} from first principles — no hints needed, ${totalAttempts} attempts in total.`
    : `Reconstructed ${episode.title} with ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}, ${totalAttempts} attempts in total.`;
  return {
    id: `esc-${episode.id}-${Date.now()}`,
    episodeId: episode.id,
    totalAttempts,
    hintsUsed,
    headline,
    completedAt: Date.now(),
  };
}

export function episodeExhibit(memory: EscapeMemory, episodeTitle: string): MuseumExhibit {
  return {
    id: `escaperoom:${memory.id}`,
    title: `Escape Room — ${episodeTitle}, reopened`,
    provenance: {
      kind: 'reference-reconstruction',
      note: memory.headline,
    },
    sourceMode: 'escape-room',
    layout: 'exploded-mechanism',
    createdAt: memory.completedAt,
    tags: [memory.hintsUsed === 0 ? 'no hints' : `${memory.hintsUsed} hints`, `${memory.totalAttempts} attempts`],
  };
}
