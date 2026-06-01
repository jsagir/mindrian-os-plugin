#!/usr/bin/env bash
# Phase 130.7 scoped runner -- run before each 130.7 task commit and as the
# phase release gate. Mirrors the tests/run-all-130.sh shape (per-suite
# PASS/FAIL line, exit non-zero on any fail). Structured so Plan 02 + Plan 03
# append their suites to MEMORY_SUITES / CJS_SUITES later.
#
# The phase-130.7 suites (Correlation-ID Contract + Dual-Graph CI Gates):
#   lib/memory/correlation.test.cjs             -> 130.7-01 Task 1 (the
#     name-based, embedding-INDEPENDENT computeCorrelationId hashing chokepoint:
#     determinism + embedding-independence arity assert + label-sensitivity +
#     trim normalization + 28-name collision fixture + golden version pin).
#   lib/memory/correlation-label-index.test.cjs -> 130.7-01 Task 2 (the LOCAL
#     correlation_labels index producer/parser: serialize/parse round-trip incl.
#     a cross-label-duplicate name with per-label degree; empty/malformed body
#     returns {} without throwing; stable section key).
#
# MEMORY_SUITES entries resolve relative to REPO_ROOT (the module sites under
# lib/memory/). CJS_SUITES entries resolve relative to this directory (tests/),
# reserved for Plan 02 + Plan 03 integration suites. bash only. No emoji. No
# em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Module-site suites (resolve from REPO_ROOT).
MEMORY_SUITES=(
  lib/memory/correlation.test.cjs
  lib/memory/correlation-label-index.test.cjs
)

# tests/-dir CJS suites (reserved for Plan 02 + Plan 03 integration tests).
CJS_SUITES=(
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 130.7 scoped test runner"
echo "========================================"
echo ""

for s in "${MEMORY_SUITES[@]}"; do
  p="$REPO_ROOT/$s"
  ((TOTAL++))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$s (missing)"); echo ">>> $s: MISSING"; echo ""; continue
  fi
  if node "$p"; then
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
echo "  Summary (130.7 scoped)"
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
