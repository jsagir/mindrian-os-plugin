#!/usr/bin/env bash
# Phase 165 verification aggregator -- the single PASS/FAIL phase gate for the
# unknown-unknowns blind-spot engine. Runs every registered tests/test-unknowns-*.cjs
# suite to completion, prints a per-suite PASS/FAIL line + a final tally, exits 1 if
# any failed, and appends an em-dash sweep over the phase artifacts proving the
# CLAUDE.md no-em-dash HARD RULE holds.
#
# Wave 0 (Plan 01) registers the 10 RED stubs (the contracts-on-disk) + the shared
# IFACE + the seeded fixture room.db. AT WAVE-0 CLOSE THE SUITE IS INTENTIONALLY
# RED: every stub REQUIRES an engine module that does not exist yet and exits 1,
# encoding the D-165-01..10 + interPartitionDistance + Part-8 contracts. Waves 2-6
# turn each stub GREEN as the corpus-adapter, dsp, bandit, edge-writer,
# orchestrator, and verdict modules ship. The phase gate must EXECUTE every stub
# (it reports them RED at Wave-0 close; it goes GREEN only when the engine lands).
#
# Mirrors tests/run-all-164.sh. bash only. No emoji. No em-dashes (hyphens only):
# the em-dash grep below is written via its codepoint escape (U+2014) so this file
# itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-165 suites in wave order. Wave 0 registers all 10 as RED stubs; later
# waves turn each green (corpus-adapter + proxy-oracle = W2; dsp + dsp-goodness =
# W2; bandit + resume = W3; frozen-edges = W4; part8-boundary + rank-in = W5;
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
# crash). A RED stub (the Wave-0 state) EXITS 1 and is counted FAILED -- that is
# the INTENDED Wave-0 close state: the contracts exist, the engine does not yet.
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
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is matched
# via its codepoint escape (U+2014) so this runner itself carries no literal
# em-dash to trip its own sweep. Sweeps the 165 phase artifacts:
# lib/core/unknowns/*.cjs (the shared iface now; engine modules as they land) +
# tests/test-unknowns-*.cjs + the fixture + this runner.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 165 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
# Sweep every shipped lib/core/unknowns/*.cjs (glob expands to the iface now; the
# engine modules join as later waves land) plus the fixed test + fixture artifacts.
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
