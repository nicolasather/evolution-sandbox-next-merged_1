"""Compile approved seeds + frozen anchors into canonical content, atomically (WP016, WP019, WP023).

- Blocked or unfrozen seeds are NEVER compiled into the game.
- Fixture batches may only be published into a sandbox copy of the data.
- Everything is validated on an in-memory copy first (the real validate.py rules
  plus a real build_db run in a scratch root) and only then written, with a
  backup manifest, a compare-and-swap on the base content hash, and rollback.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import COMPILER_VERSION, RULES_VERSION
from .catalogue import ERA_ORDER, Catalogue
from .pipeline import Eval, revalidate_frozen
from .seeds import content_hash, placed_year
from .store import Paths, StoreError, dumps, read_json, sha256_file, write_atomic

TIER_ORDER = ["olduvai", "middle", "late"]
VIS_BY_ARCHETYPE = {
    "hafted_tool": "hafted_tool", "axe": "axe", "blade": "blade", "vessel": "vessel", "brick": "brick-course",
    "wood_rod": "branch", "stone_fragment": "flake", "polished_stone": "cobble", "woven_fibre": "twisted-cord",
    "bone_tool": "awl", "bead": "cobble", "metal_ingot": "copper-ingot",
}
RARITIES = ("common", "uncommon", "rare")
CONF_LEVEL = {"editor_reviewed": "established", "reviewed_with_uncertainty": "uncertain"}
ARTIFACT_TYPE = {
    "hafted_tool": "cutting-tool", "axe": "cutting-tool", "blade": "cutting-tool", "vessel": "container",
    "brick": "structure", "wood_rod": "shaft", "stone_fragment": "cutting-tool", "polished_stone": "ground-stone",
    "woven_fibre": "textile", "bone_tool": "piercing-tool", "bead": "ornament", "metal_ingot": "ingot",
}


class PublishError(RuntimeError):
    pass


def _known_vis(cat: Catalogue) -> set[str]:
    return {n["vis"] for n in cat.nodes}


def compile_node(seed: dict, entry: dict, no: int, cat: Catalogue, known_vis: set[str]) -> dict:
    layers = {k: " ".join(c["text"].strip() for c in seed["claims"] if c["layer"] == k) for k in ("l1", "l2", "l3")}
    src: list[str] = []
    for c in seed["claims"]:
        for s in c["sourceIds"]:
            if s not in src:
                src.append(s)
    tiers = []
    for i in entry["ingredientIds"]:
        t = cat.by_id.get(i, {}).get("stone_age_tier")
        if t:
            tiers.append(TIER_ORDER.index(t))
    tier = TIER_ORDER[max(tiers)] if tiers else "late"
    arch = seed["visualBrief"]["archetype"]
    vis = seed["visualBrief"].get("glyph")
    if vis not in known_vis:
        vis = VIS_BY_ARCHETYPE.get(arch)
    if vis not in known_vis:
        vis = arch                       # the glyph grammar falls back by category; never an invented key lookup
    node: dict[str, Any] = {
        "id": seed["itemId"], "no": no, "n": seed["canonicalName"], "era": seed["chronology"]["era"],
        "cat": seed["category"], "date": seed["chronology"]["display"], "ds": placed_year(seed),
        "rar": seed.get("rarity") if seed.get("rarity") in RARITIES else "uncommon", "vis": vis,
        "l1": layers["l1"], "l2": layers["l2"], "l3": layers["l3"], "ev": seed["evidenceLabel"].strip(),
        "src": src, "rec": [sorted(entry["ingredientIds"])], "tags": list(seed.get("tags") or []),
        "stone_age_tier": tier,
        "confidence": {"level": "debated" if seed["chronology"].get("disputed") else CONF_LEVEL[seed["truthStatus"]],
                       "note": seed["chronology"]["uncertainty"]},
        "artifactType": ARTIFACT_TYPE.get(arch, arch),
        "visualArchetype": arch,
        "physicalProperties": {"family": seed["materialProperties"]["family"]},
    }
    if seed["truthStatus"] == "reviewed_with_uncertainty" or seed["chronology"].get("disputed"):
        node["caution"] = seed["chronology"]["uncertainty"]
    return node


@dataclass
class Plan:
    paths: Paths
    base_hash: str
    nodes: list[dict]
    new_sources: dict[str, dict]
    files: dict[Path, str]
    skipped: dict[str, list[str]]
    numbers: dict[str, int]
    validation: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def base_hash(root: Path, paths: Paths) -> str:
    h = hashlib.sha256()
    for p in sorted((root / "data" / "nodes").glob("*.json")):
        h.update(p.name.encode() + sha256_file(p).encode())
    for p in (paths.sources, root / "data" / "processing.json", paths.alt_routes, paths.nodes, paths.claims,
              paths.release):
        h.update(p.name.encode() + sha256_file(p).encode())
    return h.hexdigest()


def build_plan(ev: Eval, *, sandbox: bool) -> Plan:
    paths = ev.paths
    root = paths.root
    if ev.fixture and not sandbox:
        raise PublishError("fixture_batch_requires_sandbox")
    if ev.source_problems:
        raise PublishError("batch_sources_invalid:" + ";".join(ev.source_problems))
    if not paths.frozen.exists():
        raise PublishError("no_frozen_anchors")
    frozen = read_json(paths.frozen)
    rev = revalidate_frozen(ev, frozen)
    cat = ev.cat
    by_seed = {s["itemId"]: s for s in ev.seeds}
    skipped: dict[str, list[str]] = {}
    ready: list[str] = []
    for iid in sorted(by_seed):
        if iid not in frozen["anchors"]:
            why = (frozen["blocked"].get(iid, {}).get("reasonCodes") or ["no_frozen_anchor"])
            skipped[iid] = ["anchor_blocked", *why] if iid in frozen["blocked"] else why
        elif rev[iid]["status"] != "valid_candidate":
            skipped[iid] = ["frozen_anchor_failed_revalidation", *rev[iid]["reasons"]]
        else:
            ready.append(iid)

    # existing published numbers stay; new ones are allocated above the current maximum
    prior: dict[str, int] = {}
    if paths.nodes.exists():
        prior = {n["id"]: n["no"] for n in read_json(paths.nodes)}
    taken = {n["no"] for n in cat.nodes if n["id"] not in prior}
    nxt = max([cat.max_catalogue_number(), *prior.values(), 0]) + 1
    numbers: dict[str, int] = {}
    known_vis = _known_vis(cat)
    nodes: list[dict] = []
    for iid in sorted(ready, key=lambda i: (placed_year(by_seed[i]) or 0, i)):
        if iid in prior:
            no = prior[iid]
        else:
            no, nxt = nxt, nxt + 1
        if no in taken:
            raise PublishError(f"duplicate_catalogue_number:{no}")
        taken.add(no)
        numbers[iid] = no
        nodes.append(compile_node(by_seed[iid], frozen["anchors"][iid], no, cat, known_vis))

    # immutability: an already-published item must compile to exactly what is on disk
    if paths.nodes.exists():
        on_disk = {n["id"]: n for n in read_json(paths.nodes)}
        for n in nodes:
            if n["id"] in on_disk and on_disk[n["id"]] != n:
                raise PublishError(f"published_item_changed_requires_revision:{n['id']}")
        keep = [v for k, v in on_disk.items() if k not in numbers]
        nodes = sorted(keep + nodes, key=lambda n: n["no"])

    new_sources = {k: v for k, v in (ev.batch.get("sources") or {}).items() if k not in cat.sources}
    # a fixture-only source must never reach the real registry
    if new_sources and ev.fixture and not sandbox:
        raise PublishError("fixture_sources_cannot_enter_real_registry")

    # ---- validate the would-be dataset with the real validator + a real build ---------------------
    import importlib
    tools_dir = str(Path(__file__).resolve().parents[1])
    if tools_dir not in sys.path:
        sys.path.insert(0, tools_dir)
    validate = importlib.import_module("validate")
    all_nodes = [dict(n) for n in cat.nodes if n["id"] not in {x["id"] for x in nodes}] + [dict(n) for n in nodes]
    for n in all_nodes:
        n.setdefault("_file", "plan")
    registry = {**cat.sources, **new_sources}
    errors, warns, stats = validate.check(all_nodes, registry)
    base_errors, _bw, _bs = validate.check([dict(n, _file="base") for n in cat.nodes], cat.sources)
    new_errors = [e for e in errors if e not in base_errors]
    if new_errors:
        raise PublishError("validation_failed:" + " | ".join(new_errors[:8]))

    sidecar = {
        "schemaVersion": 1, "batch": paths.batch, "fixture": ev.fixture, "items": {
            iid: {
                "contentHash": content_hash(by_seed[iid]), "truthStatus": by_seed[iid]["truthStatus"],
                "editor": by_seed[iid]["editorApproval"], "claims": by_seed[iid]["claims"],
                "chronology": by_seed[iid]["chronology"], "visualBrief": by_seed[iid]["visualBrief"],
                "materialProperties": by_seed[iid]["materialProperties"],
                "modeEligibility": by_seed[iid].get("modeEligibility", []),
                "anchor": frozen["anchors"][iid],
            } for iid in sorted(numbers) if iid in numbers
        },
    }
    if paths.claims.exists():                                   # keep previously published items
        old = read_json(paths.claims)
        for k, v in old.get("items", {}).items():
            sidecar["items"].setdefault(k, v)
    release = {
        "schemaVersion": 1, "batch": paths.batch, "fixture": ev.fixture, "compilerVersion": COMPILER_VERSION,
        "rulesVersion": RULES_VERSION, "anchorsPublished": sorted(k for k in sidecar["items"]),
        "catalogueNumbers": {n["id"]: n["no"] for n in nodes},
        "blocked": {k: v for k, v in sorted(frozen["blocked"].items())},
        "notPublished": {k: v for k, v in sorted(skipped.items())},
        "anchorHashes": {k: v["anchor"]["anchorHash"] for k, v in sorted(sidecar["items"].items())},
        "counts": {"nodesAfter": len(cat.nodes) + len([n for n in nodes if n["id"] not in cat.by_id]),
                   "published": len(nodes)},
    }
    release["releaseHash"] = content_hash({k: v for k, v in release.items() if k != "releaseHash"})

    files: dict[Path, str] = {paths.nodes: dumps(nodes), paths.claims: dumps(sidecar), paths.release: dumps(release)}
    if new_sources:
        src_doc = read_json(paths.sources)
        src_doc["sources"].update(new_sources)
        files[paths.sources] = json.dumps(src_doc, ensure_ascii=False, indent=1) + "\n"
    plan = Plan(paths, base_hash(root, paths), nodes, new_sources, files, skipped, numbers,
                {"errors": 0, "warnings": len(warns), "nodesTotal": stats["nodes_total"]}, [])
    # real build in a scratch root (derives depth/need/uses, proves 2-5 slot recipes build)
    plan.validation["build"] = _scratch_build(root, plan)
    return plan


def _scratch_build(root: Path, plan: Plan) -> dict:
    with tempfile.TemporaryDirectory(prefix="evo_plan_") as td:
        t = Path(td)
        (t / "data" / "nodes").mkdir(parents=True)
        for p in (root / "data" / "nodes").glob("*.json"):
            if p.name != plan.paths.nodes.name:
                shutil.copy2(p, t / "data" / "nodes" / p.name)
        (t / "data" / "nodes" / plan.paths.nodes.name).write_text(plan.files[plan.paths.nodes], encoding="utf-8")
        src = plan.files.get(plan.paths.sources) or plan.paths.sources.read_text(encoding="utf-8")
        (t / "data" / "sources.json").write_text(src, encoding="utf-8")
        env = {**os.environ, "EVO_ROOT": str(t)}
        r = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "build_db.py")],
                           capture_output=True, text=True, env=env)
        if r.returncode != 0:
            raise PublishError("scratch_build_failed:" + (r.stderr or r.stdout)[-400:])
        db = json.loads((t / "build" / "db.json").read_text(encoding="utf-8"))
        by = {n["id"]: n for n in db["nodes"]}
        bad = [n["id"] for n in plan.nodes if by[n["id"]]["depth"] is None]
        if bad:
            raise PublishError("published_item_unreachable:" + ",".join(bad))
        return {"ok": True, "nodes": len(db["nodes"]), "dataHash": db["dataHash"][:16],
                "depths": {n["id"]: by[n["id"]]["depth"] for n in plan.nodes}}


def apply_plan(plan: Plan, *, root: Path) -> dict:
    """Write all files or none. Backups go to data/verified/backups/<stamp>/ with a manifest."""
    if base_hash(root, plan.paths) != plan.base_hash:
        raise PublishError("base_content_changed_since_plan")
    stamp = _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    bdir = plan.paths.backups / f"{plan.paths.batch}_{stamp}"
    manifest: dict[str, Any] = {"created": [], "replaced": []}
    written: list[Path] = []
    try:
        for path, text in plan.files.items():
            rel = path.relative_to(root).as_posix()
            if path.exists():
                dst = bdir / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, dst)
                manifest["replaced"].append(rel)
            else:
                manifest["created"].append(rel)
        bdir.mkdir(parents=True, exist_ok=True)
        (bdir / "manifest.json").write_text(dumps(manifest), encoding="utf-8")
        for path, text in plan.files.items():
            write_atomic(path, text)
            written.append(path)
    except BaseException:
        for path in written:
            rel = path.relative_to(root).as_posix()
            if rel in manifest["replaced"]:
                shutil.copy2(bdir / rel, path)
            elif path.exists():
                path.unlink()
        raise
    return {"backup": bdir.relative_to(root).as_posix(), "written": sorted(p.relative_to(root).as_posix() for p in plan.files)}


def rollback(root: Path, backup_dir: Path) -> list[str]:
    """Restore a backup made by apply_plan (created files are removed, replaced files restored)."""
    manifest = read_json(backup_dir / "manifest.json")
    done = []
    for rel in manifest["created"]:
        p = root / rel
        if p.exists():
            p.unlink()
            done.append(f"removed {rel}")
    for rel in manifest["replaced"]:
        shutil.copy2(backup_dir / rel, root / rel)
        done.append(f"restored {rel}")
    return done


def make_sandbox(root: Path, dest: Path) -> Path:
    """Minimal copy of everything the pipeline reads, so fixtures never touch real data."""
    for rel in ("data/nodes", "data/sources.json", "data/processing.json", "data/verified_seeds", "data/verified",
                "lib/craft/materials.ts", "lib/types.ts"):
        src = root / rel
        if not src.exists():
            continue
        dst = dest / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns("backups"))
        else:
            shutil.copy2(src, dst)
    return dest
