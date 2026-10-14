"""Claude-authored primary ("anchor") recipes: request → validate → freeze (WP015, WP021-023).

Flow (no model is called by this code):
  1. `build_requests` writes one envelope per approved seed (prompt A in 04_MODEL_PROMPTS):
     target facts + a bounded, chronologically/materially admissible ingredient shortlist.
  2. Claude Code answers each envelope with EXACTLY ONE decision: `proposed`
     (one recipe) or `anchor_blocked` (reason codes + missing prerequisites).
     Decisions live in data/verified_seeds/<batch>.anchors.json.
  3. `validate_batch` runs every hard rule + an independent role-matching pass.
     Only `valid_candidate` can be frozen; `needs_review` needs an explicit editor
     acceptance; anything else is rejected and the seed stays out of the game.
  4. `freeze` writes the immutable result. Re-running it is byte-identical; a
     different outcome needs a deliberate compiler-version bump.
"""
from __future__ import annotations

from typing import Any

from . import COMPILER_VERSION, RULES_VERSION
from .candidates import shortlist
from .catalogue import ERA_INDEX, Catalogue, Profile
from .causal import (CATALOGUE_FAMILY_OF_SEED, ROLE_VOCAB, Assessment, Target, allowed_actions, assess)
from .keys import legacy_key, recipe_key
from .seeds import content_hash, earliest_year, placed_year

FAMILY_TO_CATALOGUE = {"ceramic": "earth", "composite": "made", "organic": "living"}
SEED_CAT_TO_MATERIAL = {}


def target_of(seed: dict, facts_ok: bool) -> Target:
    fam = CATALOGUE_FAMILY_OF_SEED[seed["materialProperties"]["family"]]
    return Target(
        id=seed["itemId"], family=fam, earliest_year=earliest_year(seed), era=seed["chronology"]["era"],
        archetype=(seed.get("visualBrief") or {}).get("archetype"), facts_ok=facts_ok,
    )


def profile_of_seed(seed: dict, cat: Catalogue) -> Profile:
    fam = FAMILY_TO_CATALOGUE.get(seed["materialProperties"]["family"], seed["materialProperties"]["family"])
    base_tags = set(seed.get("tags") or [])
    return Profile(
        id=seed["itemId"], name=seed["canonicalName"], family=fam, material=fam,
        tags=frozenset(base_tags | set(seed["materialProperties"].get("properties") or [])),
        capabilities=frozenset(), era=seed["chronology"]["era"], ds=placed_year(seed) or 0,
        status="verified", is_state=False, cat=seed["category"],
    )


def build_requests(batch_name: str, seeds: list[dict], cat: Catalogue, ready: set[str], root_actions: list[str],
                   batch_profiles: dict[str, Profile] | None = None) -> dict[str, Any]:
    """Prompt-A envelopes. `ready` = seed ids whose facts passed validation."""
    reqs = []
    for s in seeds:
        if s["itemId"] not in ready:
            continue
        t = target_of(s, True)
        reqs.append({
            "target": {
                "id": s["itemId"], "name": s["canonicalName"],
                "verifiedFacts": {c["layer"] + ":" + c["claimId"]: c["text"] for c in s["claims"]},
                "materials": s["materialProperties"], "chronology": s["chronology"], "visualBrief": s["visualBrief"],
            },
            "allowedIngredients": shortlist(cat, t, batch_profiles),
            "allowedActions": root_actions,
            "roleVocabulary": list(ROLE_VOCAB),
            "answerShape": {
                "proposed": ["status", "targetId", "ingredientIds", "action", "inputRoles", "mechanism",
                             "requiredConditions", "chronologyExplanation", "evidenceClass", "sourceSupportIds",
                             "missingPrerequisites"],
                "anchor_blocked": ["status", "targetId", "reasonCodes", "missingPrerequisites"],
            },
            "rule": "EXACTLY ONE route or anchor_blocked. Never invent ingredients, dates or sources.",
        })
    return {"schemaVersion": 1, "batch": batch_name, "compilerVersion": COMPILER_VERSION, "requests": reqs}


def _blocked_report(d: dict, seed: dict) -> dict:
    codes = d.get("reasonCodes") or []
    miss = d.get("missingPrerequisites") or []
    bad: list[str] = []
    if not codes:
        bad.append("blocked_without_reason")
    if not miss:
        bad.append("blocked_without_missing_prerequisites")
    if bad:
        return {"targetId": seed["itemId"], "status": "rejected", "reasons": bad, "warnings": []}
    return {"targetId": seed["itemId"], "status": "anchor_blocked", "reasons": sorted(set(codes)),
            "missingPrerequisites": sorted(set(miss)), "warnings": []}


