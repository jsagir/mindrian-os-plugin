#!/usr/bin/env bash
# Phase 118 scoped runner -- run before each 118 task commit. Per
# .planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
# this runner is co-owned across the 7 plans (118-00..118-06) and grows
# additively as each plan lands. Append your plan's CJS_SUITES entries below.
#
# Convention: entries are resolved relative to this directory (tests/); an
# entry may be "../lib/..." to reach a suite that lives under lib/.
#
# This runner MUST run to completion (no crash) even when RED suites fail; it
# prints a per-suite PASS/FAIL line. Exits non-zero if any suite failed.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  # Plan 118-00 (UserPromptSubmit detection)
  ../lib/core/mva-classifier.test.cjs
  ../lib/core/mva-detect.smoke.test.cjs
  # Plan 118-01 (dispatch architecture)
  ../lib/core/mva-agent-contract.test.cjs
  ../lib/core/mva-budget.test.cjs
  ../lib/core/mva-dispatcher.test.cjs
  # Plan 118-02 (six MVA agents -- aggregate test runner for all 6)
  ../lib/agents/mva/test-all-six-agents.cjs
  # Plan 118-03 (progressive streaming + orchestrator + telemetry)
  ../lib/core/mva-progressive-renderer.test.cjs
  ../lib/core/mva-telemetry.test.cjs
  ../lib/core/mva-orchestrator.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 118 scoped test runner"
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
echo "  Summary (118 scoped)"
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
