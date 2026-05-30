#!/usr/bin/env bash
# Phase 129.5 scoped runner -- run before each 129.5 task commit and as the phase
# release gate. Mirrors the tests/run-all-129.sh shape (CJS_SUITES array,
# per-suite PASS/FAIL line, exit non-zero on any fail).
#
# The 2 phase-129.5 suites (Truth-Machine Activation):
#   test-129.5-confirm-node.cjs    -> 129.5-02 (confirmNode chokepoint + human-attribution guard + resolveByUser USER.md identity resolver)
#   test-129.5-truth-machine.cjs   -> 129.5-03 (instrumented acceptance: a human APPROVE at the Decision Gate promotes a proposed truth-claim node to confirmed via the selector dispatcher calling confirmNode with USER.md byUser; agent confirm REJECTED; status_promoted memory_event emitted; audit nodes exempt; confirmedFacts returns the confirmed node)
#
# CJS_SUITES entries resolve relative to this directory (tests/). Run per suite
# with node. bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-129.5-confirm-node.cjs
  test-129.5-truth-machine.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 129.5 scoped test runner"
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
echo "  Summary (129.5 scoped)"
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
