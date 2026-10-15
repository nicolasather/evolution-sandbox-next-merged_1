# Evolution Sandbox — 1,999 items in one handoff
**Use exactly one handoff file:** `data/recipe_review/CLAUDE_ALL_1999_ONE_FILE.json`
That JSON is a single complete review package covering 999 installed exp26 items and 1,000 anc27 draft items. It includes all 1,999 proposed recipe decisions, group-level factual/process notes, gaps, duplicate matches, special historically wrong examples and exact source-file paths. All numerical ingredient references resolve against the original data files already inside this GitHub repository, as described by `sourceOrder`, `exp26Start` and `anc27Start`.
## What Claude must do
1. Open that **single JSON**, then read the baseline datasets from `merged/`; do not ask the owner to provide a second handoff.
2. For each of the 1,999 items, independently check ingredients and historical process, rectify blocked/colliding recipes and write precise item-specific explanatory facts with real scholarly sources. Do not fabricate citations or dates.
3. Verify the new 1,000 anc27 items before adding to production. They are not yet installed in the main game and have neither verified item-specific evidence nor rendered final 3D art.
4. Treat `candidate`, `review`, `blocked` as editorial/automated review categories, not guarantees of historical or gameplay correctness.
5. Do not force recipe pathways just to satisfy arbitrary counts. Where the catalog lacks the physical ingredients or knowledge/process nodes, specify the needed missing node, with why and its own valid prerequisites.
6. Review the 26 possible near-duplicates, wrong-era crop transfers, unrelated writing systems and bronze/iron substitution. Preserve historically distinct regional adaptations.
7. Run graph checks, factual checks, unit and mode integrations, manual visual QA, build and browser smoke tests. Report unresolved blockers and never auto-deploy into production.
Use `CLAUDE_ALL_1999_ONE_FILE.json` as the sole package to send Claude. The baseline files are **existing project assets**, not extra user handoffs.
