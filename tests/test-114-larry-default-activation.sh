#!/usr/bin/env bash
# tests/test-114-larry-default-activation.sh
# Phase 114 orchestrator: runs 4 sub-tests in order, prints summary
# Quick run command per VALIDATION.md `## Test Infrastructure`

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

SUBTESTS=(
  "tests/test-114-substrate-preload.sh:AC-114-01"
  "tests/test-114-turn-1-voice.sh:AC-114-02"
  "tests/test-114-mcp-alwaysload.sh:AC-114-03"
  "tests/test-114-commands-regression.sh:AC-114-04"
)

PASS_COUNT=0
FAIL_COUNT=0
FAILED_TESTS=()

echo "==== Phase 114 -- Larry-Default Activation Test Suite ===="
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
echo "==== ALL AC-114 CHECKS PASSED ===="
exit 0
