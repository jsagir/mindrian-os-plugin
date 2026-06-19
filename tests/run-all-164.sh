#!/usr/bin/env bash
# Phase 164 verification aggregator -- the single PASS/FAIL phase gate for the
# BONO Research/Debate Engine. Runs every registered tests/test-*.cjs suite to
# completion, prints a per-suite PASS/FAIL line + a final tally, exits 1 if any
# failed, and appends an em-dash sweep over the phase artifacts proving the
# CLAUDE.md no-em-dash HARD RULE holds.
#
# Wave 1 (Plan 01) registers the SyntheticExpert node-type floor test
# (test-synthetic-expert-nodetype-floor.cjs -- the E1 frozen-taxonomy amendment,
# D-164-S1). Waves 2-5 appended the writeSyntheticExpertNode chokepoint, the
# expert-library assembly, the issue-tree surface, the cell fan-out, and the
# debate orchestrator. Wave 6 (Plan 06, this FINALIZATION) registers the
# adversarial {passed, findings[]} verdict (test-bono-verdict.cjs) + the Part 8
# leak scan (test-bono-part8-leak.cjs) and adds the FROZEN-CONTRACT grep checks
# (the D-164-S2 parallel-not-runChain negative, the compose-on-169-substrate
# assertion, the frozen-vocabulary check, the v1.13 canon-version assertion) +
# the Part-8 grep sweep, locking this gate GREEN.
#
# THE FINALIZED PHASE GATE (Wave 6): every 164 suite is GREEN -- the node-type
# floor, the writer, the library assembly, the issue-tree engine + edge-remap,
# the cell fan-out + self-critique, the debate composition + incremental filing,
# the adversarial verdict, and the Part 8 leak scan -- PLUS the frozen-set
# assertion, the connector --check, the parallel-not-runChain negative grep, the
# compose-on-substrate grep, the frozen-vocabulary grep, the v1.13 canon-version
# assertion, the Part-8 grep sweep, and the em-dash sweep. This gate is the single
# PASS/FAIL phase contract for /gsd-verify-work: Failed 0, exit 0.
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
  test-bono-debate-composition.cjs
  test-bono-incremental-filing.cjs
  test-bono-verdict.cjs
  test-bono-part8-leak.cjs
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
# D-164-S2 PARALLEL-NOT-RUNCHAIN negative grep (Wave 6; threat T-164-27). The
# parallel cell fan-out must NOT ride the sequential chain executor: a
# chain-executor require / a runChain call in lib/core/bono/cell-fanout.cjs is a
# breach (the sequential loop is the Wave-5 debate, never the fan-out). Comment
# lines are filtered (grep -v) so a doc comment naming runChain cannot
# self-invalidate the count. Mirrors the Phase 166 B3 convergence-stop negative.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: D-164-S2 parallel-not-runChain negative grep (cell-fanout) ---"
FANOUT_OK=1
FANOUT_FILE="$REPO_ROOT/lib/core/bono/cell-fanout.cjs"
if [[ ! -f "$FANOUT_FILE" ]]; then
  echo "    MISSING cell-fanout.cjs"; FANOUT_OK=0
else
  # Strip CJS comment lines (leading // or * or /*) before the negative grep.
  FANOUT_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$FANOUT_FILE")
  if echo "$FANOUT_CODE" | grep -qE "require\([^)]*chain-executor"; then
    echo "    cell-fanout.cjs REQUIRES chain-executor (the parallel fan-out smuggled the sequential loop)"; FANOUT_OK=0
  fi
  if echo "$FANOUT_CODE" | grep -qE "\brunChain\b"; then
    echo "    cell-fanout.cjs calls runChain (the fan-out must be parallel, not a sequential chain)"; FANOUT_OK=0
  fi
  # Positive proof of the parallel mechanic.
  if ! echo "$FANOUT_CODE" | grep -qE "Promise\.all"; then
    echo "    cell-fanout.cjs has no Promise.all parallel dispatch (the parallel mechanic is absent)"; FANOUT_OK=0
  fi
