"""Optional alternative routes to EXISTING targets (WP031, WP033, WP037, WP038, WP040).

Zero proposals is a normal, successful answer. A proposal is a draft: it is not
playable until an editor approves its exact hash AND a publish step writes the
reviewed overlay. It can never create or rename an item.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import itertools
from typing import Any

from .candidates import shortlist
from .catalogue import STATUS_PENDING, STATUS_PLACEHOLDER, Catalogue
from .causal import ARCHETYPE_RULES, ROLE_PRED, Target, allowed_actions, assess
from .keys import RecipeKeyError, legacy_key, recipe_key
from .seeds import canonical_json

MAX_PER_BATCH = 3
MAX_PUBLISHED_PER_TARGET = 2
FORBIDDEN_FIELDS = ("name", "canonicalName", "newItem", "newItems", "itemName", "output")
ALLOWED_FIELDS = {"schemaVersion", "targetId", "ingredientIds", "action", "inputRoles", "mechanism",
                  "evidenceClass", "sourceSupportIds", "uncertainties", "origin", "requiredConditions"}


def proposal_id(p: dict) -> str:
    core = {k: p.get(k) for k in ("targetId", "ingredientIds", "action", "mechanism", "evidenceClass")}
    core["ingredientIds"] = sorted(core["ingredientIds"] or [])
    return hashlib.sha256(canonical_json(core).encode()).hexdigest()[:20]


def _signature(cat: Catalogue, ident: str) -> tuple:
    p = cat.profiles[ident]
    return (p.family, tuple(sorted(p.capabilities)))


def _is_substitution(cat: Catalogue, new: list[str], old: list[str]) -> bool:
    """Same route with exactly one ingredient swapped for a like-for-like one (a synonym, not a mechanism)."""
    if len(new) != len(old):
        return False
    a, b = sorted(new), list(sorted(old))
    only_new = [x for x in a if x not in b or a.count(x) > b.count(x)]
    only_old = [x for x in b if x not in a or b.count(x) > a.count(x)]
    if len(only_new) != 1 or len(only_old) != 1:
        return False
    return all(i in cat.profiles for i in (only_new[0], only_old[0])) and \
        _signature(cat, only_new[0]) == _signature(cat, only_old[0])


def target_for(cat: Catalogue, tid: str) -> Target | None:
    n = cat.by_id.get(tid)
    if n is None:
        return None
    p = cat.profiles[tid]
    v3 = getattr(cat, "v3_items", {}).get(tid)
    fam = (v3 or {}).get("materialProperties", {}).get("family") or p.family
    return Target(id=tid, family=fam, earliest_year=n["ds"], era=n["era"],
                  archetype=((v3 or {}).get("visualBrief") or {}).get("archetype"), new_item=False,
                  facts_ok=p.status in ("verified", "verified_with_uncertainty"))


def validate_alternative(cat: Catalogue, p: dict, actions: list[str], *, published_counts: dict[str, int] | None = None,
                         batch_count_for_target: int = 0, registry: dict | None = None) -> dict:
    """Return {status: valid_candidate|needs_review|no_result, reasons, review, detail}."""
    reasons: list[str] = []
    review: list[str] = []
    tid = p.get("targetId")
    if p.get("schemaVersion") != 1:
        reasons.append("invalid_proposal_schema")
    for k in FORBIDDEN_FIELDS:
        if k in p:
            reasons.append(f"new_item_field_forbidden:{k}")
    for k in p:
        if k not in ALLOWED_FIELDS and k not in FORBIDDEN_FIELDS:
            reasons.append(f"unexpected_field:{k}")
    t = target_for(cat, tid) if isinstance(tid, str) else None
    if t is None:
        reasons.append("UNVERIFIED_TARGET")
        return {"status": "no_result", "reasons": sorted(set(reasons)), "review": [], "detail": {}}
    prof = cat.profiles[tid]
    if prof.status in (STATUS_PLACEHOLDER, STATUS_PENDING):
        reasons.append("UNVERIFIED_TARGET")
    ing = p.get("ingredientIds")
    if not isinstance(ing, list):
        return {"status": "no_result", "reasons": sorted(set(reasons + ["INVALID_MULTISET"])), "review": [], "detail": {}}
    a = assess(cat, t, ing, p.get("action"), p.get("inputRoles"), p.get("mechanism", ""), actions=actions,
               evidence_class=p.get("evidenceClass", ""), source_support=p.get("sourceSupportIds") or [],
               required_conditions=p.get("requiredConditions") or [], verified_sources=registry)
    reasons += a.hard
    review += a.review
    if not reasons:
        for old in cat.recipe_rows.get(tid, []):
            if _is_substitution(cat, ing, old):
                reasons.append("REDUNDANT_SUBSTITUTION")
                break
        if batch_count_for_target >= MAX_PER_BATCH:
            reasons.append("TOO_MANY_PROPOSALS_FOR_TARGET")
        if (published_counts or {}).get(tid, 0) >= MAX_PUBLISHED_PER_TARGET:
            reasons.append("TOO_MANY_PUBLISHED_ALTERNATIVES")
        before = cat.depths().get(tid)
        after = cat.depths(extra_rows={tid: [ing]}).get(tid)
        if before is not None and after is not None and after <= before - 2:
            reasons.append("PROGRESSION_SHORTCUT")
        a.detail["depthBefore"], a.detail["depthAfter"] = before, after
    # an alternative is ALWAYS a human decision; "valid" means only "worth reviewing"
    status = "no_result" if reasons else "needs_review"
    return {"status": status, "reasons": sorted(set(reasons)), "review": sorted(set(review) | ({"editor_decision_required"} if not reasons else set())),
            "detail": a.detail, "warnings": a.warnings}


def rules_only_suggestions(cat: Catalogue, target_id: str, anchor_ids: list[str] | None, archetype: str | None,
                           actions: list[str], limit: int = MAX_PER_BATCH) -> list[dict]:
    """Offline suggestions. Needs a known object archetype; otherwise the honest answer is NONE."""
    t = target_for(cat, target_id)
    rule = ARCHETYPE_RULES.get(archetype or "")
    if t is None or rule is None:
        return []
    t.archetype = archetype
    need_roles, ok_actions, _ = rule
    pool = shortlist(cat, t)
    by_role: dict[str, list[str]] = {r: [x["id"] for x in pool if r in x["canFill"]] for r in need_roles}
    if any(not v for v in by_role.values()):
        return []
    out: list[dict] = []
    seen_keys = {recipe_key(anchor_ids)} if anchor_ids else set()
    anchor_fams = {cat.profiles[i].family for i in anchor_ids or [] if i in cat.profiles}
    for combo in itertools.product(*[by_role[r][:6] for r in need_roles]):
        ids = list(combo)
        if len(set(ids)) != len(ids) and not all(ROLE_PRED[r](cat.profiles[i]) for r, i in zip(need_roles, ids)):
            continue
        try:
            k = recipe_key(ids)
        except RecipeKeyError:
            continue
        if k in seen_keys or cat.owner_of(ids):
            continue
        fams = {cat.profiles[i].family for i in ids}
        if anchor_fams and fams == anchor_fams and sorted(ids)[0:0] == []:
            # same material families as the anchor: a synonym, not a distinct mechanism
            continue
        action = ok_actions[0]
        prop = {
            "schemaVersion": 1, "targetId": target_id, "ingredientIds": sorted(ids), "action": action,
            "inputRoles": list(need_roles),
            "mechanism": ("Rule-based draft: " + "; ".join(f"{i} serves as {r}" for r, i in zip(need_roles, ids))
                          + f"; worked with '{action}'. Needs editor review of real-world practice."),
            "evidenceClass": "educational_simulation", "uncertainties": ["generated from role rules, not from a source"],
            "origin": "rules_only",
        }
        v = validate_alternative(cat, prop, actions)
        if v["status"] != "no_result":
            out.append(prop)
            seen_keys.add(k)
        if len(out) >= limit:
            break
    return out


def new_store(batch: str) -> dict:
    return {"schemaVersion": 1, "batch": batch, "proposals": {}}


def add_to_store(store: dict, p: dict, verdict: dict, model: dict | None = None) -> str:
    pid = proposal_id(p)
    now = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
    entry = store["proposals"].get(pid)
    if entry is None:
        entry = {"proposalId": pid, "proposal": p, "verdict": verdict, "model": model or {"provider": "none"},
                 "status": "rejected_by_rules" if verdict["status"] == "no_result" else "pending_review",
                 "history": [{"at": now, "event": "created", "by": "pipeline"}]}
        store["proposals"][pid] = entry
    return pid


def apply_review(store: dict, decision: dict, now: str | None = None) -> str:
    """Idempotent, append-only. Needs the proposal hash AND reviewer; item approval is a separate concept."""
    pid = decision.get("proposalId")
    entry = store["proposals"].get(pid)
    if entry is None:
        return "unknown_proposal"
    if decision.get("proposalHash") != pid:
        return "hash_mismatch"
    if not decision.get("reviewer") or decision.get("decision") not in ("approve", "reject"):
        return "invalid_decision"
    if entry["status"] == "rejected_by_rules":
        return "cannot_approve_rule_rejected"
    target_state = "approved" if decision["decision"] == "approve" else "rejected"
    if entry["status"] == target_state:
        return "unchanged"
    if entry["status"] == "published":
        return "already_published"
    entry["status"] = target_state
    entry["history"].append({"at": now or _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
                             "event": target_state, "by": decision["reviewer"], "reason": decision.get("reason", "")})
    return "ok"
