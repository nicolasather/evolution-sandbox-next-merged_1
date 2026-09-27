#!/usr/bin/env python3
"""
Evolution Sandbox — chronology audit.

Structural consistency only: this checks that the BUILT data (data/db.json +
data/processing.json) does not contradict itself in time — it does NOT
re-verify any date against the real world.

The invariant is per RESULT, not per recipe line: `rec` (and the recipes the
processing layer adds) are ALTERNATIVES — a player needs only one of them.
So a result is only a genuine contradiction when NONE of its alternative
recipes/transforms could have happened in time. A result with, say, four
recipes where one uses only earlier-dated materials and three use later
materials is not a bug: the early recipe is presumably the "true" origin
path, and the later ones are convenience/flavour paths a player can also use
once they have fancier materials (real crafts often have more than one way
to make something, invented at different times). Those are reported as
informational notes, not errors, so the error list stays a signal of things
that actually need a human's judgement.

This deliberately does NOT fail:
  - a primitive as an ingredient (primitives have no invented date to violate);
  - a result with at least one internally-consistent recipe/transform, even if
    it also has later-dated convenience alternatives (see above — INFO only);
  - a contradiction with a registered exception in data/chronology_exceptions.json
    (each entry MUST carry a `reason` — see that file's own docstring);
  - a `source_required` discovery's placement on its own — that is a coverage
    gap, reported separately, not a contradiction.

This script never edits data/db.json, data/processing.json or any node file.
It reports; a human decides which contradictions are real and which are
"evidence date vs. origin date" or "gameplay abstraction" and belong in the
exceptions file instead.

  python3 tools/chronology_audit.py [--json]

Codes
-----
CH1/CH2  a discovery has NO chronologically consistent recipe at all — every
         alternative (base `rec` in data/db.json, and/or a processing-layer
         `recipes.add` entry) needs an ingredient dated later than the result
CH3      an output has NO producing transform whose technique existed in
         time — every action documented to produce it (data/processing.json
         `transforms`) is anchored later than the output
CH0      a malformed entry in data/chronology_exceptions.json (no `reason`)
INFO     convenience_alt_recipes/transforms — results/outputs that have a
         later-dated alternative path alongside a valid earlier one (not an
         error — see module docstring)
INFO     nodes.source_required   — discoveries with no verified subject-level source
INFO     exceptions_unused       — registered exceptions that no longer match anything
                                    (contradiction fixed, or the exception is stale)
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "db.json"
PROCESSING = ROOT / "data" / "processing.json"
EXCEPTIONS = ROOT / "data" / "chronology_exceptions.json"

# Mirrors the `chronology.sortDs` authored in lib/processing/techniques.ts.
# Keep in sync by hand — there are only 25 entries, and each is commented
# there with its historical basis. This script does not import TypeScript.
TECHNIQUE_SORT_DS: dict[str, int] = {
    "smash": -3_300_000, "brush": -3_300_000, "separate": -3_300_000, "pull": -3_300_000,
    "cut": -2_600_000, "dig": -2_000_000, "hammer": -1_760_000, "split": -1_500_000,
    "burn": -790_000, "carve": -400_000, "scrape": -100_000, "chisel": -70_000,
    "twist": -50_000, "tie": -48_000, "stretch": -27_000, "grind": -23_000,
    "mix": -14_000, "shape": -13_500, "heat": -10_000, "polish": -9_500,
    "press": -9_000, "dry": -9_000, "cool": -6_500, "pour": -6_000, "saw": -5_000,
}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def load_exceptions() -> list[dict]:
    if not EXCEPTIONS.exists():
        return []
    data = load_json(EXCEPTIONS)
    return data.get("exceptions", [])


def exception_key(code: str, result: str, ingredient: str) -> str:
    return f"{code}:{result}:{ingredient}"


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    as_json = "--json" in sys.argv

    db = load_json(DB)
    processing = load_json(PROCESSING)
    exceptions = load_exceptions()
    exception_keys = {exception_key(e["code"], e["result"], e["ingredient"]) for e in exceptions if e.get("reason")}
    malformed_exceptions = [e for e in exceptions if not e.get("reason")]
    used_exception_keys: set[str] = set()

    primitives: set[str] = set(db.get("primitives", []))
    nodes: list[dict] = db.get("nodes", [])
    by_id: dict[str, dict] = {n["id"]: n for n in nodes}

    errors: list[str] = []
    info: list[str] = []

    def ds_of(node_id: str) -> int | None:
        n = by_id.get(node_id)
        return n["ds"] if n else None

    # ---- CH1/CH2 — group every alternative recipe by its result id --------
    # (base `rec` entries and processing-layer `recipes.add` entries are the
    # SAME pool of alternatives from the player's point of view.)
    recipe_alts: dict[str, list[tuple[str, list[str]]]] = defaultdict(list)
    for n in nodes:
        for pair in n.get("rec", []):
            recipe_alts[n["id"]].append(("CH1", list(pair)))
    for edit in processing.get("recipes", {}).get("add", []):
        recipe_alts[edit["id"]].append(("CH2", list(edit.get("rec", []))))

    base_recipes_checked = sum(len(n.get("rec", [])) for n in nodes)
    processing_recipes_checked = len(processing.get("recipes", {}).get("add", []))

    convenience_recipes = 0
    for result_id, alts in recipe_alts.items():
        result = by_id.get(result_id)
        if not result:
            continue  # E2-style problems are validate.py's job, not this script's
        clean_exists = False
        dirty: list[tuple[str, list[str], list[tuple[str, int]]]] = []
        for code, ingredients in alts:
            violations: list[tuple[str, int]] = []
            for ing_id in ingredients:
                if ing_id in primitives:
                    continue
                ing_ds = ds_of(ing_id)
                if ing_ds is None:
                    continue  # unknown/state id — not this script's job either
                if ing_ds > result["ds"]:
                    key = exception_key(code, result_id, ing_id)
                    if key in exception_keys:
                        used_exception_keys.add(key)
                        continue
                    violations.append((ing_id, ing_ds))
            if violations:
                dirty.append((code, ingredients, violations))
            else:
                clean_exists = True
        if not dirty:
            continue
        if clean_exists:
            convenience_recipes += 1
            continue
        detail = "; ".join(
            f"[{code}] {'+'.join(ingredients)} needs "
            + ", ".join(f"'{iid}' ({by_id[iid]['n']}, ds={ids})" for iid, ids in viol)
            for code, ingredients, viol in dirty
        )
        errors.append(
            f"CH1/CH2 '{result_id}' ({result['n']}, {result['date']}, ds={result['ds']}) has NO "
            f"chronologically consistent recipe — every alternative needs a later-dated ingredient: {detail}"
        )

    # ---- CH3 — group every producing transform by its output id -----------
    state_ids = {s["id"] for s in processing.get("states", [])}
    transforms_by_out: dict[str, list[str]] = defaultdict(list)  # out_id -> [action, ...]
    for t in processing.get("transforms", []):
        action = t.get("action")
        if action not in TECHNIQUE_SORT_DS:
            continue
        for out_id in t.get("out", []):
            if out_id in state_ids:
                continue  # a state's own date is derived from its parent, not an independent claim
            if out_id in primitives:
                continue  # a primitive is a raw material found in nature, not an invented date to violate
            transforms_by_out[out_id].append(action)

    convenience_transforms = 0
    for out_id, actions in transforms_by_out.items():
        out_ds = ds_of(out_id)
        if out_ds is None:
            continue
        clean_exists = False
        dirty: list[tuple[str, int]] = []
        for action in actions:
            anchor = TECHNIQUE_SORT_DS[action]
            if anchor > out_ds:
                key = exception_key("CH3", out_id, action)
                if key in exception_keys:
                    used_exception_keys.add(key)
                    continue
                dirty.append((action, anchor))
            else:
                clean_exists = True
        if not dirty:
            continue
        if clean_exists:
            convenience_transforms += 1
            continue
        detail = ", ".join(f"'{a}' (anchor ds={anc})" for a, anc in dirty)
        errors.append(
            f"CH3 '{out_id}' ({by_id[out_id]['n']}, {by_id[out_id]['date']}, ds={out_ds}) has NO technique "
            f"that could have produced it in time — every producing action is anchored later: {detail}"
        )

    if convenience_recipes:
        info.append(
            f"INFO convenience_alt_recipes {convenience_recipes} discoveries have a later-dated alternative "
            f"recipe alongside a chronologically valid one — not an error, see module docstring"
        )
    if convenience_transforms:
        info.append(
            f"INFO convenience_alt_transforms {convenience_transforms} outputs are also produced by a later "
            f"technique alongside a chronologically valid one — not an error, see module docstring"
        )

    unused = sorted(exception_keys - used_exception_keys)
    for key in unused:
        info.append(f"INFO exceptions_unused '{key}' — no longer matches a contradiction; consider removing it")
    for e in malformed_exceptions:
        errors.append(f"CH0 exception entry missing a 'reason': {e}")

    source_required = [n["id"] for n in nodes if "source_required" in n.get("src", [])]
    info.append(f"INFO nodes.source_required {len(source_required)} discoveries have no verified subject-level source yet")

    stats = {
        "nodes_total": len(nodes),
        "base_recipes_checked": base_recipes_checked,
        "processing_recipes_checked": processing_recipes_checked,
        "transforms_checked": len(processing.get("transforms", [])),
        "results_with_recipes": len(recipe_alts),
        "outputs_from_transforms": len(transforms_by_out),
        "exceptions_registered": len(exceptions),
        "exceptions_used": len(used_exception_keys),
        "exceptions_unused": len(unused),
        "errors": len(errors),
    }

    if as_json:
        print(json.dumps({"stats": stats, "errors": errors, "info": info}, indent=2))
        return 1 if errors else 0

    print("=" * 68)
    print("  EVOLUTION SANDBOX — CHRONOLOGY AUDIT (structural only)")
    print("=" * 68)
    for key, value in stats.items():
        print(f"  {key:<28} {value}")
    print("-" * 68)
    if errors:
        print(f"  CONTRADICTIONS ({len(errors)}):")
        for line in errors:
            print(f"    ✗ {line}")
    else:
        print("  CONTRADICTIONS: none")
    print("-" * 68)
    for line in info:
        print(f"    · {line}")
    print("=" * 68)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
