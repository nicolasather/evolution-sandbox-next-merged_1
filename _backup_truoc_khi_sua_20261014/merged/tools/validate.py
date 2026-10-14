#!/usr/bin/env python3
"""
Evolution Sandbox — discovery graph validator.

Checks the node database for the failures that break a combination game
silently, and the ones that would make it quietly dishonest. Run before every
build; exit code is non-zero if any ERROR fires.

  python3 tools/validate.py [--json]

Checks
------
E1  duplicate node id
E2  recipe references an unknown node id
E3  same unordered pair produces two different results (engine ambiguity)
E4  node unreachable from the primitive set
E5  missing or empty required field
E6  node lists itself as one of its own ingredients
E7  source id not present in sources.json
E8  duplicate catalogue number
E9  rarity 'hidden' and the hidden flag disagree
E10 node cites only general references but does not say 'source_required'
E11 malformed source registry entry (tier, https url, scope, checked date)
E12 'source_required' listed more than once
W1  node has only one recipe (no alternative path) while marked important
W2  era/rarity value outside the declared vocabulary
W3  node produces nothing and is not a designated endpoint
W4  node says 'source_required' but already has a subject-level source
W5  registered source that no node cites
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_DIR = ROOT / "data" / "nodes"
SOURCES = ROOT / "data" / "sources.json"

PRIMITIVES = {"stone", "wood", "bone", "fiber"}

ERAS = {
    "origins", "fire", "settlement", "agriculture", "civilization", "trade",
    "metallurgy", "science", "industry", "electric", "computing",
    "network", "games", "simulation",
}
RARITIES = {"common", "uncommon", "rare", "hidden"}
TIERS = {"S", "A", "B"}
SCOPES = {"general", "topic"}
REQUIRED = ("id", "n", "era", "cat", "date", "rar", "l1", "l2", "l3", "ev", "src", "rec", "vis")
SOURCE_REQUIRED = "source_required"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Nodes that are meant to be terminal — they legitimately produce nothing.
ENDPOINTS = {
    "grand_theft_auto_vi", "virtual_world", "gps", "civilization", "industrial_society",
    "standardized_weights", "bookkeeping", "caravan_routes",
}


def load_nodes() -> list[dict]:
    nodes: list[dict] = []
    for path in sorted(NODE_DIR.glob("*.json")):
        with path.open(encoding="utf-8") as fh:
            chunk = json.load(fh)
        for node in chunk:
            node["_file"] = path.name
        nodes.extend(chunk)
    return nodes


def load_sources() -> dict[str, dict]:
    with SOURCES.open(encoding="utf-8") as fh:
        return json.load(fh)["sources"]


def reachable(by_id: dict[str, dict]) -> set[str]:
    """Forward closure: what can actually be built starting from the primitives."""
    have = set(PRIMITIVES)
    index: dict[frozenset, str] = {}
    for node in by_id.values():
        for pair in node.get("rec", []):
            index[frozenset(pair)] = node["id"]

    changed = True
    while changed:
        changed = False
        items = sorted(have)
        for i, a in enumerate(items):
            for b in items[i:]:
                result = index.get(frozenset((a, b)))
                if result and result not in have:
                    have.add(result)
                    changed = True
    return have


def main() -> int:
    # the report uses ✗ and —; a Windows console code page cannot always print them
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    as_json = "--json" in sys.argv
    nodes = load_nodes()
    registry = load_sources()

    errors: list[str] = []
    warnings: list[str] = []

    # E1 / E8 — identity
    by_id: dict[str, dict] = {}
    seen_no: dict[int, str] = {}
    for node in nodes:
        nid = node.get("id")
        if nid in by_id:
            errors.append(f"E1 duplicate node id '{nid}' ({node['_file']})")
        by_id[nid] = node
        no = node.get("no")
        if no in seen_no:
            errors.append(f"E8 duplicate catalogue number {no}: '{seen_no[no]}' and '{nid}'")
        seen_no[no] = nid

    # E5 — required fields
    for node in nodes:
        for field in REQUIRED:
            value = node.get(field)
            if value is None or (isinstance(value, (str, list)) and len(value) == 0):
                if field == "rec" and node.get("primitive"):
                    continue  # primitives legitimately have no recipe
                errors.append(f"E5 '{node.get('id')}' missing/empty required field '{field}'")

    # E2 / E6 / E3 — recipes
    pair_owner: dict[frozenset, str] = {}
    for node in nodes:
        nid = node["id"]
        for pair in node.get("rec", []):
            if len(pair) != 2:
                errors.append(f"E2 '{nid}' recipe is not a pair: {pair}")
                continue
            for ing in pair:
                if ing not in by_id:
                    errors.append(f"E2 '{nid}' recipe references unknown node '{ing}'")
                if ing == nid:
                    errors.append(f"E6 '{nid}' lists itself as an ingredient")
            key = frozenset(pair)
            if key in pair_owner and pair_owner[key] != nid:
                errors.append(
                    f"E3 pair {sorted(pair)} produces both "
                    f"'{pair_owner[key]}' and '{nid}' — engine cannot disambiguate"
                )
            pair_owner[key] = nid

    # E11 — the source registry itself
    for sid, s in registry.items():
        problems = []
        if s.get("t") not in TIERS:
            problems.append(f"tier {s.get('t')!r}")
        for field in ("title", "org", "url", "type"):
            if not s.get(field):
                problems.append(f"missing {field}")
        if s.get("url") and not str(s["url"]).startswith("https://"):
            problems.append("url is not https")
        if s.get("scope") not in SCOPES:
            problems.append(f"scope {s.get('scope')!r}")
        if not DATE_RE.match(str(s.get("checked", ""))):
            problems.append(f"checked {s.get('checked')!r}")
        if problems:
            errors.append(f"E11 source '{sid}': " + ", ".join(problems))

    # E7 / E10 / E12 / W4 — citations
    cited: set[str] = set()
    for node in nodes:
        nid = node["id"]
        src = node.get("src", [])
        if src.count(SOURCE_REQUIRED) > 1:
            errors.append(f"E12 '{nid}' lists '{SOURCE_REQUIRED}' more than once")
        real = [s for s in src if s != SOURCE_REQUIRED]
        for sid in real:
            if sid not in registry:
                errors.append(f"E7 '{nid}' cites unknown source id '{sid}'")
            cited.add(sid)
        topic = [s for s in real if registry.get(s, {}).get("scope") == "topic"]
        if not topic and SOURCE_REQUIRED not in src:
            errors.append(
                f"E10 '{nid}' cites only general references {real} — "
                f"add a subject-level source or mark it '{SOURCE_REQUIRED}'"
            )
        if topic and SOURCE_REQUIRED in src:
            warnings.append(f"W4 '{nid}' says '{SOURCE_REQUIRED}' but cites subject-level source(s) {topic}")

    # E9 — rarity and the hidden flag must tell the same story
    for node in nodes:
        if (node.get("rar") == "hidden") != bool(node.get("hidden")):
            errors.append(
                f"E9 '{node['id']}' has rarity '{node.get('rar')}' but hidden={bool(node.get('hidden'))}"
            )

    # E4 — reachability
    have = reachable(by_id)
    for node in nodes:
        if node["id"] not in have:
            errors.append(f"E4 '{node['id']}' ({node.get('n')}) is UNREACHABLE from primitives")

    # W2 — vocabulary
    for node in nodes:
        if node.get("era") not in ERAS:
            warnings.append(f"W2 '{node['id']}' unknown era '{node.get('era')}'")
        if node.get("rar") not in RARITIES:
            warnings.append(f"W2 '{node['id']}' unknown rarity '{node.get('rar')}'")

    # W1 — alternative paths for rare/important nodes
    for node in nodes:
        if node.get("primitive"):
            continue
        if node.get("rar") in ("rare", "hidden") and len(node.get("rec", [])) < 2:
            warnings.append(f"W1 '{node['id']}' is {node['rar']} but has only one recipe")

    # W3 — dead ends
    used: set[str] = set()
    for node in nodes:
        for pair in node.get("rec", []):
            used.update(pair)
    for node in nodes:
        if node["id"] not in used and node["id"] not in ENDPOINTS:
            warnings.append(f"W3 '{node['id']}' is never used as an ingredient (dead end)")

    # W5 — registry entries nobody cites
    for sid in registry:
        if sid not in cited:
            warnings.append(f"W5 source '{sid}' is registered but never cited")

    # ---- report -------------------------------------------------------
    stats = {
        "nodes_total": len(nodes),
        "nodes_core": sum(1 for n in nodes if not n.get("hidden")),
        "nodes_hidden": sum(1 for n in nodes if n.get("hidden")),
        "primitives": len(PRIMITIVES),
        "recipes_total": sum(len(n.get("rec", [])) for n in nodes),
        "unique_pairs": len(pair_owner),
        "reachable": len(have),
        "unreachable": len(nodes) - len(have),
        "nodes_with_alt_paths": sum(1 for n in nodes if len(n.get("rec", [])) >= 2),
        "nodes_with_caution": sum(1 for n in nodes if n.get("caution")),
        "nodes_source_required": sum(1 for n in nodes if SOURCE_REQUIRED in n.get("src", [])),
        "sources_registered": len(registry),
        "sources_topic": sum(1 for s in registry.values() if s.get("scope") == "topic"),
        "sources_general": sum(1 for s in registry.values() if s.get("scope") == "general"),
        "errors": len(errors),
        "warnings": len(warnings),
    }

    if as_json:
        print(json.dumps({"stats": stats, "errors": errors, "warnings": warnings}, indent=2))
        return 1 if errors else 0

    print("=" * 68)
    print("  EVOLUTION SANDBOX — GRAPH VALIDATION")
    print("=" * 68)
    for key, value in stats.items():
        print(f"  {key:<24} {value}")
    print("-" * 68)
    if errors:
        print(f"  ERRORS ({len(errors)}):")
        for line in errors:
            print(f"    ✗ {line}")
    else:
        print("  ERRORS: none")
    print("-" * 68)
    if warnings:
        print(f"  WARNINGS ({len(warnings)}):")
        for line in warnings:
            print(f"    ! {line}")
    else:
        print("  WARNINGS: none")
    print("=" * 68)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
