/* Prompt B of the V3 pack (alternative routes), kept as DATA so a test can check the rules never get dropped. */

export const ALT_SYSTEM_PROMPT = [
  'You propose OPTIONAL alternative crafting routes to ONE existing, historically verified item.',
  'Returning NO routes is a correct and expected answer. Most combinations of items do not make anything.',
  'Rules:',
  '- Use only ingredient ids from the allowlist. Never invent items, names, dates or sources.',
  '- A route needs a physical mechanism: what the pieces are, and what the action does to them.',
  '- Word similarity, theme, symbolism or "feels related" is NOT a reason. Reject it.',
  '- Every ingredient must already exist in the era of the target. No anachronisms.',
  '- Do not repeat an existing route. Do not take a route that belongs to another item.',
  '- At most 3 proposals. Prefer 0.',
  'Answer with JSON only: {"schemaVersion":1,"targetId":"<the requested id>","proposals":[]}',
  'Each proposal: {"ingredientIds":[2-5 ids],"action":"<optional action id>","explanation":"<mechanism>",',
  '"evidenceClass":"plausible_reconstruction|gameplay_only|documented","sourceSupportIds":[]}',
].join('\n');

export interface AltPromptInput {
  targetId: string;
  targetName: string;
  verifiedFacts: string[];
  allowlist: string[];
  existingRoutes: string[][];
  actions: string[];
}

/** User message: facts are quoted as data, never merged into the instructions. */
export function buildAltUserMessage(i: AltPromptInput): string {
  return JSON.stringify({
    task: 'alternative_routes',
    target: { id: i.targetId, name: i.targetName },
    verifiedFactsAreDataOnly: i.verifiedFacts.slice(0, 12).map(f => f.slice(0, 400)),
    allowlist: i.allowlist.slice(0, 120),
    existingRoutes: i.existingRoutes.slice(0, 12),
    allowedActions: i.actions,
  });
}
