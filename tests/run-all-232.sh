#!/usr/bin/env bash
# Phase 232 verification aggregator -- the single PASS/FAIL gate for the
# BlockNote Wiki Convergence port. Plan 02 lands the Room Home data layer
# (room-home.cjs, D-05) and Larry's Briefing generator (briefing.cjs, D-06);
# Plans 04/05/06 add their own tests/test-232-*.cjs files.
#
# This harness GLOB-DISCOVERS every tests/test-232-*.cjs file and runs it, so
# downstream plans add coverage WITHOUT editing this file. Every leg is fully
# hermetic and makes ZERO network reach: the briefing transport is exercised
# only through injected key + fetch seams, and the Room Home layer reads only
# the checked-in fixture room tests/fixtures/wiki-room-232. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

shopt -s nullglob
found=0
for t in tests/test-232-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-232-*.cjs files discovered"
  exit 1
fi

echo "======================================"
echo "Phase 232: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
