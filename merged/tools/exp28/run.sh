#!/bin/bash
# build + verify after authoring a batch (run from merged/)
set -e
python3 tools/exp28/install.py | tail -8
npm run data:build 2>&1 | tail -1
python3 tools/expansion/sync_modes.py 2>&1 | tail -1
python3 tools/exp28/devlab_fix.py
npm run data:validate 2>&1 | grep -E "ERRORS|errors "
npm run typecheck 2>&1 | tail -1
npx jest lib/content lib/devlab lib/__tests__/preservation.test.ts lib/__tests__/processing.test.ts lib/__tests__/engine.test.ts lib/craft 2>&1 | grep -E "^(Tests|Test Suites)|●" | head
