import type { Db, Discovery } from '@/lib/types';
import { materialOf } from '@/lib/craft/materials';
import { compile } from '@/lib/processing/overlay';
import { tagsOf } from '@/lib/processing/tags';
import type { Processing, ProcessingData } from '@/lib/processing/types';
import { buildRecipeIndex, type RecipeIndex } from '@/lib/content/strictCraft';

/* The server-side, read-only view of the game's truth: derived from the same `playDb` the Engine plays, never
   from the client. Nothing here is written to. (Tickets 072–074.) */

export type TruthStatus = 'verified' | 'pending' | 'placeholder' | 'state';

export const FAMILY_OF_MATERIAL: Record<string, string> = {
  stone: 'stone', wood: 'wood', bone: 'bone', fibre: 'fibre', metal: 'metal', earth: 'earth', glass: 'glass',
  liquid: 'liquid', fire: 'flame', tool: 'made', structure: 'made', machine: 'made', energy: 'abstract',
  signal: 'abstract', idea: 'abstract', life: 'living',
};

export interface Profile {
  id: string;
  family: string;
  tags: ReadonlySet<string>;
  capabilities: ReadonlySet<string>;
  era: string;
  eraRank: number;
  status: TruthStatus;
  isNode: boolean;
}

export interface CreativeCatalog {
  db: Db;
  proc: Processing;
  profiles: ReadonlyMap<string, Profile>;
  nodes: ReadonlyMap<string, Discovery>;
  recipeIndex: RecipeIndex;
  eraRank(era: string): number;
}

const isPlaceholder = (n: Discovery) => (n.caution ?? '').toLowerCase().includes('placeholder');
const hasRealSource = (n: Discovery) => (n.src ?? []).some(s => s && s !== 'source_required');

export function truthStatusOf(n: Discovery): TruthStatus {
  if (isPlaceholder(n)) return 'placeholder';
  return hasRealSource(n) ? 'verified' : 'pending';
}

export function buildCatalog(db: Db, data: ProcessingData): CreativeCatalog {
  const proc = compile(data);
  const eraIdx = new Map(db.eras.map((e, i) => [e.id as string, i]));
  const eraRank = (era: string) => eraIdx.get(era) ?? 0;
  const caps = (id: string) => new Set(Object.entries(proc.capSet).filter(([, s]) => s.has(id)).map(([c]) => c));
  const profiles = new Map<string, Profile>();
  const nodes = new Map<string, Discovery>();
  for (const n of db.nodes) {
    nodes.set(n.id, n);
    profiles.set(n.id, {
      id: n.id, family: FAMILY_OF_MATERIAL[materialOf(n)] ?? 'abstract', tags: tagsOf(proc, n), capabilities: caps(n.id),
      era: n.era, eraRank: eraRank(n.era), status: truthStatusOf(n), isNode: true,
    });
  }
  for (const s of db.states ?? []) {
    const like = { id: s.id, cat: s.cat ?? 'material', era: s.era } as Pick<Discovery, 'id' | 'cat' | 'era'>;
    profiles.set(s.id, {
      id: s.id, family: FAMILY_OF_MATERIAL[materialOf(like)] ?? 'abstract', tags: tagsOf(proc, like), capabilities: caps(s.id),
      era: s.era, eraRank: eraRank(s.era), status: 'state', isNode: false,
    });
  }
  return { db, proc, profiles, nodes, recipeIndex: buildRecipeIndex(db), eraRank };
}
