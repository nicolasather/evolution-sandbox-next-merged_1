import type { ExhibitCategory, ExhibitImportance, RegionRole } from '@/lib/museum/history/types';
import type { PathComparison } from '@/lib/museum/personal';

/* Wording shared by every Museum screen — one place to tune the curator's voice. */

export const IMPORTANCE_LABEL: Record<ExhibitImportance, string> = {
  supporting: 'Supporting artefact',
  milestone: 'Important milestone',
  breakthrough: 'Major breakthrough',
  defining: 'Civilisation-defining achievement',
};

export const IMPORTANCE_WEIGHT: Record<ExhibitImportance, number> = { supporting: 0, milestone: 1, breakthrough: 2, defining: 3 };

export const ROLE_LABEL: Record<RegionRole, string> = {
  origin: 'origin',
  independent: 'independent origin',
  'early-centre': 'early centre',
  spread: 'spread to',
  site: 'key site',
};

export const CATEGORY_LABEL: Record<ExhibitCategory, string> = {
  'human-evolution': 'Human evolution', survival: 'Survival', agriculture: 'Agriculture', materials: 'Materials',
  architecture: 'Architecture', transportation: 'Transportation', communication: 'Communication', writing: 'Writing',
  mathematics: 'Mathematics', medicine: 'Medicine', engineering: 'Engineering', navigation: 'Navigation',
  governance: 'Governance', trade: 'Trade', energy: 'Energy', warfare: 'Warfare', manufacturing: 'Manufacturing',
  astronomy: 'Astronomy', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', computing: 'Computing',
  aviation: 'Aviation', space: 'Space', culture: 'Culture', knowledge: 'Knowledge systems',
};

/** Eleven category families, each with its own hue — the globe and the ledger colour by these. */
export const CATEGORY_HUE: Record<ExhibitCategory, number> = {
  'human-evolution': 28, survival: 18, agriculture: 88, materials: 36, architecture: 42, transportation: 196,
  communication: 172, writing: 48, mathematics: 214, medicine: 352, engineering: 30, navigation: 188,
  governance: 8, trade: 58, energy: 44, warfare: 0, manufacturing: 24, astronomy: 226, physics: 202,
  chemistry: 150, biology: 120, computing: 176, aviation: 204, space: 232, culture: 16, knowledge: 50,
};

export const categoryColor = (c: ExhibitCategory, l = 62) => `hsl(${CATEGORY_HUE[c]} 58% ${l}%)`;

export const UNCERTAINTY_LABEL = {
  settled: 'Well established',
  approximate: 'Approximate',
  debated: 'Debated',
  contested: 'Contested',
} as const;

export function comparisonLine(c: PathComparison): string {
  if (c === 'earlier') return 'Your path reached this earlier than humanity did.';
  if (c === 'later') return 'Your path reached this later than humanity did.';
  return 'Your path reached this at roughly the same point in history.';
}
