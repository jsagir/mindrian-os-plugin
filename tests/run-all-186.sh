#!/usr/bin/env bash
# Phase 186 verification aggregator -- the single PASS/FAIL gate for CORPUS:
# Stats Hygiene (CORPUS-01 + CORPUS-02). Mirrors tests/run-all-180.sh.
#
# Three suites:
#   (a) the artifact behaviors (the three D1 magnitudes + the generated stamp +
#       the no-directional-sub-count negative assertion);
#   (b) the tripwire, BOTH directions (fires on a stale literal on a LIVE surface,
#       and does NOT fire on the same literal inside an excluded historical region
#       -- the D4 crux -- nor on a directional/substrate mention -- D2);
#   (c) the live end-to-end --check (green on the repointed repo).
#
# bash only. No emoji. No em-dashes.

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

# (a) artifact behaviors (the three magnitudes + the generated stamp).
run "186-artifact (three magnitudes + stamp)" node tests/test-corpus-stats-artifact.cjs

# (b) the tripwire, BOTH directions (FIRE on LIVE, PASS in excluded history / substrate).
run "186-tripwire (fires LIVE, silent in frozen history)" node tests/test-corpus-stats-tripwire.cjs

# (c) the live end-to-end --check: green on the repointed repo (exit 0).
run "186-check (live --check green)" node scripts/build-corpus-stats.cjs --check

echo "========================================"
echo "  Summary (186 verification)"
echo "  Passed: $PASS   Failed: $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
