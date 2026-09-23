#!/usr/bin/env bash
# Phase 356 (chain-executor irreversibility ledger, Jev Noul scored at dev
# time, shipped as data) verification aggregator.
#
# Modeled on tests/run-all-354.sh (the run/run_if/counter shape, the guarded
# per-planned-test-file idiom, the targeted em-dash guard).
#
# IMPORTANT: this aggregator is written ONCE, here, in 356-01. NO LATER PLAN
# in this phase edits it. A later plan adds its own test file
# (tests/test-356-*.cjs); the run_if legs below pick up a landed file
# automatically because each leg already names its guard file.
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED (ENV GAP), never reported as PASSED
# anything else -> FAILED
#
# House rule: hyphens only, no em-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0

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

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# --- Guarded legs, one run_if per planned test file, wave order --------------
run_if "356: shared Jev client (R356-08)"            tests/test-356-jev-client.cjs      node tests/test-356-jev-client.cjs
run_if "356: egress guard (R356-07)"                 tests/test-356-egress.cjs          node tests/test-356-egress.cjs
run_if "356: vendor tripwires (R356-05 d)"            tests/test-356-tripwires.cjs       node tests/test-356-tripwires.cjs
run_if "356: Larry post-gate contract (D-12)"         tests/test-356-larry-contract.cjs  node tests/test-356-larry-contract.cjs
run_if "356: runtime add-only integration (R356-05, R356-06)" tests/test-356-runtime.cjs node tests/test-356-runtime.cjs
run_if "356: label sheet (R356-02, D-04, D-16)"       tests/test-356-label-sheet.cjs     node tests/test-356-label-sheet.cjs
run_if "356: policy (R356-01)"                        tests/test-356-policy.cjs          node tests/test-356-policy.cjs
run_if "356: ledger build (R356-03, R356-04, D-14, D-15)" tests/test-356-ledger-build.cjs node tests/test-356-ledger-build.cjs
run_if "356: check mode (R356-06)"                    tests/test-356-check.cjs           node tests/test-356-check.cjs
run_if "356: answer key (R356-02)"                    tests/test-356-answer-key.cjs      node tests/test-356-answer-key.cjs

# --- Existing-suite legs (plain run, the files already exist) ---------------
run "356: existing 264 frozen pins"                   node tests/test-264-b3-frozen.cjs
run "356: existing 353 tripwires"                     node tests/test-353-tripwires.cjs
run "356: existing larry handoff seam"                node tests/test-larry-handoff-seam.cjs
run "356: existing chain-executor gate"               node tests/test-chain-executor-gate.cjs
run "356: existing chain-executor loop"               node tests/test-chain-executor-loop.cjs
run "356: existing chain-executor verdict"            node tests/test-chain-executor-verdict.cjs
run "356: existing chain-executor fable-mode"         node tests/test-chain-executor-fable-mode.cjs
run "356: existing chain-executor part8-leak"         node tests/test-chain-executor-part8-leak.cjs

# --- Ledger-absent legs (SPEC R5 c) ------------------------------------------
# Each of these six suites must stay green with MINDRIAN_IRREVERSIBILITY_LEDGER
# pointed at a missing file (degrade silently to pre-356 behavior).
run "356: ledger absent: test-larry-handoff-seam.cjs"        env MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356-no-ledger.json node tests/test-larry-handoff-seam.cjs
run "356: ledger absent: test-chain-executor-gate.cjs"       env MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356-no-ledger.json node tests/test-chain-executor-gate.cjs
run "356: ledger absent: test-chain-executor-loop.cjs"       env MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356-no-ledger.json node tests/test-chain-executor-loop.cjs
run "356: ledger absent: test-chain-executor-verdict.cjs"    env MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356-no-ledger.json node tests/test-chain-executor-verdict.cjs
run "356: ledger absent: test-chain-executor-fable-mode.cjs" env MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356-no-ledger.json node tests/test-chain-executor-fable-mode.cjs
run "356: ledger absent: test-chain-executor-part8-leak.cjs" env MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356-no-ledger.json node tests/test-chain-executor-part8-leak.cjs

# --- Em-dash guard (always) --------------------------------------------------
# The non-test files Phase 356 plans modify directly, named explicitly; a
# missing file is skipped, never an error. Plus a targeted glob of landed
# tests/test-356-*.cjs, tests/fixtures/356-*, and the 356 phase-dir docs.

echo "--- 356: em-dash guard ---"
EMDASH_HIT=0
PHASE_356_SURFACES=(
  "scripts/jev-devtime-client.cjs"
  "scripts/build-command-irreversibility-ledger.cjs"
  "scripts/irreversibility-answer-key.cjs"
  "scripts/build-section-command-ledger.cjs"
  "lib/core/irreversibility-ledger.cjs"
  "lib/core/chain-executor.cjs"
  "lib/workflow/command-resolver.cjs"
  "data/jev-policies/command-irreversibility.json"
  "data/jev-labels/command-irreversibility.json"
  "data/command-irreversibility-ledger.json"
  "data/ROOM.md"
  "tests/test-264-b3-frozen.cjs"
  "tests/test-353-tripwires.cjs"
)
EMDASH_FILES=("${PHASE_356_SURFACES[@]}" "tests/run-all-356.sh" "tests/fixtures/356-no-network-preload.cjs")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-356-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests/fixtures -maxdepth 1 -name '356-*' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at- -maxdepth 1 \( -name '356-*.md' -o -name '356-*.json' \) -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 356: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 356: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
exit $(( FAIL > 0 ? 1 : 0 ))
