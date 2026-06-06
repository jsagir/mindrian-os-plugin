#!/usr/bin/env bash
# Phase 143.1 scoped runner -- the dial-TUI capability-selector (D3) aggregator.
# Mirrors tests/run-all-143.sh exactly so the standing fences (two-K, 0.70
# floor, Part-8 {framework} seam, navigation.cjs write-locality) are enforced in
# ONE gate over the full dial pipeline.
#
# The pipeline: buildReachList (Plan 01) -> composeLabel (Plan 02) ->
# dial-presenter render (Plan 04) -> closeReach commit (Plan 03) ->
# dial-memory render (Plan 05). The Plan 06 end-to-end suite drives all five of
# them through every UI-SPEC render state and re-asserts V9/V10/V11/V12.
#
# Per-suite plan ownership:
#   test-dial-reach-orchestrator.cjs        -> Plan 01 (buildReachList + DIAL_REACH_K=5 + frozen 0.70/0.15 gate; DIALTUI-01/02)
#   test-dial-label-bank-drift.cjs          -> Plan 02 (composeLabel bank: 5-id coverage, em-dash + banned-noun sweep, Part-8 egress fixtures; DIALTUI-04/05)
#   test-dial-close-reach.cjs               -> Plan 03 (closeReach 4-outcome transaction; SELECTED_REACH/PIVOTED edges + events; DIALTUI-06/07/08/09)
#   test-dial-render-states.cjs             -> Plan 04 (CLI presenter renderDial; S1-S5 render contract; DIALTUI-03/10)
#   test-dial-memory-renderer.cjs           -> Plan 05 (dial-memory renderer; sentinel-bounded MEMDIAL projection; MEMDIAL-02/03)
#   test-dial-graph-relationship-layer.cjs  -> Plan 05 (SELECTED_REACH/PIVOTED/DRSCH graph-queryable; MEMDIAL-01 + FILEVAL-01)
#   test-dial-end-to-end-states.cjs         -> Plan 06 (full-pipeline S1-S5 + closeReach round-trip + V9/V10/V11/V12 standing fences)
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
  test-dial-reach-orchestrator.cjs
  test-dial-label-bank-drift.cjs
  test-dial-close-reach.cjs
  test-dial-render-states.cjs
  test-dial-memory-renderer.cjs
  test-dial-graph-relationship-layer.cjs
  # Plan 06 (wave 3) end-to-end gate -- full pipeline + the four standing fences:
  test-dial-end-to-end-states.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 143.1 scoped test runner"
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
echo "  Summary (143.1 scoped)"
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
