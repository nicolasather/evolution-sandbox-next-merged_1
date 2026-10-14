"""Guard: `npm run data:build` must reproduce the recipes the game actually plays.

A recipe that exists only in data/db.json (and not in data/nodes/*.json) would silently vanish the next time
the database is rebuilt, for example right after the first real publish. This test rebuilds into a temporary
copy of the data and compares every node's recipes, so that class of drift can never come back unnoticed."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RebuildMatches(unittest.TestCase):
    def test_rebuild_reproduces_every_recipe(self):
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            shutil.copytree(ROOT / "data", t / "data", ignore=shutil.ignore_patterns("backups"))
            shutil.copytree(ROOT / "tools", t / "tools", ignore=shutil.ignore_patterns("tests", "__pycache__"))
            r = subprocess.run([sys.executable, str(t / "tools" / "build_db.py")], cwd=t, capture_output=True, text=True,
                               env={**os.environ, "EVO_ROOT": str(t)})
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            built = {n["id"]: n for n in json.loads((t / "build" / "db.json").read_text(encoding="utf-8"))["nodes"]}
            shipped = {n["id"]: n for n in json.loads((ROOT / "data" / "db.json").read_text(encoding="utf-8"))["nodes"]}
            self.assertEqual(set(built), set(shipped))
            drift = [i for i in shipped if shipped[i].get("rec") != built[i].get("rec")]
            self.assertEqual(drift, [], f"recipes in data/db.json that data/nodes cannot rebuild: {drift[:5]}")
            self.assertEqual(json.loads((ROOT / "data" / "db.json").read_text(encoding="utf-8"))["dataHash"],
                             json.loads((t / "build" / "db.json").read_text(encoding="utf-8"))["dataHash"],
                             "data/db.json is stale: run `npm run data:build`")


if __name__ == "__main__":
    unittest.main()
