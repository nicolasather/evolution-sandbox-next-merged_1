#!/usr/bin/env python3
"""Build data/nodes/g12.json (Ancient individual-recipe expansion) from hand-authored recipe specs.

  python3 tools/expansion/anc27/build_g12.py            # validate specs, write g12.json
  python3 tools/expansion/anc27/build_g12.py --check    # validate only (no write)

Then:  npm run data:build && python3 tools/expansion/art_anc27.py --install && python3 tools/expansion/sync_modes.py

specs/*.py each define  R = {item_id_without_prefix: [ingredient, ingredient]}  where a plain name is an existing catalogue id and
'@name' is another anc27 item.  Optional  D = {item_id: reason}  lists items deliberately NOT built yet.

Rules enforced here (the same ones tools/validate.py and the overlay tests enforce afterwards):
  - 2..5 ingredients, no self reference, no cycles, every ingredient exists (base catalogue or another authored anc27 item)
  - the unordered ingredient set is unique across the whole catalogue AND among authored recipes
  - an item's ds is raised to its latest ingredient's ds, never lowered, so nothing is craftable before its parts exist
Items whose real input is a species-specific wild plant/animal, or a material the game does not have (papyrus, bamboo, silver, gold,
tin, salt...) are not built: they need a wild-species / material mechanic first. They are listed in
data/expansion_drafts/anc27/DEFERRED.md with the reason.
"""
from __future__ import annotations

import glob
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
STAGE = os.path.join(ROOT, "data", "expansion_drafts", "anc27")
PREFIX = "anc27_"

db = json.load(open(os.path.join(ROOT, "data", "db.json"), encoding="utf-8"))
BASE = {n["id"]: n for n in db["nodes"] if not n["id"].startswith(PREFIX)}
A = json.load(open(os.path.join(STAGE, "anc27_nodes_preview.json"), encoding="utf-8"))
ANC = {n["id"]: n for n in A}
MODES = {m["id"]: m["modes"] for m in json.load(open(os.path.join(STAGE, "anc27_modes_preview.json"), encoding="utf-8"))}
DEFAULT_MODES = {k: {"eligible": k not in ("survival", "decipher")} for k in (
    "main-evolution", "minimum-path", "reverse-evolution", "archaeology", "survival", "civilization", "escape-room", "decipher", "alien-archaeology")}


def load_specs():
    R, D = {}, {}
    for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "specs", "*.py"))):
        ns: dict = {}
        exec(open(f, encoding="utf-8").read(), ns)
        for k, v in ns["R"].items():
            assert k not in R, f"duplicate spec {k}"
            R[k] = v
        D.update(ns.get("D", {}))
    return R, D


def load_alts():
    """alts/*.py each define  ALT = {item_id_without_prefix: [[ingredients], [ingredients], ...]}  (extra routes after the primary one)."""
    ALT = {}
    for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "alts", "*.py"))):
        ns: dict = {}
        exec(open(f, encoding="utf-8").read(), ns)
        for k, v in ns["ALT"].items():
            assert k not in ALT, f"duplicate alt spec {k}"
            ALT[k] = v
    return ALT


def resolve_alts(ALT):
    def one(x):  # '@name' or a bare name that is an anc27 item and not a catalogue id
        if x.startswith("@"): return PREFIX + x[1:]
        return PREFIX + x if x not in BASE and (PREFIX + x) in ANC else x
    return {PREFIX + k: [[one(x) for x in r] for r in v] for k, v in ALT.items()}


def resolve(R):
    return {PREFIX + k: [(PREFIX + x[1:]) if x.startswith("@") else x for x in v] for k, v in R.items()}


