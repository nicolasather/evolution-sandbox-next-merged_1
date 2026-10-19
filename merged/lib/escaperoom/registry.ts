import { BRONZE_WORKSHOP } from './episodes/bronzeWorkshop';
import generated from '@/data/expansion/escape_episodes.json';
import type { EscapeRoomEpisode } from './types';

/** One generated room per expansion topic (tools/expansion/gen_escape.py), built from the game's own recipes. */
export const GENERATED_EPISODES = generated as unknown as EscapeRoomEpisode[];

/** Every authored episode. One today; the schema in types.ts and the
 *  generic puzzle renderers in components/escaperoom/ are what make
 *  adding a second episode a data change, not a new UI. */
export const EPISODES: EscapeRoomEpisode[] = [BRONZE_WORKSHOP, ...GENERATED_EPISODES];

export function getEpisode(id: string): EscapeRoomEpisode | undefined {
  return EPISODES.find(e => e.id === id);
}

export const DEFAULT_EPISODE_ID = BRONZE_WORKSHOP.id;
