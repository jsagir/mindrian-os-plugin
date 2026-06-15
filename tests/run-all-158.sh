#!/usr/bin/env bash
# Phase 158 verification aggregator -- the ONE-COMMAND PASS/FAIL phase gate for
# the bounded rejection-penalty (SEED-009-minimal). It proves the whole
# reach-surface penalty build is correct AND that the boundary fences hold
# together. Mirrors tests/run-all-148.sh structure.
#
# Four parts, run to completion even when any fails, with a per-suite PASS/FAIL
# line and a final tally; exits 1 if ANYTHING failed:
#
#   (a) the CJS_SUITES -- every test-158-*.cjs falsifiable suite (Plans 01-04).
#       A missing file gates to a FAIL line (never a crash).
#   (b) a standalone Part 8 grep sweep over the NEW reach-penalty artifacts
#       (lib/workflow/reach-reject-reader.cjs + the scripts/intent-classifier.cjs
#       reach-penalty edits) for a forbidden reason-read token, comment lines
#       stripped first so header prose mentioning "reason" never self-invalidates
#       the gate (RJP-06).
#   (c) a Part 9 chokepoint grep sweep asserting reach-reject-reader.cjs reads
#       only via navigation.cjs (no node:sqlite / better-sqlite3 / fs read) and
#       the orchestrator stays pure (no db), comment lines stripped first (RJP-07).
#   (d) a CARRIED frozen-148 passthrough (bash tests/run-all-148.sh) so the frozen
#       constitution stays green inside the 158 gate (RJP-08 / SC-05).
#
# CJS_SUITES entries resolve relative to this directory (tests/).
#
# bash only. No emoji. No em-dashes (CLAUDE.md HARD RULE). Hyphens only.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# (a) Every test-158-*.cjs suite across Plans 01-04. Listed explicitly so the
# phase gate is one command; a missing file gates to a FAIL line.
CJS_SUITES=(
  test-158-reach-id-keying.cjs            # Plan 01
  test-158-reach-presentation-counter.cjs # Plan 02
  test-158-reach-reject-only.cjs          # Plan 02
  test-158-reach-discount.cjs             # Plan 03 (RJP-02/03)
  test-158-reach-hard-suppress.cjs        # Plan 03 (RJP-04)
  test-158-reach-fences.cjs               # Plan 03 (D-05 four fences)
  test-158-reach-frozen-148-guard.cjs     # Plan 03 (SC-05)
  test-158-reach-byte-stable.cjs          # Plan 04 (RJP-02 snapshot)
  test-158-reach-orchestrator-pure.cjs    # Plan 04 (Part 9 / SC-07)
  test-158-reach-part8-no-reason.cjs      # Plan 04 (RJP-06)
  test-158-reach-part9-chokepoint.cjs     # Plan 04 (RJP-07)
)

# The new reach-penalty artifacts the boundary sweeps scope to (NOT the whole
# repo). reach-reject-reader.cjs is the reader/penalty path -- its WHOLE
# executable body is in scope. scripts/intent-classifier.cjs is a large shared
# file; ONLY its NEW 158 reach-penalty blocks are in scope (the upstream fold +
# the reach_presented counter emit). Pre-existing executable .reason reads
# elsewhere in that shared file (offer_next_step.reason, routing.reason) are NOT
# this phase's code and must NOT trip the gate -- so intent-classifier is scoped
# by extracting only its Phase-158-tagged reach-penalty lines.
ORCHESTRATOR="lib/hmi/dial-reach-orchestrator.cjs"
READER="lib/workflow/reach-reject-reader.cjs"
INTENT="scripts/intent-classifier.cjs"

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 158 verification aggregator"
echo "========================================"
echo ""

# Strip comment lines (whole-line // or block-comment body lines beginning with
# optional whitespace then // or * or /*) so header prose never trips a grep.
# This is the grep-gate-hygiene idiom (T-158-04-04): a comment mentioning
# reason/sqlite/fs must not trip OR mask the gate.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# (a) Every test-158-*.cjs falsifiable suite. A missing file gates to a FAIL
#     line (NOT a crash) so the phase gate flags incompleteness.
# ---------------------------------------------------------------------------
echo "--- test-158-*.cjs falsifiable suites ---"
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
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
# (b) Standalone Part 8 grep sweep -- the new reach-penalty + counter code must
#     never read a rejection reason string. We scan the EXECUTABLE lines (comment
#     lines stripped) of each new target for a .reason read. A comment mentioning
#     properties.reason must NOT trip it.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part 8 reason-read sweep (new 158 reach-penalty code) ---"
PART8_OK=1
REASON_RE='\.reason\b|properties\[.?.reason'

