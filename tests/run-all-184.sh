#!/usr/bin/env bash
# Phase 184 scoped runner -- READER: the decide-time projection OFFER acceptance
# aggregator. The single PASS/FAIL gate for READER-01..04 + the four acceptance
# rules (R1 A/B harness + named debt, R2 projection-correctness gate, R3 ambient
# budget, R4 structural no-firing guard).
#
# Per-suite ownership:
#   test-reader-184.cjs             -> R1 (local A/B + named-debt uninstrumented),
#                                      R2 (gate rejects malformed / passes 249-node),
#                                      R3 (ambient latency + context-weight budget),
#                                      ranking determinism, decide() graceful degrade,
#                                      Part 8 no-network + no-em-dash sweep.
#   test-reader-r4-structural-184.cjs -> R4 (reader is a reader, never a firer --
#                                      require allow-list + firing-token sweep +
#                                      decide() has no firing path).
#
# Runs to completion even when a suite fails; prints per-suite PASS/FAIL; exits
# non-zero if any suite failed.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  test-reader-184.cjs
  test-reader-r4-structural-184.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 184 scoped test runner (READER)"
echo "========================================"
echo ""

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
echo "  Summary (184 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

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
