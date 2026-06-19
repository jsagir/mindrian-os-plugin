#!/usr/bin/env bash
# Phase 164 verification aggregator -- the single PASS/FAIL phase gate for the
# BONO Research/Debate Engine. Runs every registered tests/test-*.cjs suite to
# completion, prints a per-suite PASS/FAIL line + a final tally, exits 1 if any
# failed, and appends an em-dash sweep over the phase artifacts proving the
# CLAUDE.md no-em-dash HARD RULE holds.
#
# Wave 1 (Plan 01) registers the SyntheticExpert node-type floor test
# (test-synthetic-expert-nodetype-floor.cjs -- the E1 frozen-taxonomy amendment,
# D-164-S1). Later waves (the writeSyntheticExpertNode chokepoint, the issue-tree
# surface, the debate orchestrator, the Part 8 leak scan) append their suites to
# CJS_SUITES.
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

# Phase-164 suites in wave order. Wave 1 registers the frozen-taxonomy floor
# test; later waves append (the writeSyntheticExpertNode chokepoint test, the
# issue-tree tests, the debate-engine surface tests, the Part 8 leak scan).
CJS_SUITES=(
  test-synthetic-expert-nodetype-floor.cjs
  test-synthetic-expert-writer.cjs
  test-expert-library-assembly.cjs
  test-issue-tree-engine.cjs
  test-issue-tree-edge-remap.cjs
  test-bono-cell-fanout.cjs
  test-bono-cell-selfcritique.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 164 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-164 suite. A missing file gates to a FAIL line (never
# a crash). Wave 1's floor test is the frozen-set landmine guard: a regression
# that drops a prior truth-claim type, un-freezes the Set, or removes the
# SyntheticExpert human-confirm gate turns the gate RED (threat T-164-01 /
# T-164-02).
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
# Schema-guard assertion (Wave 1). The aliases.yml SyntheticExpert node entry
# must keep the Phase-108 schema-alias drift guard green (the pre-commit
# contract). Gates RED if the guard rejects the file.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: schema-alias guard (aliases.yml SyntheticExpert entry) ---"
if node "$REPO_ROOT/scripts/check-schema-aliases.cjs" --file \
     "$REPO_ROOT/.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml" >/dev/null 2>&1; then
  ((PASSED++)); echo ">>> schema-alias guard: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("schema-alias guard"); echo ">>> schema-alias guard: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Frozen-set assertion (Wave 1; threat T-164-01). SyntheticExpert MUST be a
# member of TRUTH_CLAIM_TYPES in lib/core/navigation/transitions.cjs and edges.cjs
# MUST remain untouched by this phase (E2 was already done by Phase 168). This is
# the bash floor backing the node-type amendment.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-set assertion (SyntheticExpert membership) ---"
FROZEN_OK=1
TRANSITIONS_FILE="$REPO_ROOT/lib/core/navigation/transitions.cjs"
if [[ ! -f "$TRANSITIONS_FILE" ]]; then
  echo "    MISSING transitions.cjs"; FROZEN_OK=0
else
  grep -qE "'SyntheticExpert'" "$TRANSITIONS_FILE" || { echo "    SyntheticExpert missing from TRUTH_CLAIM_TYPES"; FROZEN_OK=0; }
  # The full prior truth-claim FLOOR must still be present (additive, never-delete).
  for t in claim CausalClaim assumption decision opportunity; do
    grep -qE "'$t'" "$TRANSITIONS_FILE" || { echo "    prior truth-claim member missing: $t"; FROZEN_OK=0; }
  done
fi
if [[ $FROZEN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> frozen-set assertion: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("frozen-set assertion"); echo ">>> frozen-set assertion: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Connector --check assertion (Wave 3; D-164-S4, threat T-164-11). The issue-tree
# sub_mode rides the EXISTING diagnose context_block reach (one reach, two modes);
# build-connector-registry.cjs --check must stay clean (no 7th reach minted, no
# duplicate tuple), and commands/diagnose.md must carry the issue-tree sub_mode +
# ignite's [SENS-01, SENS-06] pair. Mirrors the run-all-163 connector-block idiom.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector --check + diagnose issue-tree sub_mode ---"
CONN_OK=1
if ! node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check >/dev/null 2>&1; then
  echo "    connector-registry --check failed (7th reach or duplicate tuple)"; CONN_OK=0
fi
DIAGNOSE_CMD="$REPO_ROOT/commands/diagnose.md"
if [[ ! -f "$DIAGNOSE_CMD" ]]; then
  echo "    MISSING commands/diagnose.md"; CONN_OK=0
else
  grep -q "issue-tree" "$DIAGNOSE_CMD" || { echo "    issue-tree sub_mode missing from diagnose.md"; CONN_OK=0; }
  grep -q "SENS-01" "$DIAGNOSE_CMD" || { echo "    SENS-01 (ignite sensor pair) missing from diagnose.md"; CONN_OK=0; }
  grep -q "context_block" "$DIAGNOSE_CMD" || { echo "    context_block reach_id missing from diagnose.md"; CONN_OK=0; }
fi
if [[ $CONN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> connector --check + diagnose issue-tree sub_mode: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector --check + diagnose issue-tree sub_mode"); echo ">>> connector --check + diagnose issue-tree sub_mode: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is
# matched via its codepoint escape (U+2014) so this runner itself carries no
# literal em-dash to trip its own sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 164 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/navigation/transitions.cjs"
  "lib/core/navigation/synthetic-expert.cjs"
  "lib/core/expert-library.cjs"
  "tests/test-synthetic-expert-nodetype-floor.cjs"
  "tests/test-synthetic-expert-writer.cjs"
  "tests/test-expert-library-assembly.cjs"
  "lib/core/issue-tree.cjs"
  "tests/test-issue-tree-engine.cjs"
  "tests/test-issue-tree-edge-remap.cjs"
  "lib/core/bono/cell-fanout.cjs"
  "tests/test-bono-cell-fanout.cjs"
  "tests/test-bono-cell-selfcritique.cjs"
  "agents/persona-analyst.md"
  "commands/diagnose.md"
  "tests/run-all-164.sh"
  ".planning/phases/108-graph-memory-schema-reconciliation/aliases.yml"
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
echo "  Summary (164 verification)"
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
