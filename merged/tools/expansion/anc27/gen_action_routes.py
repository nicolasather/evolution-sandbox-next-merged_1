#!/usr/bin/env python3
"""Draft ordered ACTION routes (lib/processing/multistep.ts plans) for every anc27 item -> data/expansion/anc27_action_routes.json

Each plan: stock = the ingredients of the item's SECOND authored merge route (so it differs from the primary 2-5 piece recipe), actionSteps = an
ordered list of gestures that already exist in the game (the 25 techniques + 'assemble'), chosen from words in the item's name. They are design
drafts: reviewStatus PENDING_REVIEW and completeReadyForGame false, so multistep.validatePlan rejects every one until a human approves it.
Nothing here claims the action order is how the object was historically made.
"""
import json, os, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
items = json.load(open(os.path.join(ROOT, "data", "nodes", "g12.json"), encoding="utf-8"))
SUPPORTED = {'brush','smash','cut','separate','dig','carve','scrape','grind','pull','twist','tie','stretch','mix','shape','pour','heat','cool','dry','burn','hammer','split','press','saw','chisel','polish','assemble'}
RULES = [  # (regex on lowercase name, kind, steps)
 (r"casting|mould|mold|crucible|lost wax|investment|ingot|bell casting|cauldron", "physical_process", ["heat", "pour", "cool", "polish"]),
 (r"smelt|bloom|furnace|reduction|roasting|slag", "physical_process", ["burn", "heat", "separate", "hammer"]),
 (r"forg|anvil|tongs|hammering|annealing|reheating|quench|steel|carbon enriched|hearth|drawing|sheet raising", "physical_process", ["heat", "hammer", "cool"]),
 (r"kiln|oven|baking|tandoor|pottery|ceramic|faience|stoneware|glaze|burnished|slipping|urn|jar|amphora|bowl|pot\b|vat", "physical_process", ["shape", "dry", "burn", "cool"]),
 (r"brick|mudbrick|adobe|cob |puddled|rammed|plaster|wattle", "physical_process", ["mix", "shape", "dry"]),
 (r"loom|weav|tapestry|tablet weaving|backstrap", "physical_process", ["twist", "tie", "pull", "assemble"]),
 (r"spindle|yarn|spinning|flax|linen|wool|carded|felt|thread|rope|cord|knot|net\b", "physical_process", ["separate", "twist", "stretch", "tie"]),
 (r"dye|indigo|tannin|tie dyed|resist", "physical_process", ["mix", "heat", "dry"]),
 (r"needle|stitch|embroidery|tunic|cloak|garment|belt|quilt|sewing", "physical_process", ["cut", "tie", "assemble"]),
 (r"quern|mortar|pestle|grinding|milling|metate|hopper|flour|sieve|winnow|threshing|flail", "physical_process", ["carve", "grind", "separate"]),
 (r"beer|mead|vinegar|fermenter|garum|sauce|sourdough|yogurt|cheese|pickled|brine|salted|salt cured|leavening", "physical_process", ["mix", "pour", "dry"]),
 (r"smok|drying|desiccated|cured", "physical_process", ["cut", "dry", "burn"]),
 (r"chisel|ashlar|column|capital|pylon|obelisk|megalith|orthostat|trilithon|masonry|keystone|stone .*(wall|tower|platform)|pyramid|stele|sarcophagus|monument", "physical_process", ["split", "chisel", "polish", "assemble"]),
 (r"pick|quarry|mine|mining|fire setting|ore ", "environmental_construction", ["dig", "smash", "separate"]),
 (r"road|bridge|causeway|ford|track|path|pier|abutment|aqueduct|viaduct|embankment|curb|milestone|paved|street", "environmental_construction", ["dig", "carve", "press", "assemble"]),
 (r"canal|ditch|drain|sewer|culvert|well|cistern|reservoir|qanat|falaj|spillway|weir|headgate|gate|irrigation|spring|gutter|pipe", "environmental_construction", ["dig", "shape", "press", "assemble"]),
 (r"field|terrace|plot|bed|garden|chinampa|waru|rotation|fallow|mulch|manured|intercrop", "environmental_construction", ["dig", "shape", "brush"]),
 (r"wall|fort|palisade|tower|gatehouse|rampart|bastion|citadel|camp|moat|battlement|barrier|beacon", "environmental_construction", ["dig", "split", "assemble"]),
 (r"house|hut|longhouse|roundhouse|granary|silo|storehouse|shelter|cellar|loft|dwelling|chamber|courtyard|room|station|market|warehouse|wharf|dock", "environmental_construction", ["cut", "carve", "assemble"]),
 (r"boat|canoe|raft|ship|hull|barge|ferry|scow|coracle|galley|dhow|anchor|paddle|sail", "physical_process", ["saw", "carve", "assemble", "polish"]),
 (r"wheel|axle|cart|wagon|chariot|yoke|harness|saddle|bridle|stirrup|collar|plough|ard |harrow|sickle|hoe|spade|blade|axe|adze|awl|hook|spear|tool", "physical_process", ["carve", "shape", "assemble"]),
 (r"flute|aulos|harp|lyre|lute|drum|trumpet|bell|chime|zither|panpipes|instrument|kithara|shofar", "physical_process", ["carve", "scrape", "assemble", "polish"]),
 (r"tablet|stylus|ledger|inscription|record|script|scroll|codex|ostracon|stele|archive|catalogue|seal|token|notice|decree|contract", "physical_process", ["shape", "carve", "press", "dry"]),
 (r"scalpel|forceps|probe|splint|bandage|poultice|remedy|dressing|surgical|dental|medical|drill|speculum|catheter|cautery|herb", "physical_process", ["cut", "mix", "heat", "assemble"]),
 (r"balance|weight|scale|measur|gnomon|plumb|rod|chain|level|groma|compass|abacus|counting|astronom|armillary|globe|dioptra|sight", "physical_process", ["carve", "polish", "assemble"]),
]
DEFAULT = ("physical_process", ["shape", "assemble"])
plans, seen = [], {}
for n in items:
    name = n["n"].lower() + " "
    kind, steps = next(((k, s) for rx, k, s in RULES if re.search(rx, name)), DEFAULT)
    steps = [s for s in steps if s in SUPPORTED]
    if steps[-1] != "assemble": steps = steps + ["assemble"]
    stock = n["rec"][1]  # second authored route
    plan = {"outputId": n["id"], "kind": kind, "stock": list(stock),
            "actionSteps": [{"action": a, "implementedInGame": True} for a in steps],
            "environmentGates": [], "knowledgeGates": [], "additionalRequirements": [],
            "reviewStatus": "PENDING_REVIEW", "completeReadyForGame": False,
            "note": "Auto-drafted gesture order. Not a historical claim; needs human review before approval."}
    sig = json.dumps([kind, sorted(stock), [[a, []] for a in steps]])
    assert sig not in seen, (n["id"], seen.get(sig))
    seen[sig] = n["id"]
    plans.append(plan)
out = {"_note": "Draft ordered action routes for the anc27 items. All PENDING_REVIEW; multistep.validatePlan rejects them until approved.", "count": len(plans), "plans": plans}
json.dump(out, open(os.path.join(ROOT, "data", "expansion", "anc27_action_routes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(plans), "plans;", Counter(p["kind"] for p in plans), Counter(len(p["actionSteps"]) for p in plans))
