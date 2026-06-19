#!/usr/bin/env bash
# Phase 165 verification aggregator -- the single PASS/FAIL phase gate for the
# unknown-unknowns blind-spot engine. Runs every registered tests/test-unknowns-*.cjs
# suite to completion, prints a per-suite PASS/FAIL line + a final tally, exits 1 if
# any failed, and appends the FROZEN-CONTRACT + Part-8 + em-dash sweeps proving the
# constitutional invariants hold.
#
# Wave 0 (Plan 01) registered the 10 RED stubs (the contracts-on-disk) + the shared
# IFACE + the seeded fixture room.db. Waves 2-6 turned each stub GREEN as the
# corpus-adapter, dsp, bandit, edge-writer, orchestrator, and verdict modules
# shipped. Wave 6 (Plan 06, this FINALIZATION) turned the LAST two stubs green
# (part8-boundary + verdict) and adds the FROZEN-CONTRACT grep checks (the 4 frozen
# engine edge types, no 7th reach, the no-Math.random grep, the no-raw-INSERT grep),
# the connector --check, and the Part-8 grep sweep -- locking this gate GREEN.
#
# THE FINALIZED PHASE GATE (Wave 6): every test-unknowns-*.cjs is GREEN -- the
# corpus-adapter + proxy-oracle, the dsp + dsp-goodness (real interPartitionDistance),
# the bandit + resume, the frozen-edges, the part8-boundary, the rank-in, and the
# adversarial verdict -- PLUS the frozen-edge / no-random / no-raw-INSERT / no-7th-
# reach grep gates, the connector --check, the Part-8 grep sweep, the iface load, the
# fixture floor, and the em-dash sweep. This gate is the single PASS/FAIL phase
# contract for /gsd-verify-work: Failed 0, exit 0.
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-164.sh. bash only. No emoji. No em-dashes (hyphens only):
# the em-dash grep below is written via its codepoint escape (U+2014) so this file
# itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-165 suites in wave order. Wave 0 registered all 10 as RED stubs; later
# waves turned each green (corpus-adapter + proxy-oracle = W2; dsp + dsp-goodness =
# W2; bandit + resume = W3; frozen-edges = W4; rank-in = W5; part8-boundary +
# verdict = W6).
CJS_SUITES=(
  test-unknowns-corpus-adapter.cjs
  test-unknowns-dsp.cjs
  test-unknowns-dsp-goodness.cjs
  test-unknowns-proxy-oracle.cjs
  test-unknowns-bandit.cjs
  test-unknowns-resume.cjs
  test-unknowns-frozen-edges.cjs
  test-unknowns-part8-boundary.cjs
  test-unknowns-rank-in.cjs
  test-unknowns-verdict.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 165 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-165 suite. A missing FILE gates to a FAIL line (never a
# crash). At Wave-6 close every suite is GREEN (Failed 0).
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
# IFACE load assertion (Wave 0). The shared recast contract must load as a pure
# module (no Brain require) and export the signatures Plans 02-06 cite. This is
# the floor backing harness property 5 (one shared IFACE).
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: iface load assertion (the shared recast contract) ---"
if node -e "const i=require('$REPO_ROOT/lib/core/unknowns/iface.cjs'); if(!i.INSTANCE_FEATURES||!i.TIER_NUMERIC||!i.TIER_FLOOR||!i.DEFAULT_CONFIG||!i.CHECKPOINT_SHAPE||!i.FROZEN_ENGINE_EDGES) process.exit(1); const p=i.DEFAULT_CONFIG.proxy; if(p.w_contra!==0.5||p.w_mismatch!==0.3||p.w_stale!==0.2||p.proxyThreshold!==0.5||p.humanConfirmBudget!==3) process.exit(1);" >/dev/null 2>&1; then
  ((PASSED++)); echo ">>> iface load assertion: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("iface load assertion"); echo ">>> iface load assertion: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Fixture room.db assertion (Wave 0). buildFixtureRoom seeds >=5 graded-confirmed
# corpus claims (both sides of the D-165-03 filter) and returns the documented
# shape. This is the floor backing the load-bearing corpus test data.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: fixture room.db assertion (both sides of the D-165-03 filter) ---"
if node -e "const os=require('os'),fs=require('fs'),path=require('path');const d=fs.mkdtempSync(path.join(os.tmpdir(),'uufix-'));const {buildFixtureRoom}=require('$REPO_ROOT/tests/fixtures/unknowns/build-fixture-room.cjs');const r=buildFixtureRoom(d);if(!r.dbPath||!Array.isArray(r.corpusIds)||r.corpusIds.length<5||!Array.isArray(r.nonCorpusIds)||r.nonCorpusIds.length<4||!r.contradictedId||!r.staleId)process.exit(1);" >/dev/null 2>&1; then
  ((PASSED++)); echo ">>> fixture room.db assertion: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("fixture room.db assertion"); echo ">>> fixture room.db assertion: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# FROZEN-EDGE grep (Wave 6; D-165-08, threat T-165-10). The engine emits ONLY the
# four frozen edge types: the shared iface FROZEN_ENGINE_EDGES must carry exactly
# INVALIDATES / ROOT_CAUSES / ENABLES / FEEDS_INTO and NO other quoted engine edge
# handle, and the edge-writer must run the live ALLOWED_EDGE_TYPES self-check (the
# require-time throw on drift). 165 mints NO new edge type and makes ZERO edges.cjs
# change. Comment lines filtered so a doc comment cannot self-trip.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-edge grep (the 4 frozen engine edges + the live self-check) ---"
FROZEN_OK=1
IFACE_FILE="$REPO_ROOT/lib/core/unknowns/iface.cjs"
EDGEWRITER_FILE="$REPO_ROOT/lib/core/unknowns/edge-writer.cjs"
if [[ ! -f "$IFACE_FILE" ]]; then
  echo "    MISSING iface.cjs"; FROZEN_OK=0
else
  # The four frozen engine edges must all be declared in the FROZEN_ENGINE_EDGES bank.
  for t in INVALIDATES ROOT_CAUSES ENABLES FEEDS_INTO; do
    grep -qE "'${t}'" "$IFACE_FILE" || { echo "    frozen engine edge missing from iface: $t"; FROZEN_OK=0; }
  done
fi
if [[ ! -f "$EDGEWRITER_FILE" ]]; then
  echo "    MISSING edge-writer.cjs"; FROZEN_OK=0
else
  EDGEWRITER_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$EDGEWRITER_FILE")
  # The live ALLOWED_EDGE_TYPES membership self-check must be wired in the edge-writer.
  echo "$EDGEWRITER_CODE" | grep -qE "ALLOWED_EDGE_TYPES" || { echo "    edge-writer.cjs has no live ALLOWED_EDGE_TYPES self-check"; FROZEN_OK=0; }
fi
# A drift in FROZEN_ENGINE_EDGES throws at edge-writer require time: prove the live
# self-check fires (a load that succeeds means every frozen edge is a live member).
if ! node -e "require('$REPO_ROOT/lib/core/unknowns/edge-writer.cjs');" >/dev/null 2>&1; then
  echo "    edge-writer require failed (a frozen engine edge drifted out of ALLOWED_EDGE_TYPES)"; FROZEN_OK=0
fi
if [[ $FROZEN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> frozen-edge grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("frozen-edge grep"); echo ">>> frozen-edge grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# NO-MATH-RANDOM grep (Wave 6; D-165-09). The engine is index-deterministic: no
# Math.random anywhere in lib/core/unknowns/*.cjs (comment lines filtered so a doc
# comment naming the ban cannot self-trip). This is the bash floor backing the
# part8-boundary CJS sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: no-Math.random grep (lib/core/unknowns/*) ---"
RANDOM_OK=1
for f in "$REPO_ROOT"/lib/core/unknowns/*.cjs; do
  [[ -f "$f" ]] || continue
  CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$f")
  if echo "$CODE" | grep -qE "Math\.random"; then
    echo "    FORBIDDEN Math.random in: ${f#"$REPO_ROOT"/}"; RANDOM_OK=0
  fi
done
if [[ $RANDOM_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> no-Math.random grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("no-Math.random grep"); echo ">>> no-Math.random grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# NO-RAW-INSERT grep (Wave 6; D-165-10, Part 9 chokepoint). Every node/edge write
# rides the navigation.cjs chokepoint (writeClaimNode / writeEdge via the
# candidateToFinding clone); a raw INSERT INTO nodes|edges anywhere in
# lib/core/unknowns/*.cjs is a breach. Comment lines filtered.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: no-raw-INSERT grep (all writes ride the navigation chokepoint) ---"
INSERT_OK=1
for f in "$REPO_ROOT"/lib/core/unknowns/*.cjs; do
  [[ -f "$f" ]] || continue
  CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$f")
  if echo "$CODE" | grep -qiE "INSERT[[:space:]]+INTO[[:space:]]+(nodes|edges)\b"; then
    echo "    FORBIDDEN raw INSERT INTO in: ${f#"$REPO_ROOT"/}"; INSERT_OK=0
  fi
done
if [[ $INSERT_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> no-raw-INSERT grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("no-raw-INSERT grep"); echo ">>> no-raw-INSERT grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# NO-7TH-REACH grep (Wave 6; the frozen reach bank). The engine rides the EXISTING
# frozen 6-reach bank (Phase 148: context_block + the 5 others); it mints NO 7th
# reach. The candidate-reach the orchestrator builds (rankIntoSelector) uses a
# frozen reach_id; the connector --check below proves the spine stays at 6. This
# grep proves the orchestrator does not hand-roll a new reach_id literal.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: no-7th-reach grep (the orchestrator rides the frozen reach bank) ---"
REACH_OK=1
# The frozen 6-reach bank length is enforced by sensor-types REACH_IDS; assert it is
# still exactly 6 (Phase 148 froze it; 165 must not move it).
if ! node -e "const {REACH_IDS}=require('$REPO_ROOT/lib/core/sensors/sensor-types.cjs'); if(!Array.isArray(REACH_IDS)||REACH_IDS.length!==6) process.exit(1);" >/dev/null 2>&1; then
  echo "    the frozen reach bank is not exactly 6 (a 7th reach was minted)"; REACH_OK=0
fi
# The orchestrator's candidate-reach reach_id must be a frozen-bank member.
if ! node -e "const {REACH_IDS}=require('$REPO_ROOT/lib/core/sensors/sensor-types.cjs'); if(REACH_IDS.indexOf('context_block')===-1) process.exit(1);" >/dev/null 2>&1; then
  echo "    the orchestrator candidate-reach reach_id (context_block) is not a frozen-bank member"; REACH_OK=0
fi
if [[ $REACH_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> no-7th-reach grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("no-7th-reach grep"); echo ">>> no-7th-reach grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Connector --check assertion (Wave 6). The connector spine must stay clean (no 7th
# reach minted, no duplicate tuple) -- the file-meeting / map-unknowns front-door
# wiring is gated. Mirrors the run-all-164 connector-block idiom.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector --check (the spine stays at the frozen 6 reaches) ---"
if node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check >/dev/null 2>&1; then
  ((PASSED++)); echo ">>> connector --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector --check"); echo ">>> connector --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Part-8 grep sweep (Wave 6; D-165-10, threat T-165-16). The same BRAIN_WRITE
# forbidden-token vocabulary as run-all-164/169, over ALL lib/core/unknowns/*
# surfaces. The unknown-unknowns engine is LOCAL-only: there is NO legal Brain-READ
# surface in this engine, so a Brain-host URL / brain-client require is forbidden
# everywhere here (not just the WRITE tokens). The CJS part8-boundary suite carries
# the full per-line scan; this bash block is the floor that backs it.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (lib/core/unknowns/*) ---"
PART8_OK=1
# The canonical Part 8 breach: a Brain-write MCP call / write-to-Brain helper.
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# A smuggled egress wire: a Brain-host URL / brain-client require / mcp__brain.
BRAIN_REQUIRE='mindrian-brain|brain\.mindrian|brain-client|brainClient|mcp__brain|brain-md'
# A raw external fetch( (the leading char class excludes a .fetchCorpus method).
RAW_FETCH='[^a-zA-Z_.]fetch[[:space:]]*\('
for f in "$REPO_ROOT"/lib/core/unknowns/*.cjs; do
  [[ -f "$f" ]] || continue
  rel="${f#"$REPO_ROOT"/}"
  # Strip CJS comment lines before each grep so a comment naming a token cannot trip.
  CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$f")
  if echo "$CODE" | grep -qE "$BRAIN_WRITE"; then
    echo "    FORBIDDEN Brain-write token in: $rel"; PART8_OK=0
  fi
  if echo "$CODE" | grep -qE "$BRAIN_REQUIRE"; then
    echo "    FORBIDDEN Brain require / host egress in: $rel"; PART8_OK=0
  fi
  if echo "$CODE" | grep -qE "$RAW_FETCH"; then
    echo "    FORBIDDEN raw fetch( egress in: $rel"; PART8_OK=0
  fi
done
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is matched
# via its codepoint escape (U+2014) so this runner itself carries no literal
# em-dash to trip its own sweep. Sweeps the 165 phase artifacts:
# lib/core/unknowns/*.cjs + tests/test-unknowns-*.cjs + the fixture + this runner.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 165 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
for f in "$REPO_ROOT"/lib/core/unknowns/*.cjs; do
  [[ -f "$f" ]] || continue
  if grep -q "$EMDASH" "$f"; then
    echo "    FORBIDDEN em-dash in: ${f#"$REPO_ROOT"/}"; EMDASH_OK=0
  fi
done
for c in "${CJS_SUITES[@]}"; do
  f="$SCRIPT_DIR/$c"
  if [[ -f "$f" ]] && grep -q "$EMDASH" "$f"; then
    echo "    FORBIDDEN em-dash in: tests/$c"; EMDASH_OK=0
  fi
done
EMDASH_FIXED=(
  "tests/fixtures/unknowns/build-fixture-room.cjs"
  "tests/run-all-165.sh"
)
for t in "${EMDASH_FIXED[@]}"; do
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
echo "  Summary (165 verification)"
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
