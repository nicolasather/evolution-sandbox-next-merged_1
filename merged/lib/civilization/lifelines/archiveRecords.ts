import type { MuseumExhibit } from '../../museum/types';
import { hubSummaryVersion, subscribeHubSummary } from './hubSummary';
import { CAMPAIGN_KEY } from './schema';

/* ============================================================================
   LIFELINES -> MUSEUM RECORDS. Archived attempts appear in the Mode Archive
   (the player's own records), always labelled procedural-fiction with their
   seed. They are never humanity-history exhibits and never claim a real place
   or date. Reads the campaign manifest directly: no content import.
   ========================================================================== */

/** Same {subscribe, getVersion} shape the other mode stores expose to the archive wing. */
export const lifelinesArchiveStore = { subscribe: subscribeHubSummary, getVersion: hubSummaryVersion };

interface RawArchive { runId?: unknown; chapterTitle?: unknown; headline?: unknown; seed?: unknown; archivedAt?: unknown; mode?: unknown; completed?: unknown; turn?: unknown }

export function lifelinesRecords(raw?: string | null): MuseumExhibit[] {
  let text = raw;
  if (text === undefined) {
    try { text = typeof window === 'undefined' ? null : window.localStorage.getItem(CAMPAIGN_KEY); } catch { text = null; }
  }
  if (!text) return [];
  try {
    const m = JSON.parse(text) as { archives?: RawArchive[] };
    if (!Array.isArray(m.archives)) return [];
    return m.archives
      .filter(a => typeof a.runId === 'string' && typeof a.chapterTitle === 'string' && typeof a.headline === 'string')
      .map(a => ({
        id: `civilization-lifelines:${a.runId as string}`,
        title: `Lifelines — ${a.chapterTitle as string}`,
        provenance: { kind: 'procedural-fictional' as const, note: `${a.headline as string} A generated settlement, not a historical record.`, seed: typeof a.seed === 'string' ? a.seed : undefined },
        sourceMode: 'civilization',
        layout: 'diorama' as const,
        createdAt: typeof a.archivedAt === 'number' ? a.archivedAt : 0,
        tags: [a.mode === 'sandbox' ? 'sandbox' : 'campaign', a.completed === true ? 'goals met' : 'tended', typeof a.turn === 'number' ? `${a.turn} seasons` : 'seasons'],
      }));
  } catch { return []; }
}
