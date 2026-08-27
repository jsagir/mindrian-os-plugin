#!/usr/bin/env bash
# Phase 270 verification aggregator (Memory and Context Operator MCP:
# consolidate scattered local reads, fix the Resource boot-binding defect,
# close the Part 11 R1 born-wired gap, add the ICM forest walk, and give
# ~/.mindrian-user.md its first writer).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   MEMOP-02: MCP Resources resolve the room per session, the same way MCP
#     Tools already do, instead of binding roomDir once at boot.
#   MEMOP-03: the exposed ICM tree reflects a folder created after the server
#     booted, not a snapshot frozen at startup.
#   MEMOP-04: the forest walk delegates to the two already-shipped walkers
#     and mints no second, hand-rolled directory walker.
#   MEMOP-05: the section baseline is schema-driven off SECTION_METADATA,
#     never a hardcoded count of 8.
#   MEMOP-06: the forest classifies directories into four classes, and a
#     blueprint-subset room (missing some canonical sections) is not an
#     error.
#   MEMOP-07: a cross-room read never writes a cross-room edge (the Phase 8
#     aggregation fence holds for the new graph-native reads).
#   MEMOP-08: the identity write to ~/.mindrian-user.md is reachable with no
#     room bound (it is a cross-room, user-level concern, not a room-scoped
#     one).
#   MEMOP-09: every wire tool carries a connector descriptor with a
#     hitl_shape, closing the detect_dual_path / extract_shallow born-wired
#     gap.
#   MEMOP-10: the tool-schema token budget added by this phase's new tools is
#     measured with a real harness, never assumed.
#
# WAVE 0 IS RED BY DESIGN. Every tests/test-270-* file created in plans
# 270-02 through 270-04 fails until its corresponding implementation plan
# lands. A red run at the end of wave 1 is the CORRECT state, not a defect.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-269.sh). This harness globs
# every tests/test-270-* file (both .cjs and .sh) and runs it. Adding a
# tests/test-270-* file requires NO edit to this runner.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_270_PREFIX exists to prove without
# editing this file.
#
# PART 8 SOURCE SWEEP: this phase's own new production files are swept for
# Brain/network egress tokens (RESEARCH.md section 2.4, the three Part 8
# enforcement layers). Unlike the em-dash fence below, a target that does not
# yet exist is SKIPPED and counted into PART8_MISSING WITHOUT failing the
# leg -- these files legitimately do not exist until their implementation
# wave lands. This is a deliberately looser rule than the em-dash fence's
# stricter one; do not conflate the two.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_270_ALLOW_MISSING=1 is set, exactly as tests/run-all-269.sh does.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_270_PREFIX=tests/test-270-nonexistent- bash
# tests/run-all-270.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_270_PREFIX:-tests/test-270-}"

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
# DISCOVERY: glob every tests/test-270-* file. Bare `node "$t"`, NOT
# `node --test "$t"` -- this repo's aggregators invoke node:test files bare
# and still get a non-zero exit on failure (tests/run-all-264.sh:98).
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
  echo "!!! no Phase 270 test files discovered (TEST_270_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP: this phase's own new production files, comment-stripped
# then grepped for Brain/network egress tokens. A target that does not exist
# yet is SKIPPED (counted into PART8_MISSING) and does NOT fail this leg --
# these files legitimately do not exist until their implementation wave
# lands. This asymmetry vs. the em-dash fence below is deliberate.
# ---------------------------------------------------------------------------
echo "--- 270 Part 8 source sweep ---"
PART8_OK=1
PART8_MISSING=0
PART8_TARGETS=(
  "lib/core/icm-forest.cjs"
  "lib/mcp/tree-watcher.cjs"
  "lib/mcp/tools/context.cjs"
  "lib/mcp/tools/graph-reason.cjs"
  "lib/mcp/tools/identity.cjs"
  "lib/mcp/tools/dual-path.cjs"
)
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
    echo "    SKIPPED (not yet created, does not fail this leg): $t"
    PART8_MISSING=$((PART8_MISSING+1))
  fi
done
echo "    $PART8_MISSING target(s) not yet created (expected pre-wave-2/3/4/6)"
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 270 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 270 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (ported from tests/run-all-269.sh): every new file this
# phase touches, plus this runner itself and every discovered test-270- file.
# Here a MISSING target DOES count into EMDASH_MISSING and FAILS the fence
# unless TEST_270_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 270 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "${PART8_TARGETS[@]}"
  "tests/run-all-270.sh"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  EMDASH_TARGETS+=("$t")
done
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_270_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_270_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 270 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 270 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 270: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
