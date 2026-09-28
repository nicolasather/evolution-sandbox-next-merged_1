import { BRONZE_WORKSHOP } from './episodes/bronzeWorkshop';
import type { EscapeRoomEpisode } from './types';

/** Every authored episode. One today; the schema in types.ts and the
 *  generic puzzle renderers in components/escaperoom/ are what make
 *  adding a second episode a data change, not a new UI. */
export const EPISODES: EscapeRoomEpisode[] = [BRONZE_WORKSHOP];

export function getEpisode(id: string): EscapeRoomEpisode | undefined {
  return EPISODES.find(e => e.id === id);
}

export const DEFAULT_EPISODE_ID = BRONZE_WORKSHOP.id;
