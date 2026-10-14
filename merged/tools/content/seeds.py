"""VerifiedSeedInput: recipe-free editorial records (WP011, WP013, WP014).

The editor supplies a real name, sourced claims, chronology and material facts.
A recipe field is an ERROR here: the primary route is Claude's job (anchor.py).
Nothing in this module can mark a claim as verified on its own.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from .catalogue import ERA_INDEX, Catalogue
from .evidence import LAYERS, claim_status, source_problems
from .keys import ITEM_ID_RE

SCHEMA_VERSION = 3
FORBIDDEN_RECIPE_KEYS = ("rec", "recipe", "anchorRecipe", "ingredientIds", "ingredients", "singleAnchorRecipe")
TRUTH_OK = ("editor_reviewed", "reviewed_with_uncertainty")
TRUTH_ALL = TRUTH_OK + ("pending_evidence", "placeholder_legacy")
FAMILIES = (
    "stone", "wood", "bone", "fibre", "earth", "ceramic", "metal", "glass", "liquid",
    "composite", "organic", "abstract",
)
ARCHETYPES = (
    "stone_fragment", "polished_stone", "blade", "axe", "hafted_tool", "wood_rod", "woven_fibre", "vessel",
    "wheel", "brick", "metal_ingot", "circuit", "plant", "abstract_diagram", "bone_tool", "bead",
)
CATEGORIES = (
    "material", "technique", "technology", "biology", "culture", "society", "knowledge", "science",
    "engineering", "energy", "computing", "media", "economy",
)
MODES = (
    "main-evolution", "survival", "civilization", "archaeology", "escape-room", "decipher",
    "alien-archaeology", "reverse-evolution", "minimum-path",
)
YEAR_MIN, YEAR_MAX = -4_000_000, 2100


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def content_hash(obj: Any) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def fold(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().casefold())


def placed_year(seed: dict) -> int | None:
    """The sort year the editor's own chronology supports. Never derived from recipes."""
    c = seed.get("chronology") or {}
    if c.get("anchorYear") is not None:
        return int(c["anchorYear"])
    lo, hi = c.get("rangeStart"), c.get("rangeEnd")
    if lo is not None and hi is not None:
        return int((lo + hi) // 2)
    return None


def earliest_year(seed: dict) -> int | None:
    """Earliest year the item could exist, for ingredient chronology checks."""
    c = seed.get("chronology") or {}
    if c.get("rangeStart") is not None:
        return int(c["rangeStart"])
    if c.get("anchorYear") is not None:
        return int(c["anchorYear"])
    return None


def index_batch(seeds: list[dict]) -> tuple[dict[str, list[str]], dict[str, int]]:
    """Folded label → seed ids, and id → occurrence count: built once so a batch of thousands stays O(n)."""
    labels: dict[str, list[str]] = {}
    counts: dict[str, int] = {}
    for s in seeds:
        iid = s.get("itemId")
        counts[iid] = counts.get(iid, 0) + 1
        for lab in [s.get("canonicalName", "")] + list(s.get("aliases") or []):
            labels.setdefault(fold(str(lab)), []).append(iid)
    return labels, counts


def validate_seed(seed: dict, cat: Catalogue, registry: dict[str, dict],
                  label_index: dict[str, list[str]] | None = None, id_counts: dict[str, int] | None = None) -> dict:
    """Structural + evidence validation. `ok` means the FACTS are publishable; it says nothing about a recipe."""
    reasons: list[str] = []
    warnings: list[str] = []
    out: dict[str, Any] = {"itemId": seed.get("itemId"), "claimStatus": {}}

    if seed.get("schemaVersion") != SCHEMA_VERSION:
        reasons.append("unsupported_seed_schema")
    for k in FORBIDDEN_RECIPE_KEYS:
        if k in seed:
            reasons.append(f"editor_supplied_recipe:{k}")
    iid = seed.get("itemId", "")
    if not isinstance(iid, str) or not ITEM_ID_RE.fullmatch(iid):
        reasons.append("invalid_seed_id")
    name = seed.get("canonicalName", "")
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 100:
        reasons.append("invalid_name")

    # identity: ids, names and aliases must not collide with the catalogue or each other
    if iid in cat.by_id or iid in cat.states:
        reasons.append("id_collides_with_catalogue")
    taken = {fold(n["n"]): n["id"] for n in cat.nodes}
    taken.update({fold(s["n"]): s["id"] for s in cat.states.values()})
    labels = [name] + list(seed.get("aliases") or [])
    seen_local: set[str] = set()
    for lab in labels:
        f = fold(str(lab))
        if f in seen_local:
            reasons.append("duplicate_alias_in_seed")
        seen_local.add(f)
        if f in taken:
            reasons.append(f"name_collides_with_catalogue:{taken[f]}")
    for lab in seen_local:
        for other in (label_index or {}).get(lab, []):
            if other != iid:
                reasons.append(f"name_collides_with_seed:{other}")
    if (id_counts or {}).get(iid, 1) > 1:
        reasons.append("duplicate_seed_id")

    # truth + approval
    if seed.get("truthStatus") not in TRUTH_ALL:
        reasons.append("invalid_truth_status")
    elif seed["truthStatus"] not in TRUTH_OK:
        reasons.append("unverified_item")
    ap = seed.get("editorApproval") or {}
    if not ap.get("approved") or not ap.get("editorId"):
        reasons.append("editor_facts_not_approved")

    # claims
    claims = seed.get("claims") or []
    if not claims:
        reasons.append("missing_claims")
    ids_seen: set[str] = set()
    for c in claims:
        cid = c.get("claimId")
        if not cid or cid in ids_seen:
            reasons.append("claim_id_missing_or_duplicate")
        ids_seen.add(cid)
        if c.get("layer") not in LAYERS + ("ev",):
            reasons.append(f"claim_layer_invalid:{cid}")
        st, why = claim_status(c, registry)
        out["claimStatus"][cid] = st
        if st != "checked":
            reasons.extend(f"{w}:{cid}" for w in why)
    present = {c.get("layer") for c in claims}
    for layer in LAYERS:
        if layer not in present:
            reasons.append(f"missing_layer:{layer}")
    if not str(seed.get("evidenceLabel", "")).strip():
        reasons.append("missing_evidence_label")

    # chronology (no false precision, never derived from the recipe graph)
    ch = seed.get("chronology") or {}
    if not ch.get("display") or ch.get("era") not in ERA_INDEX:
        reasons.append("chronology_missing")
    else:
        a, lo, hi = ch.get("anchorYear"), ch.get("rangeStart"), ch.get("rangeEnd")
        for v in (a, lo, hi):
            if v is not None and (not isinstance(v, int) or isinstance(v, bool) or not YEAR_MIN <= v <= YEAR_MAX):
                reasons.append("invalid_chronology")
                break
        if (lo is None) != (hi is None) or (lo is not None and lo > hi):
            reasons.append("invalid_chronology_range")
        if a is None and lo is None:
            reasons.append("chronology_unplaced")
        if not str(ch.get("uncertainty", "")).strip():
            reasons.append("chronology_uncertainty_missing")
        elif a is not None and lo is None and re.search(r"[c≈~?]|circa|about|around|approx", ch["display"], re.I) \
                and "uncertain" not in ch["uncertainty"].lower() and ch.get("disputed") is not True:
            warnings.append("possible_false_precision")
        if ch.get("disputed") is True and seed.get("truthStatus") == "editor_reviewed":
            warnings.append("disputed_date_but_truth_status_is_plain_reviewed")

    # visual + material facts
    vb = seed.get("visualBrief") or {}
    if vb.get("archetype") not in ARCHETYPES:
        reasons.append("visual_archetype_unknown")
    mp = seed.get("materialProperties") or {}
    if mp.get("family") not in FAMILIES:
        reasons.append("material_family_missing")
    if seed.get("category") not in CATEGORIES:
        reasons.append("category_invalid")
    for m in seed.get("modeEligibility") or []:
        if m not in MODES:
            reasons.append(f"unknown_mode:{m}")
    if not seed.get("tags"):
        warnings.append("no_tags")

    out["ok"] = not reasons
    out["reasons"] = sorted(set(reasons))
    out["warnings"] = sorted(set(warnings))
    out["contentHash"] = content_hash(seed)
    return out


def validate_batch_sources(batch: dict, registry: dict[str, dict]) -> tuple[dict[str, dict], list[str]]:
    """Merge batch-declared new sources over the real registry, rejecting malformed or id-clashing ones."""
    merged = dict(registry)
    problems: list[str] = []
    for sid, s in (batch.get("sources") or {}).items():
        if sid in registry and registry[sid] != s:
            problems.append(f"source_id_clash:{sid}")
            continue
        bad = source_problems(sid, s)
        if bad:
            problems.append(f"source_malformed:{sid}:{','.join(bad)}")
            continue
        merged[sid] = s
    return merged, problems
