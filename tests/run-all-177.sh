#!/usr/bin/env bash
# Phase 177 verification aggregator -- the single PASS/FAIL gate for the Larry
# Behavioral Channel. Mirrors tests/run-all-176.sh.
#
# SCAFFOLD STATE (this commit): the 12 BCH suites are RED by design (TDD scaffold);
# each is a stub that exits non-zero until its wave lands. The carried frozen-set
# drift fences stay GREEN as regression. This gate is EXPECTED to fail until the
# waves are implemented; that is the point of shadow-before-trust.
#
# Composes:
#   (a) the 12 BCH suites (RED until implemented), grouped by wave:
#         Wave 1 deterministic:  bch-10, bch-16, bch-17, bch-18
#         Wave 2 shadow/logging:  bch-01, bch-04, bch-12
#         Wave 3 calibration:     bch-15  (the gate that can FAIL)
#         Wave 4 calibrated cue:  bch-07, bch-08
#         Wave 5 high blast:      bch-09
#         cross-cutting:          bch-14  (Part 8 zero-egress tripwire)
#   (b) the CARRIED frozen-set drift fences (177 mints NO reach, NO posture):
#         test-reach-ids-drift.cjs     -> frozen 6 reach_ids (no 7th)
#         test-posture-ids-drift.cjs   -> frozen 3 postures (no 4th)
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

# (a) the 12 BCH suites (RED until their wave lands -- run unguarded so a missing
#     or stubbed suite is a real FAILURE, not a silent skip).
run "bch-10 register-hud (W1)"        node tests/test-bch-10-register-hud.cjs
run "bch-16 keypress-latency (W1)"    node tests/test-bch-16-keypress-latency.cjs
run "bch-17 ignite-persona (W1)"      node tests/test-bch-17-ignite-persona.cjs
run "bch-18 persona-write (W1)"       node tests/test-bch-18-persona-write.cjs
run "bch-01 ownership (W2)"           node tests/test-bch-01-ownership.cjs
run "bch-04 shadow-log (W2)"          node tests/test-bch-04-shadow-log.cjs
run "bch-12 color-register (W2)"      node tests/test-bch-12-color-register.cjs
run "bch-15 calibration-fail (W3)"    node tests/test-bch-15-calibration-fail.cjs
run "bch-07 seam3-insertion (W4)"     node tests/test-bch-07-seam3-insertion.cjs
run "bch-08 signal-tier (W4)"         node tests/test-bch-08-signal-tier.cjs
run "bch-09 forced-material (W5)"     node tests/test-bch-09-forced-material.cjs
run "bch-14 part8-egress (cross)"     node tests/test-bch-14-part8-egress.cjs

# (a2) Wave-2 deterministic turn-stage seams (Plan 177-04, over the BCH-S1 turn_count).
#      These are GREEN once 177-04 lands (the eligibility gate + saturation predicate).
[ -f tests/test-bch-s5-turn-stage-eligibility.cjs ] && run "bch-s5 turn-stage-eligibility (W2)" node tests/test-bch-s5-turn-stage-eligibility.cjs
[ -f tests/test-bch-s4a-saturation.cjs ]            && run "bch-s4a saturation (W2)"            node tests/test-bch-s4a-saturation.cjs

# (b) carried frozen-set drift fences (additive phase -- these stay GREEN)
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (177 verification)"
echo "  Passed: $PASS   Failed: $FAIL"
echo "  NOTE: 12 BCH suites are RED by design at scaffold time."
echo "========================================"
[ "$FAIL" -eq 0 ]
