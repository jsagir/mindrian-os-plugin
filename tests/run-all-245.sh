#!/usr/bin/env bash
# Phase 245 verification aggregator: the single PASS/FAIL/SKIP gate for the
# "close the reach/brain signal loop" cluster (sensor identity + priority
# doctrine, the derivation-queue drain, the Part 8 egress-guard scoping fix,
# verb/reach affinity, the SENS-17 perspective lock, and the signal-nudge
# fusion that consumes all of it).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. Every reach dispatchSensors emits names the sensor that produced it, so
#      a same-reach collision has something real to sort on.
#   2. A sensor cannot ship without a doctrine priority rank; the build fails
#      closed rather than silently degrading to registry file order.
#   3. The rest of the loop (drain, egress scoping, verb affinity, SENS-17,
#      nudge bounds) is wired at BOTH ends, never just declared.
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This harness globs every tests/test-245-*
# file (both .cjs and .sh) and runs it. Adding a tests/test-245-* file
# requires NO edit to this runner. There is no hand-maintained execution list
# anywhere below, deliberately: a list is a second place to forget something.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   245-01  tests/test-245-sensor-id-stamped.cjs
#   245-01  tests/test-245-priority-complete.cjs
#   245-07  tests/test-245-tiebreak-deterministic.cjs
#   245-02  tests/test-245-drain-budget.cjs
#   245-02  tests/test-245-drain-no-silent-loss.cjs
#   245-0x  tests/test-245-trigger-arms.cjs
#   245-0x  tests/test-245-trigger-negative.cjs
#   245-03  tests/test-245-egress-contentless.cjs
#   245-04  tests/test-245-verb-affinity.cjs
#   245-05  tests/test-245-brain-verb-computed.cjs
#   245-06  tests/test-245-sens17-hats.cjs
#   245-06  tests/test-245-sens17-no-double-fire.cjs
#   245-07  tests/test-245-nudge-bound.cjs
#   245-08  tests/test-245-dial-reactivity.cjs
#   245-0x  tests/test-245-brain-verb-not-starved.cjs
#   245-0x  tests/test-245-reward-guard-staged.cjs
#   h5s     tests/test-245-brain-envelope-shape.cjs
#
# The last entry is from quick task 260807-h5s, not from Phase 245 itself. It
# carries the test-245- prefix deliberately so this runner's glob picks it up
# with zero execution edits, exactly as the discovery contract below intends.
#
# That is SEVENTEEN files. The glob is the executor; the list above is the
# reading checklist. A test named above that is missing from disk is NOT
# reported by this runner as a failure, because a file that does not exist
# cannot be globbed. That is the honest limitation of glob discovery and the
# reason the names are written out here. What the runner DOES catch, loudly,
# is the case where NOTHING at all is discovered.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green. A clean summary over an
# empty discovery is the same false-success shape this phase exists to
# close.
#
# run_may_skip is kept even though no .sh test is planned for Plan 01, so a
# later plan that adds one inherits the behavior: an environment self-skip is
# tallied as SKIP, never as a pass it did not earn.
#
# NO-EM-DASH FENCE (an extra runner leg beyond discovery): sweeps every file
# this phase touches for the forbidden U+2014 glyph. The pattern is matched
# via its Unicode codepoint escape (grep -P '\x{2014}') rather than a literal
# em-dash, so this runner itself carries no literal em-dash to trip its own
# sweep. Missing paths (files not yet created by a later plan/task) are
# skipped rather than treated as a failure. Offending paths are printed in
# full, never a bare count, per the false-success class this phase exists to
# close.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_245_PREFIX=tests/test-245-nonexistent- bash
# tests/run-all-245.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_245_PREFIX:-tests/test-245-}"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# A leg that may legitimately self-SKIP on environment. Exit 0 plus a SKIP
# line is tallied as SKIP, not as a pass it did not earn.
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
# No-em-dash fence: every file this phase touches, swept for U+2014. The
# codepoint escape means this runner file itself carries no literal em-dash
# that would otherwise trip its own sweep.
# ---------------------------------------------------------------------------
echo "--- 245 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "tests/test-245-sensor-id-stamped.cjs"
  "tests/test-245-priority-complete.cjs"
  "tests/test-245-tiebreak-deterministic.cjs"
  "tests/test-245-drain-budget.cjs"
  "tests/test-245-drain-no-silent-loss.cjs"
  "tests/test-245-trigger-arms.cjs"
  "tests/test-245-trigger-negative.cjs"
  "tests/test-245-egress-contentless.cjs"
  "tests/test-245-verb-affinity.cjs"
  "tests/test-245-brain-verb-computed.cjs"
  "tests/test-245-sens17-hats.cjs"
  "tests/test-245-sens17-no-double-fire.cjs"
  "tests/test-245-nudge-bound.cjs"
  "tests/test-245-dial-reactivity.cjs"
  "tests/test-245-brain-verb-not-starved.cjs"
  # Quick task 260807-h5s makes these three phase-touched files. This fence list
  # is hand-maintained (unlike the discovery glob above), so they are added here
  # explicitly.
  "tests/test-245-brain-envelope-shape.cjs"
  "lib/core/brain-response-sanitize.cjs"
  "scripts/brain-response-sanitize-hook.cjs"
  "lib/core/sensors/sensor-priority.cjs"
  "lib/core/sensors/sensor-perspective-lock.cjs"
  "lib/core/insight-sensors.cjs"
  "lib/core/brain-derivation-queue.cjs"
  "lib/core/part8-egress-guard.cjs"
  "lib/core/verb-reach-affinity.cjs"
  "lib/core/navigation-engine.cjs"
  "lib/workflow/reach-hedge-ranker.cjs"
  "scripts/build-connector-registry.cjs"
  "scripts/derive-verb-reach-affinity.cjs"
  "scripts/intent-classifier.cjs"
  "tests/run-all-245.sh"
)
# LC_ALL is forced to a UTF-8 locale and the grep exit code is INSPECTED, both
# added by quick task 260807-h5s. Why: `grep -P` refuses to run at all under a
# non-UTF-8 locale ("grep: -P supports only unibyte and UTF-8 locales") and
# exits 2. The previous `|| true` swallowed that exit, left hits empty, and the
# whole fence reported PASSED without ever having scanned a byte. That was
# observed live on Git Bash for Windows, where the default locale is C, so on
# that surface this fence was silently vacuous. A guard that cannot fail is the
# same false-success shape this runner's found-eq-0 guard exists to close, so a
# grep that ERRORS (rc 2 or more) is now a fence FAILURE, not a silent pass.
# rc 0 = a hit, rc 1 = clean, rc >= 2 = the scan itself broke.
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
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 245 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 245 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 245: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
