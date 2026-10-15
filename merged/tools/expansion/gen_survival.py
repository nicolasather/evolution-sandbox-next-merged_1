#!/usr/bin/env python3
"""Survival finds: every exp26 item of era origins/fire/settlement can turn up while foraging.
Output: data/expansion/survival_finds.json"""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
nodes = json.load(open(os.path.join(ROOT, 'data/nodes/g11.json')))
ok = {'origins', 'fire', 'settlement'}
out = [{'id': n['id'], 'n': n['n'], 'l1': n['l1'].split(': ', 1)[-1]} for n in sorted(nodes, key=lambda x: x['no']) if n['era'] in ok]
json.dump(out, open(os.path.join(ROOT, 'data/expansion/survival_finds.json'), 'w'), indent=1)
print(len(out), 'survival finds')
