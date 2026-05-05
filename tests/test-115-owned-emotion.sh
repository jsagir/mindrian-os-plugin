#!/usr/bin/env bash
# tests/test-115-owned-emotion.sh
# Phase 115 orchestrator: runs 4 sub-tests in order, prints summary
# Quick run command per VALIDATION.md `## Test Infrastructure`

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

SUBTESTS=(
  "tests/test-115-validation-template.sh:AC-115-01"
  "tests/test-115-surfaces-grep.sh:AC-115-02"
  "tests/test-115-dual-path-integration.sh:AC-115-03"
  "tests/test-115-persona-variants.sh:AC-115-04"
)

PASS_COUNT=0
FAIL_COUNT=0
FAILED_TESTS=()

echo "==== Phase 115 -- Owned Emotion + Dual-Path First Touch Test Suite ===="
echo ""

for entry in "${SUBTESTS[@]}"; do
  script="${entry%%:*}"
  ac="${entry##*:}"

  echo "---- $ac : $script ----"

  if [ ! -f "$script" ]; then
    echo "FAIL: $script does not exist"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_TESTS+=("$ac ($script -- missing)")
    continue
  fi

  if bash "$script"; then
    echo "[$ac] PASSED"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[$ac] FAILED"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_TESTS+=("$ac ($script)")
  fi
  echo ""
done

echo "==== SUMMARY ===="
echo "Passed: $PASS_COUNT / 4"
echo "Failed: $FAIL_COUNT / 4"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi

echo ""
echo "Phase 115 verification: ALL 4 ACs PASS (AC-115-01 + AC-115-02 + AC-115-03 + AC-115-04)"
echo "Manual gates remaining: 5-tester async empathy audit (D-13 + D-15) + 3-tester live empathy audit (per tests/manual/115-acceptance.md)"
exit 0
