#!/usr/bin/env bash
# Phase 169 verification aggregator -- the single PASS/FAIL phase gate for the
# Graph-Derivation Harness. Wave 1 (this scaffold) mints the room-lineage edge
# NESTED_WITHIN into the Part 9 writeEdge chokepoint frozen set so the D-169-11
# fractal joint has a LEGAL, graph-navigable representation. Runs every registered
# tests/test-*.cjs suite to completion, prints a per-suite PASS/FAIL line + a final
# tally, exits 1 if any failed, asserts NESTED_WITHIN is present in edges.cjs, and
# appends an em-dash sweep over the phase artifacts proving the CLAUDE.md no-em-dash
# HARD RULE holds.
#
# Wave 1 registers the room-lineage floor test
# (test-edges-room-lineage-floor.cjs -- the NESTED_WITHIN frozen-set mint, D-169-11)
# alongside the carried Phase 168 cascade floor test
# (test-edges-part4-cascade-floor.cjs) so the gate proves the frozen prior
# vocabulary is untouched. Plan 01 finalizes this aggregator.
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-168.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-169 suites. Wave 1 registers the room-lineage frozen-set floor test (the
# NESTED_WITHIN mint FLOOR + the room->room writeEdge round-trip + the made-up-type
# negative) plus the carried Phase 168 cascade floor test (proves the frozen prior
# vocabulary is untouched).
CJS_SUITES=(
  test-edges-room-lineage-floor.cjs
  test-edges-part4-cascade-floor.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 169 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-169 suite. A missing file gates to a FAIL line (never
# a crash). Wave 1's floor test is the frozen-set landmine guard: a regression
# that drops a prior edge type or un-freezes the Set turns the gate RED
# (threat T-169-00-01).
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
# Frozen-edge-set assertion (threat T-169-00-01). The room-lineage edge
# NESTED_WITHIN MUST be present in lib/core/navigation/edges.cjs. This is the bash
# floor that backs the floor test -- a regression that drops it turns the gate RED.
# PART_OF MUST stay untouched as the domain-taxonomy edge (no room target widening).
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-edge-set assertion (NESTED_WITHIN minted; PART_OF untouched) ---"
FROZEN_OK=1
EDGES_FILE="$REPO_ROOT/lib/core/navigation/edges.cjs"
if [[ ! -f "$EDGES_FILE" ]]; then
  echo "    MISSING edges.cjs"; FROZEN_OK=0
else
  if ! grep -qE "^  'NESTED_WITHIN'," "$EDGES_FILE"; then
    echo "    room-lineage edge missing from ALLOWED_EDGE_TYPES: NESTED_WITHIN"; FROZEN_OK=0
  fi
  if ! grep -qE "^  'PART_OF'," "$EDGES_FILE"; then
    echo "    PART_OF must remain a member (domain-taxonomy edge untouched)"; FROZEN_OK=0
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
echo "--- Running: em-dash sweep (Phase 169 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/navigation/edges.cjs"
  "tests/test-edges-room-lineage-floor.cjs"
  "tests/run-all-169.sh"
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
echo "  Summary (169 verification)"
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
