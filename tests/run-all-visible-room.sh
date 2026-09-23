#!/usr/bin/env bash
# Visible Room verification aggregator -- SEED-006 section 7 runner idiom
# (mirrors tests/run-all-232.sh). GLOB-DISCOVERS every
# tests/test-visible-room-*.cjs file and runs it, so later Wave 0 and Wave 1
# tests drop in without editing this file.

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
for t in tests/test-visible-room-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-visible-room-*.cjs files discovered"
  exit 1
fi

echo "======================================"
echo "Visible Room: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
