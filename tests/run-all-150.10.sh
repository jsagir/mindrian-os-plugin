#!/usr/bin/env bash
# Phase 150.10 verification aggregator -- the single PASS/FAIL phase gate proving
# Piece C (register systems-thinking-loop as a ranked sub_mode component in
# Larry's reach repertoire) is correct AND that the registration did NOT regress
# the frozen-6 constitutional reach bank or the frozen dial constants.
#
# Mirrors tests/run-all-148.sh: a bash PASS/FAIL loop that runs each constituent
# to completion and exits non-zero if any failed. It composes:
#
#   (a) the connector-registry --check CI tripwire (the systems-thinking
#       connector frontmatter already carries sub_mode systems-thinking-loop
#       under reach_id context_block, so this stays green with no regeneration);
#   (b) the NEW repertoire + frozen-6 test (tests/test-150.10-systems-thinking-
#       repertoire.cjs, ST-11);
#   (c) the CARRIED frozen fences proving Piece C did not regress the
#       constitution: tests/test-148-frozen-contracts.cjs and
#       tests/test-148-component-map.cjs (DIAL_REACH_K=6, MAX_K=3, the 0.70/0.15
#       gate, the 6-reach bank, the existing sub_mode rows all intact);
#   (d) a Part-8 grep sweep over the Phase 150.10 local artifacts (the reach-
#       component-map.json + the new test) for forbidden user-content-to-Brain
#       tokens -- this is a pure-local registry change, so the sweep asserts zero
#       network/egress surface was added.
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and a final tally; it exits 1 if any failed.
#
# bash only. No emoji. No em-dashes (hyphens only).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# (b) The new repertoire + frozen-6 test, plus (c) the carried 148 frozen fences.
CJS_SUITES=(
  test-150.10-systems-thinking-repertoire.cjs   # ST-11 (Piece C: repertoire + frozen-6)
  test-leverage-scan.cjs                         # ST-15..ST-17 (Piece D: the M4 leverage scanner)
  test-148-frozen-contracts.cjs                 # CARRIED: MAX_K=3, DIAL_REACH_K=6, 0.70/0.15
  test-148-component-map.cjs                     # CARRIED: the sub_mode rows + dispatcher routing
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 150.10 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The CI tripwire -- direct invocation. The systems-thinking connector
#     already carries sub_mode systems-thinking-loop, so this stays green with
#     no regeneration.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector-registry --check (CI tripwire) ---"
if node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check; then
  ((PASSED++)); echo ">>> connector-registry --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector-registry --check"); echo ">>> connector-registry --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (b) + (c) The CJS suites: the new repertoire + frozen-6 test and the carried
#     148 frozen fences. A missing file gates to a FAIL line (never a crash).
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
# (d) Standalone Part-8 grep sweep over the Phase 150.10 local artifacts. This
#     is a pure-local registry change; the sweep asserts zero network/egress
#     surface was added. The reach-component-map.json holds ONLY reach_id /
#     sub_mode -> archetype enum scalars (no free-text body channel toward a
#     Brain packet); the new test is pure node:assert with zero network token.
#     Mirrors run-all-148.sh step d.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (150.10 local artifacts) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "lib/hmi/reach-component-map.json"
  "tests/test-150.10-systems-thinking-repertoire.cjs"
)
# Forbidden egress-projection / hashing tokens (mirrors run-all-148.sh step d).
FORBIDDEN_TOKENS='projectText|safeNodeProjection|safeContradictionProjection|safeUnsupportedProjection'
for t in "${SWEEP_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  if grep -nE "$FORBIDDEN_TOKENS" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN projection/hash token in: $t"; PART8_OK=0
  fi
done
# The component map must NOT carry a free-text body channel heading to Brain.
if grep -nE '"(summary|content|body|text|note|description)"[[:space:]]*:' "$REPO_ROOT/lib/hmi/reach-component-map.json" >/dev/null 2>&1; then
  echo "    FORBIDDEN free-text body field in: lib/hmi/reach-component-map.json"; PART8_OK=0
fi
# The new test must not open a raw network egress (no fetch/http/Brain MCP call).
if grep -nE "fetch\(|https?://|mcp__brain_" "$REPO_ROOT/tests/test-150.10-systems-thinking-repertoire.cjs" >/dev/null 2>&1; then
  echo "    FORBIDDEN raw network egress in: tests/test-150.10-systems-thinking-repertoire.cjs"; PART8_OK=0
fi
# Piece D Part-8 floor: the leverage-point scanner reads LOCAL room.db only; the
# room candidates NEVER egress to Brain. The plan must_have asserts this exact
# grep returns 0 matches over lib/core/leverage-scan.cjs.
LEVERAGE_SCAN="$REPO_ROOT/lib/core/leverage-scan.cjs"
if [[ ! -f "$LEVERAGE_SCAN" ]]; then
  echo "    MISSING sweep target: lib/core/leverage-scan.cjs"; PART8_OK=0
elif grep -nE "fetch|http|curl|brain|tavily" "$LEVERAGE_SCAN" >/dev/null 2>&1; then
  echo "    FORBIDDEN egress token in: lib/core/leverage-scan.cjs"; PART8_OK=0
fi
# No em-dashes in the new 150.10 artifacts (CLAUDE.md HARD RULE: hyphens only).
# The forbidden glyph is matched via its codepoint (U+2014) so this runner
# itself carries no literal em-dash to trip its own sweep.
EMDASH=$'\u2014'
EMDASH_TARGETS=(
  "${SWEEP_TARGETS[@]}"
  "tests/run-all-150.10.sh"
  "lib/core/leverage-scan.cjs"
  "tests/test-leverage-scan.cjs"
  "references/methodology/leverage-scan-signatures.md"
  "commands/systems-thinking.md"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ -f "$f" ]] && grep -q "$EMDASH" "$f"; then
    echo "    FORBIDDEN em-dash in: $t"; PART8_OK=0
  fi
done
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (150.10 verification)"
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
