#!/usr/bin/env bash
# Phase 159 verification aggregator -- the ONE-COMMAND PASS/FAIL phase gate for
# the dial-closer-consumer-wire (DCW-01..10). It proves the whole
# producer->consumer->penalty loop fires LIVE (the 2-turn integration test) AND
# that the frozen spine (158 + 148) survived the wire. Mirrors
# tests/run-all-158.sh structure exactly.
#
# This gate exits 0 ONLY when EVERY part passes; it gates on the EXIT CODE, never
# on a hardcoded count tally -- the aggregators below add sweep parts to TOTAL, so
# the real CJS-suite counts inside 158/148 are 11/8 (not 14/18); the published
# 14/14 + 18/18 figures count those gates' own sweep parts. Asserting a literal
# tally here would be brittle and wrong. We assert exit 0.
#
# Five parts, run to completion even when any fails, with a per-suite PASS/FAIL
# line and a final tally; exits 1 if ANYTHING failed:
#
#   (a) the CJS_SUITES -- every test-159-*.cjs falsifiable suite (the three Wave-1
#       suites, the Wave-2 turn-start suite, the Wave-3 integration suite, and the
#       Part 8 SECRETREASON sweep). A missing file gates to a FAIL line (never a
#       crash) so the phase gate flags incompleteness.
#   (b) a standalone Part 8 grep sweep over the NEW consumer artifacts
#       (lib/workflow/f1-pick-consumer.cjs + lib/hmi/f1-pick-capture-cli.cjs) for a
#       forbidden pick-text-to-Brain token (buildBrainPacket / a Brain-client
#       require / fetch / http), comment lines stripped first so header prose never
#       self-invalidates the gate (the grep-gate-hygiene idiom).
#   (c) a Part 9 chokepoint grep sweep asserting f1-pick-consumer.cjs reads/writes
#       only via navigation.cjs / the closers (no node:sqlite / better-sqlite3 /
#       fs.read on executable lines), comment lines stripped first.
#   (d) + (e) the CARRIED passthroughs: bash tests/run-all-158.sh AND bash
#       tests/run-all-148.sh -- so a frozen-148 break OR a 158 regression fails the
#       159 gate (DCW-10). run-all-158.sh already carries run-all-148.sh
#       internally, but the SPEC requires BOTH passthroughs present in
#       run-all-159.sh, so 148 is invoked explicitly here too -- by design 148 runs
#       TWICE (once nested inside 158, once standalone here) per the DCW-10 literal.
#
# CJS_SUITES entries resolve relative to this directory (tests/).
#
# bash only. No emoji. No em-dashes (CLAUDE.md HARD RULE). Hyphens only.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# (a) Every test-159-*.cjs suite across Waves 1-3. Listed explicitly so the phase
# gate is one command; a missing file gates to a FAIL line.
CJS_SUITES=(
  test-159-closeoffer-reachid-forward.cjs     # Wave 1 (DCW-02/08)
  test-159-consume-f1-pick.cjs                # Wave 1 (DCW-01/03/04/05/06)
  test-159-cli-capture-adapter.cjs            # Wave 1 (DCW-07 CLI)
  test-159-turn-start-wiring.cjs              # Wave 2 (DCW-01/04/06/08)
  test-159-integration-2turn-suppress.cjs     # Wave 3 (DCW-09 headline gate)
  test-159-part8-secretreason-sweep.cjs       # Wave 3 (DCW-05 Part 8 sweep)
)

# The new consumer artifacts the boundary sweeps scope to (NOT the whole repo).
CONSUMER="lib/workflow/f1-pick-consumer.cjs"
CAPTURE="lib/hmi/f1-pick-capture-cli.cjs"

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 159 verification aggregator"
echo "========================================"
echo ""

