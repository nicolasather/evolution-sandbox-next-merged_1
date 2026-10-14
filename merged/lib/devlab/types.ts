/* Visual Lab shared types (development only). */

export type ShapeFamily =
  | 'cluster' | 'elongated' | 'sheet' | 'sphere' | 'branching' | 'blade' | 'disc' | 'vessel' | 'solid' | 'frame'
  | 'arch' | 'tower' | 'portal' | 'dome' | 'lattice' | 'radial' | 'wheel' | 'coil' | 'crystal' | 'dish' | 'sphere-instrument';

export interface ResourceEntry {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  description: string;
  period: string;
  materials: string[];
  shapeFamily: string;
  features: string[];
  complexity: number;
  catalogueCheck: { presentInCatalogue: false; matchedAgainst: string };
}

export interface Dataset {
  version: number;
  purpose: string;
  catalogueNodeCount: number;
  catalogueDataHash: string;
  categories: { id: string; name: string }[];
  resources: ResourceEntry[];
}

export type GenStatus = 'ok' | 'failed';

export interface AttemptLog {
  n: number;
  ms: number;
  /** present when this attempt failed */
  error?: { kind: string; message: string; details?: string[] };
  promptTokens?: number;
  outputTokens?: number;
}

export interface AutoMetrics {
  /** every field here is MEASURED by code, none is a judgement */
  detail: { parts: number; layers: number; paths: number; segments: number; dots: number; componentKinds: number; weightsUsed: number };
  composition: { width: number; height: number; centreOffset: number; fill: number; margin: number; fitScale: number };
  rendering: { finite: boolean; outOfBoxFraction: number; markupBytes: number; warnings: number; markupSafe: boolean };
  uniqueness: { nearestId: string | null; nearestSimilarity: number | null };
  style: { distance: number; notes: string[] };
  performance: { compileMs: number };
}

export interface GenRecord {
  id: string;
  version: number;
  status: GenStatus;
  model: string;
  generatedAt: string;
  attempts: AttemptLog[];
  /** validated spec (only when status === 'ok') */
  spec?: unknown;
  validationWarnings?: string[];
  markup?: string;
  metrics?: AutoMetrics;
  /** the final failure when status === 'failed' */
  failure?: { kind: string; message: string; details?: string[] };
  /** the last raw model reply, kept for diagnosis (never executed) */
  lastRaw?: string;
  /** where the static preview was written, relative to dev-data/visual-lab */
  preview?: string;
  /** set when the entry came from a hand-authored fixture instead of the model */
  source: 'qwen' | 'fixture';
}

export type Decision = 'pending' | 'approved' | 'rejected';
export interface Review {
  decision: Decision;
  /** manual 1-5 scores — the ONLY place judgement lives */
  scores?: Partial<Record<'recognizability' | 'style' | 'detail' | 'uniqueness' | 'composition', number>>;
  note?: string;
  at: string;
}
