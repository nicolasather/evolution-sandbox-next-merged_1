"""Claim → source graph (WP012, WP020).

A claim is only `checked` when ALL hold: it names at least one source, every
source exists in the registry (or the batch's own declared new sources), at
least one of them is subject-level (`scope: topic`, the same bar validate.py
E10 applies to nodes), and a reviewer, a date and a `checkNote` saying what was
actually checked are recorded. Anything else stays `pending`. `source_required`
is never a source.
"""
from __future__ import annotations

import csv
import io
import re
from typing import Any

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LAYERS = ("l1", "l2", "l3")
SOURCE_REQUIRED = "source_required"
MIN_NOTE = 12


def source_problems(sid: str, s: dict) -> list[str]:
    """Mirror of validate.py E11 so batch-declared sources meet the same bar."""
    p: list[str] = []
    if s.get("t") not in ("S", "A", "B"):
        p.append("tier")
    for f in ("title", "org", "url", "type"):
        if not s.get(f):
            p.append(f"missing_{f}")
    if s.get("url") and not str(s["url"]).startswith("https://"):
        p.append("url_not_https")
    if s.get("scope") not in ("general", "topic"):
        p.append("scope")
    if not DATE_RE.match(str(s.get("checked", ""))):
        p.append("checked_date")
    return p


def claim_status(claim: dict, registry: dict[str, dict]) -> tuple[str, list[str]]:
    """Return ('checked'|'pending', reasons)."""
    why: list[str] = []
    ids = claim.get("sourceIds") or []
    if not ids:
        why.append("claim_source_missing")
    for sid in ids:
        if sid == SOURCE_REQUIRED:
            why.append("source_required_is_not_a_source")
        elif sid not in registry:
            why.append("claim_source_unknown")
    topic = [s for s in ids if registry.get(s, {}).get("scope") == "topic"]
    if ids and not topic and not why:
        why.append("claim_only_general_sources")
    if not claim.get("reviewedBy") or not DATE_RE.match(str(claim.get("reviewDate", ""))):
        why.append("claim_not_reviewed")
    if len(str(claim.get("checkNote", "")).strip()) < MIN_NOTE:
        why.append("claim_check_note_missing")
    if not str(claim.get("text", "")).strip():
        why.append("claim_text_empty")
    return ("pending" if why else "checked"), sorted(set(why))


def evidence_rows(seeds: list[dict], registry: dict[str, dict]) -> list[dict[str, Any]]:
    """One row per claim: what supports it, and what is still missing."""
    rows = []
    for s in seeds:
        for c in s.get("claims", []):
            status, why = claim_status(c, registry)
            rows.append({
                "itemId": s.get("itemId"), "claimId": c.get("claimId"), "layer": c.get("layer"),
                "status": status, "sourceIds": ";".join(c.get("sourceIds") or []),
                "scopes": ";".join(registry.get(x, {}).get("scope", "?") for x in c.get("sourceIds") or []),
                "reviewedBy": c.get("reviewedBy", ""), "reviewDate": c.get("reviewDate", ""),
                "checkNote": c.get("checkNote", ""), "uncertainty": c.get("uncertainty", ""),
                "missing": ";".join(why),
            })
    return rows


def rows_to_csv(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return out.getvalue()
