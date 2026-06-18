#!/usr/bin/env bash
# Phase 166 verification aggregator -- the single PASS/FAIL phase gate for the
# gated-chain-executor. Wave 1 (FOUNDATION) registers the two pre-work-blocker
# foundation suites (B1 pipeline-state isNext hard gate + B4 recipe-maps
# three-map authority); later waves append their suites here.
#
# This runner MUST run to completion (no crash) even when any suite fails: a
# missing file gates to a FAIL line, never a crash (mirrors run-all-156.sh:55-67).
#
# Mirrors tests/run-all-156.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-166 CJS suites. Wave 1 (FOUNDATION) registers the two foundation suites;
# later waves (the runChain loop, capture/pass, gate) append below.
CJS_SUITES=(
  test-pipeline-state-isnext-gate.cjs
  test-recipe-maps-authority.cjs
  test-chain-executor-loop.cjs
  test-chain-executor-gate.cjs
  test-chain-retry-backoff.cjs
  test-chain-graceful-partial.cjs
  # Wave 4 MIGRATE act (the donor -> thinnest caller). Dependency order: the
  # pre-migration behavior CAPTURE runs FIRST (it writes/asserts the baseline
  # fixture the migration identity suite reads), then the migration + PRE===POST
  # identity suite. There is NO pre-existing act regression suite to register
  # (confirmed: tests/ carried none) -- the snapshot IS the regression net this
  # wave creates.
  test-act-prebehavior-snapshot.cjs
  test-act-on-runchain.cjs
  # Wave 5 MIGRATE pipeline (the consumer onto runChain). Dependency order: the
  # FIRST-ever pipeline-state.cjs shipped-behavior CAPTURE runs FIRST (it is the
  # regression net this wave creates -- pipeline-state.cjs shipped untested), then
  # the migration + provenanceFn + sole-truth-resume + PRE===POST identity suite.
  # There is NO pre-existing pipeline regression suite to register (confirmed:
  # tests/ carried none) -- the shipped-behavior capture IS the net.
  test-pipeline-state-shipped-behavior.cjs
  test-pipeline-on-runchain.cjs
  # Wave 6 MIGRATE ignite (the CONSUMER where the gate is ALWAYS material). The
  # ignite migration suite validates the runChain CONTRACT the doc commits to
  # (all-material halts + birthRoom ordering guard + promotion sequencing +
  # Defer/[stop] preserves the scratchpad). The three EXISTING birth-gate
  # regression suites are registered alongside it so the migration cannot drift
  # the shipped birth behavior unnoticed (the doc-content grep gate below proves
  # the DOC committed to runChain, since ignite.md is markdown with no runtime).
  test-ignite-on-runchain.cjs
  test-room-birth.cjs
  test-scratchpad-birth-answers.cjs
  test-memory-events-birth-floor.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 166 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every Phase-166 CJS suite. A missing file gates to a FAIL line (never a
# crash). Wave 1 covers the two pre-work blockers that MUST land before any
# runChain loop code exists (B1 + B4).
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
# Part-8 grep sweep over the Phase-166 lib surfaces present so far for forbidden
# user-content-to-Brain / raw-external-egress tokens. recipe-maps.cjs joins
# posture ONLY from the LOCAL command-registry and reads the projection as a
# Brain-DERIVED LOCAL cache; it must open NO Brain-write / raw-fetch path.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase-166 lib surfaces) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "lib/core/recipe-maps.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/chain-retry.cjs"
  "lib/mcp/pipeline-state.cjs"
)

# No Brain-write MCP call / brain-write helper (the canonical Part 8 breach).
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# No raw external HTTP egress (recipe-maps reads only local committed JSON maps).
RAW_FETCH='[^a-zA-Z_]fetch[[:space:]]*\('
for t in "${SWEEP_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  # Strip comment lines so a doc-comment naming a forbidden token cannot
  # self-invalidate the count (grep -v '^#'-style filtering for CJS comments).
  CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$f")
  if echo "$CODE" | grep -nE "$BRAIN_WRITE" >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
  if echo "$CODE" | grep -nE "$RAW_FETCH" >/dev/null 2>&1; then
    echo "    FORBIDDEN raw fetch( egress in: $t"; PART8_OK=0
  fi
  if echo "$CODE" | grep -nE "https?://" | grep -vE "github\.com" >/dev/null 2>&1; then
    echo "    FORBIDDEN external http(s) endpoint in: $t"; PART8_OK=0
  fi
  if echo "$CODE" | grep -nE "brain-client|brainClient|brain_client" >/dev/null 2>&1; then
    echo "    FORBIDDEN brain-client require in: $t"; PART8_OK=0
  fi
done

if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Wave 6 DOC-CONTENT GREP GATE (HIGH-2). commands/ignite.md is markdown with NO
# runtime, so the stubbed .cjs contract test alone can pass while the DOC still
# describes the OLD hand-rolled loop. The .cjs test validates the runChain
# contract; THIS gate proves the DOC actually committed to it. Two assertions:
#   (a) ignite.md NAMES the runtime -- both "chain-executor" AND "runChain" must
#       be present (fail if either is missing).
#   (b) the OLD hand-rolled sequential-loop language is removed/neutralized -- the
#       gate FAILS if surviving prose still describes ignite OWNING the B1->B2->B3
#       walk (the forbidden affirmative phrase co-locating "in sequence" with the
#       three birth gates). Comment lines are filtered (grep -v '^#'-style) so a
#       comment cannot self-invalidate the count; this is NOT a bare unfiltered
#       == 0 gate -- it scans the doc BODY for the specific forbidden phrasing.
# A doc still describing the old loop MUST fail RED here.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Wave-6 doc-content grep gate (ignite.md names runChain + old loop neutralized) ---"
IGNITE_DOC="$REPO_ROOT/commands/ignite.md"
DOC_OK=1
if [[ ! -f "$IGNITE_DOC" ]]; then
  echo "    MISSING doc: commands/ignite.md"; DOC_OK=0
else
  # (a) NAMES the runtime: both tokens must be present.
  if ! grep -q "chain-executor" "$IGNITE_DOC"; then
    echo "    ignite.md does NOT name chain-executor (the runtime the gates ride)"; DOC_OK=0
  fi
  if ! grep -q "runChain" "$IGNITE_DOC"; then
    echo "    ignite.md does NOT name runChain (the shared spine)"; DOC_OK=0
  fi
  # (b) old hand-rolled sequential-loop language removed/neutralized. Strip
  # markdown comment/HTML-comment lines first so a quoted comment cannot
  # self-invalidate the count, then scan the BODY for the FORBIDDEN affirmative
  # phrasing: prose that describes ignite OWNING the B1/B2/B3 walk "in sequence".
  # The negated form on line ~40 ("do NOT run under a hand-rolled in-sequence
  # loop") is intentionally NOT matched -- the gate targets the affirmative claim
  # that ignite orchestrates the three gates in sequence with its own loop.
  DOC_BODY=$(grep -vE '^[[:space:]]*(#|<!--)' "$IGNITE_DOC")
  if echo "$DOC_BODY" | grep -nE "orchestrates three birth gates \(B1, B2, B3\) in sequence" >/dev/null 2>&1; then
    echo "    FORBIDDEN old loop prose: ignite.md still says it orchestrates the three gates in sequence"; DOC_OK=0
  fi
  # Belt-and-suspenders: any surviving line that AFFIRMATIVELY co-locates "three
  # birth gates" + "in sequence" WITHOUT a neutralizing negation (not / NOT / do
  # not / belongs to runChain) is the old hand-rolled loop language and fails.
  OLD_LOOP=$(echo "$DOC_BODY" | grep -nE "three birth gates.*in sequence|in sequence.*three birth gates" | grep -viE "not |belongs to runChain|do NOT|does NOT")
  if [[ -n "$OLD_LOOP" ]]; then
    echo "    FORBIDDEN old loop prose (affirmative in-sequence walk) in ignite.md:"; echo "$OLD_LOOP"; DOC_OK=0
  fi
  # Confirm the load-bearing ordering-guard content string survived (re-anchored
  # on content, not a stale line number).
  if ! grep -q "B3 fires ONLY after birthRoom succeeds" "$IGNITE_DOC"; then
    echo "    MISSING ordering-guard content string 'B3 fires ONLY after birthRoom succeeds'"; DOC_OK=0
  fi
fi

if [[ $DOC_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Wave-6 doc-content grep gate: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Wave-6 doc-content grep gate"); echo ">>> Wave-6 doc-content grep gate: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is
# matched via its codepoint escape (U+2014) so this runner itself carries no
# literal em-dash to trip its own sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 166 lib files + test suites + runner) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/mcp/pipeline-state.cjs"
  "lib/core/recipe-maps.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/chain-retry.cjs"
  "tests/test-pipeline-state-isnext-gate.cjs"
  "tests/test-recipe-maps-authority.cjs"
  "tests/test-chain-executor-loop.cjs"
  "tests/test-chain-executor-gate.cjs"
  "tests/test-chain-retry-backoff.cjs"
  "tests/test-chain-graceful-partial.cjs"
  # Wave 4: the migrated donor + its command doc + the two new act suites.
  "scripts/act-command.cjs"
  "commands/act.md"
  "tests/test-act-prebehavior-snapshot.cjs"
  "tests/test-act-on-runchain.cjs"
  # Wave 5: the migrated pipeline consumer + its command doc + the two new suites.
  "commands/pipeline.md"
  "tests/test-pipeline-state-shipped-behavior.cjs"
  "tests/test-pipeline-on-runchain.cjs"
  # Wave 6: the migrated ignite doc + the new ignite-on-runchain suite.
  "commands/ignite.md"
  "tests/test-ignite-on-runchain.cjs"
  "tests/run-all-166.sh"
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
echo "  Summary (166 verification)"
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
