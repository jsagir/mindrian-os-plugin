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
