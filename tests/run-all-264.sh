#!/usr/bin/env bash
# Phase 264 verification aggregator (R2/R5/C-01 and the wave-2/3 requirements
# this file also gates for later plans in the same phase).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. R2: data/roadmap-type-chains.json maps six roadmap types to
#      framework-name chains that resolve, through the resolver and only the
#      resolver, to a runnable command chain with zero required-null steps
#      (tests/test-264-roadmap-type-chains-drift.cjs).
#   2. R3 (salient governance): the neutral/adversarial critic passes only
#      recognized, well-formed reverse-salient findings and rejects malformed
#      or self-referential ones (tests/test-264-salient-critic.cjs).
#   3. R4 (roadmap-type sensor): the sensor classifies a navigator's text into
#      one of the six roadmap-type slugs and emits the frozen evidence keys
#      (tests/test-264-roadmap-type-sensor.cjs).
#   4. Flagship / B3 (RALPH bounded retry re-proof): this phase's own flagship
#      suite re-proves the Phase 201 bounded-retry contract, and a dedicated
#      frozen-B3 suite pins Phase 166's no-convergence-stop contract so a
#      violation surfaces on wave 1, not at phase close
#      (tests/test-264-flagship-ralph.cjs, tests/test-264-b3-frozen.cjs).
#   5. R5 (sensor-to-chain resolve, end to end) + the two constitutional gates
#      every later plan in this phase depends on: the run-all-166.sh
#      regression passthrough and the chain-executor.cjs zero-diff arm
#      (tests/test-264-sensor-to-chain-resolve.cjs, plus the two gates below).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-259.sh). This
# harness globs every tests/test-264-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-264-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   tests/test-264-roadmap-type-chains-drift.cjs
#   tests/test-264-salient-critic.cjs
#   tests/test-264-roadmap-type-sensor.cjs
#   tests/test-264-flagship-ralph.cjs
#   tests/test-264-b3-frozen.cjs
#   tests/test-264-sensor-to-chain-resolve.cjs
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_264_ALLOW_MISSING=1 is set (waves 1 and 2 run with it set; the
# phase's final gate, plan 264-05, runs without it -- that is what proves
# all eleven files actually exist).
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_264_PREFIX=tests/test-264-nonexistent- bash
# tests/run-all-264.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_264_PREFIX:-tests/test-264-}"

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
# DISCOVERY: glob every tests/test-264-* file. DIVERGENCE FROM THE DONOR
# (run-all-259.sh), deliberate (RESEARCH F-19 / A6): bare `node "$t"`, NOT
# `node --test "$t"` -- every suite this phase writes is a plain script that
# throws or calls process.exit(1), not a node:test file. Do not "fix" this
# back toward the donor.
# ---------------------------------------------------------------------------
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
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
# EXPLICIT GATE LINES: pre-existing, always-present files, listed explicitly
# rather than relying on the glob (they carry no test-264- prefix).
# ---------------------------------------------------------------------------
run "201 bounded-retry (ralph_verify contract)"  node tests/test-201-bounded-retry.cjs
run "245 priority completeness (3-array lockstep)" node tests/test-245-priority-complete.cjs
run "connector registry born-wired --check"      node scripts/build-connector-registry.cjs --check
run "sensors routing fence (Phase 144)"          node tests/test-sensors-routing-fence.cjs
run "sensors Canon Part 8 sweep"                 node tests/test-sensors-part8-sweep.cjs

# ---------------------------------------------------------------------------
# REGRESSION PASSTHROUGH (SPEC R5, pattern from run-all-158.sh:187-188): this
# suite is green at 23/23 in about 3 seconds as of the phase base commit; a
# red result here means this phase broke the Phase 166 contract.
# ---------------------------------------------------------------------------
run "frozen-166 passthrough (B3 / Canon Part 3 contract)" bash "$ROOT/tests/run-all-166.sh"

# ---------------------------------------------------------------------------
# CHAIN-EXECUTOR ZERO-DIFF ARM (SPEC R5 acceptance, verbatim: "git diff for
# this phase touches zero lines inside lib/core/chain-executor.cjs's
# gate/stop-condition functions"). If the base commit is unreachable
# (shallow clone or a rewritten history), print a loud SKIPPED line and
# increment SKIP, never PASS -- a silent skip is forbidden.
# ---------------------------------------------------------------------------
PHASE_264_BASE_SHA="c7c33eea449f6f227c4cfbb86f220acaac9b5ab8"
echo "--- chain-executor.cjs zero-diff arm (base $PHASE_264_BASE_SHA) ---"
if git cat-file -e "$PHASE_264_BASE_SHA^{commit}" 2>/dev/null; then
  if git diff --quiet "$PHASE_264_BASE_SHA" -- lib/core/chain-executor.cjs; then
    echo ">>> chain-executor.cjs zero-diff arm: PASSED"; PASS=$((PASS+1))
  else
    echo "    offending diff:"
    git diff --stat "$PHASE_264_BASE_SHA" -- lib/core/chain-executor.cjs
    echo ">>> chain-executor.cjs zero-diff arm: FAILED"; FAIL=$((FAIL+1))
  fi
else
  echo "    SKIPPED (base commit unreachable)"
  echo ">>> chain-executor.cjs zero-diff arm: SKIPPED"; SKIP=$((SKIP+1))
fi
echo ""

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (C-01): clone the donor's fence at run-all-259.sh:96-131
# including the rc >= 2 SCAN BROKE arm (a broken grep -P must FAIL, never
# silently pass). DIVERGENCE FROM THE DONOR, deliberate: the donor prints
# "(skipped, not yet created)" for a missing target and moves on, which
# would let a typo'd path skip forever. This phase counts missing targets
# into EMDASH_MISSING and FAILS the fence when EMDASH_MISSING > 0, UNLESS
# TEST_264_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 264 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "data/roadmap-type-chains.json"
  "lib/core/salient-governance.cjs"
  "lib/core/sensors/sensor-roadmap-type.cjs"
  "lib/core/insight-sensors.cjs"
  "lib/core/sensors/sensor-priority.cjs"
  "tests/test-264-roadmap-type-chains-drift.cjs"
  "tests/test-264-salient-critic.cjs"
  "tests/test-264-roadmap-type-sensor.cjs"
  "tests/test-264-flagship-ralph.cjs"
  "tests/test-264-b3-frozen.cjs"
  "tests/test-264-sensor-to-chain-resolve.cjs"
  "tests/run-all-264.sh"
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_264_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_264_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 264 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 264 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 264: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
