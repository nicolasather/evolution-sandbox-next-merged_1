"""Rename dev-only visual-lab entries whose names now collide with a production node (idempotent)."""
import json, re, sys
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s.lower())).strip()
db = json.load(open('data/db.json'))
ex = {x for n in db['nodes'] for x in (norm(n['n']), norm(n['id']))}
p = 'dev-data/visual-lab/dataset.json'
d = json.load(open(p))
ch = 0
for r in d['resources']:
    n = norm(r['name'])
    if n in ex or n + 's' in ex or re.sub(r's$', '', n) in ex or norm(re.sub(r'^vl_', '', r['id'])) in ex:
        old = r['name']; r['name'] = 'Dev Lab ' + old
        r['id'] = 'vl_devlab_' + re.sub(r'^vl_', '', r['id']); ch += 1
        print('renamed', old, '->', r['name'])
if ch:
    json.dump(d, open(p, 'w'), separators=(',', ':'), ensure_ascii=False)