# Strip comment lines (whole-line // or block-comment body lines beginning with
# optional whitespace then // or * or /*) so header prose never trips a grep.
# This is the grep-gate-hygiene idiom: a comment mentioning a forbidden token
# must not trip OR mask the gate.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# (a) Every test-159-*.cjs falsifiable suite. A missing file gates to a FAIL
#     line (NOT a crash) so the phase gate flags incompleteness.
# ---------------------------------------------------------------------------
echo "--- test-159-*.cjs falsifiable suites ---"
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
# (b) Standalone Part 8 grep sweep -- the new consumer artifacts must never
#     forward pick text toward the Brain. We scan the EXECUTABLE lines (comment
#     lines stripped) of each new target for a buildBrainPacket / Brain-client
#     require / fetch / http token. A comment mentioning the LOCAL lane must NOT
#     trip it.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part 8 pick-text-to-Brain sweep (new 159 consumer artifacts) ---"
PART8_OK=1
BRAIN_RE='buildBrainPacket|require\(["'\''][^"'\'']*brain[^"'\'']*["'\'']\)|fetch\(|https?://'

for target in "$CONSUMER" "$CAPTURE"; do
  tf="$REPO_ROOT/$target"
  if [[ ! -f "$tf" ]]; then
    echo "    MISSING sweep target: $target"; PART8_OK=0
  elif strip_comments "$tf" | grep -nE "$BRAIN_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN pick-text-to-Brain token on an executable line in: $target"; PART8_OK=0
  fi
done
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part 8 pick-text-to-Brain sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part 8 pick-text-to-Brain sweep"); echo ">>> Part 8 pick-text-to-Brain sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (c) Part 9 chokepoint grep sweep -- the consumer reaches room.db ONLY through
#     navigation.cjs / the closer modules (no node:sqlite / better-sqlite3 / fs
#     read on executable lines). Comment lines stripped first.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part 9 chokepoint sweep (f1-pick-consumer.cjs) ---"
PART9_OK=1
CF="$REPO_ROOT/$CONSUMER"
if [[ ! -f "$CF" ]]; then
  echo "    MISSING sweep target: $CONSUMER"; PART9_OK=0
else
  # The consumer NEVER opens room.db itself: no direct sqlite handle, no fs
  # read/write of room data on executable lines.
  if strip_comments "$CF" | grep -nE "require\(['\"]node:sqlite|better-sqlite3|\bDatabaseSync\b|\bfs\.(read|write)" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db/fs token on an executable line in: $CONSUMER"; PART9_OK=0
  fi
  # The consumer delegates persistence to the closer module (offer-closer.cjs),
  # which itself routes through the navigation chokepoint.
  if ! strip_comments "$CF" | grep -qE "offer-closer\.cjs"; then
    echo "    MISSING closer delegation (offer-closer.cjs) in: $CONSUMER"; PART9_OK=0
  fi
fi
if [[ $PART9_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part 9 chokepoint sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part 9 chokepoint sweep"); echo ">>> Part 9 chokepoint sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (d) The CARRIED 158 passthrough. run-all-158.sh runs INSIDE this gate so a 158
#     regression fails the 159 phase gate (DCW-10). PASS only when it exits 0.
#     (run-all-158.sh itself carries run-all-148.sh internally; we ALSO invoke
#     148 standalone below per the DCW-10 literal, so 148 runs twice by design.)
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: 158 passthrough (bash tests/run-all-158.sh) ---"
if bash "$REPO_ROOT/tests/run-all-158.sh"; then
  ((PASSED++)); echo ">>> 158 passthrough: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("158 passthrough (run-all-158.sh)"); echo ">>> 158 passthrough: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (e) The CARRIED frozen-148 passthrough. The SPEC requires BOTH 158 AND 148
#     passthroughs present in run-all-159.sh, so 148 is invoked standalone here
#     too. By design 148 runs TWICE (nested in 158 above + standalone here) per
#     the DCW-10 literal -- a frozen-148 break (a moved constant, a 7th reach)
#     fails the 159 phase gate. PASS only when run-all-148.sh exits 0.
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
echo "  Summary (159 verification)"
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
