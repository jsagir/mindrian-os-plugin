#!/usr/bin/env bash
# Phase 104.1 scoped runner -- run before each 104.1 task commit. Expect RED
# on the per-command-teaching suite until Plan 02 lands the 86 teaching
# strings; the per-command-jtbd-derivation suite is GREEN immediately after
# Plan 01 Task 1 lands.
#
# Suites covered (resolved relative to tests/):
#   ../lib/memory/per-command-teaching.test.cjs        -> Plan 01 Task 2
#       RED today (1/4 fails by design); 4/4 GREEN after Plan 02 content sweep.
#   ../lib/memory/per-command-jtbd-derivation.test.cjs -> Plan 01 Task 3
#       4/4 GREEN immediately after Plan 01 Task 1 (build derivation logic).
#
# This runner MUST run to completion (no crash) even when RED suites fail;
# it prints a per-suite PASS/FAIL line. It exits non-zero if any suite
# failed -- which is EXPECTED while Plan 02 is in flight.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  ../lib/memory/per-command-teaching.test.cjs
  ../lib/memory/per-command-jtbd-derivation.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 104.1 scoped test runner"
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
  if node --test "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (104.1 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (RED-by-design until Plan 02 lands -- see header):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
