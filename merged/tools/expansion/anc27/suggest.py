#!/usr/bin/env python3
"""Authoring aid: suggest free, date-valid, acyclic alternative ingredient pairs for an anc27 item.

  python3 tools/expansion/anc27/suggest.py item_id [item_id ...]      (ids without the anc27_ prefix)
Swaps one ingredient of an existing route for a related catalogue item (shared name tokens / co-occurrence) and prints the
pairs whose unordered key is unused everywhere. Nothing is written; paste the chosen pair into alts/*.py.
"""
import glob, itertools, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import build_g12 as B

R, D = B.load_specs(); ALT = B.load_alts()
rec = B.resolve(R); alts = B.resolve_alts(ALT)
names = {n["id"]: n["n"] for n in B.db["nodes"]}
names.update({k: v["n"] for k, v in B.ANC.items()})
errs, ds = B.check(R, ALT)
dsv = {i: n["ds"] for i, n in B.BASE.items()}; dsv.update(ds)
taken = {}
for i, n in B.BASE.items():
    for r in n["rec"]: taken[tuple(sorted(r))] = i
for i, rs in rec.items():
    taken[tuple(sorted(rs))] = i
for i, rs in alts.items():
    for r in rs: taken[tuple(sorted(r))] = i
allrec = {i: [rec[i]] + alts.get(i, []) for i in rec}
for i, n in B.BASE.items(): allrec.setdefault(i, n["rec"])
anc = lambda x: x[len(B.PREFIX):] if x.startswith(B.PREFIX) else x
tok = lambda x: set(re.split(r"_", re.sub(r"^(exp26|anc27)_", "", x)))
pool = [i for i in dsv if i in B.BASE or i in rec]
co = {}
for i, rs in allrec.items():
    for r in rs:
        for a, b in itertools.permutations(r, 2): co.setdefault(a, set()).add(b)

def descends(x, t, seen=None):
    seen = seen if seen is not None else set()
    if x == t: return True
    if x in seen: return False
    seen.add(x)
    return any(descends(y, t, seen) for r in allrec.get(x, []) for y in r)

def sug(item, n=7):
    it = B.PREFIX + item
    base = rec[it]
    cands = {}
    for keep in base:
        other = [b for b in base if b != keep][0]
        for x in pool:
            if x in (it, keep, other) or dsv[x] > ds[it]: continue
            key = tuple(sorted([keep, x]))
            if key in taken: continue
            t1, t2 = tok(other), tok(x)
            score = len(t1 & t2) / max(1, len(t1 | t2)) + (0.3 if x in co.get(other, ()) else 0) + (0.2 if tok(it) & t2 else 0)
            if score <= 0.1 or descends(x, it): continue
            cands[key] = max(cands.get(key, 0), score)
    out = sorted(cands.items(), key=lambda kv: -kv[1])[:n]
    print(f"\n{item} ({names[it]}, ds {ds[it]}) primary: {[anc(x) for x in base]}")
    for (a, b), s in out: print(f"   [{anc(a)!r},{anc(b)!r}]  {s:.2f}  ({names.get(a)} + {names.get(b)}, ds {dsv[a]}/{dsv[b]})")

if __name__ == "__main__":
    for a in sys.argv[1:]: sug(a)