fi
if [[ $FANOUT_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> D-164-S2 parallel-not-runChain negative grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("D-164-S2 parallel-not-runChain negative grep"); echo ">>> D-164-S2 parallel-not-runChain negative grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# COMPOSE-ON-169-SUBSTRATE grep (Wave 6; threat T-164-33). The debate composition
# must RIDE the 169-shipped substrate: it REQUIRES graph-derivation (runDerivation)
# AND findings-wirer (wireAccept) and makes NO direct navigation.writeEdge call (the
# derived edges ride runDerivation's frozen CASCADE_SUBSET; the ruling rides
# wireAccept/wireReject). Comment lines filtered so a comment naming writeEdge cannot
# self-invalidate. Mirrors the Phase 169 MEDIUM-4 sole-cascade-writer grep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: compose-on-169-substrate grep (debate-composition) ---"
COMPOSE_OK=1
COMPOSE_FILE="$REPO_ROOT/lib/core/bono/debate-composition.cjs"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "    MISSING debate-composition.cjs"; COMPOSE_OK=0
else
  COMPOSE_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$COMPOSE_FILE")
  echo "$COMPOSE_CODE" | grep -qE "require\([^)]*graph-derivation" || { echo "    debate-composition.cjs does NOT require graph-derivation (runDerivation)"; COMPOSE_OK=0; }
  echo "$COMPOSE_CODE" | grep -qE "require\([^)]*findings-wirer" || { echo "    debate-composition.cjs does NOT require findings-wirer (wireAccept)"; COMPOSE_OK=0; }
  echo "$COMPOSE_CODE" | grep -qE "\brunDerivation\b" || { echo "    debate-composition.cjs never references runDerivation"; COMPOSE_OK=0; }
  echo "$COMPOSE_CODE" | grep -qE "\bwireAccept\b" || { echo "    debate-composition.cjs never references wireAccept"; COMPOSE_OK=0; }
  # The negative: NO bare navigation.writeEdge( / writeEdge( call in the composition.
  if echo "$COMPOSE_CODE" | grep -qE "navigation\.writeEdge[[:space:]]*\("; then
    echo "    debate-composition.cjs calls navigation.writeEdge DIRECTLY (compose-on-substrate breach)"; COMPOSE_OK=0
  fi
  if echo "$COMPOSE_CODE" | grep -qE "[^.]writeEdge[[:space:]]*\("; then
    echo "    debate-composition.cjs calls writeEdge directly (the edges must ride runDerivation / wireAccept)"; COMPOSE_OK=0
  fi
fi
if [[ $COMPOSE_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> compose-on-169-substrate grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("compose-on-169-substrate grep"); echo ">>> compose-on-169-substrate grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# FROZEN-VOCABULARY grep (Wave 6; threat T-164-28; E2-remap). The issue-tree must
# emit ONLY frozen edge types: lib/core/issue-tree.cjs must carry NO pre-remap
# literal (INVALIDATED / RESOLVES_VIA / BELONGS_TO) as an EMITTED edge_type value
# (the remap to INVALIDATES / ROOT_CAUSES / ENABLES / PART_OF landed). Comment lines
# filtered so the remap-documenting comments do not self-trip.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-vocabulary grep (issue-tree edge remap landed) ---"
VOCAB_OK=1
ISSUE_TREE_FILE="$REPO_ROOT/lib/core/issue-tree.cjs"
if [[ ! -f "$ISSUE_TREE_FILE" ]]; then
  echo "    MISSING issue-tree.cjs"; VOCAB_OK=0
else
  ISSUE_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$ISSUE_TREE_FILE")
  # A quoted pre-remap edge-type literal in the (comment-stripped) code is a breach.
  for forbidden in INVALIDATED RESOLVES_VIA BELONGS_TO; do
    if echo "$ISSUE_CODE" | grep -qE "['\"]${forbidden}['\"]"; then
      echo "    pre-remap edge type emitted: $forbidden (the E2-remap did not land)"; VOCAB_OK=0
    fi
  done
  # The remap targets must be present (the remap actually happened).
  for target in PART_OF INFORMS INVALIDATES ROOT_CAUSES ENABLES; do
    echo "$ISSUE_CODE" | grep -qE "['\"]${target}['\"]" || { echo "    remap target missing: $target"; VOCAB_OK=0; }
  done
fi
if [[ $VOCAB_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> frozen-vocabulary grep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("frozen-vocabulary grep"); echo ">>> frozen-vocabulary grep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# CANON-VERSION assertion (Wave 6; threat T-164-34). The E1 amendment must have
# landed at the live target: docs/MINDRIAN-CANON.md header + footer are v1.13 and
# Appendix D entry 24 (SyntheticExpert) exists (stacked on Phase 169's v1.12 /
# entry 23). A stale version is a Part 6 self-CONTRADICTS.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: canon-version assertion (v1.13 + Appendix D entry 24) ---"
CANON_OK=1
CANON_FILE="$REPO_ROOT/docs/MINDRIAN-CANON.md"
if [[ ! -f "$CANON_FILE" ]]; then
  echo "    MISSING MINDRIAN-CANON.md"; CANON_OK=0
else
  grep -qE "^Version:[[:space:]]*1\.13[[:space:]]*$" "$CANON_FILE" || { echo "    CANON header Version is not 1.13"; CANON_OK=0; }
  grep -qE "Mindrian Canon v1\.13" "$CANON_FILE" || { echo "    CANON footer is not v1.13"; CANON_OK=0; }
  grep -qE "^24\.[[:space:]]+\*\*Node-type amendment: SyntheticExpert" "$CANON_FILE" || { echo "    Appendix D entry 24 (SyntheticExpert) is absent"; CANON_OK=0; }
  # Stacked on Phase 169 (entry 23 / NESTED_WITHIN preserved beneath it).
  grep -qE "^23\.[[:space:]]+\*\*Edge-vocabulary amendment: NESTED_WITHIN" "$CANON_FILE" || { echo "    prior Phase-169 entry 23 (NESTED_WITHIN) is gone (the stack broke)"; CANON_OK=0; }
fi
if [[ $CANON_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> canon-version assertion: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("canon-version assertion"); echo ">>> canon-version assertion: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Part-8 grep sweep (Wave 6; threat T-164-26). The same BRAIN_WRITE forbidden-token
# vocabulary as run-all-166/169, over ALL Phase-164 surfaces. The canonical breach
# is a Brain-WRITE (a code path that writes user bytes to the Brain); a documented
# generic-handle Brain READ is the Part-8-legal Mode A path, so the egress-wire +
# raw-fetch checks are scoped to the lib surfaces only (where an egress wire would
# live). The CJS verdict + the test-bono-part8-leak.cjs suite carry the full
# per-line scan; this bash block is the floor that backs it.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase 164 surfaces) ---"
PART8_OK=1
PART8_ALL=(
  "lib/core/bono/cell-fanout.cjs"
  "lib/core/bono/debate-composition.cjs"
  "lib/core/issue-tree.cjs"
  "lib/core/navigation/synthetic-expert.cjs"
  "lib/core/expert-library.cjs"
  "commands/bono.md"
  "commands/diagnose.md"
  "agents/persona-analyst.md"
)
PART8_LIB=(
  "lib/core/bono/cell-fanout.cjs"
  "lib/core/bono/debate-composition.cjs"
  "lib/core/issue-tree.cjs"
  "lib/core/navigation/synthetic-expert.cjs"
  "lib/core/expert-library.cjs"
)
# The canonical Part 8 breach: a Brain-write MCP call / write-to-Brain helper.
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# A smuggled egress wire (lib only): a Brain-host URL / brain-client require.
BRAIN_HOST='mindrian-brain\.onrender|brain\.mindrian|brain-client|brainClient'
# A raw external fetch( in lib code (the leading char class excludes .fetchCorpus).
RAW_FETCH='[^a-zA-Z_.]fetch[[:space:]]*\('
ANTHROPIC_EXEMPT='api\.anthropic\.com'
# The Brain-WRITE token check fires on EVERY surface.
for t in "${PART8_ALL[@]}"; do
  f="$REPO_ROOT/$t"
  [[ -f "$f" ]] || { echo "    MISSING surface: $t"; PART8_OK=0; continue; }
  if grep -nE "$BRAIN_WRITE" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*|#|<!--)' >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
done
# The egress-wire + raw-fetch checks fire on lib surfaces only.
for t in "${PART8_LIB[@]}"; do
  f="$REPO_ROOT/$t"
  [[ -f "$f" ]] || continue
  if grep -nE "$BRAIN_HOST" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-host egress wire in: $t"; PART8_OK=0
  fi
  if ! grep -qE "$ANTHROPIC_EXEMPT" "$f"; then
    if grep -nE "$RAW_FETCH" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
      echo "    FORBIDDEN raw fetch( egress in: $t"; PART8_OK=0
    fi
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
  "lib/core/bono/debate-composition.cjs"
  "tests/test-bono-debate-composition.cjs"
  "tests/test-bono-incremental-filing.cjs"
  "tests/test-bono-verdict.cjs"
  "tests/test-bono-part8-leak.cjs"
  "agents/persona-analyst.md"
  "commands/bono.md"
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
