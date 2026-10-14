"""Read-only view of the game's real data: nodes, processing layer, sources.

Authority order mirrors the app: data/nodes/*.json + data/sources.json are the
authored truth; data/processing.json is the reviewed overlay (states, transforms,
3-5 piece recipes). `data/db.json` is a derived build artifact and is never read
here. Root-level shadow copies are ignored on purpose.

Everything is computed from those files; nothing is hand-listed per item except
what the app itself already lists (lib/craft/materials.ts, parsed below).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

from .keys import legacy_key, recipe_key

PRIMITIVES = ["stone", "wood", "bone", "fiber"]

ERA_ORDER = [
    "origins", "fire", "settlement", "agriculture", "civilization", "trade", "metallurgy",
    "science", "industry", "electric", "computing", "network", "games", "simulation",
]
ERA_INDEX = {e: i for i, e in enumerate(ERA_ORDER)}

# Truth-status vocabulary (V3 P1.1). `fictional_gameplay` is reserved for worked
# states, which exist only as game mechanics and never as catalogue facts.
STATUS_VERIFIED = "verified"
STATUS_UNCERTAIN = "verified_with_uncertainty"
STATUS_PENDING = "pending_evidence"
STATUS_PLACEHOLDER = "placeholder_legacy"
STATUS_STATE = "fictional_gameplay"

# Game-material → coarse family used by the causal rules.
FAMILY_OF_MATERIAL = {
    "stone": "stone", "wood": "wood", "bone": "bone", "fibre": "fibre", "metal": "metal",
    "earth": "earth", "glass": "glass", "liquid": "liquid", "fire": "flame", "tool": "made",
    "structure": "made", "machine": "made", "energy": "abstract", "signal": "abstract",
    "idea": "abstract", "life": "living",
}


class CatalogueError(RuntimeError):
    pass


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def parse_materials_ts(path: Path) -> tuple[dict[str, str], dict[str, str]]:
    """MATERIAL_OF (id → material) and BY_CATEGORY, parsed from lib/craft/materials.ts.

    Parsing the app's own file keeps ONE source of truth. If the file's shape
    changes so that nothing parses, fail loudly instead of guessing.
    """
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const LISTS[^=]*=\s*\{(.*?)\n\};", text, re.S)
    if not m:
        raise CatalogueError("materials.ts: LISTS table not found")
    material_of: dict[str, str] = {}
    for mat, body in re.findall(r"(\w+):\s*`([^`]*)`", m.group(1)):
        for ident in body.split():
            material_of.setdefault(ident, mat)
    if len(material_of) < 100:
        raise CatalogueError("materials.ts: LISTS parsed suspiciously few ids")
    c = re.search(r"const BY_CATEGORY[^=]*=\s*\{(.*?)\};", text, re.S)
    if not c:
        raise CatalogueError("materials.ts: BY_CATEGORY not found")
    by_cat = dict(re.findall(r"(\w+):\s*'(\w+)'", c.group(1)))
    return material_of, by_cat


@dataclass
class Profile:
    """What the causal rules may know about one ingredient."""
    id: str
    name: str
    family: str            # coarse material family (stone, wood, fibre, earth, flame, made, abstract…)
    material: str          # the game's craft material id
    tags: frozenset
    capabilities: frozenset
    era: str
    ds: int
    status: str
    is_state: bool
    cat: str
    rec_arities: tuple = ()


@dataclass
class Catalogue:
    root: Path
    nodes: list[dict]
    by_id: dict[str, dict]
    node_file: dict[str, str]
    processing: dict
    sources: dict[str, dict]
    material_of: dict[str, str]
    by_category: dict[str, str]
    states: dict[str, dict]
    recipe_owner: dict[str, str] = field(default_factory=dict)       # legacy_key → target id
    recipe_rows: dict[str, list[list[str]]] = field(default_factory=dict)  # target → every rec (base+overlay)
    profiles: dict[str, Profile] = field(default_factory=dict)
    state_ds: dict[str, int] = field(default_factory=dict)

    # ---- construction -------------------------------------------------
    @classmethod
    def load(cls, root: Path | str, extra_nodes: list[dict] | None = None) -> "Catalogue":
        root = Path(root)
        nodes: list[dict] = []
        node_file: dict[str, str] = {}
        for path in sorted((root / "data" / "nodes").glob("*.json")):
            for n in _read_json(path):
                nodes.append(n)
                node_file[n["id"]] = path.name
        for n in extra_nodes or []:
            nodes.append(n)
            node_file[n["id"]] = "<in-memory>"
        sources = _read_json(root / "data" / "sources.json")["sources"]
        processing = _read_json(root / "data" / "processing.json")
        material_of, by_cat = parse_materials_ts(root / "lib" / "craft" / "materials.ts")
        cat = cls(
            root=root, nodes=nodes, by_id={n["id"]: n for n in nodes}, node_file=node_file,
            processing=processing, sources=sources, material_of=material_of, by_category=by_cat,
            states={s["id"]: s for s in processing.get("states", [])},
        )
        cat._index_recipes()
        cat._resolve_state_years()
        cat._build_profiles()
        cat._apply_v3_sidecars()
        return cat

    # ---- recipes ------------------------------------------------------
    def _index_recipes(self) -> None:
        rows: dict[str, list[list[str]]] = {n["id"]: [list(r) for r in n.get("rec", [])] for n in self.nodes}
        rec = self.processing.get("recipes", {})
        for e in rec.get("retire", []):
            rows[e["id"]] = [r for r in rows.get(e["id"], []) if legacy_key(r) != legacy_key(e["rec"])]
        for e in rec.get("add", []):
            rows.setdefault(e["id"], [])
            if not any(legacy_key(r) == legacy_key(e["rec"]) for r in rows[e["id"]]):
                rows[e["id"]].append(list(e["rec"]))
        # reviewed alternative routes (V3 overlay): extra edges to existing targets, never new items
        alt_path = self.root / "data" / "verified" / "alt_routes.json"
        if alt_path.exists():
            for r in _read_json(alt_path).get("routes", []):
                rows.setdefault(r["targetId"], [])
                if not any(legacy_key(x) == legacy_key(r["ingredientIds"]) for x in rows[r["targetId"]]):
                    rows[r["targetId"]].append(list(r["ingredientIds"]))
        self.recipe_rows = rows
        owner: dict[str, str] = {}
        for tid, rs in rows.items():
            for r in rs:
                owner.setdefault(legacy_key(r), tid)   # first owner wins, as in the engine
        self.recipe_owner = owner

    def owner_of(self, ids: list[str]) -> str | None:
        return self.recipe_owner.get(legacy_key(ids))

    # ---- chronology of worked states ----------------------------------
    def _resolve_state_years(self) -> None:
        """A state is never older than the thing it is made from (conservative; not a claim)."""
        ds = {n["id"]: n["ds"] for n in self.nodes}
        known: dict[str, int] = {}
        for _ in range(len(self.states) + 3):
            moved = False
            for t in self.processing.get("transforms", []):
                src = ds.get(t["from"], known.get(t["from"]))
                if src is None:
                    continue
                for o in t["out"]:
                    if o in self.states and (o not in known or src < known[o]):
                        known[o] = src
                        moved = True
            for u in self.processing.get("unlocks", []):
                if u["give"] in self.states:
                    ws = [ds.get(w, known.get(w)) for w in u["when"]]
                    ws = [w for w in ws if w is not None]
                    if ws:
                        cand = min(ws) if u.get("any") else max(ws)
                        if u["give"] not in known or cand < known[u["give"]]:
                            known[u["give"]] = cand
                            moved = True
            if not moved:
                break
        earliest = min(ds.get(p, 0) for p in PRIMITIVES)
        self.state_ds = {sid: known.get(sid, earliest) for sid in self.states}

    # ---- statuses ------------------------------------------------------
    def status_of(self, node: dict) -> str:
        src = node.get("src", [])
        caution = (node.get("caution") or "").lower()
        if "placeholder" in caution and src == ["source_required"]:
            return STATUS_PLACEHOLDER
        real = [s for s in src if s != "source_required"]
        topic = [s for s in real if self.sources.get(s, {}).get("scope") == "topic"]
        if "source_required" in src or not topic:
            return STATUS_PENDING
        conf = (node.get("confidence") or {}).get("level")
        if conf in ("debated", "uncertain") or node.get("caution"):
            return STATUS_UNCERTAIN
        return STATUS_VERIFIED

    # ---- profiles -------------------------------------------------------
    def material_id(self, ident: str, cat: str, era: str) -> str:
        hit = self.material_of.get(ident)
        if hit:
            return hit
        if cat == "technology" and era in ("industry", "electric", "computing", "network", "games", "simulation"):
            return "machine"
        return self.by_category.get(cat, "stone")

    def capabilities_of(self, ident: str) -> frozenset:
        return frozenset(c for c, ids in self.processing.get("capabilities", {}).items() if ident in ids)

    def _build_profiles(self) -> None:
        mat_tags = self.processing.get("materialTags", {})
        extra = self.processing.get("tags", {})
        for n in self.nodes:
            mat = self.material_id(n["id"], n["cat"], n["era"])
            tags = set(mat_tags.get(mat, [])) | set(extra.get(n["id"], []))
            self.profiles[n["id"]] = Profile(
                id=n["id"], name=n["n"], family=FAMILY_OF_MATERIAL.get(mat, "made"), material=mat,
                tags=frozenset(tags), capabilities=self.capabilities_of(n["id"]), era=n["era"], ds=n["ds"],
                status=self.status_of(n), is_state=False, cat=n["cat"],
                rec_arities=tuple(sorted({len(r) for r in n.get("rec", [])})),
            )
        for sid, s in self.states.items():
            mat = self.material_id(sid, s.get("cat", "material"), s["era"])
            tags = set(mat_tags.get(mat, [])) | set(extra.get(sid, [])) | set(s.get("tags", []))
            self.profiles[sid] = Profile(
                id=sid, name=s["n"], family=FAMILY_OF_MATERIAL.get(mat, "made"), material=mat,
                tags=frozenset(tags), capabilities=self.capabilities_of(sid), era=s["era"],
                ds=self.state_ds.get(sid, 0), status=STATUS_STATE, is_state=True, cat=s.get("cat", "material"),
            )

    def _apply_v3_sidecars(self) -> None:
        """Items published by this pipeline carry their own material family and archetype (sidecar claims
        file); materials.ts does not list them, so without this they would fall back to a category guess."""
        self.v3_items: dict[str, dict] = {}
        cdir = self.root / "data" / "verified" / "claims"
        if not cdir.is_dir():
            return
        seed_fam = {"ceramic": "earth", "composite": "made", "organic": "living", "fibre": "fibre"}
        for f in sorted(cdir.glob("*.json")):
            for iid, it in _read_json(f).get("items", {}).items():
                prof = self.profiles.get(iid)
                if prof is None:
                    continue
                self.v3_items[iid] = it
                mp = it.get("materialProperties", {})
                fam = seed_fam.get(mp.get("family"), mp.get("family", prof.family))
                self.profiles[iid] = replace(
                    prof, family=fam, tags=frozenset(set(prof.tags) | set(mp.get("properties") or [])))

    # ---- helpers ---------------------------------------------------------
    def known(self, ident: str) -> bool:
        return ident in self.profiles

    def dependency_graph(self) -> dict[str, set[str]]:
        """target → every ingredient id across every route (base, overlay, via)."""
        g: dict[str, set[str]] = {}
        for tid, rs in self.recipe_rows.items():
            g.setdefault(tid, set()).update(i for r in rs for i in r)
        for t in self.processing.get("transforms", []):
            for o in t["out"]:
                g.setdefault(o, set()).add(t["from"])
        return g

    def depends_on(self, ident: str, target: str, graph: dict[str, set[str]] | None = None) -> bool:
        graph = graph or self.dependency_graph()
        stack, seen = [ident], set()
        while stack:
            cur = stack.pop()
            if cur == target:
                return True
            if cur in seen:
                continue
            seen.add(cur)
            stack.extend(graph.get(cur, ()))
        return False

    def max_catalogue_number(self) -> int:
        return max(n.get("no", 0) for n in self.nodes)

    def key_of(self, ids: list[str]) -> str:
        return recipe_key(ids)

    def depths(self, extra_rows: dict[str, list[list[str]]] | None = None) -> dict[str, int]:
        """Minimum crafting depth, counting recipes, single-resource transforms and unlocks (mirrors computeDepths)."""
        rows = {k: [list(r) for r in v] for k, v in self.recipe_rows.items()}
        for k, v in (extra_rows or {}).items():
            rows.setdefault(k, []).extend(v)
        depth: dict[str, int] = {p: 0 for p in PRIMITIVES}

        def cap_depth(cap: str) -> float:
            ids = self.processing.get("capabilities", {}).get(cap, [])
            ds = [depth[i] for i in ids if i in depth]
            return min(ds) if ds else float("inf")

        changed = True
        while changed:
            changed = False
            for tid, rs in rows.items():
                for r in rs:
                    if all(i in depth for i in r):
                        d = max(depth[i] for i in r) + 1
                        if tid not in depth or d < depth[tid]:
                            depth[tid] = d
                            changed = True
            for t in self.processing.get("transforms", []):
                if t["from"] not in depth:
                    continue
                base = depth[t["from"]]
                if t.get("needs"):
                    c = cap_depth(t["needs"])
                    if c == float("inf"):
                        continue
                    base = max(base, c)
                for o in t["out"]:
                    if o not in depth or base + 1 < depth[o]:
                        depth[o] = int(base + 1)
                        changed = True
            for u in self.processing.get("unlocks", []):
                ds = [depth.get(w) for w in u["when"]]
                ok = any(x is not None for x in ds) if u.get("any") else all(x is not None for x in ds)
                if not ok:
                    continue
                known = [x for x in ds if x is not None]
                d = (min(known) if u.get("any") else max(known)) + 1
                if u["give"] not in depth or d < depth[u["give"]]:
                    depth[u["give"]] = d
                    changed = True
        return depth
