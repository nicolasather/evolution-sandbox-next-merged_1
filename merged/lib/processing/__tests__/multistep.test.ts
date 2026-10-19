import type { ActionId } from '../../types';
import {
  EXISTING_ACTIONS, EXTENDED_ACTIONS, SUPPORTED_ACTIONS,
  awardGuard, beginCraft, compileRecipes, fishCast, routeSignature, submitGesture, validatePlan,
  type AwardContext, type CraftContext, type CraftState, type GestureContext, type SequencePlan,
} from '../multistep';

const catalogue = new Set(['worked_clay_cup', 'clay_nodule', 'different_pot']);
const make = (): SequencePlan => ({
  outputId: 'worked_clay_cup', kind: 'physical_process', stock: ['clay_nodule'], additionalRequirements: [],
  reviewStatus: 'APPROVED', completeReadyForGame: true,
  actionSteps: [
    { action: 'shape', implementedInGame: true, conditions: [] },
    { action: 'dry', implementedInGame: true, conditions: [] },
    { action: 'heat', implementedInGame: true, conditions: [] },
  ],
});
const craftCtx = (): CraftContext => ({ catalogue, inventory: new Set(['clay_nodule']), environment: new Set(), knowledge: new Set() });
const gestureCtx = (): GestureContext => ({
  supportedActions: SUPPORTED_ACTIONS, unlockedActions: new Set(['shape', 'dry', 'heat']), conditions: new Set(),
  targetMaterialCompatible: () => true, capabilitiesSatisfied: () => true,
});
const awardCtx = (): AwardContext => ({ publishedApprovedPlanIds: new Set(['worked_clay_cup']), eraGateAllows: () => true, regionGateAllows: () => true });

