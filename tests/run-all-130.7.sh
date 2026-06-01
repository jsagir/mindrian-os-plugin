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
#   lib/memory/chain-recommender-canonical.test.cjs -> 130.7-02 Task 1
#     (recommendCanonicalTargets: one canonical tuple per query, no cross-label
#     fork, correlation_id agreement, back-compat, degrade-on-no-index).
#   lib/memory/local-chain-recommender.test.cjs -> 130.7-02 Task 2
#     (bin/local-chain-recommender aggregates by correlation_id, canonical
#     agreement with the Brain side, Tier-LOCAL/Brain-down, navigation
#     chokepoint, Tier-0 empty-on-absent-room.db).
#   lib/memory/spine-events-correlation.test.cjs -> 130.7-02 Task 3
#     (memory_event references carry correlation_id additively; EVENT_TYPES
#     set-equality / zero net-new types; dedupe TTL intact; Part 8 hash scalar).
#   lib/memory/dual-graph-health.test.cjs       -> 130.7-03 Task 1 + Task 3
#     (the report-only/baseline fail-closed CI gate: records a baseline, fails on
#     regression not pre-existing debt, fails-closed on inconclusive, M3 recommender
#     no-fork, post-132 flip stubbed; PLUS the Part 8 phase-wide forbidden-pattern
#     boundary sweep over all 8 130.7 code paths).
#   lib/memory/brain-derive-curation.test.cjs   -> 130.7-03 Task 2
#     (the three /mos:brain-derive curation surfaces: --review-anchors / --orphan-census
#     / --cross-label-dups; standalone argv + 3 output shapes + brain-offline degrade
#     + Part 8 read-only methodology-only).
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
  lib/memory/chain-recommender-canonical.test.cjs
  lib/memory/local-chain-recommender.test.cjs
  lib/memory/spine-events-correlation.test.cjs
  lib/memory/dual-graph-health.test.cjs
  lib/memory/brain-derive-curation.test.cjs
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
