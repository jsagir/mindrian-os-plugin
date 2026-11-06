#!/usr/bin/env bash
# Phase 386 verification aggregator: the single PASS/FAIL/SKIP gate for the
# "audit bug fixes, Part 8 egress risks first (B1-B16)" cluster.
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This runner globs every tests/test-386-*
# file (both .cjs and .sh) and runs it. Adding a tests/test-386-* file needs NO
# edit to this runner. There is no hand-maintained execution list below,
# deliberately: a list is a second place to forget something.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A runner that
# discovers nothing must FAIL, not print green.
#
# run_may_skip: an environment self-skip (exit 0 plus a line that starts with
# SKIP) is tallied as SKIP, never as a pass it did not earn.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_386_PREFIX=tests/test-386-nonexistent- bash
# tests/run-all-386.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_386_PREFIX:-tests/test-386-}"

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

echo "======================================"
echo "Phase 386: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
