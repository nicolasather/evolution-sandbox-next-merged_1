import type { ActionId } from '../types';

/**
 * Ordered, multi-step production routes ("action sequences").
 *
 * Deterministic and rejection-first: no AI, no persistence, no side effects. A plan is REVIEW data
 * until it carries `reviewStatus: 'APPROVED'` and `completeReadyForGame: true`; every draft route in
 * the 1999-item handoff is rejected by default. This module is additive: it does not touch the legacy
 * unordered 2–5 ingredient recipes (recipe-key v2) and is not wired into the UI by itself.
 */

/** The 25 gestures the game already has, plus `assemble` (the multi-piece recipe path). */
export type SequenceActionId = ActionId | 'assemble';

export const EXISTING_ACTIONS: readonly SequenceActionId[] = Object.freeze([
  'brush', 'smash', 'cut', 'separate', 'dig', 'carve', 'scrape', 'grind', 'pull', 'twist',
  'tie', 'stretch', 'mix', 'shape', 'pour', 'heat', 'cool', 'dry', 'burn', 'hammer',
  'split', 'press', 'saw', 'chisel', 'polish', 'assemble',
]);
export const SUPPORTED_ACTIONS: ReadonlySet<string> = new Set<string>(EXISTING_ACTIONS);

/** Proposed mechanics that need real code + tests before any route may use them. */
export const EXTENDED_ACTIONS: ReadonlySet<string> = new Set([
  'fish', 'observe', 'measure', 'record', 'select', 'plant', 'tend', 'harvest', 'feed', 'breed', 'care',
]);

export type ProcessKind =
  | 'physical_process' | 'environmental_construction' | 'biological_growth_or_selection'
  | 'environmental_observation' | 'knowledge_or_social_progression';

const PROCESS_KINDS: ReadonlySet<string> = new Set<ProcessKind>([
  'physical_process', 'environmental_construction', 'biological_growth_or_selection',
  'environmental_observation', 'knowledge_or_social_progression',
]);

export interface SequenceStep {
  action: string;
  implementedInGame?: boolean;
  conditions?: string[];
  target?: string;
  toolOrCapability?: string;
}

export interface SequencePlan {
  outputId: string;
  kind: ProcessKind | string;
  stock?: string[];
  additionalRequirements?: string[];
  actionSteps: SequenceStep[];
  environmentGates?: string[];
  knowledgeGates?: string[];
  reviewStatus?: string;
  completeReadyForGame?: boolean;
}

export type Fail = { ok: false; code: string; detail: string };
export type Ok<T> = { ok: true; state: T };
export type Result<T> = Ok<T> | Fail;

const fail = (code: string, detail = ''): Fail => ({ ok: false, code, detail });
const success = <T>(state: T): Ok<T> => ({ ok: true, state });
const unique = (values: readonly string[]): string[] => [...new Set(values)];

export interface CraftState {
  state: 'idle' | 'running' | 'awaiting_verified_award';
  planId: string | null;
  stepIndex: number;
  consumed: string[];
  done: boolean;
}
export const EMPTY_CRAFT: Readonly<CraftState> = Object.freeze({ state: 'idle', planId: null, stepIndex: 0, consumed: [], done: false });

