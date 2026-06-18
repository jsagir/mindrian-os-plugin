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
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is
# matched via its codepoint escape (U+2014) so this runner itself carries no
# literal em-dash to trip its own sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 163 wave-1 artifacts) ---"
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
