#!/usr/bin/env bash
# Phase 243 verification aggregator -- the single PASS/FAIL gate for GLYPH-01
# half 1 (the honest voice glyph, tests/test-243-voice-glyph-honest.cjs) plus
# the two mandatory regression legs.
#
# GLOB-DISCOVERS every tests/test-243-* file (both .cjs and .sh) and runs it,
# so plan 243-02 (tests/test-243-rca-routing.cjs) adds coverage WITHOUT
# editing this harness. Hard-fails when zero tests are discovered -- an
# aggregator that silently exits 0 with nothing to run is the same false-
# success shape this milestone exists to close.
#
# Mandatory regression legs (RESEARCH.md Pitfall 1): run-all-192.sh and
# run-all-210.sh both carry the three assertions Phase 243 inverts (leg 3 of
# test-voice-glyph-advisory.cjs, cases (b)/(c) of
# test-192-statusline-stance-chip.cjs). They live in files named for OTHER
# phases, so a 243-scoped grep alone would never find them; running them here
# as explicit legs is what turns an intended supersession into a provably
# green result instead of a silent regression.
#
# No Part 8 egress sweep leg here (deliberate, not an oversight): every file
# this phase touches is pure local rendering with zero network, so a sweep
# leg would be vacuous, and a self-testing sweep is the only honest form of
# that gate (see tests/run-all-233.sh). Skipping it rather than shipping a
# gate that cannot bite is the honest call.
#
# No em-dashes.

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
for t in tests/test-243-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-243-*.sh; do
  found=1
  run "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-243-* files discovered"
  exit 1
fi

# Mandatory regression legs (RESEARCH.md Pitfall 1): these carry the three
# assertions this phase inverted and MUST stay green.
run "run-all-192.sh (regression)" bash tests/run-all-192.sh
run "run-all-210.sh (regression)" bash tests/run-all-210.sh

echo "======================================"
echo "Phase 243: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
