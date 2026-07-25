#!/usr/bin/env bash
# Phase 232.1 verification aggregator -- the single PASS/FAIL gate for the
# room-graph density read. Plan 01 lands the read-only room.db door
# (openRoomDbReadOnlyForCaller, D-04 corrected) and the room-graph-density
# doctor registry module (D-01/D-02/D-03/D-05/D-06/D-08); Plan 02 adds its own
# tests/test-232.1-*.cjs file.
#
# This harness GLOB-DISCOVERS every tests/test-232.1-*.cjs file and runs it, so
# downstream plans add coverage WITHOUT editing this file. The glob token
# test-232.1-*.cjs does NOT collide with Phase 232's test-232-*.cjs: the
# separator after 232 differs. Every leg is fully hermetic and makes ZERO
# network reach: each doctor spawn sets MINDRIAN_ROOMS_HOME and HOME to scratch
# dirs, and every room.db it measures is created under mkdtemp. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

shopt -s nullglob
found=0
for t in tests/test-232.1-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-232.1-*.cjs files discovered"
  exit 1
fi

echo "======================================"
echo "Phase 232.1: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
