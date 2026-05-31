#!/usr/bin/env bash
# Phase 135 scoped runner -- run before each 135 task commit and as the phase
# release gate. Mirrors the tests/run-all-129.sh shape (CJS_SUITES array,
# per-suite PASS/FAIL line, set -uo pipefail, exit non-zero on any fail).
#
# The 4 phase-135 suites (Offer Resolver and Reliable Next-Move Closer):
#   lib/memory/navigation-engine-offer.test.cjs -> resolver + abstention unit
#       contract (SC1 / SC3 / SC6). RED targets until 135-02 fills the resolver.
#   lib/memory/offer-closer.test.cjs            -> F.1 closer wiring + edge
#       persistence (SC7) + reject->shouldExclude backoff persistence. RED
#       targets until 135-03 ships the closer.
#   tests/test-135-resolver-no-leak.cjs         -> fs-instrument zero-leak
#       (SC2 / SC9): zero non-SQLite reads on the resolver decide() path
#       (USER.md allow-listed).
#   tests/test-135-decide-wiring-e2e.cjs        -> END-TO-END production-wiring
#       guard (SC1 / SC4 / SC6): drives the REAL decide() path with a REAL temp
#       room.db on a DECISION_GATE turn; asserts offer_next_step is non-null with
#       a real [[section]] reason (never [[undefined]]) and a defined scope, plus
#       a JUST_TALK null negative control. This is the regression guard against
#       the entire dark-loop / [[undefined]]-reason failure mode.
#
# The two lib/memory suites are NOT in tests/, so they are invoked via a path
# relative to the repo root (REPO_ROOT). The tests/ suites resolve relative to
# SCRIPT_DIR. RED targets inside a suite do NOT fail the suite (the suites exit 0
# while their resolver/closer-dependent assertions stay RED until 135-02/03); a
# suite fails this runner only on a hard assertion failure. bash only. No emoji.
# No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)

# tests/ suites (resolved relative to SCRIPT_DIR).
CJS_SUITES=(
  test-135-resolver-no-leak.cjs
  test-135-decide-wiring-e2e.cjs
)

# lib/memory/ suites (resolved relative to REPO_ROOT -- not under tests/).
CJS_SUITES_REPO=(
  lib/memory/navigation-engine-offer.test.cjs
  lib/memory/offer-closer.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 135 scoped test runner"
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

for c in "${CJS_SUITES_REPO[@]}"; do
  p="$REPO_ROOT/$c"
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
echo "  Summary (135 scoped)"
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
