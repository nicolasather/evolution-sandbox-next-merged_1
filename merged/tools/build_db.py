#!/usr/bin/env python3
"""Merge node chunks + sources into one runtime bundle, with derived fields precomputed.

Outputs:
  build/db.json  — canonical data, for the Next.js app to import
  build/db.js    — same payload as `window.EVO_DB`, for the single-file artifact

Top-level extras:
  dataHash        sha256 of the authored inputs (node files + sources.json), so
                  the artifact and the Next.js app can prove they ship the same data
  sourcesChecked  the most recent date a source URL was fetched and confirmed

Derived fields added per node:
  depth   minimum crafting depth from the primitives (primitives = 0)
  need    size of a minimal derivation set (how many distinct crafts, at least)
  uses    ids of nodes this one is an ingredient for
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE_DIR = ROOT / "data" / "nodes"
BUILD = ROOT / "build"
PRIMITIVES = ["stone", "wood", "bone", "fiber"]

ERAS = [
    ("origins", "Origins", "Stone, wood, bone, fibre — and the first edge."),
    ("fire", "Fire & Culture", "Heat, food, language, symbol, image."),
    ("settlement", "Settlement", "Landscape, water, staying put."),
    ("agriculture", "Agriculture", "Growing food on purpose, and everything it forced."),
    ("civilization", "Civilisation", "Cities, writing, law, number."),
    ("trade", "Trade & Currency", "Surplus, exchange, and a way to carry value between strangers."),
    ("metallurgy", "Metal & Machine", "Ore, alloy, wheel, mechanism."),
    ("science", "Knowledge", "Measurement, instrument, method."),
    ("industry", "Industry", "Coal, steam, factory, scale."),
    ("electric", "Electrification", "Current, light, signal, engine."),
    ("computing", "Computing", "Switch, chip, instruction."),
    ("network", "Network", "Packets, pages, everyone at once."),
    ("games", "Games", "Rules, pixels, response."),
    ("simulation", "Simulation", "Worlds that keep running."),
]

CATEGORIES = [
    "material", "technique", "technology", "biology", "culture", "society",
    "knowledge", "science", "engineering", "energy", "computing", "media", "economy",
]


def main() -> None:
    nodes: list[dict] = []
    for path in sorted(NODE_DIR.glob("*.json")):
        nodes.extend(json.loads(path.read_text(encoding="utf-8")))
    sources = json.loads((ROOT / "data" / "sources.json").read_text(encoding="utf-8"))

    # fingerprint of the authored inputs, taken before any derived field exists
    canonical = json.dumps({"nodes": nodes, "sources": sources}, ensure_ascii=False,
                           sort_keys=True, separators=(",", ":"))
    data_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    by_id = {n["id"]: n for n in nodes}

    # ---- depth: 0 for primitives, else 1 + max(depth of ingredients) ----
    INF = 10**6
    depth = {n["id"]: (0 if n["id"] in PRIMITIVES else INF) for n in nodes}
    for _ in range(len(nodes) + 2):
        changed = False
        for n in nodes:
            best = depth[n["id"]]
            for a, b in n.get("rec", []):
                if depth[a] < INF and depth[b] < INF:
                    cand = 1 + max(depth[a], depth[b])
                    if cand < best:
                        best = cand
            if best != depth[n["id"]]:
                depth[n["id"]] = best
                changed = True
        if not changed:
            break

    # ---- minimal derivation set -----------------------------------------
    # Monotone fixpoint, not DFS. A depth-first walk has to cut cycles, and
    # memoising a cycle-truncated result poisons every node above it — that
    # bug made `music` report 2 crafts when its only ingredient needs 8.
    # Relaxation only ever accepts a smaller complete set, so it cannot.
    memo: dict[str, frozenset] = {p: frozenset() for p in PRIMITIVES}

    for _ in range(len(nodes) + 2):
        changed = False
        for n in nodes:
            nid = n["id"]
            if nid in PRIMITIVES:
                continue
            for a, b in n.get("rec", []):
                if a not in memo or b not in memo:
                    continue  # ingredient not yet derivable — skip this round
                cand = memo[a] | memo[b] | {nid}
                if nid not in memo or len(cand) < len(memo[nid]):
                    memo[nid] = frozenset(cand)
                    changed = True
        if not changed:
            break

    # invariant: a node's derivation must strictly contain each ingredient's
    for n in nodes:
        nid = n["id"]
        if nid in PRIMITIVES or nid not in memo:
            continue
        for a, b in n.get("rec", []):
            if a in memo and b in memo and memo[a] | memo[b] | {nid} == memo[nid]:
                assert memo[a] <= memo[nid] and memo[b] <= memo[nid], f"derivation invariant broken at {nid}"
                break

    # ---- reverse index: what each node feeds into -----------------------
    uses: dict[str, list[str]] = {n["id"]: [] for n in nodes}
    for n in nodes:
        for a, b in n.get("rec", []):
            for ing in {a, b}:
                uses[ing].append(n["id"])

    for n in nodes:
        nid = n["id"]
        n.pop("_file", None)
        n["depth"] = depth[nid] if depth[nid] < INF else None
        n["need"] = len(memo.get(nid, frozenset()))
        n["uses"] = sorted(set(uses[nid]))

    checked = sorted(s.get("checked", "") for s in sources["sources"].values())

    payload = {
        "version": 1,
        "dataHash": data_hash,
        "sourcesChecked": checked[-1] if checked else None,
        "primitives": PRIMITIVES,
        "eras": [{"id": e, "name": n, "blurb": b} for e, n, b in ERAS],
        "categories": CATEGORIES,
        "sources": sources["sources"],
        "sourceNote": sources["_note"],
        "nodes": nodes,
        "counts": {
            "total": len(nodes),
            "core": sum(1 for n in nodes if not n.get("hidden")),
            "hidden": sum(1 for n in nodes if n.get("hidden")),
            "sourceRequired": sum(1 for n in nodes if "source_required" in n.get("src", [])),
        },
    }

    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    BUILD.mkdir(exist_ok=True)
    (BUILD / "db.json").write_text(text, encoding="utf-8")
    # "</" is escaped as "<\/" (still valid JSON) so no string in the data can
    # ever close the inline <script> block the artifact wraps this in
    (BUILD / "db.js").write_text("window.EVO_DB=" + text.replace("</", "<\\/") + ";", encoding="utf-8")

    deepest = max(nodes, key=lambda n: (n["depth"] or 0))
    hardest = max(nodes, key=lambda n: n["need"])
    print(f"nodes           {len(nodes)}")
    print(f"max depth       {deepest['depth']}  ({deepest['n']})")
    print(f"largest chain   {hardest['need']} crafts  ({hardest['n']})")
    print(f"source required {payload['counts']['sourceRequired']} nodes")
    print(f"data hash       {data_hash[:16]}")
    print(f"db.json         {(BUILD / 'db.json').stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
