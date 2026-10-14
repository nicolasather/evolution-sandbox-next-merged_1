/* Tickets 093–097 — the Mode Packet contract. A packet is CONTENT: item ids chosen from a server-built pool and short
   flavour strings. Mechanics, seeds, solutions, win conditions, scores and certificates are produced by the server from the
   mode's own deterministic code. Nothing a model writes can reach a rule. */

export const MODE_PACKET_MODES = [
  'survival', 'civilization', 'archaeology', 'decipher', 'escape-room', 'alien-archaeology', 'reverse-evolution', 'minimum-path',
] as const;
export type PacketModeId = (typeof MODE_PACKET_MODES)[number];

export const MAX_PACKET_ITEMS = 8;
export const POOL_MIN = 10;
export const POOL_MAX = 30;
export const CERT_SEEDS = 20;

export interface SolverCertificate {
  generatorVersion: string;
  seeds: string[];
  reachable: true;
  minSteps?: number;
  checks: string[];
  /** sha256 of the canonical certificate body — computed by the server, never by a model */
  hash: string;
}

export interface ModePacket {
  schemaVersion: 1;
  modeId: PacketModeId;
  contractVersion: string;
  releaseHash: string;
  seed: number;
  approvedItemIds: string[];
  flavor: Record<string, string>;
  scenario: Record<string, string | number>;
  /** appended by the server, fixed per mode (simulated / fictional labels) */
  disclosure: string | null;
  verification: { status: 'certified'; certificate: SolverCertificate };
}

/** What the model returns. Exactly these two keys. */
export interface RawModeOutput { schemaVersion: 1; approvedItemIds: string[]; flavor: Record<string, string> }

export interface FlavorField { key: string; maxLen: number }

export interface ModeProviderMeta { provider: string; modelId: string; promptVersion: string; requestId: string | null; inputTokens: number; outputTokens: number; costUsd: number }
export interface ComposeInput {
  modeId: PacketModeId; contractVersion: string; flavorFields: readonly FlavorField[];
  pool: readonly { id: string; name: string; era: string }[]; maxItems: number; seed: number; signal?: AbortSignal;
}
export interface ModeProvider {
  readonly name: string;
  compose(input: ComposeInput): Promise<{ output: unknown; meta: ModeProviderMeta }>;
}