# Target 1: the reader -- its WHOLE executable body is the penalty path.
RF8="$REPO_ROOT/$READER"
if [[ ! -f "$RF8" ]]; then
  echo "    MISSING sweep target: $READER"; PART8_OK=0
elif strip_comments "$RF8" | grep -nE "$REASON_RE" >/dev/null 2>&1; then
  echo "    FORBIDDEN reason-read on an executable line in: $READER"; PART8_OK=0
fi

# Target 2: ONLY the NEW 158 reach-penalty lines of the shared intent-classifier.
# Extract the lines tagged with a Phase 158 marker or that touch the penalty
# symbols (computeReachPenalties / reach_penalties / suppressedReachIds /
# reach_presented / discountedScores / reachReader), strip comments, then grep
# THAT slice for a reason-read. Pre-existing .reason reads elsewhere in the file
# are out of scope by construction (they never appear in this slice).
IF8="$REPO_ROOT/$INTENT"
if [[ ! -f "$IF8" ]]; then
  echo "    MISSING sweep target: $INTENT"; PART8_OK=0
else
  PEN_SLICE="$(grep -nE '158-0[0-9]|computeReachPenalt|reach_penalt|suppressedReachIds|reach_presented|discountedScores|reachReader|reachPenalties' "$IF8" 2>/dev/null \
    | grep -vE ':[[:space:]]*(//|\*|/\*)')"
  if echo "$PEN_SLICE" | grep -nE "$REASON_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN reason-read in the 158 reach-penalty slice of: $INTENT"; PART8_OK=0
  fi
fi
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part 8 reason-read sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part 8 reason-read sweep"); echo ">>> Part 8 reason-read sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (c) Part 9 chokepoint grep sweep -- the reader path reads ONLY via
#     navigation.cjs (no node:sqlite / better-sqlite3 / fs read) and the
#     orchestrator stays pure (no db). Comment lines stripped first.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part 9 chokepoint sweep (reader + orchestrator) ---"
PART9_OK=1
RF="$REPO_ROOT/$READER"
OF="$REPO_ROOT/$ORCHESTRATOR"

if [[ ! -f "$RF" ]]; then
  echo "    MISSING sweep target: $READER"; PART9_OK=0
else
  # Forbidden direct-db / fs tokens on executable lines in the reader.
  if strip_comments "$RF" | grep -nE "require\(['\"]node:sqlite|better-sqlite3|\bDatabaseSync\b|\bfs\.(read|write)" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db/fs token on an executable line in: $READER"; PART9_OK=0
  fi
  # The reader MUST require the navigation chokepoint.
  if ! strip_comments "$RF" | grep -qE "require\(['\"]\.\./core/navigation\.cjs['\"]\)"; then
    echo "    MISSING navigation.cjs chokepoint require in: $READER"; PART9_OK=0
  fi
fi

if [[ ! -f "$OF" ]]; then
  echo "    MISSING sweep target: $ORCHESTRATOR"; PART9_OK=0
else
  # The orchestrator must stay pure: no db handle, no navigation require, no fs,
  # no await, no network on executable lines.
  if strip_comments "$OF" | grep -nE "require\(['\"]node:sqlite|better-sqlite3|\bfs\.(read|write)|fetch\(|https?://|\bawait\b|require\(['\"][^'\"]*navigation" >/dev/null 2>&1; then
    echo "    FORBIDDEN db/fs/Brain/await token on an executable line in: $ORCHESTRATOR"; PART9_OK=0
  fi
fi
if [[ $PART9_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part 9 chokepoint sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part 9 chokepoint sweep"); echo ">>> Part 9 chokepoint sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (d) The CARRIED frozen-148 passthrough. run-all-148.sh runs INSIDE this gate so
#     a frozen-148 break (a moved constant, a 7th reach) fails the 158 phase gate
#     (RJP-08 / SC-05). PASS only when run-all-148.sh exits 0.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: frozen-148 passthrough (bash tests/run-all-148.sh) ---"
if bash "$REPO_ROOT/tests/run-all-148.sh"; then
  ((PASSED++)); echo ">>> frozen-148 passthrough: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("frozen-148 passthrough (run-all-148.sh)"); echo ">>> frozen-148 passthrough: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (158 verification)"
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
