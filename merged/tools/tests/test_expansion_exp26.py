"""Regression tests for the exp26 expansion drafts, their art and the preview-only overlay."""
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "expansion"))

import build_art  # noqa: E402
import preview_install  # noqa: E402

DB = json.loads((ROOT / "data" / "db.json").read_text(encoding="utf-8"))
DRAFTS = json.loads((ROOT / "data" / "expansion_drafts" / "exp26_1000.json").read_text(encoding="utf-8"))
ART = json.loads((ROOT / "data" / "expansion" / "art_exp26.json").read_text(encoding="utf-8"))


class Exp26(unittest.TestCase):
    def test_918_shipped_nodes_preserved(self):
        self.assertEqual(len(DB["nodes"]), 918)

    def test_no_collisions_with_shipped(self):
        ids = {n["id"] for n in DB["nodes"]}
        names = {n["n"].lower() for n in DB["nodes"]}
        for d in DRAFTS:
            self.assertNotIn(d["id"], ids)
            self.assertNotIn(d["n"].lower(), names)
        self.assertEqual(len({d["id"] for d in DRAFTS}), len(DRAFTS))
        self.assertEqual(len({d["n"].lower() for d in DRAFTS}), len(DRAFTS))

    def test_drafts_stay_unverified(self):
        for d in DRAFTS:
            self.assertIn("DRAFT", d["caution"])
            self.assertEqual(d["src"], ["source_required"])

    def test_every_draft_has_distinct_lint_clean_art(self):
        self.assertEqual(set(ART), {d["id"] for d in DRAFTS})
        self.assertEqual(len(set(ART.values())), len(ART))
        for k, v in ART.items():
            self.assertEqual(build_art.lint(v), [], k)

    def test_art_file_matches_registry(self):
        self.assertEqual(subprocess.run([sys.executable, str(ROOT / "tools" / "expansion" / "build_art.py"), "--check"], capture_output=True).returncode, 0)

    def test_preview_overlay_invariants(self):
        db, art, problems = preview_install.build()
        self.assertEqual(problems, [])
        self.assertEqual(db["nodes"][:918], DB["nodes"])
        self.assertTrue(all(n["preview"] and not n["verified"] for n in db["nodes"][918:]))
        self.assertEqual(db["draftNodeCount"], len(DRAFTS))

    def test_preview_refuses_data_dir(self):
        with self.assertRaises(SystemExit):
            preview_install.refuse_if_unsafe(ROOT / "data" / "x")


if __name__ == "__main__":
    unittest.main()
