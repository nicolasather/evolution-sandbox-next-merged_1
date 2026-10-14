# Package 067 — 10-item recipe-free pilot (14/10/2026)

Batch `data/verified_seeds/pilot.json`: ten sourced seeds with **no recipe field**. Run:
`node tools/py.mjs tools/verified_content.py run --batch pilot` and `publish --batch pilot --dry-run --sandbox out/sandbox`.

| Outcome | Count | Items |
|---|---|---|
| anchor frozen (one primary each) | 5 | fx_lashed_flake_knife (fiber+stone_flake+wood), fx_ground_pebble (stone×3), fx_ground_bone_point (bone+stone×2), fx_twisted_fibre_loop (fiber×3), fx_hafted_bone_awl (fiber+fx_ground_bone_point+wood) |
| anchor_blocked (no forced route) | 4 | clay bowl, sun-dried block, early copper ingot, "stone-age microchip" (ERA_CONFLICT + MATERIAL_IMPOSSIBLE) |
| facts not publishable | 1 | fx_unsourced_charm (claims lack check notes / specific sources) |

Blocked items list their missing prerequisites (clay node, mould, copper ore, kiln, electricity…), which is the honest answer rather than an invented recipe.
Dry-run publish into a sandbox copy: `validate.py` errors 0, 5 new nodes (#919–#923), nothing written to the real tree.
Fixture items (`fx_*`) are test data and are not in the shipped game. Visuals/motion come from `visualBrief.archetype` and material family (see PROCEDURAL_3D_AND_MOTION.md). Mode eligibility is automatic via `lib/modeAdapters`.
**Mocked vs real:** no model was called; the "Claude decisions" in `pilot.anchors.json` were produced in-session and verified by the deterministic rules.
