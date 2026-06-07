#!/usr/bin/env bash
# Phase 144 scoped runner -- the Navigation Engine legacy->engine FLIP
# acceptance aggregator. Mirrors tests/run-all-143.sh exactly so the Phase 146
# loop-fires gate (ACPT-01) can compose these suites without rework.
#
# Flip discipline: Phase 144 makes the legacy->engine flip POSSIBLE (Plan 01
# wired dispatchSensors into decide(); Plan 02 repaired the router fixture) and
# this harness PROVES it -- a POPULATED-room turn driven by a REAL fired sensor
# produces routing_source: engine, while a COLD room honestly stays legacy. The
# three fences guard the surface unchanged. Per-suite plan ownership:
#   test-nav01-populated-room-engine-fires.cjs -> Plan 03 NAV-01 acceptance (POSITIVE: real fired SENS-06 sensor, no stub -> decide() canonical fire_skill -> routeActivation source engine; NEGATIVE: cold room -> legacy; GUARD: stub env unset)
#   test-decide-sensor-fire.cjs                -> Plan 01 (decide() consumes dispatchSensors -> non-null canonical-verb fire_skill on a fired reach; tier_0 fires; wicked tie-break; Part-8 rationale; Zep trace.context_assembly + latency telemetry)
#   test-sensors-routing-fence.cjs             -> Phase 144 fence (no routing_source='engine' assignment + no decide() rewrite inside lib/core/sensors/)
#   test-decide-part8-invariant.cjs            -> Part-8 invariant (decide()/sensor trace carries no packet/brain-client require, no projection token, no hashing call site) + positive chokepoint anchor
#   ../lib/memory/skill-activation-router.test.cjs -> Plan 02 fixture repair (Tests 1-18: the closed-vocabulary router unit tests + the integration Tests 16/17 engine-vs-legacy flip through the EXISTING router + Test 18 NAV-01 cold-room honest negative)
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
  test-nav01-populated-room-engine-fires.cjs
  test-decide-sensor-fire.cjs
  test-sensors-routing-fence.cjs
  test-decide-part8-invariant.cjs
  ../lib/memory/skill-activation-router.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 144 scoped test runner"
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
echo "  Summary (144 scoped)"
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
