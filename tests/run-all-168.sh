#!/usr/bin/env bash
# Phase 168 verification aggregator -- the single PASS/FAIL phase gate for the
# Part 4 edge-vocabulary reconciliation (CONVERGES / INVALIDATES / ENABLES brought
# into the Part 9 frozen edge set to match the already-blessed Canon Part 4 prose).
# Runs every registered tests/test-*.cjs suite to completion, prints a per-suite
# PASS/FAIL line + a final tally, exits 1 if any failed, asserts the three
# reconciled edges are present in edges.cjs, and appends an em-dash sweep over the
# phase artifacts proving the CLAUDE.md no-em-dash HARD RULE holds.
#
# Wave 1 (the only wave) registers the cascade floor test
# (test-edges-part4-cascade-floor.cjs -- the three-edge code-to-canon
# reconciliation, D-168).
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-163.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-168 suites. Wave 1 registers the frozen-set floor test (the
# reconciliation FLOOR + the writeEdge round-trip + the made-up-type negative).
CJS_SUITES=(
  test-edges-part4-cascade-floor.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 168 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-168 suite. A missing file gates to a FAIL line (never
# a crash). Wave 1's floor test is the frozen-set landmine guard: a regression
# that drops a prior edge type or un-freezes the Set turns the gate RED
# (threat T-168-01).
# ---------------------------------------------------------------------------
for c in "${CJS_SUITES[@]}"; do
  ((TOTAL++))
  p="$SCRIPT_DIR/$c"
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING (FAIL)"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# Frozen-edge-set assertion (threat T-168-01). The three reconciled cascade
# edges MUST be present in lib/core/navigation/edges.cjs. This is the bash floor
# that backs the floor test -- a regression that drops one of the three turns the
# gate RED. The Part 4 prose for the three must ALSO already list them (this is a
# reconciliation, not a prose mint); a missing prose mention would mean the
# reconciliation framing is wrong.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-edge-set assertion (CONVERGES / INVALIDATES / ENABLES) ---"
FROZEN_OK=1
EDGES_FILE="$REPO_ROOT/lib/core/navigation/edges.cjs"
CANON_FILE="$REPO_ROOT/docs/MINDRIAN-CANON.md"
CASCADE_EDGES=(CONVERGES INVALIDATES ENABLES)
if [[ ! -f "$EDGES_FILE" ]]; then
  echo "    MISSING edges.cjs"; FROZEN_OK=0
else
  for e in "${CASCADE_EDGES[@]}"; do
    if ! grep -qE "^  '$e'," "$EDGES_FILE"; then
      echo "    cascade edge missing from ALLOWED_EDGE_TYPES: $e"; FROZEN_OK=0
    fi
  done
fi
if [[ ! -f "$CANON_FILE" ]]; then
  echo "    MISSING MINDRIAN-CANON.md"; FROZEN_OK=0
else
  # The Part 4 cascade-edge sentence must already list all three (reconciliation,
  # not a prose mint). The canonical sentence reads
  # "INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES".
  if ! grep -q "INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES" "$CANON_FILE"; then
    echo "    Part 4 prose does NOT already list the three (reconciliation framing broken)"; FROZEN_OK=0
  fi
fi
if [[ $FROZEN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> frozen-edge-set assertion: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("frozen-edge-set assertion"); echo ">>> frozen-edge-set assertion: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is
# matched via its codepoint escape (U+2014) so this runner itself carries no
# literal em-dash to trip its own sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 168 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/navigation/edges.cjs"
  "tests/test-edges-part4-cascade-floor.cjs"
  "tests/run-all-168.sh"
  "docs/MINDRIAN-CANON.md"
  "docs/CANON-PHASE-MAP.md"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ -f "$f" ]] && grep -q "$EMDASH" "$f"; then
    echo "    FORBIDDEN em-dash in: $t"; EMDASH_OK=0
  fi
done
if [[ $EMDASH_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> em-dash sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("em-dash sweep"); echo ">>> em-dash sweep: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (168 verification)"
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