def validate_decision(
    d: dict, seed: dict, cat: Catalogue, registry: dict[str, dict], actions: list[str], *,
    facts_ok: bool, batch_profiles: dict[str, Profile], batch_owner: dict[str, str], batch_graph: dict[str, set[str]],
    blocked_ids: set[str],
) -> dict:
    sid = seed["itemId"]
    if d.get("targetId") != sid:
        return {"targetId": sid, "status": "rejected", "reasons": ["target_mismatch"], "warnings": []}
    st = d.get("status")
    if st == "anchor_blocked":
        return _blocked_report(d, seed)
    if st != "proposed":
        return {"targetId": sid, "status": "rejected", "reasons": ["invalid_decision_status"], "warnings": []}
    ing = d.get("ingredientIds")
    if not isinstance(ing, list):
        return {"targetId": sid, "status": "rejected", "reasons": ["INVALID_MULTISET"], "warnings": []}
    extra_bad = [k for k in d if k not in {
        "status", "targetId", "ingredientIds", "action", "inputRoles", "mechanism", "requiredConditions",
        "chronologyExplanation", "evidenceClass", "sourceSupportIds", "missingPrerequisites", "author"}]
    if extra_bad:
        return {"targetId": sid, "status": "rejected", "reasons": [f"unexpected_field:{k}" for k in extra_bad],
                "warnings": []}
    a: Assessment = assess(
        cat, target_of(seed, facts_ok), ing, d.get("action"), d.get("inputRoles"), d.get("mechanism", ""),
        actions=actions, evidence_class=d.get("evidenceClass", ""), source_support=d.get("sourceSupportIds") or [],
        required_conditions=d.get("requiredConditions") or [], batch_profiles=batch_profiles,
        batch_owner=batch_owner, batch_graph=batch_graph,
        acknowledged_placeholders=[], verified_sources=registry,
    )
    reasons = list(a.hard)
    if any(i in blocked_ids for i in ing):
        reasons.append("DEPENDENCY_BLOCKED")
    if d.get("missingPrerequisites"):
        reasons.append("missing_prerequisites")
    if not str(d.get("chronologyExplanation", "")).strip():
        reasons.append("chronology_explanation_missing")
    status = "rejected" if reasons else ("needs_review" if a.review else "valid_candidate")
    out: dict[str, Any] = {
        "targetId": sid, "status": status, "reasons": sorted(set(reasons)), "review": sorted(set(a.review)),
        "warnings": sorted(set(a.warnings)), "detail": a.detail,
    }
    if status != "rejected":
        roles_in = d.get("inputRoles") or []
        # keep each role attached to its ingredient when the ids are put into canonical (sorted) order
        pairs = sorted(zip(ing, roles_in), key=lambda t: t[0]) if len(roles_in) == len(ing) else None
        out["anchor"] = {
            "ingredientIds": sorted(ing), "action": d.get("action"),
            "inputRoles": [r for _i, r in pairs] if pairs else roles_in,
            "mechanism": d["mechanism"].strip(), "requiredConditions": d.get("requiredConditions") or [],
            "chronologyExplanation": d["chronologyExplanation"].strip(), "evidenceClass": d["evidenceClass"],
            "sourceSupportIds": sorted(d.get("sourceSupportIds") or []), "author": "claude_build",
            "recipeKey": recipe_key(ing), "legacyKey": legacy_key(ing),
        }
    return out


def validate_batch(
    seeds: list[dict], decisions: dict[str, dict], facts_ok_ids: set[str], cat: Catalogue,
    registry: dict[str, dict], actions: list[str],
) -> dict[str, dict]:
    """Validate every decision in dependency order. Seeds with no decision are reported, never defaulted."""
    ordered = sorted(seeds, key=lambda s: (placed_year(s) if placed_year(s) is not None else 0, s["itemId"]))
    batch_profiles: dict[str, Profile] = {}
    batch_owner: dict[str, str] = {}
    batch_graph: dict[str, set[str]] = {}
    blocked_ids: set[str] = set()
    reports: dict[str, dict] = {}
    for s in ordered:
        sid = s["itemId"]
        if sid not in facts_ok_ids:
            reports[sid] = {"targetId": sid, "status": "facts_not_ready", "reasons": ["seed_facts_not_publishable"],
                            "warnings": []}
            blocked_ids.add(sid)
            continue
        d = decisions.get(sid)
        if d is None:
            reports[sid] = {"targetId": sid, "status": "no_decision", "reasons": ["no_anchor_decision_yet"],
                            "warnings": []}
            blocked_ids.add(sid)
            continue
        rep = validate_decision(d, s, cat, registry, actions, facts_ok=True, batch_profiles=batch_profiles,
                                batch_owner=batch_owner, batch_graph=batch_graph, blocked_ids=blocked_ids)
        reports[sid] = rep
        if rep["status"] in ("valid_candidate", "needs_review"):
            batch_profiles[sid] = profile_of_seed(s, cat)
            batch_owner[rep["anchor"]["legacyKey"]] = sid
            batch_graph[sid] = set(rep["anchor"]["ingredientIds"])
        else:
            blocked_ids.add(sid)
    return reports


def freeze_entry(seed: dict, rep: dict, reviewer: str | None = None) -> dict:
    """The immutable record. `anchorHash` covers everything that defines the route."""
    a = dict(rep["anchor"])
    core = {"targetId": seed["itemId"], "ingredientIds": a["ingredientIds"], "action": a["action"],
            "compilerVersion": COMPILER_VERSION, "rulesVersion": RULES_VERSION, "seedHash": content_hash(seed)}
    entry = {
        **a, "targetId": seed["itemId"], "seedHash": core["seedHash"], "compilerVersion": COMPILER_VERSION,
        "rulesVersion": RULES_VERSION, "anchorHash": content_hash(core),
        "reviewStatus": "auto_valid" if rep["status"] == "valid_candidate" else "editor_accepted",
        "warnings": rep.get("warnings", []), "review": rep.get("review", []),
    }
    if reviewer:
        entry["acceptedBy"] = reviewer
    return entry