def check(R, ALT=None):
    rec, errs, taken, seen = resolve(R), [], {}, {}
    alt = resolve_alts(ALT or {})
    for i, n in BASE.items():
        for r in n["rec"]:
            taken.setdefault(tuple(sorted(r)), []).append(i)
    for i, r in rec.items():
        if i not in ANC:
            errs.append(f"unknown item {i}"); continue
        if not 2 <= len(r) <= 5:
            errs.append(f"{i}: slots {len(r)}")
        for x in r:
            if x == i: errs.append(f"{i}: self")
            elif x not in BASE and x not in rec: errs.append(f"{i}: ingredient {x} unknown or not authored")
        k = tuple(sorted(r))
        if k in taken: errs.append(f"{i}: key collides with existing {taken[k][:2]}")
        if k in seen: errs.append(f"{i}: key collides with authored {seen[k]}")
        seen[k] = i
    ds: dict[str, int] = {}

    def dsof(i, stack=()):
        if i in ds: return ds[i]
        if i in stack: errs.append(f"cycle at {i}"); return 0
        if i in BASE: return BASE[i]["ds"]
        ds[i] = max([dsof(x, stack + (i,)) for x in rec[i]] + [ANC[i]["ds"]])
        return ds[i]

    for i in rec: dsof(i)

    # extra routes: same rules, plus every ingredient must already exist by the item's own date and must not descend from the item
    def ingredients_of(i):
        return list(rec.get(i, [])) + [x for r in alt.get(i, []) for x in r] if i in rec else [x for r in (BASE[i]["rec"] if i in BASE else []) for x in r]

    def descends(x, target, seen_=None):
        seen_ = seen_ if seen_ is not None else set()
        if x == target: return True
        if x in seen_ or x not in rec and x not in BASE: return False
        seen_.add(x)
        return any(descends(y, target, seen_) for y in ingredients_of(x))

    for i, routes in alt.items():
        if i not in rec:
            errs.append(f"alt for unauthored item {i}"); continue
        for r in routes:
            if not 2 <= len(r) <= 5: errs.append(f"{i}: alt slots {len(r)}")
            for x in r:
                if x == i: errs.append(f"{i}: alt self"); continue
                if x not in BASE and x not in rec: errs.append(f"{i}: alt ingredient {x} unknown"); continue
                if dsof(x) > ds[i]: errs.append(f"{i}: alt ingredient {x} (ds {dsof(x)}) later than item (ds {ds[i]})")
                if descends(x, i): errs.append(f"{i}: alt ingredient {x} descends from the item (cycle)")
            k = tuple(sorted(r))
            if len(set(r)) != len(r): errs.append(f"{i}: alt repeats an ingredient")
            if k in taken: errs.append(f"{i}: alt key collides with existing {taken[k][:2]}")
            if k in seen: errs.append(f"{i}: alt key collides with authored {seen[k]}")
            seen[k] = i
    return errs, ds


KEEP = ["id", "no", "n", "era", "cat", "date", "rar", "vis", "l1", "l2", "l3", "ev", "src", "tags", "caution", "confidence",
        "artifactType", "visualArchetype", "museum", "historical"]


def main() -> int:
    R, D = load_specs()
    ALT = load_alts()
    errs, ds = check(R, ALT)
    print(f"authored {len(R)}  extra routes {sum(len(v) for v in ALT.values())} on {len(ALT)} items  deferred(listed) {len(D)}  errors {len(errs)}")
    for e in errs[:40]: print("  ", e)
    if errs: return 1
    rec = resolve(R)
    alts = resolve_alts(ALT)
    out = []
    for n in A:
        i = n["id"]
        if i not in rec: continue
        o = {k: n[k] for k in KEEP if k in n}
        o["ds"] = ds.get(i, n["ds"])
        o["rec"] = [rec[i]] + alts.get(i, [])
        o["tags"] = list(dict.fromkeys(o["tags"] + ["anc27_individual_recipe"] + (["anc27_multi_route"] if i in alts else [])))
        o["modeMeta"] = {k: {"candidate": bool(v.get("eligible")), "review": "pending",
                             "automatic_ingestion": bool(v.get("eligible")) and k in ("main-evolution", "reverse-evolution", "minimum-path")}
                         for k, v in MODES.get(i, DEFAULT_MODES).items()}
        out.append(o)
    out.sort(key=lambda x: x["no"])
    if "--check" in sys.argv: return 0
    json.dump(out, open(os.path.join(ROOT, "data", "nodes", "g12.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    unassigned = [n["id"][len(PREFIX):] for n in A if n["id"] not in rec]
    with open(os.path.join(STAGE, "DEFERRED.md"), "w", encoding="utf-8") as f:
        f.write(f"# Ancient 1000 items NOT yet in the game ({len(unassigned)} of {len(A)})\n\n"
                "Each needs a mechanic or material the game does not have yet. Nothing here is faked with a generic recipe.\n\n")
        for k in unassigned:
            f.write(f"- `{PREFIX}{k}` - {D.get(k, 'domestication / cultivation: needs a species-specific wild input (wild-species state mechanic)')}\n")
    print(f"wrote {len(out)} nodes -> data/nodes/g12.json; deferred list -> data/expansion_drafts/anc27/DEFERRED.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
