#!/usr/bin/env bash
# Phase 185 scoped runner -- DRIFT Runtime Reachability (DRIFT-01) acceptance
# aggregator. The single PASS/FAIL gate for the runtime-reachability assertion
# added to doctor --drift: a WIRED capability unreachable by decide() at runtime
# trips the gate (RED), a fully-reachable set passes (GREEN), the existing Class
# P/Q merge-time marking is preserved, Part 8 (no network), no em-dashes.
#
# Runs to completion even when a suite fails; prints per-suite PASS/FAIL; exits
# non-zero if any suite failed.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  test-drift-runtime-reachability-185.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 185 scoped test runner (DRIFT runtime-reachability)"
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
echo "  Summary (185 scoped)"
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
