#!/bin/bash
# usage: tools/exp28/ship.sh "message"   (run from merged/)
set -e
cd "$(git rev-parse --show-toplevel)"
git add -A
git commit -q -m "$1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SDgU2kKexgnVs1Zw64xKJm"
git push -q origin main
git fetch -q --depth=50 origin beta
git checkout -q beta
git merge -q origin/beta -m "Merge origin/beta" || true
git merge -q origin/main -m "Merge main into beta ($1)"
git push -q origin beta
git checkout -q main
git ls-remote origin beta main
