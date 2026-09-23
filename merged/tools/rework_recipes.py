#!/usr/bin/env python3
"""Recipe rework, 2026-09: one result per pair, everything reachable, more routes.

Why this exists
---------------
When the 102 Stone Age nodes were added, 34 unordered ingredient pairs ended
up declared for two to five different results. The engine indexes pairs in a
map, so only the LAST declaration ever fired: `cordage + wood` produced Bow and
never Binding, Raft, Lashing or Bundle. Combined with nine nodes that had no
recipe at all, a player could reach only 50 of 322 entries from the four raw
materials. That, far more than a lack of hints, is what made the game feel
like guessing.

What it does
------------
`RECIPES` below is the full recipe list for every node it names; it replaces
that node's `rec` outright. Nodes it does not name keep theirs. Every route
added here is a *gameplay* route — a plausible "these two ideas lead to that
one" — not a claim about how or where something was first made. The exhibit
text says so (see `caution` handling in tools/rewrite_placeholders.py).

It is idempotent: running it twice changes nothing the second time. After it,
`tools/validate.py` must report no E3 (pair ambiguity) and no E4 (unreachable).

  python3 tools/rework_recipes.py            apply
  python3 tools/rework_recipes.py --check    report only, exit 1 on problems
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_DIR = ROOT / "data" / "nodes"
PRIMITIVES = ["stone", "wood", "bone", "fiber"]


RECIPES: dict[str, list[list[str]]] = {
    # ── the raw-material pairs (only ten exist, so each one matters) ──────
    # stone+stone → sharp_stone, wood+wood → fire, bone+bone → needle,
    # fiber+fiber → cordage, stone+wood → hafted_tool, stone+bone → stone_flake,
    # stone+fiber → cutting, wood+bone → spear, wood+fiber → plant,
    # bone+fiber → fishing
    "plant": [["wood", "fiber"]],
    "grass": [["plant", "fiber"], ["plant", "plant"]],
    "lever": [["lumber", "stone"], ["wood", "hammering"]],

    # ── collisions resolved: the pair stays with the core entry ───────────
    "stone_flake": [["sharp_stone", "stone"], ["stone", "bone"]],
    "mortar": [["pestle", "stone"], ["hammering", "sharp_stone"]],
    "stone_tool": [["stone_flake", "wood"], ["sharp_stone", "stone_flake"]],
    "scraper": [["scraping", "stone_flake"], ["stone_tool", "stone_flake"]],
    "kindling": [["carving_knife", "wood"], ["lumber", "fiber"]],
    "engraver": [["bone", "stone_flake"], ["needle", "stone_flake"]],
    "cordage": [["fiber", "fiber"], ["fiber", "cutting"]],
    "cloth": [["weaving_shuttle", "fiber"], ["weaving_shuttle", "flax_fiber"], ["net", "needle"]],
    "binding": [["cordage", "wood"], ["cordage", "stone_tool"]],
    "raft": [["water_crossing", "binding"], ["water_crossing", "lumber"]],
    "lashing": [["rope", "wood"], ["binding", "lumber"]],
    "bundle": [["plant", "cordage"], ["grass", "binding"]],
    "bow": [["lumber", "cordage"], ["hardened_spear", "cordage"]],
    "sewing": [["needle", "cordage"], ["thread_and_needle", "scraping"]],
    "fishing_hook": [["needle", "fishing"], ["bone", "fishing"]],
    "weaving_shuttle": [["needle", "rope"], ["carving_knife", "cordage"]],
    "needle": [["bone", "sharp_stone"], ["bone", "scraping"], ["bone", "bone"]],
    "bone_container": [["bone", "chisel"], ["bone", "hammering"]],
    "flute": [["bone", "awl"], ["music", "bone"]],
    "shelter": [["wood", "binding"], ["wood", "grass"], ["lumber", "thatch"]],
    "thatch": [["grass", "fiber"], ["grass", "cordage"]],
    "thatch_roof": [["thatch", "wood"], ["thatch", "shelter"]],
    "mat": [["thatch", "fiber"], ["grass", "grass"]],
    "spear": [["composite_tool", "wood"], ["wood", "sharp_stone"], ["wood", "bone"]],
    "chisel": [["hammering", "stone_flake"], ["sharp_stone", "lumber"]],
    "wooden_bowl": [["wood", "chisel"], ["wood", "scraper"]],
    "bullroarer": [["carving_knife", "rope"], ["lumber", "ritual"]],
    "fishing": [["water_crossing", "spear"], ["cordage", "bone"], ["bone", "fiber"]],
    "ladder": [["lashing", "lumber"], ["lumber", "lumber"]],
    "trophy_necklace": [["hunting", "cordage"], ["bone", "rope"]],
    "smudge_fire": [["smoke", "grass"], ["smoke", "fiber"]],
    "fire": [["wood", "wood"], ["bow_drill", "fiber"]],
    "bow_drill": [["bow", "wood"], ["cordage", "kindling"]],
    "microblade": [["stone_flake", "stone_flake"], ["engraver", "stone_flake"]],
    "hearth": [["fire", "stone"], ["campfire", "stone"]],
    "controlled_fire": [["fire", "hearth"], ["fire", "shelter"]],
    "boiling_stone": [["hearth", "stone"], ["hearth", "sharp_stone"]],
    "kiln": [["hearth", "stone_hut"], ["controlled_fire", "stone_hut"]],
    "smokehouse": [["smoke", "shelter"], ["smoke", "fish_drying_rack"]],
    "sauna": [["boiling_stone", "shelter"], ["hearth", "shelter"]],
    "campfire": [["fire", "wood"], ["fire", "kindling"]],
    "smoke": [["fire", "fiber"], ["fire", "grass"]],
    "dugout_canoe": [["adze", "wood"], ["fire", "lumber"]],
    "fishing_technology": [["fishing", "cordage"], ["boat", "fishing"]],
    "fishing_line": [["fishing_hook", "cordage"], ["fishing_hook", "fiber"]],
    "torch": [["fire", "hafted_tool"], ["fire", "bundle"]],
    "brand": [["torch", "hafted_tool"], ["fire", "pickaxe"]],
    "pickaxe": [["bone", "hafted_tool"], ["hafted_tool", "hammering"]],
    "hoe": [["hafted_tool", "plant"], ["hafted_tool", "cultivation"]],
    "axe": [["cordage", "hafted_tool"], ["binding", "sharp_stone"]],
    "flail": [["lumber", "rope"], ["hammering", "rope"]],
    "hardened_spear": [["fire", "spear"], ["controlled_fire", "spear"]],
    "beacon": [["campfire", "smoke"], ["torch", "landscape_knowledge"]],
    "stone_spear": [["spear", "stone_flake"], ["spear", "binding"]],
    "javelin": [["hardened_spear", "stone_flake"], ["spear", "hunting"]],
    "harpoon": [["cordage", "spear"], ["fishing", "stone_spear"]],
    "atlatl": [["spear", "lever"], ["hafted_tool", "spear"]],
    "bolas": [["cordage", "sharp_stone"], ["rope", "stone"]],
    "slingshot": [["cordage", "stone"], ["rope", "hunting"]],
    "anchor": [["rope", "sharp_stone"], ["raft", "stone"]],
    "scythe": [["microblade", "wood"], ["microblade", "hafted_tool"]],
    "weight": [["net", "stone"], ["cordage", "stone_flake"]],
    "carving_knife": [["cutting", "wood"], ["stone_tool", "wood"]],
    "tallies": [["engraver", "wood"], ["engraver", "bone"]],
    "bone_saw": [["bone", "cutting"], ["microblade", "bone"]],
    "dice": [["carving_knife", "bone"], ["ritual", "bone"]],
    "charcoal": [["hearth", "wood"], ["smoke", "wood"]],
    "lime": [["kiln", "stone"], ["bone", "fire"]],
    "ash": [["campfire", "fire"], ["charcoal", "fire"]],
    "flint_spark": [["flint", "stone"], ["flint", "sharp_stone"]],
    "heat_treatment": [["controlled_fire", "stone"], ["controlled_fire", "sharp_stone"], ["fire", "stone_flake"]],
    "reinforced_shelter": [["cordage", "shelter"], ["lashing", "shelter"]],
    "tripwire": [["snares", "wood"], ["snares", "cordage"]],
    "fence": [["hafted_tool", "shelter"], ["palisade", "rope"]],
    "workshop": [["shelter", "stone_tool"], ["stone_hut", "hafted_tool"]],
    "net": [["cordage", "fiber"], ["rope", "fiber"]],
    "thread_and_needle": [["needle", "fiber"], ["needle", "plant_thread"]],
    "plant_thread": [["plant", "scraping"], ["plant", "cutting"]],
    "flax_fiber": [["plant", "hammering"], ["plant_knowledge", "fiber"]],
    "pulp": [["plant", "pestle"], ["plant", "mortar"]],
    "embroidery": [["cloth", "thread_and_needle"], ["cloth", "needle"]],
    "camouflage": [["cloth", "grass"], ["cloth", "plant"]],
    # ── second routes for entries that had only one ───────────────────────
    "scraping": [["stone_tool", "bone"], ["stone_tool", "plant"]],
    "hammering": [["stone", "stone_tool"], ["handaxe", "stone"]],
    "composite_tool": [["stone_tool", "binding"], ["hafted_tool", "binding"]],
    "adze": [["hafted_tool", "stone_flake"], ["chisel", "hafted_tool"]],
    "barbed_spear": [["needle", "spear"], ["microblade", "spear"]],
    "snares": [["cordage", "cutting"], ["cordage", "peg"]],
    "awl": [["bone", "needle"], ["sharp_stone", "needle"]],
    "trident": [["fishing", "spear"], ["harpoon", "spear"]],
    "slow_match": [["cordage", "fire"], ["rope", "fire"]],
    "cooked_marrow": [["bone", "hearth"], ["bone", "campfire"]],
    "spit": [["campfire", "spear"], ["hearth", "spear"]],
    "palisade": [["shelter", "wood"], ["shelter", "lumber"]],
    "stone_hut": [["shelter", "stone"], ["shelter", "quarry"]],
    "bone_tent": [["bone", "shelter"], ["bone", "reinforced_shelter"]],
    "rope": [["cordage", "cordage"], ["cordage", "plant_thread"]],
    "tapestry": [["needle", "shelter"], ["cloth", "art"]],
    "pestle": [["stone", "stone_flake"], ["stone", "hammering"]],
    "handaxe": [["sharp_stone", "sharp_stone"], ["sharp_stone", "stone_tool"]],
    "shears": [["cutting", "cutting"], ["cutting", "scraper"]],
    "lumber": [["hafted_tool", "wood"], ["axe", "wood"]],
    "quarry": [["hafted_tool", "stone"], ["pickaxe", "stone"]],
    "peg": [["needle", "wood"], ["carving_knife", "lumber"]],
    "fish_trap": [["wood", "net"], ["fishing", "lumber"]],
    "retiarius_trap": [["net", "rope"], ["net", "weight"]],
    "fish_drying_rack": [["fishing", "shelter"], ["fishing", "smoke"]],
    "pike": [["bone", "spear"], ["spear", "lumber"]],
    "mattock": [["hafted_tool", "sharp_stone"], ["pickaxe", "hoe"]],
    "trench": [["cutting", "shelter"], ["hoe", "shelter"]],
    "spike_trap": [["shelter", "spear"], ["snares", "spear"]],
    "wildfire": [["fire", "fire"], ["fire", "plant"]],
    "weir": [["fishing", "fishing"], ["fish_trap", "stone"]],
}


def load() -> tuple[list[tuple[Path, list[dict]]], dict[str, dict]]:
    files = [(p, json.loads(p.read_text(encoding="utf-8"))) for p in sorted(NODE_DIR.glob("*.json"))]
    by_id = {n["id"]: n for _, arr in files for n in arr}
    return files, by_id


def audit(by_id: dict[str, dict]) -> list[str]:
    problems: list[str] = []
    pairs: dict[tuple[str, str], list[str]] = defaultdict(list)
    for n in by_id.values():
        for a, b in n.get("rec", []):
            for x in (a, b):
                if x not in by_id:
                    problems.append(f"unknown ingredient {x!r} in {n['id']}")
            pairs[tuple(sorted((a, b)))].append(n["id"])
    for k, v in pairs.items():
        if len(set(v)) > 1:
            problems.append(f"pair {k[0]} + {k[1]} → {', '.join(v)}")
    found = set(PRIMITIVES)
    changed = True
    while changed:
        changed = False
        for n in by_id.values():
            if n["id"] in found:
                continue
            if any(a in found and b in found for a, b in n.get("rec", [])):
                found.add(n["id"])
                changed = True
    for nid in by_id:
        if nid not in found:
            problems.append(f"unreachable {nid}")
    return problems


def main() -> int:
    check = "--check" in sys.argv
    files, by_id = load()
    for nid, rec in RECIPES.items():
        if nid not in by_id:
            print(f"RECIPES names unknown node {nid!r}")
            return 1
        if not check:
            by_id[nid]["rec"] = [list(r) for r in rec]
    problems = audit(by_id)
    for p in problems:
        print(p)
    if problems:
        return 1
    if not check:
        for path, arr in files:
            path.write_text(json.dumps(arr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    multi = sum(1 for n in by_id.values() if len(n.get("rec", [])) > 1)
    print(f"ok — {len(by_id)} nodes, all reachable, every pair unique, {multi} with more than one route")
    return 0


if __name__ == "__main__":
    sys.exit(main())
