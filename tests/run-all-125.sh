#!/usr/bin/env bash
# Phase 125 F-Selector Ranker scoped runner -- run before each 125 task commit.
# Expect GREEN once all 8 plans land (Wave 0 = scaffolded stubs; Wave 1+ = live):
#   navigation-write-edge.test.cjs          -> Plan 125-00 (writeEdge primitive)
#   navigation-projections.test.cjs         -> Plan 125-01 (projection helpers)
#   brain-cypher-chain-slice.test.cjs       -> Plan 125-02 (Brain Cypher slice)
#   packet-chain-hint.test.cjs              -> Plan 125-03 (packet builder ext)
#   packet-schema-validation.test.cjs       -> Plan 125-04 (schema superset)
#   f-selector-ranker.test.cjs              -> Plan 125-05 (the ranker core; Plan 125-07 appends 5 D8 tests)
#   selector-decisions.test.cjs             -> Plan 125-06 (D7 decisions + decay)
#   selector-miss.test.cjs                  -> Plan 125-07 (D8 miss capture)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# Bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  ../lib/memory/navigation-write-edge.test.cjs
  ../lib/memory/navigation-projections.test.cjs
  ../lib/memory/brain-cypher-chain-slice.test.cjs
  ../lib/memory/packet-chain-hint.test.cjs
  ../lib/memory/packet-schema-validation.test.cjs
  ../lib/memory/f-selector-ranker.test.cjs
  ../lib/memory/selector-decisions.test.cjs
  ../lib/memory/selector-miss.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 125 scoped test runner"
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
echo "  Summary (125 scoped)"
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
