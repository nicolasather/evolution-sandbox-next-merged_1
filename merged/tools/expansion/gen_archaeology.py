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
# Ancient individual-recipe expansion (g12): topic tag -> template category
CAT.update({t: c for c, ts in {
    "pottery": ["pottery_kilns", "fermentation_ancient"],
    "structural": ["fields_soil", "food_storage", "water_collection", "irrigation_civilizations", "hydraulic_machines_ancient", "sanitation_urban",
                   "urban_housing", "stone_architecture_ancient", "earth_construction", "city_infrastructure", "roads_land", "bridges_water_crossings",
                   "river_boats", "sea_vessels", "wheel_carts", "defence_fortifications", "ancient_mechanics", "american_african_asian"],
    "organic": ["pastoral_tools", "harvest_processing", "preservation_ancient", "draft_animals_ancient", "fiber_flax_silk", "wool_cotton_textiles", "healing_plants"],
    "lithic": ["ploughing_systems", "milling_baking", "copper_technology", "bronze_industry", "iron_industry", "ore_mines", "weights_measures_ancient", "medical_practice"],
    "ornament": ["ancient_navigation", "dyes_garments", "trade_networks_ancient", "music_and_performing"],
    "ritual": ["money_ledgers", "ancient_writing", "books_learning", "ancient_governance", "ancient_law", "observational_astronomy", "ancient_mathematics", "ritual_social_artifacts"],
}.items() for t in ts})
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
    nodes = [(n, False) for n in json.loads((ROOT / "data/nodes/g11.json").read_text(encoding="utf-8"))]
    g12 = ROOT / "data/nodes/g12.json"
    if g12.exists():
        nodes += [(n, True) for n in json.loads(g12.read_text(encoding="utf-8"))]
    for n, ancient in nodes:
        topic = next((t for t in n["tags"] if t in CAT), None)
        # anc27 items are ancient by construction (era 'science' there means ancient measurement / mathematics); the pack's own
        # per-item mode metadata decides whether a thing can be dug up at all (institutions, algorithms and rites cannot)
        if ancient and not (n.get("modeMeta", {}).get("archaeology", {}).get("candidate")):
            continue
        if not topic or (n["era"] not in OK_ERAS and not (ancient and n["era"] == "science")):
            continue
        cat = CAT[topic]
        out.append({"id": "x-" + n["id"], "label": n["n"], "material": MAT[cat], "category": cat,
                    "commonFunction": first_sentence(n["l1"]), "affinity": AFF[cat], "rarity": 1, "itemId": n["id"]})
    p = ROOT / "data/expansion/archaeology_templates.json"
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(out)} archaeology templates")


if __name__ == "__main__":
    main()
