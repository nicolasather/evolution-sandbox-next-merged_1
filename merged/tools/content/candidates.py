"""Bounded candidate retrieval (WP030) — never an n×n pair generator.

For one fixed target, shortlist at most MAX_POOL admissible ingredient ids using
chronology, material/role relevance and process capability. An empty pool is a
normal result (`no_approved_result`); the pool is never widened to fill it.
"""
from __future__ import annotations

from .catalogue import ERA_INDEX, STATUS_PLACEHOLDER, Catalogue, Profile
from .causal import ACTION_NEEDS, ARCHETYPE_RULES, FAMILY_FLOW, ROLE_PRED, Target

MIN_POOL, MAX_POOL = 10, 50


def relevant_roles(target: Target) -> tuple[str, ...]:
    rule = ARCHETYPE_RULES.get(target.archetype or "")
    base = list(rule[0]) if rule else []
    if rule:
        for act in rule[1]:
            base.extend(ACTION_NEEDS.get(act, ()))
    return tuple(dict.fromkeys(base))


def shortlist(cat: Catalogue, target: Target, extra: dict[str, Profile] | None = None) -> list[dict]:
    """Admissible ingredients, best first. Pure function of data; deterministic order."""
    if target.earliest_year is None:
        return []
    roles = relevant_roles(target)
    rule = ARCHETYPE_RULES.get(target.archetype or "")
    must = tuple(r for r in (rule[0] if rule else ()) if r != "workpiece")
    flow = FAMILY_FLOW.get(target.family) or set()
    depth = cat.depths()
    scored: list[tuple[float, int, int, str, Profile, list[str]]] = []
    for p in list(cat.profiles.values()) + list((extra or {}).values()):
        if p.id == target.id or p.status == STATUS_PLACEHOLDER or p.is_state:
            continue
        if p.ds > target.earliest_year or ERA_INDEX.get(p.era, 0) > ERA_INDEX.get(target.era, 0):
            continue
        hit = [r for r in roles if ROLE_PRED[r](p)]
        in_flow = p.family in flow or (target.family == "composite" and p.family not in ("abstract",))
        if not hit and not in_flow:
            continue
        # the components the object truly needs count most; generic "workpiece" fit barely counts
        score = 3 * sum(1 for r in hit if r in must) + sum(1 for r in hit if r not in must and r != "workpiece") \
            + (0.5 if "workpiece" in hit else 0) + (0.5 if in_flow else 0)
        scored.append((-score, depth.get(p.id, 99), abs(target.earliest_year - p.ds), p.id, p, hit))
    scored.sort(key=lambda t: (t[0], t[1], t[2], t[3]))
    out = []
    for _s, _dp, _d, _i, p, hit in scored[:MAX_POOL]:
        out.append({
            "id": p.id, "name": p.name, "era": p.era, "ds": p.ds, "family": p.family,
            "tags": sorted(p.tags), "capabilities": sorted(p.capabilities), "status": p.status,
            "isState": p.is_state, "canFill": hit,
        })
    return out
