/* Shared contracts for the Phase 2 "creative" sidecar (tickets 069–100).
   Authority stays with the deterministic Engine and reviewed content releases; nothing here can make a craft
   succeed or publish anything. */

export const SCHEMA_VERSION = 1 as const;

/** A request as the server understands it AFTER validation. Identity/role never come from the body. */
export interface TryRequest {
  schemaVersion: 1;
  ingredientIds: string[];
  actionId: string | null;
  releaseHash: string;
  attemptId: string;
}

export type NoResultReason = 'causally_impossible' | 'no_eligible_target' | 'validated_none' | 'cached_none';

export type TryCraftResponse =
  | { kind: 'known'; targetId: string | null; releaseHash: string; gated: boolean }
  | { kind: 'no_result'; reason: NoResultReason; releaseHash: string }
  | { kind: 'pending_review'; attemptId: string; releaseHash: string; message: 'A possible route is being reviewed.' }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'unavailable' }
  | { kind: 'release_mismatch' };

/** Internal, richer reject codes. They are logged for operators, never sent to players. */
export type HardReject =
  | 'INVALID_INPUT' | 'UNKNOWN_ITEM' | 'UNVERIFIED_INGREDIENT' | 'ACTION_NOT_ALLOWED' | 'NO_PHYSICAL_PROCESS'
  | 'MISSING_REQUIRED_COMPONENT' | 'MATERIAL_IMPOSSIBLE' | 'ERA_CONFLICT' | 'NO_ELIGIBLE_TARGET';

/** What a hard-coded, human-reviewed mechanism list allows for one attempt (reference/recipePolicy.ts TargetRule). */
export interface TargetRule {
  targetId: string;
  processId: string;
  ingredientIds: readonly string[];
  actionId: string | null;
  rationale: string;
}

export type EvidenceClass = 'documented' | 'reconstructed' | 'pedagogical_simulation';

export type ModelDecision =
  | { schemaVersion: 1; decision: 'none'; reasonCodes: readonly string[] }
  | {
      schemaVersion: 1; decision: 'propose'; targetId: string; processId: string; requiredActionId: string | null;
      causalMechanism: string; evidenceClass: EvidenceClass; reasonCodes: readonly string[];
    };

export interface ResolvedModelMetadata {
  provider: string;
  /** exact API model id used, as reported by the provider (NOT the IDE label) */
  modelId: string;
  promptVersion: string;
  requestId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface DecideInput {
  ingredientIds: readonly string[];
  actionId: string | null;
  candidates: readonly TargetRule[];
  releaseHash: string;
  promptVersion: string;
  signal?: AbortSignal;
}

export interface DecideOutput { decision: unknown; meta: ResolvedModelMetadata }

/** Provider boundary: returns RAW (untrusted) data; the caller validates. Throws ProviderError on failure. */
export interface CreativeProvider {
  readonly name: string;
  decide(input: DecideInput): Promise<DecideOutput>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly billableUnknown = false) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const PROCESS_ID_RE = /^[a-z][a-z0-9_]{1,63}$/;
export const MAX_CANDIDATES = 12;
export const MAX_MECHANISM = 300;
