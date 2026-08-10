#!/usr/bin/env bash
# Phase 246 verification aggregator (LOOP-02, the Brain graph census).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. Every exported census Cypher string classifies allow under the Part 8
#      egress guard, so a future vocabulary regression turns this red instead
#      of silently re-gating a content-free introspection call.
#   2. renderMarkdown()/serializeArtifactJson() render deterministically from
#      a fixture with ZERO network, and the PENDING Lane B line is explicit
#      when lane_b is absent, never a silent omission.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-245.sh). This
# harness globs every tests/test-246-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-246-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   246-01  tests/test-246-census-guard.cjs
#   246-01  tests/test-246-census-render.cjs
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'), so this
# runner itself carries no literal em-dash that would trip its own sweep.
# Missing paths (docs/BRAIN-GRAPH-CENSUS.generated.md does not exist until
# Task 2) are skipped, not failed.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_246_PREFIX=tests/test-246-nonexistent- bash
# tests/run-all-246.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_246_PREFIX:-tests/test-246-}"

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

shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  found=$((found+1))
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""

# ---------------------------------------------------------------------------
# No-em-dash fence: every file this phase touches, swept for U+2014.
# ---------------------------------------------------------------------------
echo "--- 246 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "scripts/build-brain-census.cjs"
  "tests/test-246-census-guard.cjs"
  "tests/test-246-census-render.cjs"
  "tests/run-all-246.sh"
  "docs/BRAIN-GRAPH-CENSUS.generated.md"
)
# rc 0 = a hit, rc 1 = clean, rc >= 2 = the scan itself broke (fence FAILURE,
# per the run-all-245.sh precedent: a grep that errors must never report a
# silent pass).
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
    echo "    (skipped, not yet created): $t"
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 246 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 246 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 246: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
