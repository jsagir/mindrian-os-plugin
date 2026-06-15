#!/usr/bin/env bash
# Phase 156 verification aggregator -- the single PASS/FAIL phase gate for the
# Futures Wheel (FW-01..FW-13). Runs every tests/test-futures-*.cjs to
# completion, prints a per-suite PASS/FAIL line + a final tally, exits 1 if any
# failed, and appends a Part-8 grep sweep over lib/core/futures/ + commands/
# futures.md proving zero user-content-to-Brain / raw-external-egress surface.
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-150.10.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# All 11 Phase-156 futures suites (Waves 1-4), in dependency order:
#   generator / causal-cue / frontmatter / edges / hsi-integration (Waves 1-2)
#   render / confirm / bank                                         (Wave 3)
#   chaining / signal / part8-leak                                  (Wave 4)
CJS_SUITES=(
  test-futures-generator.cjs
  test-futures-causal-cue.cjs
  test-futures-frontmatter.cjs
  test-futures-edges.cjs
  test-futures-hsi-integration.cjs
  test-futures-render.cjs
  test-futures-confirm.cjs
  test-futures-bank.cjs
  test-futures-chaining.cjs
  test-futures-signal.cjs
  test-futures-part8-leak.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 156 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every test-futures-*.cjs suite. A missing file gates to a FAIL line (never a
# crash). The Wave-2 HSI integration test is the count-match landmine guard, so
# a regression that reintroduces the silent zero-edge path turns the gate RED
# (threat T-156-01).
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
# Part-8 grep sweep over lib/core/futures/ + commands/futures.md for forbidden
# user-content-to-Brain / raw-external-egress tokens. The ONLY external call in
# the phase is the FW-13 SIGNAL fetch, which delegates to
# research-corpus.fetchCorpus (the single audited egress chokepoint); the
# futures code itself must open NO raw fetch / Brain-write path.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (lib/core/futures + commands/futures.md) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "lib/core/futures/orchestrator.cjs"
  "lib/core/futures/causal-cue.cjs"
  "lib/core/futures/subsystem-render.cjs"
  "commands/futures.md"
)

# No Brain-write MCP call / brain-write helper (the canonical Part 8 breach).
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# No raw external HTTP egress in the futures code (egress is delegated to the
# fetchCorpus chokepoint).
RAW_FETCH='[^a-zA-Z_]fetch[[:space:]]*\('
for t in "${SWEEP_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  if grep -nE "$BRAIN_WRITE" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
  if grep -nE "$RAW_FETCH" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN raw fetch( egress in: $t"; PART8_OK=0
  fi
  # No hardcoded external http(s) endpoint (a github.com comment URL is allowed).
  if grep -nE "https?://" "$f" | grep -vE "github\.com" >/dev/null 2>&1; then
    echo "    FORBIDDEN external http(s) endpoint in: $t"; PART8_OK=0
  fi
done

# FW-12 grep gate: zero hardcoded /mos: command strings in the handoff surfacer
# (every handoff resolves through command-resolver). Must be 0.
HARDCODED_CMD="['\"]/mos:(systems-thinking|scenario-plan|explore-trends|mullins|diagnose|analyze-timing|dominant-designs|explore-futures)['\"]"
N_HARDCODED=$(grep -ciE "$HARDCODED_CMD" "$REPO_ROOT/lib/core/futures/orchestrator.cjs")
if [[ "$N_HARDCODED" != "0" ]]; then
  echo "    FORBIDDEN hardcoded /mos: command string in orchestrator.cjs ($N_HARDCODED)"; PART8_OK=0
fi

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
echo "--- Running: em-dash sweep (Phase 156 wave-4 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/futures/orchestrator.cjs"
  "commands/futures.md"
  "tests/test-futures-chaining.cjs"
  "tests/test-futures-signal.cjs"
  "tests/test-futures-part8-leak.cjs"
  "tests/run-all-156.sh"
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
echo "  Summary (156 verification)"
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
