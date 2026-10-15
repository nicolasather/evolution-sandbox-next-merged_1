#!/usr/bin/env python3
"""ONE command that makes every catalogue item join every mode. Run after adding/changing any node:
    npm run data:build && python3 tools/expansion/sync_modes.py
Regenerates: Minimum Path atlas + missions, Archaeology templates, Survival finds, Escape Room rooms.
A jest test (lib/content/__tests__/modeCoverage.test.ts) fails if any pool is stale."""
import subprocess, sys, os
here = os.path.dirname(__file__)
for s in ['gen_minpath.py', 'gen_archaeology.py', 'gen_survival.py', 'gen_escape.py']:
    subprocess.check_call([sys.executable, os.path.join(here, s)])
