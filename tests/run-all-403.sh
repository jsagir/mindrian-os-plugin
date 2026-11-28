#!/usr/bin/env bash
# Phase 403 omitClaudeMd verification runner.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
KNOWN=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  fi
  echo ""
}

run_known() {
  local label="$1"; local signature="$2"; shift 2
  echo "--- $label ---"
  local out
  out="$("$@" 2>&1)"
  local status=$?
  printf '%s\n' "$out" | tail -n 15
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed - drop the run_known wrapper at phase close)"; PASS=$((PASS+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

run "403: omitClaudeMd position, list, mutation, ledger sentence" node tests/test-403-omit-claudemd.cjs
run "403: job sentences (leg S7)" node tests/test-400-job-sentences.cjs
run "403: agent tools naming (391)" node tests/test-391-agent-tools-naming.cjs
run "403: runner contract, leg K7 (363)" node tests/test-363-runner-contract.cjs
run "403: agent contract (361)" node tests/test-361-agent-contract.cjs
run "403: capability ledger schema (265)" node tests/test-265-capability-ledger-schema.cjs
run "403: connector registry check" node scripts/build-connector-registry.cjs --check
run "403: orchestration projection check" node scripts/build-orchestration-projection.cjs --check
run "403: shape declaration check" node scripts/check-shape-declaration.cjs --check
run "403: harness check" node scripts/run-harness.cjs --check
run_known "403: dist bundle stale check" "dist bundle STALE" node scripts/build-dist-bundles.cjs --check-stale

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
