#!/usr/bin/env bash
# Phase 121 scoped runner -- runs every Phase 121 plan's scaffold harness in
# sequence. Mirrors tests/run-all-124.sh shape. Subsequent plans (121-01,
# 121-02, 121-03, 121-04) append their own test-121-XX-scaffold.sh to this
# script as they land; Plan 121-00 wires only its own.
#
# bash only. No emoji. No em-dashes (per memory rule feedback_no_emdashes).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
  test-121-00-scaffold.sh
  test-121-01-scaffold.sh
  test-121-03-scaffold.sh
)
CJS_SUITES=(
  ../lib/core/telemetry/schema.test.cjs
  ../lib/core/telemetry/validator.test.cjs
  ../lib/core/telemetry/writer.test.cjs
  ../scripts/migrate-telemetry-v1.test.cjs
  test-121-03-empathy-observation.cjs
  test-121-03-room-receipt-emit.cjs
  test-121-03-command-invocation-hook.cjs
  test-121-03-drowning-protection.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 121 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  TOTAL=$((TOTAL + 1))
  echo "--- Running: $s ---"
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

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  TOTAL=$((TOTAL + 1))
  echo "--- Running: $c ---"
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

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (121 scoped)"
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
