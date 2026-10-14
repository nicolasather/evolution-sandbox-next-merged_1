"""Deterministic physical / technological / chronological causality rules.

This is the rejection-first core (V3 07_STRICT_CRAFT_LOGIC). It does NOT prove
real-world chemistry or archaeology. It refuses combinations that lack a
concrete input→result transformation, and routes anything it cannot judge to
`needs_review` — never to success. Model confidence is not an input.

Hard reject codes (spec): NO_CAUSAL_MECHANISM, MATERIAL_IMPOSSIBLE,
MISSING_REQUIRED_COMPONENT, PROCESS_UNAVAILABLE, ERA_CONFLICT,
RECIPE_ALREADY_CLAIMED, CYCLE_OR_SELF_REFERENCE, UNVERIFIED_TARGET,
UNVERIFIED_INGREDIENT, WEAK_SEMANTIC_ASSOCIATION, UNKNOWN_CONDITIONS,
INSUFFICIENT_EVIDENCE, NO_APPROVED_RESULT.
Extensions (sub-cases, documented in docs/VERIFIED_CONTENT_PIPELINE.md):
INVALID_MULTISET, UNKNOWN_INGREDIENT, ROLE_MISMATCH, ROLES_INCOMPLETE,
ACTION_NOT_ALLOWED, TARGET_IN_INPUTS, DEPENDENCY_BLOCKED, STATE_NOT_ALLOWED_IN_BASE_RECIPE.
"""
from __future__ import annotations

import itertools
import re
from dataclasses import dataclass, field
from pathlib import Path

from .catalogue import ERA_INDEX, STATUS_PLACEHOLDER, Catalogue, Profile
from .keys import RecipeKeyError, legacy_key, recipe_key

# --------------------------------------------------------------------------
# vocabulary
# --------------------------------------------------------------------------
EXTRA_ACTIONS = ("assemble",)

ROLE_VOCAB = (
    "head", "edge", "haft", "binding", "fibre_stock", "workpiece", "striker", "abrasive", "plastic_body",
    "heat_source", "fuel", "liquid_medium", "mold", "ore", "knowledge", "living_stock", "tool",
)

WEAK_PHRASES = re.compile(
    r"\b(symbolic(ally)?|represents?|reminds? of|associated with|theme|thematic|related to|idea of|"
    r"spirit of|inspired by|magic(al)?|somehow|vibe)\b", re.I)

MIN_MECHANISM = 40


def _has(p: Profile, *t: str) -> bool:
    return any(x in p.tags for x in t)


def _cap(p: Profile, *c: str) -> bool:
    return any(x in p.capabilities for x in c)


def _physical(p: Profile) -> bool:
    return p.family not in ("abstract",)


# role → predicate over a real catalogue profile. The predicates read game data
# (tags, capabilities, families), never names.
ROLE_PRED = {
    "head": lambda p: (p.family in ("stone", "bone", "metal") and _has(p, "hard")) or _cap(p, "edged", "hammer") or p.family == "metal",
    "edge": lambda p: _cap(p, "edged", "metalblade"),
    "haft": lambda p: _has(p, "woody") and p.family == "wood",
    "binding": lambda p: _cap(p, "cord") or (_has(p, "fibrous") and p.family == "fibre"),
    "fibre_stock": lambda p: _has(p, "fibrous"),
    "workpiece": _physical,
    "striker": lambda p: _cap(p, "hammer") or (p.family == "stone" and _has(p, "hard")),
    "abrasive": lambda p: (p.family == "stone" and _has(p, "hard")) or (_has(p, "glassy") and _has(p, "loose")),
    "plastic_body": lambda p: _has(p, "plastic"),
    "heat_source": lambda p: _cap(p, "flame") or p.family == "flame",
    "fuel": lambda p: _has(p, "flammable", "burnable", "woody", "fibrous") and p.family != "made",
    "liquid_medium": lambda p: _has(p, "fluid"),
    "mold": lambda p: _cap(p, "mold"),
    "ore": lambda p: _has(p, "mineral") and ("ore" in p.id or p.family == "metal"),
    "knowledge": lambda p: p.family == "abstract",
    "living_stock": lambda p: p.family == "living" or _has(p, "living"),
    "tool": lambda p: p.family == "made" or bool(p.capabilities),
}

