#!/usr/bin/env python3
"""Add the exp26 items and auto-generated missions to data/minimumpath/atlas.v1.json (idempotent).

Every new mission mirrors an existing mission pattern of its chapter (waypoints / blocked / forward-only) and its
`optimal` is recomputed with the same unit-cost BFS the game uses, so lib/minimumpath/content.ts validateContent passes.
Items/missions already added by this tool (ids starting `exp26_` / missions `-x`) are removed first, so it can be re-run
whenever new items are added to data/nodes.
"""
from __future__ import annotations
import json, random, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "data/minimumpath/atlas.v1.json"


def build(items):
    ids = {i["id"] for i in items}
    fwd = {i: set() for i in ids}; both = {i: set() for i in ids}
    for it in items:
        for rec in it["recipes"]:
            for x in rec:
                if x == it["id"] or x not in ids: continue
                fwd[x].add(it["id"]); both[x].add(it["id"]); both[it["id"]].add(x)
    return {"forward": {k: sorted(v) for k, v in fwd.items()}, "both": {k: sorted(v) for k, v in both.items()}}


def shortest(g, m):
    s, t, via, blocked = m["start"], m["target"], m["via"], set(m["blocked"])
    if s in blocked: return None
    adj = g[m["direction"]]
    mask_of = lambda n: sum(1 << i for i, v in enumerate(via) if v == n)
    full = (1 << len(via)) - 1
    start = (s, mask_of(s)); par = {start: None}; q = collections.deque([start])
    while q:
        cur = q.popleft()
        if cur[0] == t and cur[1] == full:
            p = []; c = cur
            while c: p.append(c[0]); c = par[c]
            return p[::-1]
        for n in adj.get(cur[0], []):
            if n in blocked: continue
            st = (n, cur[1] | mask_of(n))
            if st not in par: par[st] = cur; q.append(st)
    return None


def reachable(g, direction, s, depth):
    adj = g[direction]; seen = {s}; frontier = [s]
    for _ in range(depth):
        nxt = []
        for x in frontier:
            for y in adj.get(x, []):
                if y not in seen: seen.add(y); nxt.append(y)
        frontier = nxt
    return seen


PREFIXES = ("exp26_", "anc27_", "exp28_")  # exp28 items join the atlas; their missions come once the pool is large enough
# (mission-id suffix, item-id prefix, rng seed): exp26 missions keep their original seed/suffix so existing ids stay stable
POOLS = (("x", "exp26_", 26), ("y", "anc27_", 27))


def main():
    a = json.loads(ATLAS.read_text(encoding="utf-8"))
    a["items"] = [i for i in a["items"] if not i["id"].startswith(PREFIXES)]
    a["missions"] = [m for m in a["missions"] if not m["id"].endswith(("-x", "-y"))]
    new_nodes = []
    for f in sorted((ROOT / "data/nodes").glob("g*.json")):
        new_nodes += [n for n in json.loads(f.read_text(encoding="utf-8")) if n["id"].startswith(PREFIXES)]
    a["items"] += [{"id": n["id"], "name": n["n"], "era": n["era"], "recipes": n["rec"]} for n in new_nodes]
    g = build(a["items"])
    name = {i["id"]: i["name"] for i in a["items"]}
    original = list(a["missions"])
    out = []
    for suffix, prefix, seed in POOLS:
        new_ids = [n["id"] for n in new_nodes if n["id"].startswith(prefix)]
        pool_set = set(new_ids)
        if len(new_ids) < 2:
            continue
        rng = random.Random(seed)
        by_ch = collections.defaultdict(list)
        for m in original: by_ch[m["chapter"]].append(m)
        count = collections.Counter()
        for ch in a["chapters"]:
            pats = by_ch[ch["id"]]
            lo = min(m["optimal"] for m in pats); hi = max(m["optimal"] for m in pats)
            lo, hi = max(2, min(lo, 3)), max(hi, 5)
            for k, pat in enumerate(pats * 1):
                for attempt in range(8000):
                    s = rng.choice(new_ids); t = rng.choice(new_ids)
                    if attempt >= 4000:  # random pairs rarely connect in a young pool: walk out from s and pick a reachable member
                        reach = reachable(g, pat["direction"], s, hi + 3)
                        cands = [x for x in reach if x in pool_set and x != s]
                        if not cands: continue
                        t = rng.choice(sorted(cands))
                    if s == t: continue
                    m = {"start": s, "target": t, "via": [], "blocked": [], "direction": pat["direction"]}
                    base = shortest(g, m)
                    if not base or not (lo <= len(base) - 1 <= hi + 3): continue
                    inner = base[1:-1]
                    if len(pat["via"]) > len(inner) or len(pat["blocked"]) > max(0, len(inner) - 1): continue
                    if pat["via"]: m["via"] = rng.sample(inner, len(pat["via"]))
                    if pat["blocked"]:
                        cand = [x for x in inner if x not in m["via"]]
                        if len(cand) < len(pat["blocked"]): continue
                        m["blocked"] = rng.sample(cand, len(pat["blocked"]))
                    p = shortest(g, m)
                    if not p or len(p) > 60: continue
                    count[ch["id"]] += 1
                    out.append({"id": f"{ch['id']}-m{len(pats) + count[ch['id']]:02d}-{suffix}", "chapter": ch["id"],
                                "title": f"{name[s]} → {name[t]}", "briefing": pats[0]["briefing"], **m, "optimal": len(p) - 1})
                    break
                else:
                    raise SystemExit(f"could not generate a mission for {ch['id']} pattern {k} ({suffix})")
    a["missions"] += out
    # the graph grew, so a shortcut through new items can shorten an old mission: re-score every mission against the real graph
    rescored = 0
    for m in a["missions"]:
        p = shortest(g, m)
        if not p: raise SystemExit(f"mission {m['id']} became unsolvable")
        if len(p) - 1 != m["optimal"]: m["optimal"] = len(p) - 1; rescored += 1
    print(f"re-scored {rescored} missions whose shortest route changed")
    ATLAS.write_text(json.dumps(a, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"atlas: {len(a['items'])} items, {len(a['missions'])} missions (+{len(out)} generated)")


if __name__ == "__main__":
    main()
