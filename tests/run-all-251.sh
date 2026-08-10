#!/usr/bin/env bash
# Phase 251 Plan 01 verification aggregator (CACHE-02, the hygiene pass on
# the proven-cache-safe UserPromptSubmit rail).
#
# WHAT THIS PLAN HAS TO PROVE, in one sentence each:
#   1. Two consecutive byte-identical NAVIGATION DECISION blocks suppress to
#      a one-line marker, a changed decision always re-emits in full, the
#      Stop-gate sidechannel never records a suppressed turn, a corrupt or
#      missing hash sidecar fails OPEN, a kill switch exists, and
#      post-compact resets the sidecar so the first post-compact turn
#      re-emits in full.
#   2. The FIRE-IF-FORK imperative moves to SessionStart additionalContext
#      (re-seeded on startup/clear/compact) and is no longer per-turn; the
#      byte-frozen marker stays per-turn; dispatcher + emitBindingGate
#      surfaces are byte-untouched.
#   3. The [AskUserQuestion payload: ...] line stops repeating the verb
#      labels already printed in the option rows; the persisted
#      f1_closer_payload (next-turn consumer) is untouched.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-250.sh). This
# harness globs every tests/test-251-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-251-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   251-01  tests/test-251-suppress-unchanged.cjs
#   251-01  tests/test-251-skeleton-split.cjs
#   251-01  tests/test-251-payload-dedup.cjs
#   251-02  tests/test-251-block-budget.cjs
#   251-02  tests/test-251-hitrate-report.cjs
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
# without editing this file: TEST_251_PREFIX=tests/test-251-nonexistent- bash
# tests/run-all-251.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_251_PREFIX:-tests/test-251-}"

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
echo "--- 251 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "scripts/intent-classifier.cjs"
  "scripts/session-start"
  "scripts/post-compact"
  "tests/test-251-suppress-unchanged.cjs"
  "tests/test-251-skeleton-split.cjs"
  "tests/test-251-payload-dedup.cjs"
  "tests/test-251-block-budget.cjs"
  "tests/test-251-hitrate-report.cjs"
  "tests/test-209-engine-arm-contract.cjs"
  "tests/run-all-251.sh"
  "docs/HOOK-INJECTION-CACHE-DOCTRINE.md"
  "scripts/cache-hitrate-report.cjs"
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
  echo ">>> 251 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 251 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 251 Plan 01: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