# action → what the hands/ingredients must provide (any single role satisfied by some ingredient)
ACTION_NEEDS = {
    "tie": ("binding",), "twist": ("fibre_stock",), "pull": ("fibre_stock",), "stretch": ("fibre_stock",),
    "heat": ("heat_source",), "burn": ("heat_source",),
    "hammer": ("striker",), "split": ("striker",), "chisel": ("edge", "striker"),
    "cut": ("edge",), "saw": ("edge",), "carve": ("edge",), "scrape": ("edge",),
    "grind": ("abrasive",), "polish": ("abrasive",),
    "mix": ("liquid_medium", "plastic_body", "fibre_stock"), "pour": ("liquid_medium",),
    "shape": ("plastic_body", "fibre_stock", "haft"), "dig": ("tool",),
}
ACTIONS_NEEDING_CONDITIONS = {"heat", "burn", "dry", "cool", "pour"}

# archetype → (mandatory roles, actions that can realise it, target family it implies)
ARCHETYPE_RULES = {
    "hafted_tool": (("head", "haft", "binding"), ("tie", "assemble"), "composite"),
    "axe": (("head", "haft", "binding"), ("tie", "assemble"), "composite"),
    "blade": (("workpiece", "striker"), ("smash", "split", "hammer", "press", "chisel"), "stone"),
    "stone_fragment": (("workpiece", "striker"), ("smash", "split", "hammer"), "stone"),
    "polished_stone": (("workpiece", "abrasive"), ("grind", "polish"), "stone"),
    "wood_rod": (("workpiece", "edge"), ("cut", "carve", "scrape", "split", "saw"), "wood"),
    "woven_fibre": (("fibre_stock", "binding"), ("twist", "tie", "pull", "shape"), "fibre"),
    "vessel": (("plastic_body", "heat_source"), ("heat", "shape"), "ceramic"),
    "brick": (("plastic_body", "liquid_medium", "mold"), ("shape", "press", "mix"), "ceramic"),
    "metal_ingot": (("ore", "heat_source"), ("heat", "pour"), "metal"),
    "bone_tool": (("workpiece", "abrasive"), ("grind", "carve", "scrape", "cut"), "bone"),
    "bead": (("workpiece", "abrasive"), ("grind", "polish", "carve"), "stone"),
}
# archetypes the rules cannot judge: always reviewed by a human, never auto-frozen
REVIEW_ONLY_ARCHETYPES = ("wheel", "circuit", "plant", "abstract_diagram")

# which families a result of a given family may come out of, per allowed action
FAMILY_FLOW = {
    "stone": {"stone"}, "wood": {"wood"}, "bone": {"bone"}, "fibre": {"fibre"},
    "earth": {"earth", "liquid"}, "ceramic": {"earth"},          # ceramic needs heat on earth
    "metal": {"metal", "stone"},                                  # ore is a mineral in the data
    "glass": {"glass", "earth"}, "liquid": {"liquid"},
    "composite": None,                                            # ≥2 distinct physical families
    "organic": {"wood", "fibre", "bone", "living", "earth"},
    "abstract": {"abstract"},
}
CERAMIC_ACTIONS = {"heat", "burn"}
CATALOGUE_FAMILY_OF_SEED = {
    "stone": "stone", "wood": "wood", "bone": "bone", "fibre": "fibre", "earth": "earth", "ceramic": "ceramic",
    "metal": "metal", "glass": "glass", "liquid": "liquid", "composite": "composite", "organic": "organic",
    "abstract": "abstract",
}


def allowed_actions(root: Path) -> list[str]:
    """ActionId union parsed from lib/types.ts (single source of truth) + process labels."""
    text = (root / "lib" / "types.ts").read_text(encoding="utf-8")
    m = re.search(r"export type ActionId\s*=([^;]*);", text, re.S)
    if not m:
        raise RuntimeError("types.ts: ActionId union not found")
    acts = re.findall(r"'(\w+)'", m.group(1))
    if len(acts) < 15:
        raise RuntimeError("types.ts: ActionId parsed suspiciously few actions")
    return acts + [a for a in EXTRA_ACTIONS if a not in acts]


