#!/usr/bin/env bash
# Phase 176 verification aggregator -- the single PASS/FAIL gate for the
# Scenario Analysis canon wiring. Mirrors tests/run-all-172.sh.
#
# Composes:
#   (a) BOTH coverage tripwires (registry/projection not stale + gap=0 on both ledgers):
#         node scripts/build-connector-registry.cjs --check
#         node scripts/build-orchestration-projection.cjs --check
#   (b) the Phase 176 chain test:
#         test-176-scenario-chain.cjs  -> the 3 curated edges + recommender candidates
#   (c) the CARRIED frozen-bank drift fences (176 is ADDITIVE -- no frozen-set move):
#         test-reach-ids-drift.cjs     -> frozen 6 reach_ids (no 7th)
#         test-posture-ids-drift.cjs   -> frozen 3 postures (no 4th)
#
# bash only. No emoji. No em-dashes.

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

run "connector-registry --check (gap=0)"      node scripts/build-connector-registry.cjs --check
run "orchestration-projection --check (gap=0)" node scripts/build-orchestration-projection.cjs --check
run "test-176-scenario-chain"                  node tests/test-176-scenario-chain.cjs
[ -f tests/test-reach-ids-drift.cjs ]   && run "reach-ids-drift (frozen 6)"   node tests/test-reach-ids-drift.cjs
[ -f tests/test-posture-ids-drift.cjs ] && run "posture-ids-drift (frozen 3)" node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (176 verification)"
echo "  Passed: $PASS   Failed: $FAIL"
echo "========================================"
[ "$FAIL" -eq 0 ]
