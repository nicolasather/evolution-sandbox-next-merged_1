#!/usr/bin/env python3
"""Generate one Escape Room episode per expansion topic from the game's own
recipe data (data/nodes/g*.json). Idempotent. Puzzles ask about the in-game
crafting web (order of the tech tree, which ingredient a recipe uses, counts),
never about invented history. Run: python3 tools/expansion/gen_escape.py"""
import json, glob, os, collections
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
names = {}
for f in glob.glob(os.path.join(ROOT, 'data/nodes/*.json')):
    for x in json.load(open(f)): names[x['id']] = x['n']
nodes = [x for x in json.load(open(os.path.join(ROOT, 'data/nodes/g11.json')))]
_g12 = os.path.join(ROOT, 'data/nodes/g12.json')
if os.path.exists(_g12):
    nodes += [x for x in json.load(open(_g12)) if x.get('modeMeta', {}).get('escape-room', {}).get('candidate')]
_g13 = os.path.join(ROOT, 'data/nodes/g13.json')
if os.path.exists(_g13):  # exp28: only items whose installer decision says their family can fill a fair room
    nodes += [x for x in json.load(open(_g13)) if x.get('modeMeta', {}).get('escape-room', {}).get('candidate')]
topics = collections.OrderedDict()
for x in sorted(nodes, key=lambda x: x['no']): topics.setdefault(x['tags'][1], []).append(x)

def pretty(t): return t.replace('_', ' ').title()
eps = []
for t, items in list(topics.items()):
    if len(items) < 6 or len({it['rec'][0][0] for it in items}) < 5:  # too small a family for a fair 5-step order and a 4-way match
        topics.pop(t); continue
    items = sorted(items, key=lambda x: (x['ds'], x['no']))
    # sequence: 5 items spread across the family, shown scrambled, correct = (ds, no) order
    idx = [round(i * (len(items) - 1) / 4) for i in range(5)]
    seq = [items[i] for i in idx]
    order = [s['id'] for s in seq]
    scr = [seq[i] for i in (3, 0, 4, 2, 1)]
    # match: 4 items with distinct first ingredient
    pick, used = [], set()
    for it in items:
        ing = it['rec'][0][0]
        if ing not in used and it['id'] not in order[:0]:
            used.add(ing); pick.append(it)
        if len(pick) == 4: break
    mscr = [pick[i] for i in (2, 0, 3, 1)]
    letters = ''.join(p['n'][0].upper() for p in mscr)
    code = f"{len(items)}-5-{letters}"
    tgt = [pick[i] for i in (1, 3, 0, 2)]
    eps.append({
      'id': f'x-{t}', 'title': f'The {pretty(t)} Workshop',
      'setting': f'A sealed workshop wall chart of the {pretty(t).lower()} family of the Discovery Journal.',
      'introText': f'A workshop of {pretty(t).lower()} stands closed. The door opens only for someone who has read the crafting web of this family: how many entries it holds, in what order they unfold, and which ingredient leads to which tool. This room is built from the game\'s own recipes, not from historical claims.',
      'puzzles': [
        {'id': 'ratio', 'kind': 'ratio', 'title': 'The Tally Board', 'unit': 'entries', 'correctValue': len(items), 'tolerance': 0,
         'prompt': 'The tally board lists every entry of this family: ' + '; '.join(i['n'] for i in items) + '. How many entries are there?',
         'hint': 'Count the names on the board one by one.', 'unlockFragment': str(len(items))},
        {'id': 'sequence', 'kind': 'sequence', 'title': 'The Unfolding Order',
         'prompt': 'Five entries of this family lie scattered. Put them back in the order they appear along the Discovery Journal timeline, earliest first.',
         'steps': [{'id': s['id'], 'text': s['n']} for s in scr], 'correctOrder': order,
         'hint': 'Earlier entries sit lower in the Journal and use more basic ingredients.', 'unlockFragment': '5'},
        {'id': 'match', 'kind': 'match', 'title': 'The Ingredient Wall',
         'prompt': 'Four items hang on the wall. Match each to the first ingredient of its main recipe.',
         'items': [{'id': m['id'], 'label': m['n']} for m in mscr],
         'targets': [{'id': p['rec'][0][0], 'label': names.get(p['rec'][0][0], p['rec'][0][0])} for p in tgt],
         'correctMatch': {p['id']: p['rec'][0][0] for p in pick},
         'hint': 'Open each item in the Discovery Journal and read its first recipe.', 'unlockFragment': letters},
        {'id': 'exit', 'kind': 'code', 'title': 'The Workshop Door',
         'prompt': 'Set the three tallies in order: the entry count, the number of steps in the timeline, and the initials of the four items.',
         'correctCode': code, 'requires': ['ratio', 'sequence', 'match'],
         'hint': 'Count, then steps, then initials in the order the wall lists the items.'},
      ],
      'finalPuzzleId': 'exit',
      'successText': 'The door opens. You read a family of tools the way the game builds it: a count, an order, a chain of ingredients.',
    })
# the match item list order must follow pick order for the initials -> keep items in pick order for code
for e, (t, items) in zip(eps, topics.items()):
    pass
json.dump(eps, open(os.path.join(ROOT, 'data/expansion/escape_episodes.json'), 'w'), indent=1)
print(len(eps), 'episodes')
