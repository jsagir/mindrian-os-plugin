#!/usr/bin/env bash
# Phase 169 verification aggregator -- the single PASS/FAIL phase gate for the
# Graph-Derivation Harness. Wave 1 (169-00) minted the room-lineage edge
# NESTED_WITHIN into the Part 9 writeEdge chokepoint frozen set so the D-169-11
# fractal joint has a LEGAL, graph-navigable representation. Wave 2 (169-01, this
# finalization) lands the shared IFACE block + the thirteen RED test stubs + the
# fixtures, and registers every stub here so the gate EXECUTES them.
#
# Runs every registered tests/test-*.cjs suite to completion, prints a per-suite
# PASS/FAIL line + a final tally, exits 1 if any failed, asserts NESTED_WITHIN is
# present in edges.cjs, runs a Part-8 grep sweep over the 169 lib + script
# surfaces, and appends an em-dash sweep over the phase artifacts proving the
# CLAUDE.md no-em-dash HARD RULE holds.
#
# NOTE on RED-by-design (Wave 2): the thirteen 169 stubs require not-yet-built
# IFACE modules (room-root.cjs, doc-text-extractor.cjs, graph-candidate-producer.cjs,
# graph-derivation.cjs, graph-self-heal.cjs). They are SUPPOSED to FAIL here
# (Nyquist: every module ships with a test that preceded it). The gate EXECUTES
# them and reports them red; Waves 3-6 turn each GREEN. The two carried floor
# tests (room-lineage + Phase 168 cascade) stay GREEN and prove the frozen
# vocabulary is untouched.
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-167.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-169 suites. The two carried floor tests stay first so the frozen-vocabulary
# proof runs before the RED stubs. Wave 1 registered both floor tests; Wave 2
# appends the thirteen RED stubs (RED-by-require until Waves 3-6 build the IFACE
# modules).
CJS_SUITES=(
  test-edges-room-lineage-floor.cjs
  test-edges-part4-cascade-floor.cjs
  test-room-root-resolver.cjs
  test-doc-text-extractor.cjs
  test-subroom-rollup.cjs
  test-candidate-producer.cjs
  test-graph-derivation-loop.cjs
  test-derive-idempotence.cjs
  test-derive-backfill-acceptance.cjs
  test-169-brain-boundary.cjs
  test-sentinel-self-heal.cjs
  test-room-lineage-edge.cjs
  test-recursive-rollup.cjs
  test-depth2-full-citizen.cjs
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
# (threat T-169-00-01). The thirteen Wave-2 stubs are RED-by-require until their
# IFACE module ships (Nyquist).
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
# Part-8 grep sweep (VERIFY). The same BRAIN_WRITE + RAW_FETCH + external-http
# regexes as run-all-167.sh, over the Phase-169 lib + script surfaces. Zero
# user-content-to-Brain / raw-external-egress tokens may appear. The derivation +
# the LLM candidate producer + the heal read LOCAL text and write LOCAL edges;
# none open a raw fetch / Brain-write path (Part 8). A target absent at this wave
# is SKIPPED (the module ships in a later wave); the sweep fires once it exists,
# so the boundary is guarded the instant the surface lands.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase 169 surfaces) ---"
PART8_OK=1
PART8_LIB=(
  "lib/core/graph-derivation.cjs"
  "lib/core/graph-candidate-producer.cjs"
  "lib/core/graph-self-heal.cjs"
  "scripts/gsd-graph-derive-sweep.cjs"
)
# No Brain-write MCP call / brain-write helper (the canonical Part 8 breach).
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# No raw external HTTP egress in lib/script code. The leading char class excludes
# .fetchCorpus on a caller object.
RAW_FETCH='[^a-zA-Z_.]fetch[[:space:]]*\('
for t in "${PART8_LIB[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    (not yet built, skipping until it ships): $t"; continue
  fi
  if grep -nE "$BRAIN_WRITE" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
  # Filter comment lines so a doc comment that names fetch( as prose does not
  # self-invalidate the count (CJS comments lead with // or *).
  if grep -nE "$RAW_FETCH" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN raw fetch( egress in: $t"; PART8_OK=0
  fi
  if grep -nE "https?://" "$f" | grep -vE "github\.com" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN external http(s) endpoint in: $t"; PART8_OK=0
  fi
done
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
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
  "tests/test-edges-part4-cascade-floor.cjs"
  "tests/test-room-root-resolver.cjs"
  "tests/test-doc-text-extractor.cjs"
  "tests/test-subroom-rollup.cjs"
  "tests/test-candidate-producer.cjs"
  "tests/test-graph-derivation-loop.cjs"
  "tests/test-derive-idempotence.cjs"
  "tests/test-derive-backfill-acceptance.cjs"
  "tests/test-169-brain-boundary.cjs"
  "tests/test-sentinel-self-heal.cjs"
  "tests/test-room-lineage-edge.cjs"
  "tests/test-recursive-rollup.cjs"
  "tests/test-depth2-full-citizen.cjs"
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
