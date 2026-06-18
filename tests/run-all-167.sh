#!/usr/bin/env bash
# Phase 167 verification aggregator -- the single PASS/FAIL phase gate for the
# Harness-as-code completion (declared manifest + fable-mode + new-surface
# generator). Runs every registered tests/test-*.cjs suite to completion, prints
# a per-suite PASS/FAIL line + a final tally, exits 1 if any failed, and appends
# a Part-8 grep sweep + an em-dash sweep over the phase artifacts proving the
# CLAUDE.md no-em-dash + Canon Part 8 HARD RULES hold.
#
# Wave 1 (this plan) registers the three foundation suites:
#   test-harness-manifest-check.cjs           (the generator + --check)
#   test-recipe-maps-loadmanifest.cjs         (the loadManifest accessor)
#   test-harness-manifest-part8-boundary.cjs  (the planted-secret boundary scan)
# Later waves (fable-mode, /mos:new-surface, the adversarial verdict) append
# their suites to CJS_SUITES.
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

# Phase-167 suites in wave order. Wave 1 registers the three foundation suites;
# Wave 2 (D-167-03 enforcement) appends the pre-commit wiring test; later waves
# append (fable-mode self-critique, new-surface generator, the adversarial
# structured verdict).
CJS_SUITES=(
  test-harness-manifest-check.cjs
  test-recipe-maps-loadmanifest.cjs
  test-harness-manifest-part8-boundary.cjs
  test-harness-manifest-precommit-wiring.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 167 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-167 suite. A missing file gates to a FAIL line (never
# a crash). Wave 1's manifest-check is the byte-stability + 3-map-digest guard;
# a regression that adds a per-surface row or drifts the committed artifact turns
# the gate RED (threats T-167-01 / T-167-04).
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
# Manifest --check (the live drift gate, D-167-03). Regenerates the manifest in
# memory and asserts STALE / UNRESOLVED / MALFORMED against the committed
# artifact; exit-1 on any finding. This is the same gate Wave 2 wires into
# pre-commit.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: harness-manifest --check (STALE / UNRESOLVED / MALFORMED) ---"
if node "$REPO_ROOT/scripts/build-harness-manifest.cjs" --check; then
  ((PASSED++)); echo ">>> harness-manifest --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("harness-manifest --check"); echo ">>> harness-manifest --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Part-8 grep sweep (VERIFY). The same BRAIN_WRITE + RAW_FETCH + external-http
# regexes as run-all-163.sh, over the Phase-167 lib + script surfaces present so
# far. Zero user-content-to-Brain / raw-external-egress tokens may appear. The
# manifest is a LOCAL artifact; its generator + the recipe-maps wrapper open NO
# raw fetch / Brain-write path.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase 167 surfaces) ---"
PART8_OK=1
PART8_LIB=(
  "scripts/build-harness-manifest.cjs"
  "lib/core/recipe-maps.cjs"
)
# No Brain-write MCP call / brain-write helper (the canonical Part 8 breach).
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# No raw external HTTP egress in lib/script code. The leading char class excludes
# .fetchCorpus on a caller object.
RAW_FETCH='[^a-zA-Z_.]fetch[[:space:]]*\('
for t in "${PART8_LIB[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
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
echo "--- Running: em-dash sweep (Phase 167 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "scripts/build-harness-manifest.cjs"
  "data/harness-manifest.json"
  "lib/core/recipe-maps.cjs"
  "tests/test-harness-manifest-check.cjs"
  "tests/test-recipe-maps-loadmanifest.cjs"
  "tests/test-harness-manifest-part8-boundary.cjs"
  "tests/test-harness-manifest-precommit-wiring.cjs"
  "scripts/install-pre-commit.sh"
  "tests/run-all-167.sh"
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
echo "  Summary (167 verification)"
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
