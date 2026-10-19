/* Typed views over the checked-in retention catalogues (data/retention/*.json). Static data only. */
import achievementsJson from '../../data/retention/achievements.json';
import shopJson from '../../data/retention/cosmetic-shop.json';
import dailyJson from '../../data/retention/daily-microgames.json';
import type { EraId } from '../types';
import type { CosmeticCategory } from './store';

export const ERA_ORDER: readonly EraId[] = [
  'origins', 'fire', 'settlement', 'agriculture', 'civilization', 'trade', 'metallurgy',
  'science', 'industry', 'electric', 'computing', 'network', 'games', 'simulation',
];
export const eraIndex = (e: string) => ERA_ORDER.indexOf(e as EraId);

export type AchievementTrigger =
  | 'unique_discovery' | 'era_reached' | 'unique_route_count' | 'museum_unique_exhibits'
  | 'daily_unique_dates_completed' | 'easter_unique_count' | 'npc_unique_encounters';

export interface AchievementDef {
  id: string; trigger: AchievementTrigger; threshold: number; target?: string;
  name: string; description: string; coins: number;
}
export const ACHIEVEMENTS: readonly AchievementDef[] = (achievementsJson as Array<Record<string, unknown>>).map(a => ({
  id: String(a.id), trigger: a.trigger as AchievementTrigger,
  threshold: typeof a.threshold === 'number' ? a.threshold : 1,
  target: typeof a.target === 'string' ? a.target : undefined,
  name: String(a.name), description: String(a.description), coins: Number(a.coins),
}));

export interface CosmeticDef {
  id: string; category: CosmeticCategory; name: string; cost: number;
  rarity: 'common' | 'uncommon' | 'rare'; motif: string; defaultUnlocked: boolean;
}
export const SHOP: readonly CosmeticDef[] = (shopJson as Array<Record<string, unknown>>).map(c => ({
  id: String(c.id), category: c.category as CosmeticCategory, name: String(c.name), cost: Number(c.cost),
  rarity: c.rarity as CosmeticDef['rarity'], motif: String(c.visualMotif), defaultUnlocked: c.defaultUnlocked === true,
}));
export const SHOP_BY_ID: Readonly<Record<string, CosmeticDef>> = Object.fromEntries(SHOP.map(c => [c.id, c]));
export const shopOf = (cat: CosmeticCategory) => SHOP.filter(c => c.category === cat);

export type DailyKind =
  | 'discover-new' | 'visit-museum' | 'new-route' | 'inspect-object' | 'try-technique'
  | 'study-history' | 'change-scene' | 'interact-physics' | 'inspect-npc' | 'solve-small-path';

export interface DailyDef { id: string; kind: DailyKind; name: string; description: string; target: number; coins: number }
export const DAILY: readonly DailyDef[] = (dailyJson as Array<Record<string, unknown>>).map(d => ({
  id: String(d.id), kind: d.kind as DailyKind, name: String(d.name), description: String(d.description),
  target: Number(d.progressTarget), coins: Number(d.coinReward),
}));
export const DAILY_BY_ID: Readonly<Record<string, DailyDef>> = Object.fromEntries(DAILY.map(d => [d.id, d]));
