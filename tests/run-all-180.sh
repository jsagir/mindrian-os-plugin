#!/usr/bin/env bash
# Phase 180 verification aggregator -- the single PASS/FAIL gate for CANON-31:
# Establish the Two-Gauge Metric (Appendix D entry 31). Mirrors tests/run-all-179.sh.
#
# Phase 180 is a docs+evidence CANON amendment (navigator-LOCKED): it amends Part 5
# (Evidence) + Part 10 (ratification provenance) via the existing Appendix D
# mechanism, mints NO edge/node/reach/Brain wire. The one suite is the canonical
# FLOOR test pinning entry 31: entry present; the WELDED two-gauge pair in BOTH
# Part 5 and Part 10; the self-binding clause; the LOCAL telemetry marker; the
# Hooked gate retired + Manipulation Matrix kept; prior entries 1-30 preserved
# (Appendix D slice only); version 1.19. NEVER asserts a raw .size / entry count.
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

# (a) the entry-31 welded two-gauge FLOOR test (the canon contract).
run "180-01 canon-entry-31-two-gauge-floor" node tests/test-canon-entry-31-two-gauge-floor.cjs

# (b) carried frozen-set drift fences (additive phase -- 180 mints NO reach, NO
#     posture, NO edge, NO node; these stay GREEN).
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (180 verification)"
echo "  Passed: $PASS   Failed: $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
