#!/usr/bin/env bash
# Phase 122 scoped runner -- run before each 122 task commit. Expect RED on the
# suites whose owning plan has not landed yet (see 122-VALIDATION.md):
#   GREEN at Wave 0:  test-command-registry.cjs (stub: prints the Wave-0 line, exits 0)
#   RED-by-design until their owning plan lands -- the stub flips to a real
#   suite WITHOUT changing the registered path:
#     test-command-registry.cjs            -> real suite when 122-02 lands
#   suites appended by downstream plans (not present until their plan lands):
#     test-chain-recommender.cjs (or chain-recommender.test.cjs)   -> 122-03
#     test-navigation-hook-resolver.cjs                            -> 122-04
#     test-suggest-next-workflow.cjs                               -> 122-04
#     test-workflow-layer-e2e.cjs                                  -> 122-05
#
# This runner MUST run to completion (no crash) even when RED suites fail; it
# prints a per-suite PASS/FAIL line. It exits non-zero if any suite failed --
# which is EXPECTED while the downstream plans are still in flight.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-command-registry.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 122 scoped test runner"
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
echo "  Summary (122 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (RED-by-design until the owning plan lands -- see header):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
