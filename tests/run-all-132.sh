#!/usr/bin/env bash
# Phase 132 scoped runner -- run before each 132 task commit and as the phase
# release gate. Mirrors the tests/run-all-130.sh shape (CJS_SUITES array,
# per-suite PASS/FAIL line, exit non-zero on any fail).
#
# Wave 1 (this plan, 132-01) ships the shared machinery + its fixture tests:
#   curation-batch.test.cjs           -> 132-01 Task 1 (the reusable
#                                        curation-batch runner: created_by
#                                        stamping, rollback pairing required,
#                                        dry-run creds-free + ungated, the
#                                        write-time 130.7-contract guard, the
#                                        Part 8 no-user-content scan)
#   hypergraph-event-schema.test.cjs  -> 132-01 Task 2 (the frozen 5-event-type
#                                        schema contract + the additive reify
#                                        Cypher builder + EVENT_INSTANCE_MIN)
#
# Plans 02-05 APPEND their suites to CJS_SUITES later (hypergraph reify,
# cross-label dedup, content wire-it, pseudonymize). This Wave-1 plan writes
# NOTHING to the Brain; every suite here is a pure-Node fixture test.
#
# CJS_SUITES entries resolve relative to the repo lib/memory/ directory. bash
# only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
)
CJS_SUITES=(
  lib/memory/curation-batch.test.cjs
  lib/memory/hypergraph-event-schema.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 132 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$REPO_ROOT/$s"
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
  p="$REPO_ROOT/$c"
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
echo "  Summary (132 scoped)"
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
