#!/usr/bin/env bash
# Phase 121.5 scoped runner -- run before each 121.5 task commit. Each plan
# appends its own suites. Current coverage:
#   ../lib/memory/sessionstart-coordinator.test.cjs  -> Plan 121.5-00 (SessionStart Coordinator; D-13..D-16)
#   ../lib/memory/palette-consistency.test.cjs       -> Plan 121.5-03 Task 1 (canonical palette.json)
#   ../lib/memory/statusline-two-row.test.cjs        -> Plan 121.5-03 Task 2 (two-row renderer)
#   ../lib/memory/terminal-capability.test.cjs       -> Plan 121.5-07 Task 1 (capability probe + help_jtbd sweep)
#   ../lib/memory/help-renderer.test.cjs             -> Plan 121.5-07 Task 2 (help-groups.json + renderer)
#   ../lib/memory/help-coverage.test.cjs             -> Plan 121.5-07 Task 2 (check-help-coverage CI guard)
#   test-help-renderer-bulletproof.cjs               -> Plan 121.5-07 Task 2 (3 torture tests)
#   ../lib/memory/soft-alias.test.cjs                -> Plan 121.5-08 Task 1 (soft-alias-runner + 5 stub bodies + /mos:mos + diagnostics rename)
#   ../lib/memory/state-aware-router.test.cjs        -> Plan 121.5-08 Task 1 (state-aware-router pure function)
#   ../lib/memory/doctor-deprecation-surface.test.cjs -> Plan 121.5-08 Task 2 (doctor class I --deprecated-usage + F.1 selector wiring)
#   test-coherence-smoke.cjs                         -> Plan 121.5-09 Task 1 (coherence smoke harness; Sub-plan H acceptance)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# Bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  ../lib/memory/sessionstart-coordinator.test.cjs
  ../lib/memory/palette-consistency.test.cjs
  ../lib/memory/statusline-two-row.test.cjs
  ../lib/memory/terminal-capability.test.cjs
  ../lib/memory/help-renderer.test.cjs
  ../lib/memory/help-coverage.test.cjs
  test-help-renderer-bulletproof.cjs
  ../lib/memory/soft-alias.test.cjs
  ../lib/memory/state-aware-router.test.cjs
  ../lib/memory/doctor-deprecation-surface.test.cjs
  test-coherence-smoke.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 121.5 scoped test runner"
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
echo "  Summary (121.5 scoped)"
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
