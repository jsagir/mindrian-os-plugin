#!/usr/bin/env bash
# Phase 122 scoped runner -- run before each 122 task commit. Expect RED on the
# suites whose owning plan has not landed yet (see 122-VALIDATION.md):
#   GREEN once their owning plan lands:
#     test-command-registry.cjs                          -> real suite, 122-02 (landed)
#     ../lib/memory/chain-recommender.test.cjs            -> 122-03 (landed)
#     ../lib/memory/navigation-hook-resolver.test.cjs     -> 122-04 (landed)
#     ../lib/memory/suggest-next-workflow.test.cjs        -> 122-04 (landed)
#   suites appended by downstream plans (not present until their plan lands):
#     test-workflow-layer-e2e.cjs       (or ../lib/memory/workflow-layer-e2e.test.cjs)       -> 122-05
#   Note: command-resolver.test.cjs (122-03, landed) runs via the Feynman runner
#   (lib/memory/run-feynman-tests.cjs TEST_FILES[]) -- it does not need a second
#   registration here; chain-recommender.test.cjs is listed here too because the
#   plan asks for it in CJS_SUITES.
#
# This runner MUST run to completion (no crash) even when RED suites fail; it
# prints a per-suite PASS/FAIL line. It exits non-zero if any suite failed --
# which is EXPECTED while the downstream plans are still in flight.
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
  test-command-registry.cjs
  ../lib/memory/chain-recommender.test.cjs
  ../lib/memory/navigation-hook-resolver.test.cjs
  ../lib/memory/suggest-next-workflow.test.cjs
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
