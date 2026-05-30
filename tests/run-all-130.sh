#!/usr/bin/env bash
# Phase 130 scoped runner -- run before each 130 task commit and as the phase
# release gate. Mirrors the tests/run-all-129.sh shape (CJS_SUITES array,
# per-suite PASS/FAIL line, exit non-zero on any fail).
#
# The phase-130 suites (Lens-Engine Skeleton + Cognitive-Family Migration):
#   test-130-lens-substrate.cjs -> 130-01 (INFORMS + REJECTED_BECAUSE edge enum
#                                  + lens-nodes.cjs HatState / lens_finding node
#                                  chokepoint + navigation.cjs re-exports)
#   test-130-lens-engine.cjs    -> 130-02 (rotate() engine + 5-family registry +
#                                  serial/parallel/single modes + the 3 pure
#                                  synthesizers + the 5 lens memory_event types)
#   test-130-cognitive-migration.cjs -> 130-03 (hat-persistence room.db rewrite +
#                                  one-shot backfill + the 4 thin lens-engine
#                                  command clients + persona-ops loop delegation +
#                                  tension-map dedup)
#   test-130-lens-engine-e2e.cjs -> 130-04 (the phase release gate: 8 instrumented
#                                  E2E tests -- 6 cognitive-family serial/parallel/
#                                  single/consume + round-trip + backfill, and 2
#                                  engine-contract rejection-as-data + persona-aware
#                                  framing, all through navigation.cjs with the
#                                  fs-instrument zero-leak gate)
#
# CJS_SUITES entries resolve relative to this directory (tests/). Run per suite
# with node. bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-130-lens-substrate.cjs
  test-130-lens-engine.cjs
  test-130-cognitive-migration.cjs
  test-130-lens-engine-e2e.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 130 scoped test runner"
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
echo "  Summary (130 scoped)"
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
