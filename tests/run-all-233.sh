#!/usr/bin/env bash
# Phase 233 verification aggregator -- the single PASS/FAIL gate for the
# graph-derive drain residual (SEED-037 / RCA items 4c + 4d).
#
# Plan 01 lands the graph-derive-health doctor class (detectRoomHealth + the
# --heal-room re-enqueue) and the cadence:once graph-derive-heal-retrofit that
# repairs already-damaged rooms on update.
#
# This harness GLOB-DISCOVERS every tests/test-233-*.cjs file and runs it, so
# downstream plans add coverage WITHOUT editing this file. It ALSO runs the two
# EXISTING generic doctor gates unmodified, because the two new registry entries
# must satisfy the same contract every other doctor class already does: the
# declaration-completeness gate (check/fix export parity, explicit
# fix_supported, non-empty detail) and the doc-vs-code parity gate (every parsed
# flag documented, every documented flag parsed). Those two are what stop a new
# class from shipping with a doc promise it cannot keep -- the exact rot that
# produced this phase's own trigger bug.
#
# Every leg is fully hermetic and makes ZERO network reach: each doctor spawn
# sets MINDRIAN_ROOMS_HOME and HOME to scratch dirs, every room.db is created
# under mkdtemp, and the SessionStart contributor is driven through an injected
# report stub rather than a real subprocess. No em-dashes.

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
for t in tests/test-233-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ "$found" -eq 0 ]; then
  echo "!!! no tests/test-233-*.cjs files discovered"
  exit 1
fi

# The two EXISTING generic doctor gates, run unmodified against the new entries.
run "test-doctor-module-contract-parity.cjs" node tests/test-doctor-module-contract-parity.cjs
run "test-doctor-doc-parity.cjs" node tests/test-doctor-doc-parity.cjs

echo "======================================"
echo "Phase 233: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
