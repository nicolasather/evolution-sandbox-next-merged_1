import db from '../../../data/db.json';
import routes from '../../../data/expansion/anc27_action_routes.json';
import { compileRecipes, validatePlan, type SequencePlan } from '../multistep';

const catalogue = new Set<string>((db as { nodes: { id: string }[] }).nodes.map(n => n.id));
const plans = (routes as unknown as { plans: SequencePlan[] }).plans;
const byId = new Map((db as { nodes: { id: string; rec: string[][] }[] }).nodes.map(n => [n.id, n]));

describe('anc27 draft action routes', () => {
  it('has one drafted ordered route for each of the 841 built items', () => {
    expect(plans).toHaveLength(841);
    expect(new Set(plans.map(p => p.outputId)).size).toBe(841);
  });

  it('are all rejected by default because nobody has reviewed them', () => {
    for (const p of plans) {
      const r = validatePlan(p, catalogue);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('UNREVIEWED_PLAN');
    }
    expect(compileRecipes(plans, catalogue).routes.size).toBe(0);
  });

  it('would all be valid and collision-free if approved: real stock, existing gestures, unique signatures', () => {
    const approved = plans.map(p => ({ ...p, reviewStatus: 'APPROVED', completeReadyForGame: true }));
    const { routes: ok, conflicts } = compileRecipes(approved, catalogue);
    expect(conflicts).toEqual([]);
    expect(ok.size).toBe(841);
  });

  it('use the same ingredients as the item\'s second merge route and end by assembling', () => {
    for (const p of plans) {
      const node = byId.get(p.outputId)!;
      expect([...(p.stock ?? [])].sort()).toEqual([...node.rec[1]].sort());
      expect(p.actionSteps[p.actionSteps.length - 1].action).toBe('assemble');
    }
  });
});
