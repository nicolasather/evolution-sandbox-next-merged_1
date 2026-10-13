export interface Item { id: string; name: string; era: string; recipes: string[][] }
export interface Mission {
  id: string; chapter: string; title: string; briefing: string;
  start: string; target: string; via: string[]; blocked: string[];
  direction: 'both' | 'forward'; optimal: number;
}
export interface Content {
  version: string; source: { commit: string; dataHash: string; note: string };
  defaults: { showNames: boolean; motion: boolean; textScale: number };
  limits: { maxWaypoints: number; maxPath: number; maxSaveBytes: number; minScale: number; maxScale: number; scaleStep: number };
  chapters: { id: string; title: string; lesson: string }[];
  items: Item[]; missions: Mission[];
}
export interface Run { missionId: string; path: string[]; assisted: boolean }
export interface RecordEntry { missionId: string; path: string[]; assisted: boolean }
export interface Save {
  version: 1; contentVersion: string; run: Run | null;
  records: RecordEntry[]; settings: Content['defaults'];
}
export interface Graph { items: Map<string, Item>; forward: Map<string, string[]>; both: Map<string, string[]> }
