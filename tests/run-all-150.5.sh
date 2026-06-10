#!/usr/bin/env bash
# Phase 150.5 phase gate -- sensor-turn contract + atomic dial render.
# ONE green command (DIAL-ATOM-02 / DIAL-ATOM-03 closeout).
#
# What this PROVES (by instrumentation, not by promise -- Canon Part 6
# dog-fooding): the acceptance harness can never again stay green through a
# dead sensor spine or a split render. Two groups compose the gate:
#
#   (a) the 150.5 CJS suites + the carried D-03a fence:
#         test-150-5-sensor-firability.cjs   (Plan 01) trigger-chain gate 4:
#                 the production turn shape feeds the Plan-01 seam
#                 (normalizeTurn + deriveTurnSignals) so a real sensor can
#                 fire with NO hand-shaped signal bag.
#         test-150-5-render-atomicity.cjs    (Plan 02) trigger-chain gates
#                 7 + 11 + 12: dial text + card contract emit together on the
#                 engine arm (the dispatcher-trailer threading); the fault
#                 path writes dial_render_note; the tier-0 sensor-fired
#                 cold-card arm proves the D-01 hybrid.
#         test-acpt-06-dial-atomic-emission.cjs (Plan 03) the end-to-end ACPT
#                 leg: production turn -> seam-derived signal -> real sensor
#                 fire -> decide() -> routeActivation engine -> atomic
#                 text+contract emission; legacy honest-negative; Part-8
#                 sentinel sweep.
#         test-retrieval-seed.cjs            the carried D-03a Part-8 fence.
#
#   (b) the carried regression-floor shell aggregators:
#         run-all-144.sh   the engine-flip floor (listed explicitly per
#                 150.5-VALIDATION.md even though run-all-146.sh re-runs it;
#                 cheap, and the validation contract names it).
#         run-all-146.sh   the 6-leg loop-fires milestone gate (now carrying
#                 ACPT-06) + the carried 144/1441/145 upstream gates.
#         run-all-150.sh   the cortex-bridge phase gate, which carries the
#                 148 frozen-contract + reach/posture drift fences and the
#                 strengthened claim harness (claim-c2 contract-presence).
#
# Frozen surfaces this gate defends: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15
# recommend gate, the 6-reach bank, the 3 postures, zero Brain egress delta.
#
# This runner MUST run to completion (no crash) even when a suite fails; it
# prints a per-suite PASS/FAIL/MISSING line + a final tally. It exits non-zero
# if any suite failed OR is missing.
#
# CJS_SUITES entries are resolved relative to this directory (tests/).
# SHELL_SUITES entries are sibling shell aggregators run as shell suites.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

# (a) The 150.5 CJS suites + the carried D-03a fence.
CJS_SUITES=(
  test-150-5-sensor-firability.cjs
  test-150-5-render-atomicity.cjs
  test-acpt-06-dial-atomic-emission.cjs
  test-retrieval-seed.cjs
)

# (b) The carried regression-floor shell aggregators.
SHELL_SUITES=(
  run-all-144.sh
  run-all-146.sh
  run-all-150.sh
)

TOTAL=0
PASSED=0
FAILED=0
MISSING=0
FAILED_TESTS=()
MISSING_TESTS=()

echo "========================================"
echo "  Phase 150.5 phase gate"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The 150.5 CJS suites + the carried D-03a fence.
# ---------------------------------------------------------------------------
echo "--- Group (a): the 150.5 CJS suites + the D-03a fence ---"
echo ""
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$c"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (b) The carried regression-floor shell aggregators.
# ---------------------------------------------------------------------------
echo "--- Group (b): the carried regression-floor aggregators ---"
echo ""
for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((MISSING++)); MISSING_TESTS+=("$s"); echo ">>> $s: MISSING"; echo ""; continue
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
echo "  Summary (150.5 phase gate)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Missing: $MISSING"
echo "  Time:    ${ELAPSED}s"

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "  Missing:"
  for t in "${MISSING_TESTS[@]}"; do
    echo "    - $t"
  done
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

if [[ $MISSING -gt 0 ]]; then
  echo "========================================"
  exit 1
fi

echo "========================================"
echo "  Exit 0: the Phase 150.5 gate is green (the sensor-turn contract holds + dial emission is atomic + the frozen constitution held)."
exit 0
