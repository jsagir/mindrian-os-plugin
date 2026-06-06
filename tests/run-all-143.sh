#!/usr/bin/env bash
# Phase 143 scoped runner -- the insight-sensor (7-row trigger map) loop-fires
# aggregator. Mirrors tests/run-all-142.sh exactly so the Phase 146 loop-fires
# gate (ACPT-01..05) can compose these suites without rework.
#
# Loop-fires discipline: every Phase 143 sensor has exactly one named acceptance
# suite that asserts THE SENSOR FIRES on its signal (not merely that code
# exists). The two module-level gates (Phase 144 routing fence + Part-8 sweep)
# guard the sensor surface. Per-suite plan ownership:
#   test-sensor-spine-dispatch.cjs        -> Plan 01 spine (REACH_IDS/POSTURE_IDS/makeReach/dispatch chokepoint)
#   test-sens01-first-material-fires.cjs  -> SENS-01 (first-material -> context_block + brain_framework_chain companion; Part-8 no-leak)
#   test-sens06-artifact-filed-fires.cjs  -> SENS-06 (artifact-filed -> contradiction/cross_room over the shipped CASC-01 side-channel)
#   test-sensors-routing-fence.cjs        -> Phase 144 fence (no routing_source='engine'; no decide() rewrite in lib/core/sensors/)
#   test-sensors-part8-sweep.cjs          -> Part 8 5-tripwire (no packet/brain-client require, no projection token, no hashing call site)
#   test-sens02-lagging-component-fires.cjs -> SENS-02 (lagging-component -> context_block dispatching the shipped Phase 89 rs-engine/find-bottlenecks)
#   test-sens03-methodology-decision-fires.cjs -> SENS-03 (methodology-decision -> brain_consult + brain_framework_chain CHAINS_TO, generic handles only)
#   test-sens07-gate-approach-fires.cjs   -> SENS-07 (gate-approach -> the shipped Phase 120 breakthrough scan + agents/investor objection surface)
#   test-sens04-external-fact-fires.cjs   -> SENS-04 (external-fact -> hat-scoped WebSearch via hat-scoping-table; MCP-stack-ask Decision Gate, no silent WebSearch; Part-8 public SIGNAL only)
#   test-sens05-jtbd-reweight-fires.cjs   -> SENS-05 (JTBD set/changed -> selector-menu serves_jtbd + ADDRESSES_PROBLEM_TYPE Brain-query re-weight over the shipped Phase 104 jtbd-state)
#
# Plans 02 and 03 APPEND their detector suites (SENS-02/03/04/05/07) to
# CJS_SUITES below; the two module-level gates already span every new file under
# lib/core/sensors/.
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-sensor-spine-dispatch.cjs
  test-sens01-first-material-fires.cjs
  test-sens06-artifact-filed-fires.cjs
  test-sensors-routing-fence.cjs
  test-sensors-part8-sweep.cjs
  # Plan 02 (wave 2) detector suites -- SENS-02 / SENS-03 / SENS-07:
  test-sens02-lagging-component-fires.cjs
  test-sens03-methodology-decision-fires.cjs
  test-sens07-gate-approach-fires.cjs
  # Plan 03 (wave 3) detector suites -- SENS-04 / SENS-05 (the final two rows):
  test-sens04-external-fact-fires.cjs
  test-sens05-jtbd-reweight-fires.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 143 scoped test runner"
echo "========================================"
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
echo "  Summary (143 scoped)"
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
  exit 1
fi

echo "========================================"
exit 0
