#!/usr/bin/env bash
# Phase 131 scoped runner -- run before each 131 task commit and as the phase
# release gate. Mirrors the tests/run-all-130.sh shape (CJS_SUITES array,
# per-suite PASS/FAIL line) with ONE deliberate difference: an absent suite is a
# SKIP-WITH-NOTE, not a failure. This is the SINGLE owner of the phase aggregator.
#
# Plan 131-01 PRE-REGISTERS the FULL Phase 131 CJS_SUITES list below so the
# same-wave parallel plans (02 / 03) and the later plans (04 / 05) only CREATE
# their suite files -- they never edit this aggregator. That keeps the plans
# file-disjoint. Because a not-yet-created suite is skipped gracefully, this
# runner is runnable in EVERY wave: in Wave 1 only test-131-substrate.cjs is
# present (and must pass); the other 5 skip-with-note. Exit is non-zero ONLY on a
# PRESENT-suite failure.
#
#   test-131-substrate.cjs          -> 131-01 (this plan: CONTRADICTS + SUPERSEDES
#                                      edge enum additive + research_filed /
#                                      research_rejected / research_deferred events
#                                      + evidence-claim.cjs writeEvidenceClaim
#                                      locked Phase 136 schema + research-preflight.cjs
#                                      getResearchPreflight batched 8-input read +
#                                      navigation.cjs re-exports)
#   test-131-context-extractor.cjs  -> 131-02 (Stage 1 pre-flight context extractor)
#   test-131-source-lens-driver.cjs -> 131-03 (Stage 3-4 source-lens driver)
#   test-131-findings-wirer.cjs     -> 131-04 (Stage 7 typed-edge wirer + F.1 selector)
#   test-131-isomorphism.cjs        -> 131-04/05 (check-research-isomorphism CI guard)
#   test-131-e2e.cjs                -> 131-05 (the 5 E2E tests, the phase release gate)
#
# CJS_SUITES entries resolve relative to this directory (tests/). Run per suite
# with node. bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  test-131-substrate.cjs
  test-131-context-extractor.cjs
  test-131-source-lens-driver.cjs
  test-131-findings-wirer.cjs
  test-131-isomorphism.cjs
  test-131-e2e.cjs
)

TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 131 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((SKIPPED++)); echo ">>> $s: SKIP (not yet created in this wave)"; echo ""; continue
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
    ((SKIPPED++)); echo ">>> $c: SKIP (not yet created in this wave)"; echo ""; continue
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
echo "  Summary (131 scoped)"
echo "========================================"
echo "  Total:   $TOTAL"
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Skipped: $SKIPPED (suite file absent -- created by a later plan)"
echo "  Time:    ${ELAPSED}s"

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
