#!/usr/bin/env bash
# run-all.sh -- Test runner for MindrianOS meeting intelligence tests
# Executes all test-*.sh scripts and reports results

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  MindrianOS Meeting Intelligence Tests"
echo "========================================"
echo ""

# Find and run all test scripts
for test_script in "$SCRIPT_DIR"/test-*.sh; do
  if [[ ! -f "$test_script" ]]; then
    continue
  fi

  test_name=$(basename "$test_script" .sh)
  ((TOTAL++))

  echo "--- Running: $test_name ---"

  if bash "$test_script"; then
    ((PASSED++))
    echo ">>> $test_name: PASSED"
  else
    ((FAILED++))
    FAILED_TESTS+=("$test_name")
    echo ">>> $test_name: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
