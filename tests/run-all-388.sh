#!/usr/bin/env bash
# Phase 388 verification aggregator: the single PASS/FAIL/SKIPPED gate for the
# "ship less: tests and dead weight out of the install" phase.
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This runner globs every tests/test-388-*
# file (.cjs and .sh) and runs it. Adding a tests/test-388-* file needs no edit
# here. There is no hand-maintained list of tests anywhere below.
#
# A test that exits 77 is an environment gap (for example the npm registry is
# unreachable). It is counted as SKIPPED and printed with its reason. It is never
# counted as PASS.
#
# THE found-eq-0 GUARD IS LOAD-BEARING. A runner that discovers nothing must FAIL,
# not print green. TEST_388_PREFIX=tests/test-388-nonexistent- bash tests/run-all-388.sh
# must exit non-zero. Production runs never set it.
#
# Dash fence: every discovered test file and every tests/helpers/*388* file is
# swept for the two forbidden dash characters (em dash and en dash). The pattern
# uses codepoint escapes, so this file holds no literal dash of that kind.
#
# bash only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PREFIX="${TEST_388_PREFIX:-tests/test-388-}"

PASS=0
FAIL=0
SKIP=0

# Run one leg. Exit 0 is PASS, exit 77 is SKIPPED (ENV GAP), anything else is FAIL.
run_leg() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED (exit $rc)"; FAIL=$((FAIL+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

shopt -s nullglob
found=0
FILES=()
for t in "$PREFIX"*.cjs; do
  found=$((found+1)); FILES+=("$t")
  run_leg "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  found=$((found+1)); FILES+=("$t")
  run_leg "$(basename "$t")" bash "$t"
done
for h in tests/helpers/*388*; do FILES+=("$h"); done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""

echo "--- 388 dash fence ---"
DASH_OK=1
for f in "${FILES[@]}" "tests/run-all-388.sh"; do
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '[\x{2013}\x{2014}]' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $f"
      DASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN dash character in: $f"
      DASH_OK=0
    fi
  fi
done
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 388 dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 388 dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 388: PASS=$PASS FAIL=$FAIL SKIPPED=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