/** Every input must be a real catalogue id. Design placeholders ("NEEDS:…") never count as materials. */
export function validatePlan(plan: SequencePlan | null | undefined, catalogue: ReadonlySet<string>, supportedActions: ReadonlySet<string> = SUPPORTED_ACTIONS): Result<{ validated: true }> {
  if (!plan || typeof plan !== 'object' || !plan.outputId || !Array.isArray(plan.actionSteps)) return fail('INVALID_PLAN');
  if (plan.completeReadyForGame !== true || plan.reviewStatus !== 'APPROVED') return fail('UNREVIEWED_PLAN', plan.outputId);
  if (!catalogue.has(plan.outputId)) return fail('UNKNOWN_TARGET');
  if (!PROCESS_KINDS.has(plan.kind)) return fail('UNKNOWN_PROCESS_KIND');
  if (!plan.actionSteps.length && plan.kind === 'physical_process') return fail('EMPTY_PHYSICAL_PROCESS');
  for (const material of plan.stock ?? []) {
    if (material.startsWith('NEEDS:')) return fail('PLACEHOLDER_STOCK', material);
    if (!catalogue.has(material)) return fail('UNKNOWN_STOCK', material);
    if (material === plan.outputId) return fail('SELF_REFERENCE', material);
  }
  for (const req of plan.additionalRequirements ?? []) if (req.startsWith('NEEDS:')) return fail('MISSING_PREREQUISITE', req);
  for (const s of plan.actionSteps) {
    if (!supportedActions.has(s.action)) return fail('ACTION_UNIMPLEMENTED', s.action);
    if (s.implementedInGame !== true) return fail('ACTION_NOT_IMPLEMENTED', s.action);
  }
  return success({ validated: true });
}

/** Two outcomes may never claim the same kind + inputs + ordered actions + conditions (the output id is NOT part of the key). */
export function routeSignature(plan: SequencePlan): string {
  const material = [...(plan.stock ?? [])].sort();
  const steps = plan.actionSteps.map(s => [s.action, unique([...(s.conditions ?? [])].sort())]);
  return JSON.stringify([plan.kind, material, steps, [...(plan.environmentGates ?? [])].sort()]);
}

export interface RouteConflict { id: string | undefined; reason: string; detail?: string; with?: string }

export function compileRecipes(approvedPlans: readonly SequencePlan[], catalogue: ReadonlySet<string>, supportedActions: ReadonlySet<string> = SUPPORTED_ACTIONS): { routes: Map<string, SequencePlan>; conflicts: RouteConflict[] } {
  const routes = new Map<string, SequencePlan>();
  const conflicts: RouteConflict[] = [];
  for (const p of approvedPlans) {
    const tested = validatePlan(p, catalogue, supportedActions);
    if (!tested.ok) { conflicts.push({ id: p?.outputId, reason: tested.code, detail: tested.detail }); continue; }
    const key = routeSignature(p);
    const prior = routes.get(key);
    if (prior && prior.outputId !== p.outputId) { conflicts.push({ id: p.outputId, reason: 'ACTION_ROUTE_COLLISION', with: prior.outputId }); continue; }
    routes.set(key, p);
  }
  return { routes, conflicts };
}

export interface CraftContext {
  catalogue: ReadonlySet<string>;
  inventory: ReadonlySet<string>;
  environment: ReadonlySet<string>;
  knowledge: ReadonlySet<string>;
  supportedActions?: ReadonlySet<string>;
}

export function beginCraft(plan: SequencePlan, ctx: CraftContext): Result<CraftState> {
  const tested = validatePlan(plan, ctx.catalogue, ctx.supportedActions ?? SUPPORTED_ACTIONS);
  if (!tested.ok) return tested;
  for (const id of plan.stock ?? []) if (!ctx.inventory.has(id)) return fail('MISSING_INVENTORY', id);
  for (const condition of plan.environmentGates ?? []) if (!ctx.environment.has(condition)) return fail('ENVIRONMENT_UNAVAILABLE', condition);
  for (const unlocked of plan.knowledgeGates ?? []) if (!ctx.knowledge.has(unlocked)) return fail('KNOWLEDGE_NOT_UNLOCKED', unlocked);
  return success<CraftState>({ state: 'running', planId: plan.outputId, stepIndex: 0, consumed: [], done: false });
}

export interface Gesture { action: string; completed: boolean }

export interface GestureContext {
  supportedActions: ReadonlySet<string>;
  unlockedActions: ReadonlySet<string>;
  conditions: ReadonlySet<string>;
  targetMaterialCompatible: (gesture: Gesture, step: SequenceStep) => boolean;
  capabilitiesSatisfied: (gesture: Gesture, step: SequenceStep) => boolean;
}

