#!/usr/bin/env bash
# Phase 95.6 scoped runner -- run before each 95.6 task commit. Expect RED on the
# suites whose owning plan has not landed yet (see 95.6-VALIDATION.md):
#   GREEN at Wave 0:  test-skills-have-skill-md.cjs (after 95.6-02 Task 1)
#                     test-92-rename-no-long-leaves.cjs (PASS if 95.6-01 ran, else SKIP -> exit 0)
#   RED-by-design until their owning plan lands:
#     test-install-sh-skill-loop.sh        -> GREEN when 95.6-03 lands
#     test-install-preflight-longpath.sh   -> GREEN when 95.6-04 lands
#     test-doctor-class-h.cjs              -> GREEN when 95.6-05 lands
#     test-doctor-class-h-fix.cjs          -> GREEN when 95.6-05 lands
#     test-install-receipt.cjs             -> GREEN when 95.6-05 lands
#     test-release-npm-gate.sh             -> GREEN when 95.6-06 lands
#
# This runner MUST run to completion (no crash) even when RED suites fail; it
# prints a per-suite PASS/FAIL line for each of the 8. It exits non-zero if any
# suite failed -- which is EXPECTED at Wave 0 time.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
  test-install-sh-skill-loop.sh
  test-install-preflight-longpath.sh
  test-release-npm-gate.sh
)
CJS_SUITES=(
  test-skills-have-skill-md.cjs
  test-doctor-class-h.cjs
  test-doctor-class-h-fix.cjs
  test-install-receipt.cjs
  test-92-rename-no-long-leaves.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 95.6 scoped test runner"
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
echo "  Summary (95.6 scoped)"
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
