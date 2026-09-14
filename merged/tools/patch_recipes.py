#!/usr/bin/env python3
"""Historical recipe patch: resolve E3 pair collisions and wire hidden nodes into the graph.

Applied to data/nodes on 2026-09-09 and kept as the record of what changed.
It is safe to run again: a patch whose result is already in the file is
reported as "already applied" and skipped.

Raw-text replacement so the hand-formatted JSON layout survives. A patch that
is neither applied nor applicable (its target text is missing or ambiguous)
is a hard failure, never a silent no-op.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "nodes"

PATCHES: list[tuple[str, str, str]] = [
    # ---- g1: collision fixes + alt paths + hidden wiring -----------------
    ("g1.json",
     '"rec":[["stone_flake","wood"],["sharp_stone","bone"]]',
     '"rec":[["stone_flake","wood"],["stone_flake","bone"]]'),
    ("g1.json",
     '"rec":[["communication","symbolic_thought"]]',
     '"rec":[["communication","symbolic_thought"],["symbolic_thought","social_gathering"]]'),
    ("g1.json",
     '"rec":[["plant_processing","shelter"],["plant_processing","pottery"]]',
     '"rec":[["plant_processing","shelter"],["plant_processing","pottery"],["meat_processing","smoke"]]'),
    ("g1.json",
     '"rec":[["teaching","social_gathering"],["teaching","language"]]',
     '"rec":[["teaching","social_gathering"],["teaching","language"],["cave_art","teaching"]]'),
    ("g1.json",
     '"rec":[["art","social_gathering"],["art","cooking"]]',
     '"rec":[["art","social_gathering"],["art","cooking"],["music","social_gathering"]]'),

    # ---- g2 --------------------------------------------------------------
    ("g2.json",
     '"rec":[["water_crossing","binding"],["wood","cordage"]]',
     '"rec":[["water_crossing","binding"],["water_crossing","fiber"]]'),
    ("g2.json",
     '"rec":[["settlement","food_storage"],["settlement","agriculture"]]',
     '"rec":[["settlement","food_storage"],["village","food_surplus"],["vaccine","city"]]'),
    ("g2.json",
     '"rec":[["food_surplus","cooperation"],["specialized_labor","migration"]]',
     '"rec":[["food_surplus","migration"],["specialized_labor","migration"]]'),
    ("g2.json",
     '"rec":[["composite_tool","cultivation"],["stone_tool","cultivation"]]',
     '"rec":[["composite_tool","cultivation"],["stone_tool","cultivation"],["bronze_tools","cultivation"]]'),

    # ---- g3 --------------------------------------------------------------
    ("g3.json",
     '"rec":[["brick","cooperation"],["wood","specialized_labor"]]',
     '"rec":[["brick","cooperation"],["wood","specialized_labor"],["mechanical_advantage","cooperation"]]'),
    ("g3.json",
     '"rec":[["trade","taxation"],["accounting","city"]]',
     '"rec":[["trade","taxation"],["accounting","city"],["money","trade"]]'),

    # ---- g4 --------------------------------------------------------------
    ("g4.json",
     '"rec":[["maps","geometry"],["maps","measurement"]]',
     '"rec":[["maps","geometry"],["maps","measurement"],["compass","maps"]]'),
    ("g4.json",
     '"rec":[["optics","experiment"],["optics","measurement"]]',
     '"rec":[["optics","experiment"],["optics","measurement"],["lens","measurement"]]'),
    ("g4.json",
     '"rec":[["magnification","astronomy"],["magnification","metallurgy"]]',
     '"rec":[["magnification","astronomy"],["magnification","metallurgy"],["lens","astronomy"]]'),
    ("g4.json",
     '"rec":[["mathematics","experiment"],["mechanism","mathematics"]]',
     '"rec":[["mathematics","experiment"],["mechanism","mathematics"],["clock","experiment"]]'),
    ("g4.json",
     '"rec":[["statistics","written_knowledge"],["statistics","record_keeping"]]',
     '"rec":[["statistics","written_knowledge"],["statistics","record_keeping"],["scientific_community","statistics"]]'),
    ("g4.json",
     '"rec":[["factory","coal"],["factory","mass_production"]]',
     '"rec":[["factory","coal"],["factory","mass_production"],["locomotive","factory"]]'),
    ("g4.json",
     '"rec":[["standardized_parts","factory"],["standardized_parts","division_of_labor"]]',
     '"rec":[["standardized_parts","factory"],["standardized_parts","division_of_labor"],["electric_motor","standardized_parts"]]'),
    ("g4.json",
     '"rec":[["industrialization","city"],["mass_production","city"]]',
     '"rec":[["industrialization","city"],["mass_production","city"],["automobile","city"],["antibiotics","city"]]'),

    # ---- g5 --------------------------------------------------------------
    ("g5.json",
     '"rec":[["steam_engine","chemistry"],["machine_tools","chemistry"]]',
     '"rec":[["steam_engine","chemistry"],["machine_tools","chemistry"],["gunpowder","machine_tools"]]'),
    ("g5.json",
     '"rec":[["transistor","standardized_parts"],["transistor","mass_production"]]',
     '"rec":[["transistor","standardized_parts"],["transistor","mass_production"],["silicon","transistor"]]'),
    ("g5.json",
     '"rec":[["microprocessor","mass_production"],["microprocessor","software"]]',
     '"rec":[["microprocessor","mass_production"],["microprocessor","software"],["plastic","microprocessor"]]'),
    ("g5.json",
     '"rec":[["internet","storage"],["computer_network","storage"]]',
     '"rec":[["internet","storage"],["computer_network","storage"],["smartphone","internet"]]'),

    # ---- g6: hidden node collision fixes ---------------------------------
    ("g6.json",
     '"rec":[["medicine","magnification"],["biology","chemistry"]]',
     '"rec":[["medicine","chemistry"],["biology","chemistry"]]'),
    ("g6.json",
     '"rec":[["flight","radio"],["flight","radar"]]',
     '"rec":[["flight","radar"],["flight","physics"]]'),
    ("g6.json",
     '"rec":[["smelting","heat_treatment"]]',
     '"rec":[["smelting","heat_treatment"],["pottery","smelting"]]'),
]


def main() -> int:
    applied = skipped = 0
    for filename, old, new in PATCHES:
        path = ROOT / filename
        text = path.read_text(encoding="utf-8")
        if text.count(new) == 1 and old not in text:
            skipped += 1  # already applied on an earlier run
            continue
        count = text.count(old)
        if count != 1:
            print(f"FAIL {filename}: pattern found {count}x (expected 1)\n      {old}")
            return 1
        path.write_text(text.replace(old, new), encoding="utf-8")
        applied += 1
    print(f"applied {applied}, already applied {skipped}, of {len(PATCHES)} patches")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
