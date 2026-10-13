import raw from '@/data/minimumpath/atlas.v1.json';
import { buildGraph, shortest } from '@/lib/minimumpath/engine';
import type { Content } from '@/lib/minimumpath/types';
// JSON is shipped with this bundle, never accepted from a remote/user source.
const candidate = raw as Content;
export function validateContent(content: Content): void {
  const ids = new Set(content.items.map(item => item.id));
  const chapters = new Set(content.chapters.map(chapter => chapter.id));
  if (ids.size !== content.items.length || chapters.size !== content.chapters.length) throw new Error('Duplicate content IDs');
  if (!content.items.length || !content.missions.length || content.limits.maxWaypoints > 2) throw new Error('Invalid content limits');
  for (const item of content.items) for (const recipe of item.recipes) {
    if (!recipe.length || recipe.some(id => !ids.has(id))) throw new Error(`Invalid recipe: ${item.id}`);
  }
  const seen = new Set<string>();
  const graph = buildGraph(content);
  for (const mission of content.missions) {
    if (seen.has(mission.id) || !chapters.has(mission.chapter) || mission.via.length > content.limits.maxWaypoints ||
        new Set(mission.via).size !== mission.via.length || !['both', 'forward'].includes(mission.direction) ||
        [mission.start, mission.target, ...mission.via, ...mission.blocked].some(id => !ids.has(id)) ||
        [mission.start, mission.target, ...mission.via].some(id => mission.blocked.includes(id))) throw new Error(`Invalid mission: ${mission.id}`);
    seen.add(mission.id);
    const path = shortest(graph, mission);
    if (!path || path.length - 1 !== mission.optimal || path.length > content.limits.maxPath) throw new Error(`Unsolvable/mis-scored mission: ${mission.id}`);
  }
}
export const content: Content = candidate;
export const graph = buildGraph(content);
