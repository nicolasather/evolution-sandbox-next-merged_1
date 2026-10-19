"""Regression tests for the exp26 items installed in the game (data/nodes/g11.json) and their plate art."""
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "expansion"))
import build_art  # noqa: E402

DB = json.loads((ROOT / "data" / "db.json").read_text(encoding="utf-8"))
G11 = json.loads((ROOT / "data" / "nodes" / "g11.json").read_text(encoding="utf-8"))
G12_PATH = ROOT / "data" / "nodes" / "g12.json"
G12 = json.loads(G12_PATH.read_text(encoding="utf-8")) if G12_PATH.exists() else []
ART = json.loads((ROOT / "data" / "art.json").read_text(encoding="utf-8"))
NEW = {n["id"] for n in G11}
LATER = {n["id"] for n in G12}  # g12 = Ancient individual-recipe expansion (see test_expansion_anc27.py)


class Exp26InGame(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(len(G11), 999)
        self.assertEqual(len(DB["nodes"]), 918 + 999 + len(G12))

    def test_original_918_untouched(self):
        old = [n for n in DB["nodes"] if n["id"] not in NEW and n["id"] not in LATER]
        self.assertEqual(len(old), 918)
        self.assertEqual(sorted(n["no"] for n in old), list(range(1, 919)))

    def test_unique_ids_names_and_recipe_keys(self):
        self.assertEqual(len({n["id"] for n in DB["nodes"]}), len(DB["nodes"]))
        self.assertEqual(len({n["n"].lower() for n in DB["nodes"]}), len(DB["nodes"]))
        keys = [tuple(sorted(r)) for n in DB["nodes"] for r in n["rec"]]
        self.assertEqual(len(keys), len(set(keys)))

    def test_every_new_item_has_pair_recipes_and_art(self):
        for n in G11:
            self.assertGreaterEqual(len(n["rec"]), 2, n["id"])
            self.assertTrue(all(len(r) == 2 for r in n["rec"]), n["id"])
            self.assertIn(n["id"], ART)
            self.assertEqual(build_art.lint(ART[n["id"]]), [], n["id"])

    def test_art_registry_in_sync(self):
        self.assertEqual(subprocess.run([sys.executable, str(ROOT / "tools" / "expansion" / "build_art.py"), "--check"], capture_output=True).returncode, 0)


if __name__ == "__main__":
    unittest.main()
