#!/usr/bin/env python3
"""Build data/expansion/anc27_facts.json (topic-context pages per anc27 item). data/sources.json is deliberately NOT touched:
items keep src ['source_required'] because the creative gateway treats any real src as 'verified' truth.

Facts come from tools/expansion/anc27/facts/raw_*.py (fetched 2026-10-15 from en.wikipedia.org; one-line reader summaries). Every anc27 item
is matched to ONE topic page via overrides.PRE -> NONE -> overrides.OVERRIDES -> subjects.RULES. A match means 'this page is about the kind of thing the item is';
it never means the exact item, its recipe or its game year is documented. Items with no fitting fetched page stay 'source_required'.

  python3 tools/expansion/anc27/facts/build_facts.py
"""
import glob, json, os, re, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
CHECKED = "2026-10-15"
ns = {}
exec(open(os.path.join(HERE, "subjects.py"), encoding="utf-8").read(), ns); RULES = ns["RULES"]
exec(open(os.path.join(HERE, "overrides.py"), encoding="utf-8").read(), ns); PRE, NONE, OVERRIDES = ns["PRE"], ns["NONE"], ns["OVERRIDES"]
raw = {}
for f in sorted(glob.glob(os.path.join(HERE, "raw_*.py"))):
    n2 = {}; exec(open(f, encoding="utf-8").read(), n2); raw.update(n2["W"])
items = json.load(open(os.path.join(ROOT, "data", "nodes", "g12.json"), encoding="utf-8"))
sid = lambda slug: "wp_" + re.sub(r"[^a-z0-9]+", "_", urllib.parse.unquote(slug).lower()).strip("_")
url = lambda slug: "https://en.wikipedia.org/wiki/" + slug

facts, uncovered, used = {}, [], set()
for n in items:
    nm = " " + n["n"].lower() + " "
    if n["n"].lower() in NONE:
        uncovered.append(n["id"]); continue
    slug = next((s for k, s in PRE + OVERRIDES + RULES if k in nm and s in raw), None)
    if not slug:
        uncovered.append(n["id"]); continue
    title, what, earliest = raw[slug]
    used.add(slug)
    facts[n["id"]] = {"source": sid(slug), "page": title, "url": url(slug), "what": what, "earliestOnPage": earliest, "gameYear": n["ds"],
                      "status": "topic_context_only", "itemSpecificEvidenceVerified": False}
out = {"_note": "Topic-context fact check. Each entry names the Wikipedia page about the KIND of thing the item represents (fetched and read "
                + CHECKED + "). It is NOT proof that the exact item, recipe, region or game year is historical; gameYear is a gameplay gate. "
                "Wikipedia is crowd-edited, so it is never listed in data/sources.json; where the page itself flags a claim as unsourced this is stated in earliestOnPage.",
       "checked": CHECKED, "covered": len(facts), "uncovered": len(uncovered), "uncoveredIds": uncovered, "pages": len(used), "items": facts}
os.makedirs(os.path.join(ROOT, "data", "expansion"), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, "data", "expansion", "anc27_facts.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"covered {len(facts)} / {len(items)} items with {len(used)} topic pages; uncovered {len(uncovered)}")
