#!/usr/bin/env python3
"""Install the exp26 items straight into the game: data/nodes/g11.json + their plate art in data/art.json.

Recipes in the pack are 2-3 ingredient placeholders; the engine crafts in pairs, so each item gets pair recipes:
  3 ingredients [a,b,c] -> routes (a,b) and (b,c) | (a,c)       2 ingredients [a,b] -> route (a,b) plus a second
route (a, earlier item of the same topic).  Every key is unique across the whole game.  Re-runnable (idempotent).
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAUTION = "Historical sourcing for this entry is still being researched; the date is a sort position, not an invention date."


def main() -> None:
    drafts = json.loads((ROOT / "data/expansion_drafts/exp26_1000.json").read_text(encoding="utf-8"))
    art = json.loads((ROOT / "data/expansion/art_exp26.json").read_text(encoding="utf-8"))
    ids_new = {d["id"] for d in drafts}
    nodes_dir = ROOT / "data/nodes"
    taken: set[str] = set()
    base_ids: set[str] = set()
    base_nodes: list[dict] = []
    for f in sorted(nodes_dir.glob("g*.json")):
        if f.name == "g11.json":
            continue
        for n in json.loads(f.read_text(encoding="utf-8")):
            base_ids.add(n["id"])
            base_nodes.append(n)
            for r in n["rec"]:
                taken.add("|".join(sorted(r)))
    big = [set(e["rec"]) for e in json.loads((ROOT / "data/processing.json").read_text(encoding="utf-8"))["recipes"]["add"]]
    big += [set(r) for n in base_nodes for r in n["rec"] if len(r) > 2]
    ds_of = {n["id"]: n["ds"] for n in base_nodes}
    ds_of.update({d["id"]: d["ds"] for d in drafts})
    base_order = [n["id"] for n in sorted(base_nodes, key=lambda n: n["no"])][:150]
    key = lambda r: "|".join(sorted(r))
    by_topic: dict[str, list[dict]] = {}
    for d in sorted(drafts, key=lambda x: x["no"]):
        by_topic.setdefault(next((t for t in d["tags"] if t not in ("expansion_2026_1000", "research_pending", "design_lineage", "physical")), "x"), []).append(d)
    plan = []  # (draft, candidate routes in preference order)
    for topic, items in by_topic.items():
        for idx, d in enumerate(items):
            ing = list(d["rec"][0])
            own = [[ing[0], ing[1]]] if len(ing) < 3 else [[ing[0], ing[1]], [ing[1], ing[2]], [ing[0], ing[2]]]
            prev = [p["id"] for p in reversed(items[:idx])][:10]
            mates = [[prev[i], prev[j]] for j in range(len(prev)) for i in range(j)]  # nearest earlier mates first
            ing_prev = [[x, m] for m in prev for x in ing if m not in ing]
            later = [[x, nxt["id"]] for nxt in items[idx + 1:] for x in ing if nxt["id"] not in ing]
            early = [[x, prim] for x in ing for prim in base_order if x != prim and prim not in ing]
            # chain inside the topic first: keeps the new items from piling onto a few shared ingredients (graph hubs)
            plan.append((d, mates + own + ing_prev + early, mates + own + ing_prev + later + early))
    def not_inside_assembly(r):  # an assembly recipe may never contain a smaller recipe that makes something else
        return not any(set(r) < b for b in big)

    def chrono_ok(d, r):  # an ingredient may never be dated after what it makes (the "chronological-only" modifier relies on it)
        return all(ds_of[i] <= d["ds"] for i in r)
    chosen: dict[str, list[list[str]]] = {}
    own_pairs = 3 if True else 1
    for d, cands, _alt in plan:  # pass 1: every item gets its primary route first (so no alternate can steal it)
        for r in cands:
            if r[0] != r[1] and d["id"] not in r and key(r) not in taken and chrono_ok(d, r) and not_inside_assembly(r):
                taken.add(key(r)); chosen[d["id"]] = [r]; break
        else:
            raise SystemExit(f"no unique chronological recipe for {d['id']} (ds {d['ds']})")
    for d, _p, cands in plan:  # pass 2: one alternate route each
        for r in cands:
            if r[0] != r[1] and d["id"] not in r and key(r) not in taken and chrono_ok(d, r) and not_inside_assembly(r):
                taken.add(key(r)); chosen[d["id"]].append(r); break
    out = []
    for d, _p, _a in plan:
        n = dict(d)
        n["rec"] = chosen[d["id"]]
        n["caution"] = CAUTION
        n["tags"] = [t for t in d["tags"] if t != "research_pending"] + ["source_required"]
        out.append(n)
    out.sort(key=lambda x: x["no"])
    (nodes_dir / "g11.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    a = json.loads((ROOT / "data/art.json").read_text(encoding="utf-8"))
    a.update(art)
    (ROOT / "data/art.json").write_text(json.dumps(a, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"installed {len(out)} nodes, {sum(1 for n in out if len(n['rec']) > 1)} with 2 routes; art entries {len(a)}")


if __name__ == "__main__":
    main()
