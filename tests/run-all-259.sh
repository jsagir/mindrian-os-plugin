#!/usr/bin/env bash
# Phase 259 verification aggregator (TRUST-01, honest 429 handling; TRUST-02,
# void-on-probe-failure).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. A 429 from the Brain retries up to 3 times honoring Retry-After and
#      then reports rate_limited, never BRAIN_UNREACHABLE with zero retries
#      (TRUST-01).
#   2. The refusal rail can name a rate limit honestly instead of coercing it
#      to unreachable (TRUST-01, F-09 Option B).
#   3. A floor run containing any probe-failure row reports VOID with exit
#      code 3 and names every failed row plus its trigger type, never a false
#      MISS or RED (TRUST-02).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-250.sh). This
# harness globs every tests/test-259-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-259-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   259-01  tests/test-259-brain-client-429.cjs
#   259-02  tests/test-259-refusal-rate-limited.cjs
#   259-03  tests/test-259-brain-call-errorkind.cjs
#   259-03  tests/test-259-floor-void.cjs
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'), so this
# runner itself carries no literal em-dash that would trip its own sweep.
# Missing paths are skipped, not failed.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_259_PREFIX=tests/test-259-nonexistent- bash
# tests/run-all-259.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_259_PREFIX:-tests/test-259-}"

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
  run "$(basename "$t")" node --test "$t"
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
# No-em-dash fence: every file this phase touches, swept for U+2014.
# ---------------------------------------------------------------------------
echo "--- 259 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/brain-client.cjs"
  "lib/core/refusal-messaging.cjs"
  "lib/core/doctor/class-m-brain-smoke.cjs"
  "scripts/build-brain-census.cjs"
  "scripts/check-flagship-floor.cjs"
  "tests/helpers/brain-capture-server.cjs"
  "tests/test-259-brain-client-429.cjs"
  "tests/test-259-refusal-rate-limited.cjs"
  "tests/test-259-brain-call-errorkind.cjs"
  "tests/test-259-floor-void.cjs"
  "tests/run-all-259.sh"
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
    echo "    (skipped, not yet created): $t"
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 259 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 259 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 259: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
