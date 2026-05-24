#!/usr/bin/env bash
# Phase 127.3 test aggregator -- one-command verification surface for the
# whole jtbd-auto-anchor-fix phase. Mirrors tests/run-all-127.sh / run-all-125.sh.
# Exits 0 ONLY when all 3 suites pass.
#
# Suites covered (one row per test surface; their roles per 127.3-CONTEXT.md
# section "Plans" + 127.3-06-PLAN.md objective):
#
#   tests/test-resolve-active-room-canonical.cjs (Plan 00, CJS)
#     -> 12 hermetic scenarios on the lib/core/resolve-active-room.cjs
#        chokepoint (rar.1..rar.12; covers both legacy + current registry
#        shapes, env override, sealed/archived rejection, Canon Part 8 +
#        Part 9 source-grep tripwires).
#
#   tests/test-jtbd-auto-anchor-empirical.sh (Plan 06 Task 1, shell)
#     -> Empirical RCA reproduction; two-half protocol exercising the
#        Plan 01 chokepoint reroute (jtbd-state.json write) AND the
#        Phase 103-05 across-session promotion pipeline (in_flight +
#        ~/MindrianRooms/.memory/ bootstrap).
#
#   tests/test-127.3-sibling-sweep.sh (Plan 03, shell)
#     -> Structural tripwire across scripts/ + lib/: no script outside the
#        chokepoint + Phase-129-deferral allow-list reads the registry via
#        the broken pattern (reg.active_room || Array.isArray(reg.rooms)).
#
# Per PATTERNS.md the Feynman runner (lib/memory/run-feynman-tests.cjs) is
# CJS-only -- it runs the unit-test via spawnSync('node', [file]). Shell
# tests run here, via the aggregator.
#
# CRITICAL: set -uo pipefail (NOT -e) so an inner `if node "$p"` that exits
# non-zero does not terminate the script before subsequent suites can run.
# Bash's `if` construct already consumes the non-zero exit code, so -u
# (unset-vars guard) + -o pipefail (pipe-failure surface) is the safe set
# for an aggregator. Per the canonical run-all-127.sh shape.
#
# Bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
  test-jtbd-auto-anchor-empirical.sh
  test-127.3-sibling-sweep.sh
)
CJS_SUITES=(
  test-resolve-active-room-canonical.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 127.3 scoped test runner"
echo "========================================"
echo ""

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  TOTAL=$((TOTAL + 1))
  echo "--- Running: tests/$c ---"
  if [[ ! -f "$p" ]]; then
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$c (missing)")
    echo ">>> $c: MISSING"
    echo ""
    continue
  fi
  if node "$p"; then
    PASSED=$((PASSED + 1))
    echo ">>> $c: PASSED"
  else
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$c")
    echo ">>> $c: FAILED"
  fi
  echo ""
done

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  TOTAL=$((TOTAL + 1))
  echo "--- Running: tests/$s ---"
  if [[ ! -f "$p" ]]; then
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$s (missing)")
    echo ">>> $s: MISSING"
    echo ""
    continue
  fi
  if bash "$p"; then
    PASSED=$((PASSED + 1))
    echo ">>> $s: PASSED"
  else
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$s")
    echo ">>> $s: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (127.3 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"
echo "  ${PASSED}/${TOTAL} green"

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