/** Called only when the player's physical gesture actually finishes, and only for the NEXT expected step. */
export function submitGesture(plan: SequencePlan, craftState: CraftState | null | undefined, gesture: Gesture | null | undefined, ctx: GestureContext): Result<CraftState> {
  if (craftState?.state !== 'running' || craftState.done) return fail('NOT_RUNNING');
  if (craftState.planId !== plan.outputId) return fail('WRONG_PLAN');
  const expected = plan.actionSteps[craftState.stepIndex];
  if (!expected) return fail('NO_REMAINING_ACTION');
  if (!gesture || !gesture.completed) return fail('GESTURE_INCOMPLETE');
  if (gesture.action !== expected.action) return fail('WRONG_ACTION', `${gesture.action}, expected ${expected.action}`);
  if (!ctx.unlockedActions.has(gesture.action)) return fail('ACTION_LOCKED');
  if (!ctx.supportedActions.has(gesture.action)) return fail('ACTION_UNIMPLEMENTED');
  if (!ctx.targetMaterialCompatible(gesture, expected)) return fail('PHYSICAL_MISMATCH');
  if (!ctx.capabilitiesSatisfied(gesture, expected)) return fail('TOOL_OR_CAPABILITY_MISSING');
  for (const condition of expected.conditions ?? []) if (!ctx.conditions.has(condition)) return fail('CONDITION_MISSING', condition);
  const index = craftState.stepIndex + 1;
  const done = index === plan.actionSteps.length;
  return success<CraftState>({ ...craftState, stepIndex: index, done, state: done ? 'awaiting_verified_award' : 'running' });
}

export interface AwardContext {
  publishedApprovedPlanIds: ReadonlySet<string>;
  eraGateAllows: (outputId: string) => boolean;
  regionGateAllows: (outputId: string) => boolean;
}

/** The award is a deliberate, separate call: it never fires from a finished gesture alone, and never overrides era/region locks. */
export function awardGuard(plan: SequencePlan, craftState: CraftState | null | undefined, ctx: AwardContext): Result<{ outputId: string }> {
  if (!craftState?.done || craftState.state !== 'awaiting_verified_award') return fail('PROCESS_INCOMPLETE');
  if (!ctx.publishedApprovedPlanIds.has(plan.outputId)) return fail('REVIEW_NOT_PUBLISHED');
  if (ctx.eraGateAllows(plan.outputId) !== true) return fail('ERA_LOCKED');
  if (ctx.regionGateAllows(plan.outputId) !== true) return fail('REGION_LOCKED');
  return success({ outputId: plan.outputId });
}

export interface FishContext {
  enabledActions?: ReadonlySet<string>;
  nearFishableWater?: boolean;
  hasHook?: boolean;
  hasLine?: boolean;
  baitPresent?: boolean;
  fishPopulationPresent?: boolean;
  targetSpecies?: string | null;
}

/** Environmental `fish`: hook + line make TACKLE; a catch needs habitat, stock, bait and a real cast. Disabled until the action is enabled and tested. */
export function fishCast(ctx: FishContext): Result<{ state: 'awaiting_bite'; species: string | null; tension: number }> {
  if (!ctx.enabledActions?.has('fish')) return fail('ACTION_UNIMPLEMENTED', 'fish');
  if (!ctx.nearFishableWater) return fail('NOT_FISHABLE_WATER');
  if (!ctx.hasHook || !ctx.hasLine) return fail('TACKLE_MISSING');
  if (!ctx.baitPresent) return fail('BAIT_OR_LURE_MISSING');
  if (!ctx.fishPopulationPresent) return fail('NO_FISH_POPULATION');
  return success({ state: 'awaiting_bite', species: ctx.targetSpecies ?? null, tension: 0 });
}
