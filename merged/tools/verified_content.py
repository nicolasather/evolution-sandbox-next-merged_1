#!/usr/bin/env python3
"""Verified-content workflow for Evolution Sandbox (Logic-First V3, Phase 1).

  node tools/py.mjs tools/verified_content.py <command> [options]

Commands (run from the app root, `merged/`):
  audit            truth-status audit of the existing catalogue   [--report out/content-audit.json]
  seed-import      validate + register a recipe-free seed file     --input FILE [--dry-run] [--split-by-era --chunk N]
  seed-validate    check a batch's facts, sources, chronology      --batch NAME
  anchor-requests  write prompt-A envelopes for Claude Code         --batch NAME
  anchor-validate  hard-validate Claude's one-route decisions       --batch NAME
  freeze           freeze valid anchors (idempotent)                --batch NAME [--revise ID --reason TEXT]
  suggest          0..N alternative routes to a KNOWN target        --batch NAME --target ID (--rules-only | --from-response FILE)
  visual-preview   check visual briefs and list 3D archetypes       --batch NAME
  review           apply editor decisions (anchors / alternatives)  --batch NAME --decision-file FILE
  publish          compile to canonical files (all-or-nothing)      --batch NAME (--dry-run | --apply) [--sandbox DIR]
  rollback         restore a publish backup                         --backup DIR
  report           exception report + missing prerequisites         --batch NAME
  batches          list batches grouped by era
  run              seed-validate + anchor-requests + anchor-validate + report in one go

Every command prints plain, actionable messages; exit code is non-zero when something must be fixed.
Nothing here calls a network service or a model.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from content import COMPILER_VERSION  # noqa: E402
from content import alt as altmod  # noqa: E402
from content.anchor import build_requests, profile_of_seed  # noqa: E402
from content.catalogue import Catalogue  # noqa: E402
from content.evidence import evidence_rows, rows_to_csv  # noqa: E402
from content.pipeline import evaluate, freeze  # noqa: E402
from content.publish import PublishError, apply_plan, build_plan, make_sandbox, rollback  # noqa: E402
from content.report import audit, batch_exception_report, dependency_report  # noqa: E402
from content.seeds import ARCHETYPES, SCHEMA_VERSION  # noqa: E402
from content.store import BATCH_RE, Paths, StoreError, dumps, read_json, write_atomic  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def _out(msg: str = "") -> None:
    print(msg)


def cmd_audit(a) -> int:
    cat = Catalogue.load(a.root)
    rep = audit(cat)
    t = rep["totals"]
    _out(f"Catalogue: {t['nodes']} entries + {t['workedStates']} worked states")
    for k in ("verified", "verified_with_uncertainty", "pending_evidence", "placeholder_legacy", "fictional_gameplay"):
        _out(f"  {k:<28}{t[k]}")
    _out(f"  recipe slot histogram       {rep['recipeSlotHistogram']}")
    _out(f"  recipe key collisions       {len(rep['recipeKeyCollisions'])}")
    if a.report:
        p = Path(a.report)
        p = p if p.is_absolute() else a.root / p
        write_atomic(p, dumps(rep))
        _out(f"report written: {p}")
    return 0


def _print_seed_issues(ev) -> int:
    bad = 0
    if ev.source_problems:
        bad += 1
        _out("Batch sources with problems:")
        for p in ev.source_problems:
            _out(f"  ✗ {p}")
    for iid, r in ev.seed_results.items():
        if r["ok"]:
            _out(f"  ✓ {iid}" + (f"   (warnings: {', '.join(r['warnings'])})" if r["warnings"] else ""))
        else:
            bad += 1
            _out(f"  ✗ {iid}")
            for why in r["reasons"]:
                _out(f"      - {why}")
    return bad


def cmd_seed_validate(a) -> int:
    ev = evaluate(a.root, a.batch)
    _out(f"Batch '{a.batch}': {len(ev.seeds)} seed(s){'  [FIXTURE]' if ev.fixture else ''}")
    bad = _print_seed_issues(ev)
    rows = evidence_rows(ev.seeds, ev.registry)
    if a.evidence_csv:
        p = Path(a.evidence_csv)
        write_atomic(p if p.is_absolute() else a.root / p, rows_to_csv(rows))
        _out(f"evidence report: {a.evidence_csv}")
    pend = sum(1 for r in rows if r["status"] == "pending")
    _out(f"Claims: {len(rows) - pend} checked, {pend} pending")
    return 1 if bad else 0


def cmd_anchor_requests(a) -> int:
    ev = evaluate(a.root, a.batch)
    profiles = {}
    reqs = build_requests(a.batch, ev.seeds, ev.cat, ev.facts_ok, ev.actions, profiles)
    out = a.root / "out" / f"{a.batch}.anchor_requests.json"
    write_atomic(out, dumps(reqs))
    empty = [r["target"]["id"] for r in reqs["requests"] if not r["allowedIngredients"]]
    _out(f"{len(reqs['requests'])} envelope(s) → {out.relative_to(a.root).as_posix()}")
    for e in empty:
        _out(f"  ! {e}: empty ingredient pool → expect anchor_blocked (NO_APPROVED_RESULT)")
    skipped = [i for i in ev.seed_results if i not in ev.facts_ok]
    if skipped:
        _out(f"  not requested (facts not ready): {', '.join(skipped)}")
    return 0


def cmd_anchor_validate(a) -> int:
    ev = evaluate(a.root, a.batch)
    n_ok = 0
    for iid, rep in sorted(ev.reports.items()):
        st = rep["status"]
        mark = {"valid_candidate": "✓", "anchor_blocked": "■", "needs_review": "?"}.get(st, "✗")
        extra = ""
        if st == "valid_candidate":
            n_ok += 1
            extra = " ← " + " + ".join(rep["anchor"]["ingredientIds"]) + (f" [{rep['anchor']['action']}]" if rep["anchor"]["action"] else "")
        _out(f"  {mark} {iid}: {st}{extra}")
        for why in rep.get("reasons", []):
            _out(f"      - {why}")
        for why in rep.get("review", []):
            _out(f"      ? {why}")
        for m in rep.get("missingPrerequisites", []) or []:
            _out(f"      needs: {m}")
        for w in rep.get("warnings", []):
            _out(f"      ! {w}")
    _out(f"{n_ok} valid, {sum(1 for r in ev.reports.values() if r['status'] == 'anchor_blocked')} blocked, "
         f"{sum(1 for r in ev.reports.values() if r['status'] in ('rejected', 'no_decision', 'facts_not_ready'))} not usable")
    return 0 if all(r["status"] in ("valid_candidate", "anchor_blocked") for r in ev.reports.values()) else 1


def cmd_freeze(a) -> int:
    ev = evaluate(a.root, a.batch)
    revise = {a.revise: a.reason} if a.revise else None
    if a.revise and not a.reason:
        _out("--revise needs --reason \"why this anchor changes\"")
        return 2
    doc, msgs = freeze(ev, revise=revise)
    for m in msgs:
        _out("  " + m)
    text = dumps(doc)
    if ev.paths.frozen.exists() and ev.paths.frozen.read_text(encoding="utf-8") == text:
        _out("Frozen file unchanged (byte-identical).")
        return 0
    if a.dry_run:
        _out("dry run: nothing written")
        return 0
    write_atomic(ev.paths.frozen, text)
    _out(f"Frozen: {len(doc['anchors'])} anchor(s), {len(doc['blocked'])} blocked → "
         f"{ev.paths.frozen.relative_to(a.root).as_posix()}")
    return 1 if any("REFUSED" in m or "STALE" in m for m in msgs) else 0


def cmd_suggest(a) -> int:
    ev = evaluate(a.root, a.batch)
    cat, actions = ev.cat, ev.actions
    store = read_json(ev.paths.proposals) if ev.paths.proposals.exists() else altmod.new_store(a.batch)
    props: list[dict] = []
    model = None
    if a.from_response:
        resp = read_json(Path(a.from_response))
        if resp.get("decision") == "none":
            _out(f"Model answered NONE ({', '.join(resp.get('reasonCodes', []))}) — a normal, successful result.")
            return 0
        raw = resp.get("proposals") if "proposals" in resp else [resp]
        if resp.get("targetId") not in (None, a.target):
            _out("✗ response targets a different item: rejected wholesale")
            return 1
        props = [dict(p, schemaVersion=p.get("schemaVersion", 1), targetId=a.target) if p.get("targetId") in (None, a.target)
                 else p for p in raw]
        model = {"provider": "response-file", "file": Path(a.from_response).name}
    else:
        seed = next((s for s in ev.seeds if s["itemId"] == a.target), None)
        anchor = None
        arch = None
        if seed is not None and ev.paths.frozen.exists():
            frozen = read_json(ev.paths.frozen)
            anchor = (frozen["anchors"].get(a.target) or {}).get("ingredientIds")
            arch = seed["visualBrief"]["archetype"]
        props = altmod.rules_only_suggestions(cat, a.target, anchor, arch, actions)
        model = {"provider": "rules-only"}
        if not props:
            _out("No alternative routes proposed (zero is a normal result).")
    kept = 0
    batch_count = 0
    for p in props:
        v = altmod.validate_alternative(cat, p, actions, batch_count_for_target=batch_count)
        pid = altmod.add_to_store(store, p, v, model)
        if v["status"] == "no_result":
            _out(f"  ✗ rejected {pid}: {', '.join(v['reasons'])}")
        else:
            kept += 1
            batch_count += 1
            _out(f"  ? pending review {pid}: {' + '.join(p['ingredientIds'])}")
    write_atomic(ev.paths.proposals, dumps(store))
    _out(f"{kept} proposal(s) pending review; {len(props) - kept} rejected by rules. Nothing is playable until approved and published.")
    return 0


def cmd_visual(a) -> int:
    ev = evaluate(a.root, a.batch)
    bad = 0
    for s in ev.seeds:
        arch = (s.get("visualBrief") or {}).get("archetype")
        ok = arch in ARCHETYPES
        bad += 0 if ok else 1
        _out(f"  {'✓' if ok else '✗'} {s['itemId']}: archetype={arch} material={s['visualBrief'].get('material')} "
             f"stylized={s['visualBrief'].get('stylized')}")
    _out("3D is generated at run time from the brief (lib/visual3d); open the Visual lab in the beta build to see it.")
    return 1 if bad else 0


def cmd_review(a) -> int:
    dec = read_json(Path(a.decision_file))
    ev = evaluate(a.root, a.batch)
    rc = 0
    acc = dec.get("anchorAcceptances", [])
    if acc:
        write_atomic(ev.paths.reviews, dumps({"anchorAcceptances": acc}))
        _out(f"{len(acc)} anchor acceptance(s) recorded (applies only to the exact anchorHash given).")
    if dec.get("altDecisions"):
        store = read_json(ev.paths.proposals) if ev.paths.proposals.exists() else altmod.new_store(a.batch)
        for d in dec["altDecisions"]:
            r = altmod.apply_review(store, d)
            _out(f"  {d.get('proposalId')}: {r}")
            rc |= 0 if r in ("ok", "unchanged") else 1
        write_atomic(ev.paths.proposals, dumps(store))
    return rc


def cmd_publish(a) -> int:
    root = a.root
    if a.sandbox:
        sb = Path(a.sandbox)
        sb = sb if sb.is_absolute() else root / sb
        make_sandbox(root, sb)
        root = sb
        _out(f"sandbox copy: {sb}")
    ev = evaluate(root, a.batch)
    try:
        plan = build_plan(ev, sandbox=bool(a.sandbox))
    except PublishError as e:
        _out(f"✗ publish refused: {e}")
        return 1
    _out(f"Plan: {len(plan.nodes)} item(s) to publish; {len(plan.skipped)} not published")
    for iid, why in plan.skipped.items():
        _out(f"  skip {iid}: {', '.join(why)}")
    for n in plan.nodes:
        _out(f"  + #{n['no']} {n['id']} ← {' + '.join(n['rec'][0])}")
    _out(f"validation: {plan.validation}")
    if a.apply:
        res = apply_plan(plan, root=root)
        _out(f"Applied. Backup: {res['backup']}")
        _out("Next: `npm run data:build` (after you approve) to regenerate data/db.json; nothing was committed or deployed.")
    else:
        _out("dry run: nothing written")
    return 0


def cmd_rollback(a) -> int:
    for line in rollback(a.root, Path(a.backup)):
        _out("  " + line)
    return 0


def cmd_report(a) -> int:
    ev = evaluate(a.root, a.batch)
    rep = batch_exception_report(ev)
    dep = dependency_report(ev)
    out = a.root / "out" / f"{a.batch}.exceptions.json"
    write_atomic(out, dumps({**rep, "missingPrerequisiteIndex": dep}))
    _out(f"Outcomes: {rep['counts']}")
    for it in rep["items"]:
        if it["outcome"] != "valid_candidate":
            _out(f"  {it['itemId']}: {it['outcome']} {it['factIssues'] or it['anchorIssues']} {it['missingPrerequisites']}")
    if dep:
        _out("Missing prerequisites (add these items in an earlier era batch first):")
        for k, v in dep.items():
            _out(f"  {k}: needed by {', '.join(v)}")
    _out(f"report: {out.relative_to(a.root).as_posix()}")
    return 0


def cmd_batches(a) -> int:
    d = a.root / "data" / "verified_seeds"
    groups: dict[str, list[str]] = {}
    for p in sorted(d.glob("*.json")):
        if p.name.endswith((".anchors.json", ".anchors.frozen.json", ".reviews.json")):
            continue
        try:
            data = read_json(p)
        except StoreError:
            continue
        groups.setdefault(data.get("era", "unknown"), []).append(f"{p.stem} ({len(data.get('seeds', []))})")
    for era, names in groups.items():
        _out(f"{era}: {', '.join(names)}")
    return 0


def cmd_run(a) -> int:
    rc = cmd_seed_validate(argparse.Namespace(root=a.root, batch=a.batch, evidence_csv=None))
    cmd_anchor_requests(a)
    rc |= cmd_anchor_validate(a)
    cmd_report(a)
    return rc


def cmd_seed_import(a) -> int:
    src = read_json(Path(a.input))
    seeds = src.get("seeds")
    if src.get("schemaVersion") != SCHEMA_VERSION or not isinstance(seeds, list):
        _out("✗ input must be {schemaVersion: 3, batch, seeds: [...]}")
        return 1
    batches: dict[str, dict] = {}
    if a.split_by_era:
        prefix = src.get("batch", "import")
        per_era: dict[str, list[dict]] = {}
        for s in seeds:
            per_era.setdefault((s.get("chronology") or {}).get("era", "unknown"), []).append(s)
        for era, items in per_era.items():
            items.sort(key=lambda s: (((s.get("chronology") or {}).get("anchorYear")
                                      if (s.get("chronology") or {}).get("anchorYear") is not None else 0), s.get("itemId", "")))
            for k in range(0, len(items), a.chunk):
                name = f"{prefix}_{era}_{k // a.chunk + 1:03d}"
                batches[name] = {**{x: src[x] for x in src if x not in ("seeds", "batch")}, "batch": name, "era": era,
                                 "seeds": items[k:k + a.chunk]}
    else:
        name = src.get("batch")
        if not name or not BATCH_RE.fullmatch(name):
            _out("✗ input needs a valid lowercase batch name")
            return 1
        batches[name] = src
    rc = 0
    for name, data in batches.items():
        p = Paths(a.root, name)
        same = p.seeds.exists() and read_json(p.seeds) == data
        _out(f"  {name}: {len(data['seeds'])} seed(s) {'(identical, no change)' if same else ''}")
        if a.dry_run or same:
            continue
        if p.seeds.exists() and not a.replace:
            _out("    ✗ batch file already exists; pass --replace to overwrite")
            rc = 1
            continue
        write_atomic(p.seeds, dumps(data))
    if a.dry_run:
        _out("dry run: nothing written")
    return rc


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Verified-content workflow", formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__)
    ap.add_argument("--root", type=Path, default=ROOT, help="app root (default: merged/)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, fn, *args):
        sp = sub.add_parser(name)
        sp.set_defaults(fn=fn)
        for spec in args:
            sp.add_argument(*spec[0], **spec[1])
        return sp

    batch = (["--batch"], {"required": True})
    add("audit", cmd_audit, (["--report"], {}))
    add("seed-import", cmd_seed_import, (["--input"], {"required": True}), (["--dry-run"], {"action": "store_true"}),
        (["--replace"], {"action": "store_true"}), (["--split-by-era"], {"action": "store_true"}),
        (["--chunk"], {"type": int, "default": 200}))
    add("seed-validate", cmd_seed_validate, batch, (["--evidence-csv"], {}))
    add("anchor-requests", cmd_anchor_requests, batch)
    add("anchor-validate", cmd_anchor_validate, batch)
    add("freeze", cmd_freeze, batch, (["--revise"], {}), (["--reason"], {}), (["--dry-run"], {"action": "store_true"}))
    add("suggest", cmd_suggest, batch, (["--target"], {"required": True}), (["--rules-only"], {"action": "store_true"}),
        (["--from-response"], {}))
    add("visual-preview", cmd_visual, batch)
    add("review", cmd_review, batch, (["--decision-file"], {"required": True}))
    add("publish", cmd_publish, batch, (["--dry-run"], {"action": "store_true"}), (["--apply"], {"action": "store_true"}),
        (["--sandbox"], {}))
    add("rollback", cmd_rollback, (["--backup"], {"required": True}))
    add("report", cmd_report, batch)
    add("batches", cmd_batches)
    add("run", cmd_run, batch)
    a = ap.parse_args(argv)
    if getattr(a, "cmd", None) == "publish" and a.apply == a.dry_run:
        ap.error("publish needs exactly one of --dry-run or --apply")
    a.root = Path(a.root).resolve()
    try:
        return a.fn(a)
    except (StoreError, PublishError) as e:
        print(f"✗ {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
