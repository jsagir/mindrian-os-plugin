#!/usr/bin/env bash
# Phase 129 scoped runner -- run before each 129 task commit and as the phase
# release gate. Mirrors the tests/run-all-128.sh shape (CJS_SUITES array,
# per-suite PASS/FAIL line, exit non-zero on any fail).
#
# The 5 phase-129 suites (Spine Repair Memory-Event):
#   test-129-spine-substrate.cjs        -> 129-01 (5 net-new event types + FOLLOWS_FROM + 60s dedup + spine-events helper API)
#   test-129-read-surface-events.cjs    -> 129-02 (mos-status / memory / suggest-next emit spine_read + suggestion_surfaced)
#   test-129-state-transition-events.cjs-> 129-03 (jtbd / operator transitions emit jtbd_transitioned + operator_transitioned)
#   test-129-workflow-stage-events.cjs  -> 129-04 (act / pipeline emit workflow_stage entered + completed)
#   test-129-spine-acceptance.cjs       -> 129-05 (instrumented proactive-loop acceptance: zero non-SQLite reads + exact event count + backward arc)
#
# CJS_SUITES entries resolve relative to this directory (tests/). Run per suite
# with node. bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-129-spine-substrate.cjs
  test-129-read-surface-events.cjs
  test-129-state-transition-events.cjs
  test-129-workflow-stage-events.cjs
  test-129-spine-acceptance.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 129 scoped test runner"
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
echo "  Summary (129 scoped)"
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
