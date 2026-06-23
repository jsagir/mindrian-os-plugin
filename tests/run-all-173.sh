#!/usr/bin/env bash
# Phase 173 verification aggregator -- the single PASS/FAIL gate proving the
# publish/visualize JTBD need-selector end-to-end flow (R1-R7) is GREEN.
#
# Mirrors tests/run-all-172.sh: a bash PASS/FAIL loop that runs each constituent
# to completion and exits non-zero if any failed.
#
# It composes:
#   (a) the 173-01 data-contract suite:
#         test-publish-needs-map.cjs          -> the JTBD need->command map +
#                                                --check + the role_blend->lane mapper
#   (b) the 173-03 suites:
#         test-show-share-sensor.cjs           -> SENS-SHOW unit (frozen reach +
#                                                registry membership + Part-8 +
#                                                dispatch-resolution + fire/no-fire)
#         test-publish-needs-flow.cjs          -> the R1-R7 end-to-end proof
#   (c) the CARRIED frozen-bank drift fences (173 is ADDITIVE -- no frozen-set move):
#         test-reach-ids-drift.cjs             -> frozen 6 reach_ids (no 7th)
#         test-posture-ids-drift.cjs           -> frozen 3 postures (no 4th)
#         test-dispatch-framework-map-drift.cjs-> the WFL-01 map stays framework-only
#         test-sensors-part8-sweep.cjs         -> zero Brain egress across every sensor
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  test-publish-needs-map.cjs
  test-show-share-sensor.cjs
  test-publish-needs-flow.cjs
  test-reach-ids-drift.cjs
  test-posture-ids-drift.cjs
  test-dispatch-framework-map-drift.cjs
  test-sensors-part8-sweep.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 173 verification aggregator"
echo "========================================"
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

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (173 verification)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