describe('multistep action sequences', () => {
  test('every gesture the game has is supported, plus assemble; extended mechanics are not', () => {
    const typed: ActionId[] = ['brush', 'smash', 'cut', 'separate', 'dig', 'carve', 'scrape', 'grind', 'pull', 'twist', 'tie', 'stretch', 'mix', 'shape', 'pour', 'heat', 'cool', 'dry', 'burn', 'hammer', 'split', 'press', 'saw', 'chisel', 'polish'];
    for (const a of typed) expect(SUPPORTED_ACTIONS.has(a)).toBe(true);
    expect(SUPPORTED_ACTIONS.has('assemble')).toBe(true);
    expect(EXISTING_ACTIONS).toHaveLength(26);
    for (const a of EXTENDED_ACTIONS) expect(SUPPORTED_ACTIONS.has(a)).toBe(false);
  });

  test('rejects draft proposals and placeholder prerequisites by default', () => {
    const draft = make(); draft.reviewStatus = 'NEEDS_FACT_AND_PHYSICS_REVIEW';
    expect(validatePlan(draft, catalogue)).toMatchObject({ ok: false, code: 'UNREVIEWED_PLAN' });
    const needs = make(); needs.additionalRequirements = ['NEEDS:water'];
    expect(validatePlan(needs, catalogue)).toMatchObject({ ok: false, code: 'MISSING_PREREQUISITE' });
    const stock = make(); stock.stock = ['NEEDS:species_specific_wild_einkorn_wheat_population'];
    expect(validatePlan(stock, catalogue)).toMatchObject({ ok: false, code: 'PLACEHOLDER_STOCK' });
  });

  test('rejects unknown ids, self reference, empty physical process and unknown kinds', () => {
    const unknownStock = make(); unknownStock.stock = ['nope'];
    expect(validatePlan(unknownStock, catalogue)).toMatchObject({ code: 'UNKNOWN_STOCK' });
    const self = make(); self.stock = ['worked_clay_cup'];
    expect(validatePlan(self, catalogue)).toMatchObject({ code: 'SELF_REFERENCE' });
    const empty = make(); empty.actionSteps = [];
    expect(validatePlan(empty, catalogue)).toMatchObject({ code: 'EMPTY_PHYSICAL_PROCESS' });
    const kind = make(); kind.kind = 'magic';
    expect(validatePlan(kind, catalogue)).toMatchObject({ code: 'UNKNOWN_PROCESS_KIND' });
    const target = make(); target.outputId = 'ghost';
    expect(validatePlan(target, catalogue)).toMatchObject({ code: 'UNKNOWN_TARGET' });
  });

  test('rejects actions the game does not implement (fish, plant, select, observe…)', () => {
    for (const action of ['fish', 'plant', 'select', 'observe']) {
      const p = make(); p.actionSteps = [{ action, implementedInGame: false, conditions: [] }];
      expect(validatePlan(p, catalogue)).toMatchObject({ ok: false, code: 'ACTION_UNIMPLEMENTED' });
    }
    const flagged = make(); flagged.actionSteps = [{ action: 'shape', implementedInGame: false }];
    expect(validatePlan(flagged, catalogue)).toMatchObject({ code: 'ACTION_NOT_IMPLEMENTED' });
  });

  test('two different outputs cannot share inputs + ordered actions; the output id is not part of the key', () => {
    const a = make(); const b = { ...make(), outputId: 'different_pot' };
    expect(routeSignature(a)).toBe(routeSignature(b));
    const r = compileRecipes([a, b], catalogue);
    expect(r.routes.size).toBe(1);
    expect(r.conflicts[0]).toMatchObject({ reason: 'ACTION_ROUTE_COLLISION', with: 'worked_clay_cup' });
  });

  test('order matters: the same actions in a different order are a different route', () => {
    const a = make(); const b = make(); b.actionSteps = [...b.actionSteps].reverse();
    expect(routeSignature(a)).not.toBe(routeSignature(b));
  });

  test('begin requires real inventory, environment and knowledge', () => {
    const p = make(); const c = craftCtx(); c.inventory = new Set();
    expect(beginCraft(p, c)).toMatchObject({ ok: false, code: 'MISSING_INVENTORY' });
    const env = make(); env.environmentGates = ['kiln_available'];
    expect(beginCraft(env, craftCtx())).toMatchObject({ code: 'ENVIRONMENT_UNAVAILABLE' });
    const kn = make(); kn.knowledgeGates = ['fire_control'];
    expect(beginCraft(kn, craftCtx())).toMatchObject({ code: 'KNOWLEDGE_NOT_UNLOCKED' });
  });

  test('the player must perform the actions in order with a completed gesture, and the award is separate', () => {
    const p = make(); const g = gestureCtx();
    const begun = beginCraft(p, craftCtx());
    expect(begun.ok).toBe(true); if (!begun.ok) return;
    let state = begun.state;
    expect(submitGesture(p, state, { action: 'dry', completed: true }, g)).toMatchObject({ code: 'WRONG_ACTION' });
    expect(submitGesture(p, state, { action: 'shape', completed: false }, g)).toMatchObject({ code: 'GESTURE_INCOMPLETE' });
    expect(awardGuard(p, state, awardCtx())).toMatchObject({ code: 'PROCESS_INCOMPLETE' });
    for (const action of ['shape', 'dry', 'heat']) {
      const r = submitGesture(p, state, { action, completed: true }, g);
      expect(r.ok).toBe(true); if (!r.ok) return;
      state = r.state;
    }
    expect(state.done).toBe(true);
    expect(awardGuard(p, state, awardCtx())).toEqual({ ok: true, state: { outputId: 'worked_clay_cup' } });
  });

  test('locked actions, wrong material, missing tool and unmet conditions block a step', () => {
    const p = make(); p.actionSteps[0].conditions = ['clay_is_wet'];
    const begun = beginCraft(p, craftCtx()); if (!begun.ok) throw new Error('begin');
    const locked = gestureCtx(); locked.unlockedActions = new Set();
    expect(submitGesture(p, begun.state, { action: 'shape', completed: true }, locked)).toMatchObject({ code: 'ACTION_LOCKED' });
    const wrong = gestureCtx(); wrong.targetMaterialCompatible = () => false;
    expect(submitGesture(p, begun.state, { action: 'shape', completed: true }, wrong)).toMatchObject({ code: 'PHYSICAL_MISMATCH' });
    const tool = gestureCtx(); tool.capabilitiesSatisfied = () => false;
    expect(submitGesture(p, begun.state, { action: 'shape', completed: true }, tool)).toMatchObject({ code: 'TOOL_OR_CAPABILITY_MISSING' });
    expect(submitGesture(p, begun.state, { action: 'shape', completed: true }, gestureCtx())).toMatchObject({ code: 'CONDITION_MISSING' });
  });

  test('never awards unpublished plans or past era/region locks', () => {
    const p = make();
    const done: CraftState = { state: 'awaiting_verified_award', planId: 'worked_clay_cup', stepIndex: 3, consumed: [], done: true };
    const unpublished = awardCtx(); unpublished.publishedApprovedPlanIds = new Set();
    expect(awardGuard(p, done, unpublished)).toMatchObject({ code: 'REVIEW_NOT_PUBLISHED' });
    const era = awardCtx(); era.eraGateAllows = () => false;
    expect(awardGuard(p, done, era)).toMatchObject({ code: 'ERA_LOCKED' });
    const region = awardCtx(); region.regionGateAllows = () => false;
    expect(awardGuard(p, done, region)).toMatchObject({ code: 'REGION_LOCKED' });
  });

  test('fish stays disabled until enabled, then needs water, tackle, bait and fish stock', () => {
    expect(fishCast({ enabledActions: new Set() })).toMatchObject({ code: 'ACTION_UNIMPLEMENTED' });
    const c = { enabledActions: new Set(['fish']), nearFishableWater: true, hasHook: true, hasLine: true, baitPresent: true, fishPopulationPresent: true };
    expect(fishCast(c).ok).toBe(true);
    expect(fishCast({ ...c, nearFishableWater: false })).toMatchObject({ code: 'NOT_FISHABLE_WATER' });
    expect(fishCast({ ...c, hasHook: false })).toMatchObject({ code: 'TACKLE_MISSING' });
    expect(fishCast({ ...c, baitPresent: false })).toMatchObject({ code: 'BAIT_OR_LURE_MISSING' });
    expect(fishCast({ ...c, fishPopulationPresent: false })).toMatchObject({ code: 'NO_FISH_POPULATION' });
  });
});
