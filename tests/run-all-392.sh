#!/usr/bin/env bash
# Phase 392 verification aggregator: the single PASS/FAIL/SKIP gate for the
# "Part 8 problem-shape packet: measure, close the six bypasses, ship the
# shape contract" cluster.
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This runner globs every tests/test-392-*
# file (both .cjs and .sh) and runs it. Adding a tests/test-392-* file needs NO
# edit to this runner. There is no hand-maintained execution list below,
# deliberately: a list is a second place to forget something.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A runner that
# discovers nothing must FAIL, not print green.
#
# run_may_skip: an environment self-skip (exit 0 plus a line that starts with
# SKIP) is tallied as SKIP, never as a pass it did not earn. Plan 392-13: the
# .cjs loop runs through run_may_skip too (the acceptance Jev leg
# tests/test-392-acceptance-jev.cjs self-skips its live arm with a SKIP line;
# test-392-vocabulary-drift prints one when the Theo tree is unreadable).
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_392_PREFIX=tests/test-392-nonexistent- bash
# tests/run-all-392.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_392_PREFIX:-tests/test-392-}"

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
  run_may_skip "$(basename "$t")" node "$t"
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

echo "======================================"
echo "Phase 392: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
