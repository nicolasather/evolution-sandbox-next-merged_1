"""Audit and exception reports (WP002, WP020, WP025, WP022)."""
from __future__ import annotations

import collections
from pathlib import Path
from typing import Any

from .catalogue import (STATUS_PENDING, STATUS_PLACEHOLDER, STATUS_STATE, STATUS_UNCERTAIN, STATUS_VERIFIED,
                        Catalogue)
from .keys import legacy_key


def audit(cat: Catalogue) -> dict[str, Any]:
    """Truth-status audit of the existing catalogue. Never upgrades a status; never edits data."""
    by_status: dict[str, list[str]] = collections.defaultdict(list)
    rows = []
    per_file: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for n in cat.nodes:
        st = cat.status_of(n)
        by_status[st].append(n["id"])
        per_file[cat.node_file[n["id"]]][st] += 1
        real = [s for s in n["src"] if s != "source_required"]
        rows.append({
            "id": n["id"], "no": n.get("no"), "status": st, "era": n["era"], "ds": n["ds"],
            "sourcesTopic": sum(1 for s in real if cat.sources.get(s, {}).get("scope") == "topic"),
            "sourcesGeneral": sum(1 for s in real if cat.sources.get(s, {}).get("scope") == "general"),
            "sourceRequired": "source_required" in n["src"], "file": cat.node_file[n["id"]],
            "dateUncertain": bool(n.get("caution") or n.get("confidence")),
        })
    for sid in cat.states:
        by_status[STATUS_STATE].append(sid)
    owners: dict[str, list[str]] = collections.defaultdict(list)
    for tid, rs in cat.recipe_rows.items():
        for r in rs:
            owners[legacy_key(r)].append(tid)
    collisions = {k: sorted(set(v)) for k, v in owners.items() if len(set(v)) > 1}
    slot_hist = collections.Counter(len(r) for rs in cat.recipe_rows.values() for r in rs)
    multi = sum(1 for rs in cat.recipe_rows.values() if len(rs) > 1)
    return {
        "schemaVersion": 1,
        "totals": {"nodes": len(cat.nodes), "workedStates": len(cat.states),
                   **{k: len(by_status.get(k, [])) for k in (STATUS_VERIFIED, STATUS_UNCERTAIN, STATUS_PENDING,
                                                             STATUS_PLACEHOLDER, STATUS_STATE)}},
        "placeholderIds": sorted(by_status.get(STATUS_PLACEHOLDER, [])),
        "perFile": {f: dict(c) for f, c in sorted(per_file.items())},
        "recipeSlotHistogram": dict(sorted(slot_hist.items())),
        "nodesWithMultipleRoutes": multi,
        "recipeKeyCollisions": collisions,
        "sourceRegistry": {"total": len(cat.sources),
                           "topic": sum(1 for s in cat.sources.values() if s.get("scope") == "topic"),
                           "general": sum(1 for s in cat.sources.values() if s.get("scope") == "general")},
        "note": "Statuses are derived from the authored src/caution fields only. 'verified' means a subject-level "
                "source is cited, not that the entry was independently re-checked. Placeholders keep their ids and "
                "numbers; nothing here changes any data.",
        "nodes": rows,
    }


def batch_exception_report(ev) -> dict[str, Any]:
    """What the editor needs to look at: nothing about recipes they were never asked to write."""
    items = []
    counts = collections.Counter()
    for s in ev.seeds:
        iid = s.get("itemId")
        sr = ev.seed_results.get(iid) or ev.seed_results.get(next(iter(ev.seed_results), ""), {})
        rep = ev.reports.get(iid, {})
        facts_ready = iid in ev.facts_ok
        if not facts_ready:
            outcome = "facts_pending"
        else:
            outcome = rep.get("status", "no_decision")
        counts[outcome] += 1
        items.append({
            "itemId": iid, "outcome": outcome,
            "factIssues": sr.get("reasons", []) if not facts_ready else [],
            "anchorIssues": rep.get("reasons", []) if outcome not in ("valid_candidate",) else [],
            "missingPrerequisites": rep.get("missingPrerequisites", []),
            "needsReview": rep.get("review", []), "warnings": sorted(set(sr.get("warnings", []) + rep.get("warnings", []))),
        })
    return {"schemaVersion": 1, "batch": ev.paths.batch, "fixture": ev.fixture, "counts": dict(counts),
            "items": items}


def dependency_report(ev) -> dict[str, list[str]]:
    """Missing prerequisite → seeds that were blocked by it (so the next import batch knows what to add)."""
    out: dict[str, list[str]] = collections.defaultdict(list)
    for iid, rep in ev.reports.items():
        for m in rep.get("missingPrerequisites", []) or []:
            out[m].append(iid)
    return {k: sorted(v) for k, v in sorted(out.items())}
