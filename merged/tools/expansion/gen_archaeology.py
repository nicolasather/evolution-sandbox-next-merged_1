#!/usr/bin/env python3
"""Generate Archaeologist find templates for the exp26 items whose era is no later than 'metallurgy'
(a dig site is an ancient/historic site; later items are not recoverable finds). Output: data/expansion/archaeology_templates.json"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OK_ERAS = {"origins", "fire", "settlement", "agriculture", "civilization", "trade", "metallurgy"}
CAT = {  # topic tag -> template category + affinity profile
    "clay_vessels": "pottery", "fermented_foods": "pottery", "cooking_equipment": "pottery", "glass_vessels": "pottery",
    "architectural_ceramics": "structural", "stone_construction": "structural", "timber_joinery": "structural",
    "irrigation_works": "structural", "watercraft_hulls": "structural", "bridges_and_spans": "structural",
    "road_making": "structural", "public_water_systems": "structural",
    "cordage_and_rope": "organic", "linen_textile": "organic", "wool_manufacture": "organic", "leather_crafting": "organic",
    "basket_and_reedwork": "organic", "cereal_cultivation": "organic", "food_drying": "organic", "sail_technology": "organic",
    "natural_colorants": "ornament", "navigation_instruments": "ornament", "writing_and_binding": "ritual",
    "copper_fabrication": "lithic", "iron_blacksmithing": "lithic",
}
AFF = {
    "pottery": {"permanent-settlement": 0.4, "seasonal-camp": 0.3},
    "structural": {"permanent-settlement": 0.7},
    "organic": {"seasonal-camp": 0.3, "permanent-settlement": 0.4},
    "ornament": {"ceremonial-site": 0.4, "permanent-settlement": 0.2},
    "ritual": {"ceremonial-site": 0.6, "permanent-settlement": 0.2},
    "lithic": {"workshop": 0.6, "permanent-settlement": 0.2},
}
MAT = {"pottery": "fired clay or glass", "structural": "worked earth, timber or stone", "organic": "plant or animal fibre (rarely survives)",
       "ornament": "pigment, bead or fine-worked material", "ritual": "inscribed or deliberately placed object", "lithic": "worked metal or stone"}


def first_sentence(s: str) -> str:
    s = s.split(": ", 1)[-1].strip()
    return s if s.endswith(".") else s + "."


def main():
    out = []
    for n in json.loads((ROOT / "data/nodes/g11.json").read_text(encoding="utf-8")):
        topic = next((t for t in n["tags"] if t in CAT), None)
        if not topic or n["era"] not in OK_ERAS:
            continue
        cat = CAT[topic]
        out.append({"id": "x-" + n["id"], "label": n["n"], "material": MAT[cat], "category": cat,
                    "commonFunction": first_sentence(n["l1"]), "affinity": AFF[cat], "rarity": 1, "itemId": n["id"]})
    p = ROOT / "data/expansion/archaeology_templates.json"
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(out)} archaeology templates")


if __name__ == "__main__":
    main()
