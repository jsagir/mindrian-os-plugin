#!/usr/bin/env bash
# Phase 146 aggregator -- the LOOP-FIRES acceptance gate, the milestone gate.
#
# What this aggregator PROVES (by instrumentation, not by promise): the loop
# FIRES end-to-end across the FULL connector surface. It composes two groups so
# Phase 146 certifies the full surface, not a 5-criteria sample:
#
#   (a) the 6 ACPT dogfood drivers -- each driving a REAL shipped unit (no stub
#       of the unit under test) with obviously-fictional fixture inputs, each
#       carrying an adversarial honest-negative:
#         ACPT-01 navigation engine fires    (Plan 01) routing_source legacy->engine
#         ACPT-02 WebSearch is hat-scoped    (Plan 01) external-tool hat boundary
#         ACPT-03 first material auto-explore (Plan 02) room non-empty by turn 2
#         ACPT-04 filing cascade surfaces     (Plan 02) cross-relationship mid-session
#         ACPT-05 BRAIN.md derive tier rise   (Plan 03) tier_mode rises above tier_0
#         ACPT-06 dial atomic emission        (Phase 150.5-03) the leg that would
#                 have caught the dead-sensor spine and the split render: a real
#                 sensor fires from the PRODUCTION turn shape and dial text +
#                 card contract emit atomically on the engine arm; legacy emits
#                 neither.
#       The ACPT-05 LIVE mode_a arm self-skips honestly when Brain is unreachable;
#       its hermetic mode_b arm carries the CI gate either way (the live arm is
#       the operator's in-room proof, named not faked).
#
#   (b) the upstream gates re-run for FULL-surface certification (so 146
#       certifies the whole connector surface, not a sample):
#         run-all-144.sh   engine flip + real-fired-sensor (143.3 Tier A + 144 criticals)
#         run-all-1441.sh  registry complete + exhaustive 114-surface coverage + Part-8 boundary
#         run-all-145.sh   cadence + Phase-140 hardening
#
# Exit 0 = every constituent (6 ACPT + 3 upstream gates) is green = the milestone
# ships as "Larry Reaches". Non-zero = the milestone is renamed (per the ROADMAP
# Phase 146 mandate). The gate needs NO live Brain / live web / live Vercel to be
# CI-green; the hermetic legs carry the gate.
#
# Mirrors tests/run-all-144.sh: a bash PASS/FAIL loop that runs each constituent
# to completion (no crash) even when any fails; it prints a per-suite PASS/FAIL
# line and exits non-zero if any constituent failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/).
# SHELL_SUITES entries are sibling run-all-*.sh aggregators re-run as shell suites
# (mirrors the way run-all-1441.sh composes other aggregators).
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

# (a) The 6 ACPT dogfood drivers (each drives a REAL shipped unit).
CJS_SUITES=(
  test-acpt-01-engine-fires.cjs
  test-acpt-02-websearch-hat-scoped.cjs
  test-acpt-03-first-material-explore.cjs
  test-acpt-04-filing-cascade-surfaces.cjs
  test-acpt-05-brain-derive-tier-rise.cjs
  test-acpt-06-dial-atomic-emission.cjs
)

# (b) The upstream aggregators re-run for full-surface certification.
SHELL_SUITES=(
  run-all-144.sh
  run-all-1441.sh
  run-all-145.sh
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 146 loop-fires acceptance gate"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The 6 ACPT dogfood drivers.
# ---------------------------------------------------------------------------
echo "--- Group (a): the 6 ACPT dogfood drivers ---"
echo ""
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (b) The upstream gates re-run for full-surface certification.
# ---------------------------------------------------------------------------
echo "--- Group (b): upstream gates re-run (full-surface certification) ---"
echo ""
for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$s (missing)"); echo ">>> $s: MISSING"; echo ""; continue
  fi
  if bash "$p"; then
    ((PASSED++)); echo ">>> $s: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$s"); echo ">>> $s: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (146 loop-fires gate)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (see header for plan ownership):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  echo "  Non-zero exit: the milestone is renamed (a loop-fires constituent failed)."
  exit 1
fi

echo "========================================"
echo "  Exit 0: the milestone ships as \"Larry Reaches\"."
exit 0
