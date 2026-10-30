#!/usr/bin/env bash
# Phase 381 verification aggregator (room scan once, render three times: node renderers behind
# compute-state, compute-team and analyze-room).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   PERF381-01: the OLD vs NEW parity harness (git archive of BASE_SHA against this tree) shows
#     zero diff on stdout, exit code and the written tree for every gate room.
#   PERF381-02: one room scan (lib/core/room-scan.cjs) feeds three renderers.
#   PERF381-03: the bash dialect frontmatter extractor matches the live sed/grep pipeline.
#   PERF381-04: the bash associative array iteration order is emulated, never sorted.
#   PERF381-05: the hostile room (the quick 261029-u8x payloads) gives equal bytes on both sides
#     and no run creates a marker file.
#   PERF381-06: the compute-team renderer keeps the bash bytes (stdout, TEAM-STATE, PROFILE.md).
#   PERF381-07: the analyze-room renderer keeps the bash bytes and the line order.
#   PERF381-08: the compute-state renderer keeps the bash bytes; the callers stay intact.
#   PERF381-09: the measured gain is recorded with real numbers; the legacy bodies are removed
#     only after the parity run is recorded.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-363.1.sh). Every tests/test-381-*.cjs file is
# discovered and run. Adding one needs NO edit here. The found-eq-0 guard is load-bearing: a run
# that discovers nothing FAILS, it never prints green. TEST_381_PREFIX exists only so that guard
# is provable without editing this file.
#
# PART 8 SOURCE SWEEP: the new lib modules are swept for Brain/network egress tokens. A target
# that does not exist yet is SKIPPED and does not fail the leg (it lands in a later plan).
#
# DASH FENCE: every file this phase adds is swept for U+2014 and U+2013.
#
# Bash 3.2 compatible: no associative arrays, no mapfile. Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (the run-all-216 idiom): the offline preload is inherited by every spawned
# leg. The parity harness adds its own net guard to every OLD and NEW child.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PREFIX="${TEST_381_PREFIX:-tests/test-381-}"

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
# DISCOVERY
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run_may_skip "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 381 test files discovered (TEST_381_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP (the run-all-270 forbidden-token regex)
# ---------------------------------------------------------------------------
echo "--- 381 Part 8 source sweep ---"
PART8_OK=1
PART8_TARGETS=(
  "lib/core/room-scan.cjs"
  "lib/core/room-render.cjs"
  "lib/core/room-render-team.cjs"
  "lib/core/room-render-analyze.cjs"
  "lib/core/room-render-state.cjs"
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
    echo "SKIP $t (not built yet)"
  fi
done
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 381 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 381 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# DASH FENCE (U+2014 em-dash, U+2013 en-dash)
# ---------------------------------------------------------------------------
echo "--- 381 dash fence ---"
DASH_OK=1
DASH_TARGETS=(
  "lib/core/room-scan.cjs"
  "lib/core/room-render.cjs"
  "lib/core/room-render-team.cjs"
  "lib/core/room-render-analyze.cjs"
  "lib/core/room-render-state.cjs"
  "tests/run-all-381.sh"
  "tests/helpers/oracle-381.cjs"
  "tests/helpers/net-guard-381.cjs"
  "tests/fixtures/room-381/build-fixture.cjs"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  DASH_TARGETS+=("$t")
done
for t in "${DASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -cP '\x{2014}|\x{2013}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      DASH_OK=0
    elif [ "${hits:-0}" -gt 0 ]; then
      echo "    FORBIDDEN dash ($hits line(s)) in: $t"
      DASH_OK=0
    fi
  else
    echo "    SKIPPED (not present): $t"
  fi
done
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 381 dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 381 dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 381: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
