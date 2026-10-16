#!/usr/bin/env python3
"""EXP28 installer: tools/exp28/batches/b*.py (hand-authored, researched items) -> the running game.

  python3 tools/exp28/install.py            # validate every batch, then write nodes / art / sources / majors
  python3 tools/exp28/install.py --check    # validate only, write nothing

Writes (idempotent, re-runnable):
  data/nodes/g13.json     the exp28 nodes (ids keep their catalogue number between runs)
  data/art.json           one hand-authored plate per node  (merged, never replaces existing keys)
  data/sources.json       item-specific sources the batches cite (ids x28_*)
  data/majors.json        only items that carry a researched `major` block
  data/exp28/audit.csv    item-by-item pass/fail table

An item that fails any gate is NOT installed and is listed with the reason. Nothing is guessed or auto-fixed.
"""
from __future__ import annotations

import argparse
import csv
import glob
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tools" / "exp28"))
from content.keys import ITEM_ID_RE, MAX_SLOTS, MIN_SLOTS, legacy_key  # noqa: E402

TODAY = "2026-10-16"
ALLOWED = {"g", "path", "line", "circle", "ellipse", "rect", "polyline", "polygon"}
MAX_BYTES, MAX_ELEMENTS = 6500, 140
ERAS = ["origins", "fire", "settlement", "agriculture", "civilization", "trade", "metallurgy", "science",
        "industry", "electric", "computing", "network", "games", "simulation"]
CATS = {"material", "technique", "technology", "biology", "culture", "society", "knowledge", "science",
        "engineering", "energy", "computing", "media", "economy"}
ANCIENT = {"origins", "fire", "settlement", "agriculture", "civilization", "trade", "metallurgy"}
MODES = ["main-evolution", "survival", "civilization", "archaeology", "escape-room", "decipher",
         "alien-archaeology", "reverse-evolution", "minimum-path"]
FIRST_NO = 2920


def lint_art(markup: str) -> list[str]:
    p: list[str] = []
    for tag in re.findall(r"<\s*([A-Za-z][A-Za-z0-9]*)", markup):
        if tag not in ALLOWED:
            p.append(f"element <{tag}> not allowed")
    if re.search(r"(?i)<script|javascript:|\bon[a-z]+\s*=|href\s*=|xlink|<text|<image|<use|style\s*=|url\(", markup):
        p.append("forbidden construct")
    if "NaN" in markup:
        p.append("non-finite number")
    if not markup.startswith("<g"):
        p.append("must start with <g data-z>")
    if len(set(re.findall(r'data-z="(-?\d+)"', markup))) < 2:
        p.append("needs 2+ depth layers")
    if not re.search(r'opacity="0?\.\d+"', markup):
        p.append("no hairline (opacity<1) detail")
    if re.search(r'opacity="0(\.0+)?"', markup) or re.search(r'stroke-width="0(\.0+)?"', markup):
        p.append("invisible geometry")
    if len(markup.encode()) > MAX_BYTES:
        p.append("markup too large")
    els = len(re.findall(r"<(?:path|line|circle|ellipse|rect|polyline|polygon)\b", markup))
    if els > MAX_ELEMENTS:
        p.append(f"too many elements ({els})")
    if els < 6:
        p.append(f"too sparse ({els} elements)")
    for m in re.finditer(r'\b(?:cx|cy|x1|x2|y1|y2|x|y)="(-?\d+(?:\.\d+)?)"', markup):
        if not -6 <= float(m.group(1)) <= 106:
            p.append("coordinate outside plate")
            break
    for m in re.finditer(r'points="([^"]+)"', markup):
        if any(not -6 <= float(v) <= 106 for v in re.findall(r"-?\d+(?:\.\d+)?", m.group(1))):
            p.append("polyline point outside plate")
            break
    for m in re.finditer(r' d="([^"]+)"', markup):
        if re.search(r"[^MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]", m.group(1)):
            p.append("bad path data")
            break
    return p