@dataclass
class Target:
    id: str
    family: str
    earliest_year: int | None
    era: str
    archetype: str | None = None
    new_item: bool = True
    facts_ok: bool = True


@dataclass
class Assessment:
    hard: list[str] = field(default_factory=list)
    review: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    detail: dict = field(default_factory=dict)

    @property
    def status(self) -> str:
        if self.hard:
            return "no_result"
        if self.review:
            return "needs_review"
        return "valid_candidate"

    def add(self, code: str, *, review: bool = False) -> None:
        bucket = self.review if review else self.hard
        if code not in bucket:
            bucket.append(code)


def match_roles(required: tuple[str, ...], profiles: list[Profile]) -> bool:
    """Independent check: can DISTINCT ingredients be assigned to every required role by data alone?"""
    if len(required) > len(profiles):
        return False
    for perm in itertools.permutations(range(len(profiles)), len(required)):
        if all(ROLE_PRED[r](profiles[i]) for r, i in zip(required, perm)):
            return True
    return False


def assess(
    cat: Catalogue,
    target: Target,
    ingredient_ids: list[str],
    action: str | None,
    roles: list[str] | None,
    mechanism: str,
    *,
    actions: list[str],
    evidence_class: str = "plausible_reconstruction",
    source_support: list[str] | None = None,
    required_conditions: list[str] | None = None,
    batch_profiles: dict[str, Profile] | None = None,
    batch_owner: dict[str, str] | None = None,
    batch_graph: dict[str, set[str]] | None = None,
    acknowledged_placeholders: list[str] | None = None,
    verified_sources: dict[str, dict] | None = None,
) -> Assessment:
    a = Assessment()
    batch_profiles = batch_profiles or {}

    # ---- multiset shape -------------------------------------------------
    try:
        key = recipe_key(ingredient_ids)
    except RecipeKeyError as e:
        a.add("INVALID_MULTISET")
        a.detail["multisetError"] = str(e)
        return a
    a.detail["recipeKey"] = key

    if not target.facts_ok:
        a.add("UNVERIFIED_TARGET")

    # ---- ingredients exist and are admissible ------------------------------
    profs: list[Profile] = []
    for i in ingredient_ids:
        p = cat.profiles.get(i) or batch_profiles.get(i)
        if p is None:
            a.add("UNKNOWN_INGREDIENT")
            continue
        profs.append(p)
        if p.is_state:
            # a base recipe may only name catalogue nodes; worked states exist only inside processing.json
            a.add("STATE_NOT_ALLOWED_IN_BASE_RECIPE")
            a.detail.setdefault("states", []).append(i)
        if p.status == STATUS_PLACEHOLDER and i not in (acknowledged_placeholders or []):
            a.add("UNVERIFIED_INGREDIENT")
        elif p.status == "pending_evidence":
            a.warnings.append(f"ingredient_evidence_pending:{i}")
    if i_missing := [i for i in ingredient_ids if i not in cat.profiles and i not in batch_profiles]:
        a.detail["unknownIngredients"] = sorted(set(i_missing))
    if len(profs) != len(ingredient_ids):
        return a

    # ---- identity / graph ------------------------------------------------------
    if target.id in ingredient_ids:
        a.add("TARGET_IN_INPUTS")
        a.add("CYCLE_OR_SELF_REFERENCE")
    graph = cat.dependency_graph()
    for k, v in (batch_graph or {}).items():
        graph.setdefault(k, set()).update(v)
    if any(cat.depends_on(i, target.id, graph) for i in ingredient_ids if i != target.id):
        a.add("CYCLE_OR_SELF_REFERENCE")
    owner = cat.owner_of(ingredient_ids) or (batch_owner or {}).get(legacy_key(ingredient_ids))
    if owner is not None and owner != target.id:
        a.add("RECIPE_ALREADY_CLAIMED")
        a.detail["claimedBy"] = owner
    elif owner == target.id:
        a.add("RECIPE_ALREADY_CLAIMED")      # an anchor must be a NEW route, not a restatement
        a.detail["claimedBy"] = owner

    # ---- chronology ------------------------------------------------------------
    if target.earliest_year is None:
        a.add("ERA_CONFLICT")
        a.detail["chronology"] = "target has no placed year"
    else:
        for p in profs:
            if p.ds > target.earliest_year:
                a.add("ERA_CONFLICT")
                a.detail.setdefault("eraConflicts", []).append(p.id)
            elif ERA_INDEX.get(p.era, 0) > ERA_INDEX.get(target.era, 0):
                a.add("ERA_CONFLICT")
                a.detail.setdefault("eraConflicts", []).append(p.id)

    # ---- process --------------------------------------------------------------------
    if action is not None and action not in actions:
        a.add("ACTION_NOT_ALLOWED")
        a.add("PROCESS_UNAVAILABLE")
    if action is None and target.archetype in ARCHETYPE_RULES:
        a.add("PROCESS_UNAVAILABLE")
        a.detail["processNote"] = "this kind of object needs a named work action"
    if action in ACTION_NEEDS:
        needs = ACTION_NEEDS[action]
        if not any(ROLE_PRED[r](p) for r in needs for p in profs):
            a.add("PROCESS_UNAVAILABLE")
            a.detail["actionNeeds"] = list(needs)
    if action in ACTIONS_NEEDING_CONDITIONS and not (required_conditions or []):
        a.add("UNKNOWN_CONDITIONS", review=True)

    # ---- roles (declared) + independent role matching -------------------------------
    roles = roles or []
    if len(roles) != len(ingredient_ids) or any(r not in ROLE_VOCAB for r in roles):
        a.add("ROLES_INCOMPLETE")
        a.add("NO_CAUSAL_MECHANISM")
    else:
        for i, r, p in zip(ingredient_ids, roles, profs):
            if not ROLE_PRED[r](p):
                a.add("ROLE_MISMATCH")
                a.detail.setdefault("roleMismatch", []).append(f"{i}:{r}")
    mech = (mechanism or "").strip()
    if len(mech) < MIN_MECHANISM:
        a.add("NO_CAUSAL_MECHANISM")
    if WEAK_PHRASES.search(mech):
        a.add("WEAK_SEMANTIC_ASSOCIATION")

    # ---- archetype components + material flow --------------------------------------
    rule = ARCHETYPE_RULES.get(target.archetype or "")
    if target.archetype in REVIEW_ONLY_ARCHETYPES:
        a.add("ARCHETYPE_NOT_AUTOMATICALLY_JUDGEABLE", review=True)
    elif rule:
        need_roles, ok_actions, _implied = rule
        if action not in ok_actions:
            a.add("PROCESS_UNAVAILABLE")
            a.detail["archetypeActions"] = list(ok_actions)
        if roles and len(roles) == len(ingredient_ids):
            declared = set(roles)
            if not set(need_roles) <= declared:
                a.add("MISSING_REQUIRED_COMPONENT")
                a.detail["missingRoles"] = sorted(set(need_roles) - declared)
        if not match_roles(need_roles, profs):
            a.add("MISSING_REQUIRED_COMPONENT")        # independent of anything the proposal claimed
    elif target.archetype is not None:
        a.add("ARCHETYPE_UNKNOWN", review=True)

    fam = target.family
    fams = {p.family for p in profs}
    phys = {f for f in fams if f not in ("abstract", "flame")}
    flow_ok = True
    if fam == "composite":
        flow_ok = len(phys) >= 2
    elif fam == "ceramic":
        flow_ok = "earth" in fams and action in CERAMIC_ACTIONS
    elif fam == "abstract":
        flow_ok = "abstract" in fams
    elif fam in FAMILY_FLOW and FAMILY_FLOW[fam] is not None:
        flow_ok = bool(fams & FAMILY_FLOW[fam])
        if fam == "metal" and not ({"metal"} & fams or any(ROLE_PRED["ore"](p) for p in profs)):
            flow_ok = False
    else:
        flow_ok = False
    if not flow_ok:
        a.add("MATERIAL_IMPOSSIBLE")

    # ---- evidence class -------------------------------------------------------------
    if evidence_class not in ("documented", "plausible_reconstruction", "educational_simulation"):
        a.add("INSUFFICIENT_EVIDENCE")
    elif evidence_class == "documented":
        good = [s for s in (source_support or []) if (verified_sources or cat.sources).get(s, {}).get("scope") == "topic"]
        if not good:
            a.add("INSUFFICIENT_EVIDENCE")
    a.detail["evidenceClass"] = evidence_class
    return a
