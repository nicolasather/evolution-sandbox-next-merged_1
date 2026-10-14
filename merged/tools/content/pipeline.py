"""Evaluate / freeze a batch (shared by the CLI and the tests)."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import COMPILER_VERSION, RULES_VERSION
from .anchor import freeze_entry, validate_batch, validate_decision, profile_of_seed
from .catalogue import Catalogue
from .causal import allowed_actions
from .evidence import evidence_rows
from .seeds import SCHEMA_VERSION, content_hash, index_batch, validate_batch_sources, validate_seed
from .store import Paths, StoreError, dumps, read_json, write_atomic


@dataclass
class Eval:
    paths: Paths
    batch: dict
    seeds: list[dict]
    registry: dict[str, dict]
    source_problems: list[str]
    cat: Catalogue
    actions: list[str]
    seed_results: dict[str, dict]
    facts_ok: set[str]
    decisions: dict[str, dict]
    reports: dict[str, dict]
    reviews: dict[str, Any] = field(default_factory=dict)

    @property
    def fixture(self) -> bool:
        return bool(self.batch.get("fixture")) or any(s.get("fixture") for s in self.seeds)


def load_batch(root: Path, batch: str) -> tuple[Paths, dict]:
    paths = Paths(root, batch)
    data = read_json(paths.seeds)
    if not isinstance(data, dict) or data.get("schemaVersion") != SCHEMA_VERSION or data.get("batch") != batch:
        raise StoreError("seed_file_schema_or_batch_mismatch")
    if not isinstance(data.get("seeds"), list):
        raise StoreError("seed_file_has_no_seeds")
    return paths, data


def evaluate(root: Path | str, batch: str) -> Eval:
    root = Path(root)
    paths, data = load_batch(root, batch)
    cat = Catalogue.load(root)
    registry, src_problems = validate_batch_sources(data, cat.sources)
    seeds = data["seeds"]
    results: dict[str, dict] = {}
    labels, counts = index_batch(seeds)
    for k, s in enumerate(seeds):
        results[s.get("itemId") or f"<no id #{k}>"] = validate_seed(s, cat, registry, labels, counts)
    facts_ok = {i for i, r in results.items() if r["ok"]}
    decisions: dict[str, dict] = {}
    if paths.decisions.exists():
        raw = read_json(paths.decisions)
        decisions = {d["targetId"]: d for d in raw.get("decisions", []) if isinstance(d, dict) and "targetId" in d}
    actions = allowed_actions(root)
    reviews = read_json(paths.reviews) if paths.reviews.exists() else {}
    reports = validate_batch([s for s in seeds if s.get("itemId") in results], decisions, facts_ok, cat, registry, actions)
    return Eval(paths, data, seeds, registry, src_problems, cat, actions, results, facts_ok, decisions, reports, reviews)


def accepted_anchor_hashes(reviews: dict) -> dict[str, str]:
    return {a["itemId"]: a["anchorHash"] for a in reviews.get("anchorAcceptances", [])
            if a.get("itemId") and a.get("anchorHash") and a.get("reviewer")}


def freeze(ev: Eval, *, revise: dict[str, str] | None = None) -> tuple[dict, list[str]]:
    """Return (frozen document, messages). Never silently changes an existing frozen anchor."""
    msgs: list[str] = []
    old = read_json(ev.paths.frozen) if ev.paths.frozen.exists() else {"anchors": {}, "blocked": {}}
    anchors: dict[str, Any] = dict(old.get("anchors", {}))
    blocked: dict[str, Any] = {}
    accepted = accepted_anchor_hashes(ev.reviews)
    by_seed = {s["itemId"]: s for s in ev.seeds if s.get("itemId") in ev.seed_results}
    for iid, rep in sorted(ev.reports.items()):
        seed = by_seed[iid]
        if rep["status"] in ("valid_candidate", "needs_review"):
            entry = freeze_entry(seed, rep)
            if rep["status"] == "needs_review":
                if accepted.get(iid) != entry["anchorHash"]:
                    msgs.append(f"{iid}: needs_review ({', '.join(rep['review'])}) — not frozen until an editor "
                                f"accepts anchorHash {entry['anchorHash'][:12]}")
                    continue
                entry = freeze_entry(seed, rep, reviewer=next(
                    a["reviewer"] for a in ev.reviews["anchorAcceptances"] if a["itemId"] == iid))
            prev = anchors.get(iid)
            if prev is None:
                anchors[iid] = entry
                msgs.append(f"{iid}: frozen ({entry['anchorHash'][:12]})")
            elif prev["anchorHash"] == entry["anchorHash"]:
                pass                                           # byte-identical re-run
            elif revise and iid in revise:
                entry["revision"] = int(prev.get("revision", 1)) + 1
                entry["revisionReason"] = revise[iid]
                entry["supersedes"] = prev["anchorHash"]
                anchors[iid] = entry
                msgs.append(f"{iid}: REVISED {prev['anchorHash'][:12]} -> {entry['anchorHash'][:12]} ({revise[iid]})")
            else:
                msgs.append(f"{iid}: REFUSED — a different anchor is already frozen; revise explicitly with "
                            f"--revise {iid} --reason \"…\"")
        elif rep["status"] == "anchor_blocked":
            blocked[iid] = {"reasonCodes": rep["reasons"], "missingPrerequisites": rep["missingPrerequisites"],
                            "seedHash": content_hash(seed)}
        else:
            msgs.append(f"{iid}: not frozen ({rep['status']}: {', '.join(rep['reasons'])})")
    # an anchor frozen earlier for a seed that no longer exists / changed facts is stale, never silently dropped
    for iid, e in list(anchors.items()):
        if iid not in by_seed:
            msgs.append(f"{iid}: frozen anchor has no seed any more (kept, will not publish)")
        elif e["seedHash"] != content_hash(by_seed[iid]):
            msgs.append(f"{iid}: seed facts changed after freeze — anchor is STALE, revalidate and --revise")
    doc = {"schemaVersion": 1, "batch": ev.paths.batch, "compilerVersion": COMPILER_VERSION,
           "rulesVersion": RULES_VERSION, "anchors": anchors, "blocked": blocked}
    return doc, msgs


def revalidate_frozen(ev: Eval, frozen: dict) -> dict[str, dict]:
    """Frozen anchors must still pass every rule against the CURRENT catalogue."""
    by_seed = {s["itemId"]: s for s in ev.seeds}
    out: dict[str, dict] = {}
    batch_profiles: dict = {}
    batch_owner: dict[str, str] = {}
    batch_graph: dict[str, set[str]] = {}
    from .seeds import placed_year
    ordered = sorted(frozen["anchors"], key=lambda i: (placed_year(by_seed[i]) or 0, i) if i in by_seed else (0, i))
    for iid in ordered:
        e = frozen["anchors"][iid]
        s = by_seed.get(iid)
        if s is None or iid not in ev.facts_ok:
            out[iid] = {"status": "rejected", "reasons": ["seed_missing_or_facts_not_ready"]}
            continue
        if e["seedHash"] != content_hash(s):
            out[iid] = {"status": "rejected", "reasons": ["STALE_ANCHOR_SEED_CHANGED"]}
            continue
        d = {"status": "proposed", "targetId": iid, "ingredientIds": e["ingredientIds"], "action": e["action"],
             "inputRoles": e["inputRoles"], "mechanism": e["mechanism"], "requiredConditions": e["requiredConditions"],
             "chronologyExplanation": e["chronologyExplanation"], "evidenceClass": e["evidenceClass"],
             "sourceSupportIds": e["sourceSupportIds"], "missingPrerequisites": []}
        rep = validate_decision(d, s, ev.cat, ev.registry, ev.actions, facts_ok=True, batch_profiles=batch_profiles,
                                batch_owner=batch_owner, batch_graph=batch_graph, blocked_ids=set())
        if rep["status"] == "needs_review" and e.get("reviewStatus") == "editor_accepted":
            rep["status"] = "valid_candidate"
        out[iid] = rep
        if rep["status"] == "valid_candidate":
            batch_profiles[iid] = profile_of_seed(s, ev.cat)
            batch_owner[rep["anchor"]["legacyKey"]] = iid
            batch_graph[iid] = set(rep["anchor"]["ingredientIds"])
    return out
