#!/usr/bin/env bash
# Phase 163 verification aggregator -- the single PASS/FAIL phase gate for the
# Trending-to-the-Absurd Harness (Visionary Innovation Companion). Runs every
# registered tests/test-*.cjs suite to completion, prints a per-suite PASS/FAIL
# line + a final tally, exits 1 if any failed, and appends an em-dash sweep over
# the phase artifacts proving the CLAUDE.md no-em-dash HARD RULE holds.
#
# Wave 1 (this plan) registers the domain-taxonomy floor test
# (test-edges-domain-taxonomy-floor.cjs -- the four-edge frozen-vocabulary
# amendment, D-163-03). Later waves (the edge-linker, the trend agent surface,
# Stage 7, persona/path variance) append their suites to CJS_SUITES.
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-156.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-163 suites in wave order. Wave 1 registers the frozen-set floor test;
# later waves append (e.g. the typed-domain writer / edge-linker tests, the
# trend-agent surface tests, the Part 8 leak scan).
CJS_SUITES=(
  test-edges-domain-taxonomy-floor.cjs
  test-typed-domain.cjs
  test-lens-domain-family.cjs
  test-get-domains-for-trends.cjs
  test-trending-to-absurd-orchestrator.cjs
  test-trending-to-absurd-stage7.cjs
  test-trending-to-absurd-variance.cjs
  test-trending-to-absurd-verdict.cjs
  test-trending-to-absurd-part8-leak.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 163 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-163 suite. A missing file gates to a FAIL line (never
# a crash). Wave 1's floor test is the frozen-set landmine guard: a regression
# that drops a prior edge type or un-freezes the Set turns the gate RED
# (threat T-163-01).
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
# Connector-block validation (Wave 4 SURFACE-A). The /mos:trending-to-absurd
# command must declare connects_to_spine: true and a connector framework that
# EQUALS its frameworks: value (Phase 143.3 contract section 27 + the generator
# --check tripwire). Gates RED if the command is missing or the framework drifts.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector-block validation (trending-to-absurd) ---"
CONN_OK=1
TTA_CMD="$REPO_ROOT/commands/trending-to-absurd.md"
TTA_SKILL="$REPO_ROOT/skills/trending-to-absurd/SKILL.md"
if [[ ! -f "$TTA_CMD" ]]; then
  echo "    MISSING commands/trending-to-absurd.md"; CONN_OK=0
else
  grep -q "connects_to_spine: true" "$TTA_CMD" || { echo "    connects_to_spine not true"; CONN_OK=0; }
  # The connector framework MUST equal the frameworks: value (S-Curve Analysis).
  grep -q 'frameworks: \["S-Curve Analysis"\]' "$TTA_CMD" || { echo "    frameworks: drift"; CONN_OK=0; }
  grep -q 'framework: "S-Curve Analysis"' "$TTA_CMD" || { echo "    connector framework drift"; CONN_OK=0; }
fi
if [[ ! -f "$TTA_SKILL" ]]; then
  echo "    MISSING skills/trending-to-absurd/SKILL.md"; CONN_OK=0
fi
if [[ $CONN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> connector-block validation: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector-block validation"); echo ">>> connector-block validation: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Part-8 grep sweep (Wave 6 VERIFY). The same BRAIN_WRITE + RAW_FETCH + external-
# http regexes as run-all-156.sh, over every Phase-163 lib + command + skill
# surface. Zero user-content-to-Brain / raw-external-egress tokens may appear.
# The lib code must open NO raw fetch / Brain-write path; the ONLY sanctioned
# external leg is the inherited runSignalResearch -> fetchCorpus chokepoint
# (which lives in the futures harness, not Phase-163 code).
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase 163 surfaces) ---"
PART8_OK=1
# The lib subset (raw fetch / external http forbidden in code paths).
PART8_LIB=(
  "lib/core/navigation/typed-domain.cjs"
  "lib/core/navigation/get-domains-for-trends.cjs"
  "lib/core/synthesizers/domain-hierarchy.cjs"
  "lib/core/trending-to-absurd/orchestrator.cjs"
  "lib/core/trending-to-absurd/stage7-roadmap.cjs"
  "lib/core/trending-to-absurd/variance.cjs"
)
# The full surface (Brain-write forbidden everywhere, prose layer included).
PART8_ALL=(
  "${PART8_LIB[@]}"
  "commands/trending-to-absurd.md"
  "skills/trending-to-absurd/SKILL.md"
)
# No Brain-write MCP call / brain-write helper (the canonical Part 8 breach).
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# No raw external HTTP egress in lib code (egress is delegated to the fetchCorpus
# chokepoint). The leading char class excludes .fetchCorpus on a caller object.
RAW_FETCH='[^a-zA-Z_.]fetch[[:space:]]*\('
for t in "${PART8_ALL[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  if grep -nE "$BRAIN_WRITE" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
done
for t in "${PART8_LIB[@]}"; do
  f="$REPO_ROOT/$t"
  [[ -f "$f" ]] || continue
  # Filter comment lines so a doc comment that names fetch( as prose does not
  # self-invalidate the count (the `grep -v '^#'` spirit; CJS comments lead with
  # // or *). Never a bare unfiltered gate.
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
# Frozen-edge-set assertion (Wave 6 VERIFY; threat T-163-16). The four domain
# edges MUST be present in lib/core/navigation/edges.cjs and NO non-domain edge
# string may have leaked into typed-domain.cjs's DOMAIN_EDGE_SUBSET. This is the
# bash floor that backs the verdict's CHECK 2 -- a regression that drops a
# domain edge or widens the domain subset turns the gate RED.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-edge-set assertion (domain edges + subset integrity) ---"
FROZEN_OK=1
EDGES_FILE="$REPO_ROOT/lib/core/navigation/edges.cjs"
TYPED_DOMAIN_FILE="$REPO_ROOT/lib/core/navigation/typed-domain.cjs"
DOMAIN_EDGES=(DECOMPOSED_INTO PART_OF TAGGED_WITH RELATED_TO)
if [[ ! -f "$EDGES_FILE" ]]; then
  echo "    MISSING edges.cjs"; FROZEN_OK=0
else
  for e in "${DOMAIN_EDGES[@]}"; do
    if ! grep -qE "'$e'" "$EDGES_FILE"; then
      echo "    domain edge missing from ALLOWED_EDGE_TYPES: $e"; FROZEN_OK=0
    fi
  done
fi
if [[ ! -f "$TYPED_DOMAIN_FILE" ]]; then
  echo "    MISSING typed-domain.cjs"; FROZEN_OK=0
else
  # The DOMAIN_EDGE_SUBSET literal block must contain EXACTLY the four domain
  # edges and no other edge token (no leak of an arbitrary type into the domain
  # writers). Extract the subset block and check its membership tokens.
  SUBSET_BLOCK=$(awk '/DOMAIN_EDGE_SUBSET = Object.freeze/{f=1} f{print} /\]\)\);/{if(f)exit}' "$TYPED_DOMAIN_FILE")
  for e in "${DOMAIN_EDGES[@]}"; do
    if ! echo "$SUBSET_BLOCK" | grep -qE "'$e'"; then
      echo "    DOMAIN_EDGE_SUBSET missing the domain edge: $e"; FROZEN_OK=0
    fi
  done
  # Any non-domain edge token (an uppercase identifier in quotes) leaking into the
  # subset block is a breach. Strip the four legal ones and assert nothing remains.
  LEAKED=$(echo "$SUBSET_BLOCK" | grep -oE "'[A-Z_]{3,}'" \
    | grep -vE "'(DECOMPOSED_INTO|PART_OF|TAGGED_WITH|RELATED_TO)'" || true)
  if [[ -n "$LEAKED" ]]; then
    echo "    FORBIDDEN non-domain edge leaked into DOMAIN_EDGE_SUBSET: $LEAKED"; FROZEN_OK=0
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
echo "--- Running: em-dash sweep (Phase 163 artifacts) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/navigation/edges.cjs"
  "tests/test-edges-domain-taxonomy-floor.cjs"
  "tests/run-all-163.sh"
  "docs/MINDRIAN-CANON.md"
  "docs/CANON-PHASE-MAP.md"
  "lib/core/navigation/typed-domain.cjs"
  "lib/core/navigation.cjs"
  "tests/test-typed-domain.cjs"
  "lib/core/lens-engine.cjs"
  "lib/core/synthesizers/domain-hierarchy.cjs"
  "lib/core/navigation/get-domains-for-trends.cjs"
  "tests/test-lens-domain-family.cjs"
  "tests/test-get-domains-for-trends.cjs"
  "lib/core/trending-to-absurd/orchestrator.cjs"
  "tests/test-trending-to-absurd-orchestrator.cjs"
  "commands/trending-to-absurd.md"
  "skills/trending-to-absurd/SKILL.md"
  "lib/core/trending-to-absurd/stage7-roadmap.cjs"
  "tests/test-trending-to-absurd-stage7.cjs"
  "lib/core/trending-to-absurd/variance.cjs"
  "tests/test-trending-to-absurd-variance.cjs"
  "tests/test-trending-to-absurd-verdict.cjs"
  "tests/test-trending-to-absurd-part8-leak.cjs"
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
echo "  Summary (163 verification)"
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