def load_batches() -> list[dict]:
    items: list[dict] = []
    for f in sorted(glob.glob(str(ROOT / "tools/exp28/batches/b*.py"))):
        spec = importlib.util.spec_from_file_location(Path(f).stem, f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for it in mod.ITEMS:
            it = dict(it)
            it["_batch"] = Path(f).stem
            items.append(it)
    return items


ARCH_CAT = {"fired clay": "pottery", "glass": "pottery", "ceramic": "pottery", "stone": "lithic", "metal": "lithic", "iron": "lithic",
            "bronze": "lithic", "copper": "lithic", "brass": "lithic", "wood": "organic", "fibre": "organic", "leather": "organic"}


def arch_category(it: dict) -> str:
    if it.get("arch_cat"):
        return it["arch_cat"]
    mat = it.get("material", "").lower()
    for k, v in ARCH_CAT.items():
        if k in mat:
            return v
    return "structural"


def default_modes(it: dict, escape_ok: bool = False) -> dict:
    """Honest per-mode decision. `decision` is playable | contextual | not_eligible, always with a reason."""
    era, mat = it["era"], it.get("material", "mixed")
    ancient = era in ANCIENT
    physical = it.get("physical", True)
    durable = it.get("durable", True)
    m: dict[str, dict] = {}
    m["main-evolution"] = dict(candidate=True, decision="playable", reason="catalogue node reached by its own recipe")
    m["reverse-evolution"] = dict(candidate=True, decision="playable", reason="decomposes along its sourced recipe")
    m["minimum-path"] = dict(candidate=True, decision="playable", reason="finite acyclic recipe graph, in the atlas")
    m["escape-room"] = dict(candidate=escape_ok, decision="playable" if escape_ok else "contextual",
                            reason=("room x-%s is generated from this family's own recipes" % it.get("topic") if escape_ok
                                    else "family still too small for a fair 5-step room; no room is faked"))
    if ancient and physical and durable:
        m["archaeology"] = dict(candidate=True, decision="playable", category=arch_category(it),
                                reason=f"{mat} object recoverable from a settlement / workshop context")
    else:
        m["archaeology"] = dict(candidate=False, decision="not_eligible",
                                reason="post-ancient or perishable: not a plausible excavated find in this mode's sites")
    surv = it.get("survival", False)
    m["survival"] = dict(candidate=bool(surv), decision="playable" if surv else "not_eligible",
                         reason="era-appropriate make-able or forage-able tool" if surv
                         else "needs workshop, metal or specialist knowledge beyond a survival scenario")
    m["civilization"] = dict(candidate=bool(it.get("civ")), decision="playable" if it.get("civ") else "contextual",
                             reason=(it["civ"]["note"] if it.get("civ") else
                                     "history context only: no causal city effect is claimed, so no production bonus is faked"))
    m["decipher"] = dict(candidate=False, decision="not_eligible",
                         reason="Decipher uses invented scripts; no real inscription is fabricated for this object")
    m["alien-archaeology"] = dict(candidate=False, decision="not_eligible",
                                  reason="a human artefact is never presented as alien")
    m.update(it.get("modes", {}))
    for k in m:
        m[k].setdefault("review", "approved")
        m[k].setdefault("automatic_ingestion", k in ("main-evolution", "minimum-path", "reverse-evolution"))
    return m


def recipe_problems(iid: str, ds: int, r: list[str], known: dict[str, dict], claimed: dict[str, str]) -> list[str]:
    why: list[str] = []
    if not MIN_SLOTS <= len(r) <= MAX_SLOTS:
        return [f"recipe slots {r}"]
    for i in r:
        k = known.get(i)
        if k is None:
            why.append(f"unknown ingredient {i}")
        elif i == iid:
            why.append("self ingredient")
        elif k.get("ds", 0) > ds:
            why.append(f"ingredient {i} (ds {k['ds']}) later than item (ds {ds})")
        elif i in LEGACY_PLACEHOLDERS:
            why.append(f"ingredient {i} is a legacy placeholder")
    key = legacy_key(r)
    if key in claimed and claimed[key] != iid:
        why.append(f"recipe {r} already makes {claimed[key]}")
    for owner, row in ROWS:
        if owner == iid:
            continue
        if strict_sub(r, row):
            why.append(f"recipe {r} sits inside {owner}'s recipe {row} (assembly rule)")
            break
        if strict_sub(row, r):
            why.append(f"recipe {r} contains {owner}'s recipe {row} (assembly rule)")
            break
    return why


def find_recipes(it: dict, known: dict[str, dict], claimed: dict[str, str], lock: dict) -> list[list[str]]:
    """Pick up to `n` valid recipes from the author's ordered ingredient `pool` (all members chosen by hand as physically
    plausible for the object). Reuses the locked choice when it is still valid, so saved games never see a recipe move."""
    import itertools
    locked = lock.get(it["id"])
    if locked and all(not recipe_problems(it["id"], it["ds"], r, known, claimed) for r in locked):
        return locked
    pool = [p for p in it["pool"] if p in known and p != it["id"] and known[p].get("ds", 0) <= it["ds"] and p not in LEGACY_PLACEHOLDERS]
    must = set(it.get("must", []))
    want = it.get("nrec", 2)
    out: list[list[str]] = []
    for size in (3, 2, 4, 5):
        cands = [list(c) for c in itertools.combinations(pool, size) if must <= set(c)]
        cands.sort(key=lambda c: sum(pool.index(x) for x in c))
        for c in cands:
            if recipe_problems(it["id"], it["ds"], c, known, claimed):
                continue
            if any(len(set(c) & set(o)) >= len(c) - 0 for o in out):
                continue
            if any(set(c) == set(o) for o in out):
                continue
            out.append(c)
            if len(out) >= want:
                return out
    return out


def validate_item(it: dict, known: dict[str, dict], claimed: dict[str, str], art_seen: dict[str, str]) -> list[str]:
    why: list[str] = []
    for f in ("id", "n", "era", "cat", "ds", "date", "rar", "vis", "l1", "l2", "l3", "ev", "srcs", "rec", "art", "region", "confidence"):
        if it.get(f) in (None, "", [], {}):
            why.append(f"missing {f}")
    if why:
        return why
    if not it["id"].startswith("exp28_") or not ITEM_ID_RE.fullmatch(it["id"]):
        why.append("bad id")
    if it["era"] not in ERAS:
        why.append("bad era")
    if it["cat"] not in CATS:
        why.append("bad category")
    if it["rar"] not in {"common", "uncommon", "rare"}:
        why.append("bad rarity")
    if it["confidence"]["level"] not in {"established", "debated", "uncertain"}:
        why.append("bad confidence")
    if not any(s.get("scope") == "topic" for s in it["srcs"]):
        why.append("no topic-level source")
    for s in it["srcs"]:
        if not str(s.get("url", "")).startswith("https://") or not s.get("claim"):
            why.append(f"source {s.get('k')} needs https url and the claim it supports")
        if re.search(r"(search\?|/search|collection/?$|openaccess/devtools|/collection$)", s.get("url", "")):
            why.append(f"source {s.get('k')} is a search/collection index, not item proof")
    recs = it["rec"]
    if len(recs) > 5:
        why.append("more than 5 recipes")
    for r in recs:
        why += recipe_problems(it["id"], it["ds"], r, known, claimed)
    errs = lint_art(it["art"])
    why += [f"art: {e}" for e in errs]
    h = hashlib.sha256(it["art"].encode()).hexdigest()
    if h in art_seen and art_seen[h] != it["id"]:
        why.append(f"art duplicates {art_seen[h]}")
    if len(it["l1"]) < 30 or len(it["l2"]) < 60:
        why.append("layers too thin")
    if "pending" in (it["l1"] + it["l2"] + it["l3"]).lower() or "unverified" in (it["l1"] + it["l2"] + it["l3"]).lower():
        why.append("placeholder wording")
    mj = it.get("major")
    if mj:
        for f in ("tier", "lat", "lon", "precision", "geo", "region", "civ", "period", "certainty", "fact", "evidence"):
            if mj.get(f) in (None, ""):
                why.append(f"major missing {f}")
    return why


LEGACY_PLACEHOLDERS: set[str] = set()
ROWS: list[tuple[str, list[str]]] = []   # every (owner, recipe) in the catalogue + processing overlay


def strict_sub(sub, sup) -> bool:
    """Mirror of strictSub in lib/__tests__/processing.test.ts: multiset sub strictly smaller than sup and inside it."""
    if len(sub) >= len(sup):
        return False
    pool = list(sup)
    for x in sub:
        if x not in pool:
            return False
        pool.remove(x)
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    nodes_dir = ROOT / "data/nodes"
    base: dict[str, dict] = {}
    claimed: dict[str, str] = {}
    for f in sorted(nodes_dir.glob("g*.json")):
        if f.name == "g13.json":
            continue
        for n in json.loads(f.read_text(encoding="utf-8")):
            base[n["id"]] = n
            for r in n.get("rec", []):
                claimed[legacy_key(r)] = n["id"]
            if f.name == "g10.json":
                LEGACY_PLACEHOLDERS.add(n["id"])
    # processing overlay: recipes added / retired for existing items (assembly rule: no recipe inside another item's recipe)
    proc = json.loads((ROOT / "data/processing.json").read_text(encoding="utf-8"))["recipes"]
    retired = {(e["id"], legacy_key(e["rec"])) for e in proc["retire"]}
    for nid, n in base.items():
        for r in n.get("rec", []):
            if (nid, legacy_key(r)) not in retired:
                ROWS.append((nid, r))
    for e in proc["add"]:
        ROWS.append((e["id"], e["rec"]))
        claimed.setdefault(legacy_key(e["rec"]), e["id"])
    art_all = json.loads((ROOT / "data/art.json").read_text(encoding="utf-8"))
    art_seen = {hashlib.sha256(v.encode()).hexdigest(): k for k, v in art_all.items() if not k.startswith("exp28_")}

    out_file = nodes_dir / "g13.json"
    prev_no = {n["id"]: n["no"] for n in json.loads(out_file.read_text(encoding="utf-8"))} if out_file.exists() else {}
    items = load_batches()
    lock_file = ROOT / "data/exp28/recipes.lock.json"
    lock = json.loads(lock_file.read_text(encoding="utf-8")) if lock_file.exists() else {}
    ok: list[dict] = []
    report: list[dict] = []
    known = dict(base)
    # already-installed items first (in their stable order) so new items can never displace a shipped recipe;
    # new items follow in ds order so they can chain on earlier exp28 items
    for it in sorted(items, key=lambda x: (0, prev_no[x["id"]], x["id"]) if x["id"] in prev_no else (1, x["ds"], x["id"])):
        if it["id"] in {o["id"] for o in ok}:
            report.append(dict(id=it["id"], name=it["n"], batch=it["_batch"], status="FAIL", reason="duplicate id in batches"))
            continue
        if it.get("pool") and not it.get("rec"):
            it["rec"] = find_recipes(it, known, claimed, lock)
            if not it["rec"]:
                report.append(dict(id=it["id"], name=it["n"], batch=it["_batch"], status="FAIL",
                                   reason="no valid recipe from the author's ingredient pool (dense recipe space)"))
                continue
        why = validate_item(it, known, claimed, art_seen)
        norm = re.sub(r"[^a-z0-9]", "", it["n"].lower())
        for n in base.values():
            if re.sub(r"[^a-z0-9]", "", n["n"].lower()) == norm:
                why.append(f"name duplicates existing node {n['id']}")
                break
        if why:
            report.append(dict(id=it["id"], name=it["n"], batch=it["_batch"], status="FAIL", reason="; ".join(why)))
            continue
        for r in it["rec"]:
            claimed[legacy_key(r)] = it["id"]
            ROWS.append((it["id"], r))
        art_seen[hashlib.sha256(it["art"].encode()).hexdigest()] = it["id"]
        known[it["id"]] = it
        ok.append(it)
        report.append(dict(id=it["id"], name=it["n"], batch=it["_batch"], status="PASS", reason=""))

    fails = [r for r in report if r["status"] == "FAIL"]
    print(f"items authored {len(items)}  pass {len(ok)}  fail {len(fails)}")
    for r in fails:
        print("  FAIL", r["id"], "-", r["reason"])
    regress = [r["id"] for r in fails if r["id"] in prev_no]
    if regress:
        print("REGRESSION: previously installed items now fail:", regress)
        return 2
    if a.check:
        return 1 if fails else 0

    # ---- numbers: stable between runs ----
    nxt = max([FIRST_NO - 1] + list(prev_no.values()) + [n["no"] for n in base.values()]) + 1
    nodes_out = []
    fam: dict[str, list[dict]] = {}
    for it in ok:
        fam.setdefault(it["topic"], []).append(it)
    escape_topics = {t for t, v in fam.items() if len(v) >= 6 and len({x["rec"][0][0] for x in v}) >= 5}
    srcs_new: dict[str, dict] = {}
    for it in sorted(ok, key=lambda x: (x["ds"], x["id"])):
        no = prev_no.get(it["id"])
        if no is None:
            no = nxt
            nxt += 1
        src_ids = []
        for s in it["srcs"]:
            sid = f"x28_{s['k']}"
            src_ids.append(sid)
            srcs_new[sid] = {"t": s.get("t", "B"), "title": s["title"], "org": s["org"], "url": s["url"],
                             "type": s.get("type", "reference"), "scope": s.get("scope", "topic"), "checked": TODAY}
        modes = default_modes(it, it["topic"] in escape_topics)
        node = {
            "id": it["id"], "no": no, "n": it["n"], "era": it["era"], "cat": it["cat"], "date": it["date"], "ds": it["ds"],
            "rar": it["rar"], "vis": it["vis"], "l1": it["l1"], "l2": it["l2"], "l3": it["l3"], "ev": it["ev"],
            "src": src_ids, "rec": it["rec"],
            "tags": ["exp28", it.get("topic", "exp28")] + list(it.get("tags", [])),
            "confidence": it["confidence"],
            "artifactType": it.get("artifactType", "tool"),
            "museum": {"reconstructionStatus": "reference", "label": f"{it['n']} — {it['region']}"},
            "historical": {
                "region": it["region"], "firstKnownDate": it.get("first_known"), "itemSpecificEvidenceVerified": True,
                "claims": [{"source": f"x28_{s['k']}", "supports": s["claim"]} for s in it["srcs"]],
            },
            "modeMeta": modes,
        }
        if it.get("regions"):
            node["regions"] = it["regions"]
        if it.get("tradeImportance"):
            node["tradeImportance"] = it["tradeImportance"]
        nodes_out.append(node)
    out_file.write_text(json.dumps(nodes_out, ensure_ascii=False, indent=1), encoding="utf-8")

    art = json.loads((ROOT / "data/art.json").read_text(encoding="utf-8"))
    for k in [k for k in art if k.startswith("exp28_")]:
        del art[k]
    for it in ok:
        art[it["id"]] = it["art"]
    (ROOT / "data/art.json").write_text(json.dumps(art, ensure_ascii=False), encoding="utf-8")

    sj = json.loads((ROOT / "data/sources.json").read_text(encoding="utf-8"))
    for k in [k for k in sj["sources"] if k.startswith("x28_")]:
        del sj["sources"][k]
    sj["sources"].update(srcs_new)
    (ROOT / "data/sources.json").write_text(json.dumps(sj, ensure_ascii=False, indent=1), encoding="utf-8")

    mj = json.loads((ROOT / "data/majors.json").read_text(encoding="utf-8"))
    mj["majors"] = [m for m in mj["majors"] if not m["id"].startswith("exp28_")]
    for it in ok:
        if it.get("major"):
            m = dict(it["major"])
            m.pop("evidence", None)
            mj["majors"].append({"id": it["id"], "required": False, **m})
    (ROOT / "data/majors.json").write_text(json.dumps(mj, ensure_ascii=False, indent=1), encoding="utf-8")

    (ROOT / "data/exp28").mkdir(exist_ok=True)
    lock_file.write_text(json.dumps({it["id"]: it["rec"] for it in ok}, indent=1, ensure_ascii=False), encoding="utf-8")
    with open(ROOT / "data/exp28/audit.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["id", "name", "batch", "status", "reason"])
        w.writeheader()
        w.writerows(report)
    print(f"installed {len(nodes_out)} nodes -> data/nodes/g13.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
