#!/usr/bin/env bash
# Phase 276 verification aggregator (MCP Tool Honesty - Triage and Close the
# check-tool-honesty.cjs disease: the dead switch(command) branch splitter,
# the L1 description false claims it enables, and the sibling substrate
# false-success class C4/C5 named in the same phase).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   TOOLHON-01: splitBranches recognizes a top-level switch (command) branch
#     at all (216-01, this file's own headline defect).
#   TOOLHON-02: live scanAll() output matches the checked-in disposition
#     ledger, so a new finding or a silently-resolved one cannot pass unseen
#     (276-06).
#   TOOLHON-03: orchestration's description asserts no capability its
#     handler cannot reach, and the scout* family self-discloses in-band
#     (276-03).
#   TOOLHON-04: room_content's WRITE-surface list names only commands that
#     reach a write primitive, with a NOT-EXECUTED banner on the rest
#     (276-03).
#   TOOLHON-05: every documented detector boundary (B-1..B-6) is asserted or
#     enumerated in the script header (276-01, this file's own headline
#     defect).
#   TOOLHON-06: every ALLOWED_UNVERIFIED entry carries a reason, a triage
#     date, and resolves to a live scan row (276-04).
#   TOOLHON-07: the meeting Tri-Polar gap carries a recorded disposition
#     (276-05, navigator ruling).
#   TOOLHON-08: the ROADMAP Phase 276 entry reconciles its finding count and
#     drops its stale Phase 275 dependency (276-05).
#   TOOLHON-09: a held exclusive write lock makes a contended opener WAIT,
#     never fail in ~0ms with SQLITE_BUSY (276-10).
#   TOOLHON-10: spine-events' _emit sites return a typed reason
#     (room_db_busy / room_db_broken), never a collapsed no_room_db, under a
#     held lock or a corrupted file (276-10).
#   TOOLHON-11: every no_room_db-producing site is enumerated at run time and
#     either fires only on a genuine stat failure or has been migrated
#     (276-10).
#   TOOLHON-12: the five Theo description constants diff against the live
#     plugin registration strings, cross-repo, skip-when-absent (276-13).
#   TOOLHON-13: the DIKW / ALLOWED_EPISTEMIC_TYPES / knowledge_type
#     vocabulary mapping is ruled by the navigator (276-05, decision-only).
#   TOOLHON-14: the meeting-filing pipeline is reachable and gated on
#     Desktop/Cowork, verified through room.db, never the tool's own
#     response text (276-14).
#
# WAVE 0 IS RED BY DESIGN. tests/test-276-tool-honesty-switch-branches.cjs
# (created by THIS plan, 276-01) MUST fail until plan 276-06 lands the
# one-line GREEN fix to scripts/check-tool-honesty.cjs's splitBranches. A red
# run at the end of Wave 0 is the CORRECT state, not a defect -- mirrors
# tests/run-all-273.sh's documented convention. Do NOT "fix" this runner by
# softening that arm; the fix belongs to plan 276-06, not to this aggregator.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-273.sh / tests/run-all-270.sh).
# This harness globs every tests/test-276-* file (both .cjs and .sh) and
# runs it. Adding a tests/test-276-* file requires NO edit to this runner.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_276_PREFIX exists to prove without
# editing this file. A harness reporting green over zero discovery is itself
# the false-success disease this phase exists to close.
#
# PART 8 SOURCE SWEEP: this phase's production targets (comment-stripped,
# then grepped for Brain/network egress tokens) plus every discovered test
# file. A missing target counts as a FAILURE, not a skip -- every listed
# target already exists on main today.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_276_ALLOW_MISSING=1 is set, exactly as tests/run-all-273.sh does.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_276_PREFIX=test-276-nonexistent- bash
# tests/run-all-276.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_276_PREFIX:-tests/test-276-}"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# DISCOVERY: glob every tests/test-276-* file. Bare `node "$t"`, NOT node's
# own `--test` flag on "$t" -- this repo's aggregators invoke node:test files
# bare and still get a non-zero exit on failure (tests/run-all-273.sh
# precedent).
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 276 test files discovered (TEST_276_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP: this phase's production targets, comment-stripped
# then grepped for Brain/network egress tokens, plus every discovered test
# file. Every target below already exists on main, so a missing target is a
# real defect, not an expected pre-wave gap.
# ---------------------------------------------------------------------------
echo "--- 276 Part 8 source sweep ---"
PART8_OK=1
PART8_MISSING=0
PART8_TARGETS=(
  "scripts/check-tool-honesty.cjs"
  "lib/mcp/tool-router.cjs"
  "lib/mcp/tools/gate.cjs"
  "lib/mcp/tools/graph.cjs"
  "lib/core/navigation/spine-events.cjs"
  "lib/core/lazygraph-ops.cjs"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  PART8_TARGETS+=("$t")
done
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(grep -v '^\s*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)"
    if [ "$hits" -gt 0 ]; then
      echo "    FORBIDDEN egress token(s) in: $t ($hits match(es))"
      PART8_OK=0
    else
      echo "    clean: $t"
    fi
  else
    echo "    MISSING (counts as a failure, every Part 8 target already exists on main): $t"
    PART8_MISSING=$((PART8_MISSING+1))
    PART8_OK=0
  fi
done
echo "    $PART8_MISSING target(s) missing"
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 276 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 276 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (ported from tests/run-all-273.sh): every production
# target above, plus this runner itself and every discovered test-276- file.
# A MISSING target counts into EMDASH_MISSING and FAILS the fence unless
# TEST_276_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 276 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "${PART8_TARGETS[@]}"
  "tests/run-all-276.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    MISSING (not yet created): $t"
    EMDASH_MISSING=$((EMDASH_MISSING+1))
  fi
done
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_276_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_276_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 276 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 276 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 276: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
