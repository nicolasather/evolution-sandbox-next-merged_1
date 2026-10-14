# ADR 0001 — Verified seeds, one frozen anchor recipe, rejection first

**Status:** accepted for Phase 1 (14/10/2026). **Context:** the game must stay logic-first; most arbitrary
combinations must fail; the owner supplies facts, not recipes.

**Decisions**
1. Facts and recipes are separate artefacts. A seed has no recipe field.
2. Each publishable new item has exactly one frozen *anchor* produced at build time and checked by deterministic rules; otherwise `anchor_blocked` with missing prerequisites. No fallback second primary.
3. Anchors may only use catalogue nodes (not worked states), existing actions, earlier-or-equal eras, and an unclaimed multiset.
4. Alternatives are optional proposals to *existing* items, hash-bound, reviewed, published separately.
5. Runtime is rejection-first: known recipe → result; otherwise `no_result`. No random success rolls, no confidence thresholds.
6. Recipe identity is the multiset key `recipe-v2` (Python and TS golden-tested); the engine’s persisted `multiKey` is unchanged.
7. Nothing public calls a model in Phase 1; the owner-only route is closed unless explicitly configured and never open on production.

**Consequences:** new items tend to use 3-slot recipes (the 2-slot space is full); “craftable” can legitimately be
impossible until a prerequisite item is imported first (reported, not faked).
