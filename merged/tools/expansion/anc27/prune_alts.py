#!/usr/bin/env python3
"""Authoring aid: remove every alt line that fails build_g12 --check from alts/*.py and print the pruned ids (one per line) to stdout."""
import glob, os, re, subprocess, sys
here = os.path.dirname(__file__)
out = subprocess.run([sys.executable, os.path.join(here, "build_g12.py"), "--check"], capture_output=True, text=True).stdout
bad = []
for l in out.splitlines():
    m = re.match(r"\s+anc27_(\w+):", l)
    if m and m.group(1) not in bad: bad.append(m.group(1))
for f in glob.glob(os.path.join(here, "alts", "*.py")):
    lines = open(f, encoding="utf-8").read().split("\n")
    keep = [l for l in lines if not any(re.match(rf"\s*'{b}':", l) for b in bad)]
    if len(keep) != len(lines): open(f, "w", encoding="utf-8").write("\n".join(keep))
print("\n".join(bad))
