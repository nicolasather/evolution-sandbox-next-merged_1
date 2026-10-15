"""Regression tests for the Ancient individual-recipe expansion (data/nodes/g12.json)."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "expansion"))
import build_art  # noqa: E402

DB = json.loads((ROOT / "data" / "db.json").read_text(encoding="utf-8"))
G12 = json.loads((ROOT / "data" / "nodes" / "g12.json").read_text(encoding="utf-8"))
ART = json.loads((ROOT / "data" / "art.json").read_text(encoding="utf-8"))
BY_ID = {n["id"]: n for n in DB["nodes"]}
NEW = {n["id"] for n in G12}
KEY = lambda r: tuple(sorted(r))


class Anc27InGame(unittest.TestCase):
    def test_counts_and_numbering(self):
        self.assertEqual(len(G12), 841)
        self.assertEqual(len(DB["nodes"]), 918 + 999 + len(G12))
        nos = [n["no"] for n in G12]
        self.assertEqual(len(set(nos)), len(nos))
        self.assertTrue(all(1920 <= x <= 2919 for x in nos), "anc27 keeps its reserved catalogue numbers 1920-2919")

    def test_original_items_untouched(self):
        older = [n for n in DB["nodes"] if n["id"] not in NEW and not n["id"].startswith("exp26_")]
        self.assertEqual(sorted(n["no"] for n in older), list(range(1, 919)))

    def test_every_item_has_at_least_two_distinct_routes_over_real_ingredients(self):
        for n in G12:
            self.assertGreaterEqual(len(n["rec"]), 2, n["id"])
            self.assertEqual(len({KEY(r) for r in n["rec"]}), len(n["rec"]), n["id"])
            for r in n["rec"]:
                self.assertTrue(2 <= len(r) <= 5, n["id"])
                self.assertNotIn(n["id"], r)
                self.assertEqual(len(set(r)), len(r), f"{n['id']} repeats an ingredient")
                for x in r:
                    self.assertIn(x, BY_ID, f"{n['id']} uses unknown {x}")
                    self.assertLessEqual(BY_ID[x]["ds"], n["ds"], f"{n['id']} is placed before its ingredient {x}")

    def test_routes_never_depend_on_the_item_itself(self):
        def reaches(src, target, seen):
            if src == target: return True
            if src in seen or src not in BY_ID: return False
            seen.add(src)
            return any(reaches(x, target, seen) for r in BY_ID[src]["rec"] for x in r)
        for n in G12:
            for r in n["rec"]:
                for x in r:
                    self.assertFalse(reaches(x, n["id"], set()), f"{n['id']} <- {x} is circular")

    def test_no_recipe_key_is_shared_in_the_whole_game(self):
        keys = [KEY(r) for n in DB["nodes"] for r in n["rec"]]
        self.assertEqual(len(keys), len(set(keys)))

    def test_ids_and_names_unique(self):
        self.assertEqual(len({n["id"] for n in DB["nodes"]}), len(DB["nodes"]))
        self.assertEqual(len({n["n"].lower() for n in DB["nodes"]}), len(DB["nodes"]))

    def test_nothing_claims_verified_history(self):
        facts = json.loads((ROOT / "data" / "expansion" / "anc27_facts.json").read_text(encoding="utf-8"))["items"]
        reg = json.loads((ROOT / "data" / "sources.json").read_text(encoding="utf-8"))["sources"]
        for n in G12:
            self.assertIn("anc27_individual_recipe", n["tags"])
            self.assertFalse(n["historical"]["itemSpecificEvidenceVerified"], n["id"])
            if n["id"] in facts:  # topic context only, from a tier-C encyclopedia page, and said so
                f = facts[n["id"]]
                self.assertEqual(n["src"], [f["source"]], n["id"])
                self.assertEqual(reg[f["source"]]["t"], "C", n["id"])
                self.assertEqual(reg[f["source"]]["scope"], "topic", n["id"])
                self.assertEqual(n["historical"]["factCheck"]["status"], "topic_context_only", n["id"])
                self.assertIn("not item-specific", n["ev"], n["id"])
                self.assertFalse(f["itemSpecificEvidenceVerified"], n["id"])
            else:
                self.assertEqual(n["src"], ["source_required"], n["id"])

    def test_fact_check_covers_most_items_and_lists_the_rest(self):
        d = json.loads((ROOT / "data" / "expansion" / "anc27_facts.json").read_text(encoding="utf-8"))
        self.assertEqual(d["covered"] + d["uncovered"], len(G12))
        self.assertEqual(len(d["items"]), d["covered"])
        self.assertEqual(len(d["uncoveredIds"]), d["uncovered"])
        self.assertGreaterEqual(d["covered"], 700)

    def test_independent_lineages_and_no_bronze_from_iron(self):
        # Only anc27/exp26-authored lineage is checked; legacy base-graph quirks (e.g. metallurgy > ironworking) are out of scope.
        def authored(x):
            return x.startswith("anc27_") or x.startswith("exp26_")

        def ancestors(i, seen=None):
            seen = seen if seen is not None else set()
            for r in BY_ID[i]["rec"]:
                for x in r:
                    if x not in seen and authored(x):
                        seen.add(x); ancestors(x, seen)
            return seen
        for i, n in BY_ID.items():
            if i.startswith("anc27_") and ("bronze" in i or "copper" in i) and "iron" not in i:
                bad = [a for a in ancestors(i) if "iron" in a or "anvil" in a]
                self.assertEqual(bad, [], i)

    def test_every_item_has_distinct_valid_plate_art(self):
        seen = {}
        for i in NEW:
            self.assertIn(i, ART)
            self.assertEqual(build_art.lint(ART[i]), [], i)
            key = re.sub(r"\s+", "", ART[i])
            self.assertNotIn(key, seen, f"{i} repeats the drawing of {seen.get(key)}")
            seen[key] = i

    def test_deferred_items_are_not_built_and_are_listed(self):
        deferred = (ROOT / "data/expansion_drafts/anc27/DEFERRED.md").read_text(encoding="utf-8")
        listed = set(re.findall(r"`(anc27_[a-z0-9_]+)`", deferred))
        self.assertEqual(len(listed), 1000 - len(G12))
        self.assertFalse(listed & NEW)


if __name__ == "__main__":
    unittest.main()
