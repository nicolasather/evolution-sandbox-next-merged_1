#!/usr/bin/env python3
"""Authoring aid: turn  'item: a,b'  lines (stdin) into an alts/<name>.py file.   mkalt.py name < lines.txt
Several routes for one item: repeat the item on more lines. Bare names that are anc27 items are resolved automatically."""
import os, sys
by = {}
for l in sys.stdin.read().strip().split("\n"):
    if not l.strip(): continue
    k, v = l.split(": ")
    by.setdefault(k.strip(), []).append([x.strip() for x in v.split(",")])
out = ["ALT = {"] + [f" '{k}': [{', '.join('[' + ','.join(repr(x) for x in r) + ']' for r in rs)}]," for k, rs in by.items()] + ["}"]
open(os.path.join(os.path.dirname(__file__), "alts", sys.argv[1] + ".py"), "w").write("\n".join(out) + "\n")
print(len(by), "items")
