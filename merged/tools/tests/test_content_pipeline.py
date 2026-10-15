"""Tests for the verified-content pipeline. Standard library only:  python -m unittest discover -s tools/tests -v

Everything that writes works on a throw-away copy of the data (make_sandbox); the real data is never touched.
"""
from __future__ import annotations

import hashlib
import itertools
import json
import random
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.content.catalogue import Catalogue  # noqa: E402
from tools.content.causal import Target, allowed_actions, assess  # noqa: E402
from tools.content.keys import RecipeKeyError, legacy_key, recipe_key  # noqa: E402
from tools.content.publish import make_sandbox  # noqa: E402

CLI = [sys.executable, str(ROOT / "tools" / "verified_content.py")]


def run_cli(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(CLI + ["--root", str(root), *args], capture_output=True, text=True, cwd=ROOT)


def tree_hash(root: Path, rels=("data/nodes", "data/sources.json")) -> str:
    h = hashlib.sha256()
    for rel in rels:
        p = root / rel
        files = sorted(p.rglob("*")) if p.is_dir() else [p]
        for f in files:
            if f.is_file():
                h.update(str(f.relative_to(root)).encode())
                h.update(f.read_bytes())
    return h.hexdigest()


class RecipeKeyTests(unittest.TestCase):
    def test_golden_fixture(self):
        cases = json.loads((Path(__file__).parent / "fixtures" / "recipe_key_golden.json").read_text("utf-8"))
        self.assertGreater(len(cases), 5)
        for c in cases:
            if "expected" in c:
                self.assertEqual(recipe_key(c["items"]), c["expected"], c["items"])

    def test_order_free_but_repeats_kept(self):
        self.assertEqual(recipe_key(["stone", "wood"]), recipe_key(["wood", "stone"]))
        self.assertNotEqual(recipe_key(["stone", "stone"]), recipe_key(["stone", "wood"]))
        self.assertNotEqual(recipe_key(["stone", "stone", "wood"]), recipe_key(["stone", "wood", "wood"]))

    def test_frozenset_would_collapse_but_legacy_key_does_not(self):
        # WP009: frozenset({'a','a','b'}) == frozenset({'a','b'}) — exactly the bug the multiset key removes
        self.assertEqual(frozenset(["stone", "stone", "wood"]), frozenset(["stone", "wood"]))
        self.assertNotEqual(legacy_key(["stone", "stone", "wood"]), legacy_key(["stone", "wood"]))

    def test_rejects_bad_input(self):
        for bad in ([], ["stone"], ["a"] * 6, ["stone", ""], ["Stone", "wood"], ["st one", "wood"], ["stone", "wo\x00od"],
                    ["stone", None], ["1stone", "wood"], ["é", "wood"]):
            with self.assertRaises(RecipeKeyError, msg=str(bad)):
                recipe_key(bad)

    def test_cardinality_2_to_5(self):
        for n in range(2, 6):
            self.assertTrue(recipe_key(["fiber"] * n).startswith(f"recipe-v2:{n}:"))
        self.assertNotEqual(recipe_key(["fiber"] * 3), recipe_key(["fiber"] * 2))


class CatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cat = Catalogue.load(ROOT)
        cls.actions = allowed_actions(ROOT)

    def test_counts(self):
        g12 = ROOT / "data" / "nodes" / "g12.json"
        extra = len(json.loads(g12.read_text(encoding="utf-8"))) if g12.exists() else 0
        self.assertEqual(len([p for p in self.cat.profiles.values() if not p.is_state]), 1917 + extra)
        statuses = {}
        for p in self.cat.profiles.values():
            statuses[p.status] = statuses.get(p.status, 0) + 1
        self.assertEqual(statuses.get("placeholder_legacy"), 500, "g10 placeholders must stay quarantined")

    def test_actions_come_from_types_ts(self):
        self.assertIn("assemble", self.actions)
        self.assertEqual(len(self.actions), 26)

    def test_no_placeholder_is_ever_verified(self):
        for p in self.cat.profiles.values():
            if p.status == "verified":
                self.assertFalse("placeholder" in (getattr(p, "note", "") or "").lower())


class NegativeCraftSuite(unittest.TestCase):
    """Arbitrary / thematic combinations must be refused with reasons — never succeed by chance."""

    @classmethod
    def setUpClass(cls):
        cls.cat = Catalogue.load(ROOT)
        cls.actions = allowed_actions(ROOT)
        cls.pool = [i for i, p in cls.cat.profiles.items() if not p.is_state and p.status != "placeholder_legacy"]

    def _assess(self, target, ids, action, roles, mech):
        return assess(self.cat, target, ids, action, roles, mech, actions=self.actions,
                      evidence_class="plausible_reconstruction", source_support=[], required_conditions=[],
                      batch_profiles={}, batch_owner={}, batch_graph={}, acknowledged_placeholders=[],
                      verified_sources={})

    def test_random_blind_combinations_all_fail(self):
        rnd = random.Random(20261014)
        targets = [
            Target(id="neg_blade", family="composite", earliest_year=-1_000_000, era="origins", archetype="hafted_tool",
                   facts_ok=True),
            Target(id="neg_ingot", family="metal", earliest_year=-5000, era="civilization", archetype="metal_ingot",
                   facts_ok=True),
            Target(id="neg_chip", family="composite", earliest_year=-1_000_000, era="origins", archetype="circuit",
                   facts_ok=True),
        ]
        ok = 0
        total = 0
        for t in targets:
            for _ in range(200):
                ids = rnd.sample(self.pool, rnd.choice([2, 3]))
                # a combination with no causal story: no action, no roles, no mechanism
                a = self._assess(t, ids, None, [], "")
                total += 1
                if not a.hard:
                    ok += 1
        self.assertEqual(ok, 0, f"{ok}/{total} blind combinations were not rejected")

    def test_word_association_is_not_a_mechanism(self):
        t = Target(id="neg_a", family="composite", earliest_year=-1_000_000, era="origins", archetype="hafted_tool",
                   facts_ok=True)
        a = self._assess(t, ["stone_flake", "wood", "fiber"], "tie", ["head", "haft", "binding"],
                         "The wood symbolically represents the spirit of the blade, somehow related to the theme.")
        self.assertIn("WEAK_SEMANTIC_ASSOCIATION", a.hard)

    def test_thematic_pair_fails_roles(self):
        t = Target(id="neg_b", family="composite", earliest_year=-1_000_000, era="origins", archetype="hafted_tool",
                   facts_ok=True)
        a = self._assess(t, ["fiber", "fiber", "fiber"], "tie", ["head", "haft", "binding"],
                         "Three fibres are tied together to make a cutting tool with a handle and a head.")
        self.assertTrue({"ROLE_MISMATCH", "MISSING_REQUIRED_COMPONENT"} & set(a.hard))

    def test_anachronism_rejected(self):
        t = Target(id="neg_c", family="stone", earliest_year=-2_000_000, era="origins", archetype="polished_stone",
                   facts_ok=True)
        late = next(i for i, p in self.cat.profiles.items() if p.era == "computing" and not p.is_state)
        a = self._assess(t, ["stone", late], "grind", ["workpiece", "abrasive"],
                         "A stone is ground against another material so that its surface becomes smooth.")
        self.assertIn("ERA_CONFLICT", a.hard)

    def test_existing_recipe_cannot_be_claimed_again(self):
        t = Target(id="neg_d", family="stone", earliest_year=-2_000_000, era="origins", archetype="stone_fragment",
                   facts_ok=True)
        a = self._assess(t, ["bone", "stone"], "smash", ["workpiece", "striker"],
                         "One stone is struck against another so that a fragment breaks off along a fracture.")
        self.assertIn("RECIPE_ALREADY_CLAIMED", a.hard)

    def test_self_reference_rejected(self):
        t = Target(id="stone", family="stone", earliest_year=-2_000_000, era="origins", archetype="stone_fragment",
                   facts_ok=True)
        a = self._assess(t, ["stone", "stone"], "smash", ["workpiece", "striker"],
                         "A stone is struck against another stone so that a fragment breaks off along a fracture.")
        self.assertTrue({"CYCLE_OR_SELF_REFERENCE", "TARGET_IN_INPUTS"} & set(a.hard))

    def test_processing_state_is_not_a_base_ingredient(self):
        state = next(i for i, p in self.cat.profiles.items() if p.is_state)
        t = Target(id="neg_e", family="stone", earliest_year=-2_000_000, era="origins", archetype="polished_stone",
                   facts_ok=True)
        a = self._assess(t, ["stone", state, "stone"], "grind", ["workpiece", "abrasive", "abrasive"],
                         "A stone is rubbed against two others so abrasion wears its surface smooth.")
        self.assertIn("STATE_NOT_ALLOWED_IN_BASE_RECIPE", a.hard)

    def test_unknown_ingredient_and_bad_action(self):
        t = Target(id="neg_f", family="stone", earliest_year=-2_000_000, era="origins", archetype="polished_stone",
                   facts_ok=True)
        a = self._assess(t, ["stone", "no_such_thing"], "grind", ["workpiece", "abrasive"],
                         "A stone is rubbed against something so abrasion wears its surface smooth.")
        self.assertIn("UNKNOWN_INGREDIENT", a.hard)
        b = self._assess(t, ["stone", "stone", "stone"], "teleport", ["workpiece", "abrasive", "abrasive"],
                         "A stone is rubbed between two others so abrasion wears its surface smooth.")
        self.assertIn("ACTION_NOT_ALLOWED", b.hard)


class EndToEndPilotTests(unittest.TestCase):
    """seed-validate → anchor-validate → freeze → publish → rollback on a sandbox copy."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="evo_pilot_"))
        cls.sb = make_sandbox(ROOT, cls.tmp / "sb")
        cls.before = tree_hash(cls.sb)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_01_seed_validate_rejects_unsourced_charm(self):
        r = run_cli(self.sb, "seed-validate", "--batch", "pilot")
        self.assertIn("fx_unsourced_charm", r.stdout + r.stderr)

    def test_02_anchor_validate_outcomes(self):
        r = run_cli(self.sb, "anchor-validate", "--batch", "pilot")
        out = r.stdout
        self.assertIn("5 valid, 4 blocked", out)
        for blocked in ("fx_early_copper_ingot", "fx_stone_age_microchip", "fx_fired_clay_bowl", "fx_sun_dried_block"):
            self.assertRegex(out, rf"■ {blocked}: anchor_blocked")

    def test_03_freeze_is_idempotent_and_refuses_silent_change(self):
        run_cli(self.sb, "freeze", "--batch", "pilot")
        f = self.sb / "data/verified_seeds/pilot.anchors.frozen.json"
        self.assertTrue(f.exists())
        first = f.read_bytes()
        r = run_cli(self.sb, "freeze", "--batch", "pilot")
        self.assertEqual(first, f.read_bytes())
        self.assertIn("byte-identical", r.stdout)
        # tamper with a decision: freezing must refuse to change the stored anchor
        a = self.sb / "data/verified_seeds/pilot.anchors.json"
        orig = a.read_text("utf-8")
        d = json.loads(orig)
        for e in d["decisions"]:
            if e["targetId"] == "fx_ground_pebble":
                e["ingredientIds"] = ["stone", "stone", "stone", "stone"]
                e["inputRoles"] = ["workpiece", "abrasive", "abrasive", "abrasive"]
        a.write_text(json.dumps(d), "utf-8")
        r = run_cli(self.sb, "freeze", "--batch", "pilot")
        self.assertIn("REFUSED", r.stdout)
        self.assertEqual(first, f.read_bytes())
        a.write_text(orig, "utf-8")

    def test_04_publish_dry_run_writes_nothing(self):
        pub = self.tmp / "pub"
        r = run_cli(self.sb, "publish", "--batch", "pilot", "--dry-run", "--sandbox", str(pub))
        self.assertIn("dry run: nothing written", r.stdout, r.stdout + r.stderr)
        self.assertFalse((pub / "data/nodes/v3_pilot.json").exists())
        self.assertEqual(self.before, tree_hash(self.sb))

    def test_05_publish_apply_then_validate_then_rollback(self):
        pub = self.tmp / "pub"
        before_pub = tree_hash(pub) if (pub / "data").exists() else None
        r = run_cli(self.sb, "publish", "--batch", "pilot", "--apply", "--sandbox", str(pub))
        self.assertIn("Applied.", r.stdout, r.stdout + r.stderr)
        self.assertTrue((pub / "data/nodes/v3_pilot.json").exists())
        self.assertEqual(self.before, tree_hash(self.sb), "source sandbox must not change")
        nodes = json.loads((pub / "data/nodes/v3_pilot.json").read_text("utf-8"))
        nodes = nodes if isinstance(nodes, list) else nodes.get("nodes", nodes)
        ids = {n["id"] for n in nodes}
        self.assertEqual(ids, {"fx_lashed_flake_knife", "fx_ground_pebble", "fx_ground_bone_point",
                               "fx_twisted_fibre_loop", "fx_hafted_bone_awl"})
        for n in nodes:  # exactly one primary recipe, 2–5 slots, repeats preserved
            self.assertEqual(len(n["rec"]), 1)
            self.assertTrue(2 <= len(n["rec"][0]) <= 5)
        self.assertNotIn("fx_early_copper_ingot", ids)
        backups = sorted((pub / "data/verified/backups").iterdir())
        self.assertEqual(len(backups), 1)
        rb = run_cli(pub, "rollback", "--backup", str(backups[0]))
        self.assertEqual(rb.returncode, 0, rb.stdout + rb.stderr)
        self.assertEqual(self.before, tree_hash(pub), "rollback must restore the exact pre-publish data")

    def test_06_real_tree_untouched(self):
        self.assertFalse((ROOT / "data/nodes/v3_pilot.json").exists())


class ImportSplitTests(unittest.TestCase):
    def test_split_by_era_with_small_sample(self):
        tmp = Path(tempfile.mkdtemp(prefix="evo_split_"))
        try:
            sb = make_sandbox(ROOT, tmp / "sb")
            pilot = json.loads((sb / "data/verified_seeds/pilot.json").read_text("utf-8"))
            (tmp / "in.json").write_text(json.dumps(pilot), "utf-8")
            r = run_cli(sb, "seed-import", "--input", str(tmp / "in.json"), "--split-by-era", "--chunk", "3")
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            files = sorted(p.name for p in (sb / "data/verified_seeds").glob("pilot_*_[0-9][0-9][0-9].json"))
            self.assertTrue(files, "no batch files written")
            self.assertTrue(all("_origins_" in f or "_civilization_" in f for f in files))
            self.assertLessEqual(max(len(json.loads((sb / "data/verified_seeds" / f).read_text("utf-8"))["seeds"])
                                     for f in files), 3)
            seen = []
            for f in files:
                seen += [s["itemId"] for s in json.loads((sb / "data/verified_seeds" / f).read_text("utf-8"))["seeds"]]
            self.assertEqual(sorted(seen), sorted(s["itemId"] for s in pilot["seeds"]))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()


class AlternativeProposalTests(unittest.TestCase):
    """Alternatives are optional (0..N), rule-checked, hash-bound, append-only, and never create items."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="evo_alt_"))
        cls.sb = make_sandbox(ROOT, cls.tmp / "sb")
        pub = cls.tmp / "pub"
        r = run_cli(cls.sb, "publish", "--batch", "pilot", "--apply", "--sandbox", str(pub))
        assert "Applied." in r.stdout, r.stdout + r.stderr
        cls.pub = pub
        shutil.copytree(ROOT / "data/verified_seeds/fixtures", pub / "data/verified_seeds/fixtures", dirs_exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_zero_is_a_normal_answer(self):
        r = run_cli(self.pub, "suggest", "--batch", "pilot", "--target", "fx_ground_pebble", "--rules-only")
        self.assertIn("zero is a normal result", r.stdout)

    def test_fixture_response_every_bad_variant_gets_its_own_reason(self):
        resp = self.pub / "data/verified_seeds/fixtures/pilot.alt_response.json"
        r = run_cli(self.pub, "suggest", "--batch", "pilot", "--target", "fx_lashed_flake_knife", "--from-response", str(resp))
        out = r.stdout
        for code in ("REDUNDANT_SUBSTITUTION", "ROLE_MISMATCH", "WEAK_SEMANTIC_ASSOCIATION", "INVALID_MULTISET",
                     "CYCLE_OR_SELF_REFERENCE", "UNKNOWN_INGREDIENT", "unexpected_field:newItemName"):
            self.assertIn(code, out, code)
        self.assertIn("0 proposal(s) pending review; 8 rejected by rules", out)

    def test_wrong_target_response_is_rejected_wholesale(self):
        resp = self.pub / "data/verified_seeds/fixtures/pilot.alt_response.json"
        r = run_cli(self.pub, "suggest", "--batch", "pilot", "--target", "fx_ground_pebble", "--from-response", str(resp))
        self.assertIn("different item", r.stdout)

    def test_no_item_is_created_by_any_alternative_run(self):
        nodes = json.loads((self.pub / "data/nodes/v3_pilot.json").read_text("utf-8"))
        nodes = nodes if isinstance(nodes, list) else nodes.get("nodes", nodes)
        self.assertEqual(len(nodes), 5)

    def test_review_store_is_hash_bound_and_idempotent(self):
        from tools.content.alt import add_to_store, apply_review, new_store, proposal_id
        store = new_store("t")
        p = {"schemaVersion": 1, "targetId": "x", "ingredientIds": ["stone", "wood"], "mechanism": "m" * 50}
        add_to_store(store, p, {"status": "needs_review", "reasons": [], "review": ["editor_decision_required"]})
        pid = proposal_id(p)
        self.assertEqual(apply_review(store, {"proposalId": pid, "proposalHash": "bogus", "reviewer": "a", "decision": "approve"}), "hash_mismatch")
        self.assertEqual(apply_review(store, {"proposalId": pid, "proposalHash": pid, "reviewer": "", "decision": "approve"}), "invalid_decision")
        self.assertEqual(apply_review(store, {"proposalId": pid, "proposalHash": pid, "reviewer": "a", "decision": "approve"}), "ok")
        self.assertEqual(apply_review(store, {"proposalId": pid, "proposalHash": pid, "reviewer": "a", "decision": "approve"}), "unchanged")
        self.assertEqual(len(store["proposals"][pid]["history"]), 2)        # append-only
        bad = {"schemaVersion": 1, "targetId": "x", "ingredientIds": ["stone", "ghost_item"], "mechanism": "z" * 50}
        add_to_store(store, bad, {"status": "no_result", "reasons": ["UNKNOWN_INGREDIENT"], "review": []})
        bid = proposal_id(bad)
        self.assertEqual(apply_review(store, {"proposalId": bid, "proposalHash": bid, "reviewer": "a", "decision": "approve"}),
                         "cannot_approve_rule_rejected")
