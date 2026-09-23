#!/usr/bin/env bash
# Phase 357 (Gate-triad replay harness: Jev as dev-time teacher, deterministic
# runtime) verification aggregator.
#
# Modeled on tests/run-all-354.sh (run/run_if/counter shape, exit 77 = SKIPPED
# ENV GAP, the targeted em-dash guard loop, final exit) and tests/run-all-238.sh
# (run_if pattern).
#
# WRITTEN ONCE, HERE, IN 357-01. NO LATER 357 PLAN EDITS THIS FILE. Every 357
# leg is pre-declared below, guarded on the test file (or on
# tests/fixtures/card-fire-replay/baseline.json for the plan-09 bar-gated
# legs), so a leg SKIPs until its file lands -- expected mid-phase, not a
# failure. If a later plan believes it needs a new leg not already listed
# below, that is a signal to re-open this file deliberately, not to silently
# patch around it (D-14).
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

# --- 357 legs, pre-declared once (D-14) --------------------------------------
run_if "357: corpus loader (GATE357-01)" tests/test-357-corpus-loader.cjs node tests/test-357-corpus-loader.cjs
run_if "357: replay harness and parity (GATE357-02, GATE357-06)" tests/test-357-replay.cjs node tests/test-357-replay.cjs
run_if "357: labeler refusal and vendor tripwire (GATE357-03)" tests/test-357-labeler-refusal.cjs node tests/test-357-labeler-refusal.cjs
run_if "357: harness source class (GATE357-04)" tests/test-357-harness-source.cjs node tests/test-357-harness-source.cjs
run_if "357: F.1 dial chrome strip (GATE357-05)" tests/test-357-f1-chrome.cjs node tests/test-357-f1-chrome.cjs
run_if "357: dogfood strict (GATE357-09)" tests/fixtures/card-fire-replay/baseline.json node tests/test-357-corpus-loader.cjs --dogfood-strict
run_if "357: mutation, reverted fix fails (GATE357-08)" tests/fixtures/card-fire-replay/baseline.json node tests/test-357-replay.cjs --mutation
run_if "357: shared tripwires (D-11)" tests/test-353-tripwires.cjs node tests/test-353-tripwires.cjs

# --- Regression legs (plain run; all six measured green at planning time
# under a hermetic env, 357-01-SUMMARY.md). Do NOT add
# tests/test-card-fire-relevance-gate.cjs or tests/test-ga4-card-fire-e2e-179.cjs,
# which carry pre-existing reds per RESEARCH Pitfall 8 / R-J. -------------------
run_if "regression: 209 primary sidechannel" tests/test-209-primary-sidechannel.cjs node tests/test-209-primary-sidechannel.cjs
run_if "regression: 238 card-fire corpus" tests/test-238-card-fire-corpus.cjs node tests/test-238-card-fire-corpus.cjs
run_if "regression: 198 stop-gate retry ceiling" tests/test-198-stop-gate-retry-ceiling.test.cjs node tests/test-198-stop-gate-retry-ceiling.test.cjs
run_if "regression: larry handoff seam" tests/test-larry-handoff-seam.cjs node tests/test-larry-handoff-seam.cjs
run_if "regression: gate-native fire w1" tests/test-gate-native-fire-w1.cjs node tests/test-gate-native-fire-w1.cjs
run_if "regression: larry voice mark 182" tests/test-larry-voice-mark-182.cjs node tests/test-larry-voice-mark-182.cjs

# --- Vendor gate leg -----------------------------------------------------------
run "357: no api.typesafe.ai under lib/ or hooks/" bash -c '! grep -rn "api.typesafe.ai" lib/ hooks/'

# --- Em-dash guard (always) ---------------------------------------------------
echo "--- 357: em-dash guard ---"
EMDASH_HIT=0
PHASE_357_SURFACES=(
  "scripts/card-fire-replay-corpus.cjs"
  "scripts/replay-card-fire.cjs"
  "scripts/label-card-fire-replay.cjs"
  "scripts/extract-dogfood-stop-events.cjs"
  "scripts/jev-devtime-client.cjs"
  "data/jev-policies/card-fire-replay.json"
  "lib/hmi/turn-text.cjs"
  "scripts/check-card-fire.cjs"
  "lib/core/gate-relevance.cjs"
  "agents/larry-extended.md"
  "skills/larry-personality/SKILL.md"
  "tests/test-353-tripwires.cjs"
  "tests/run-all-238.sh"
)
EMDASH_FILES=("${PHASE_357_SURFACES[@]}" "tests/run-all-357.sh")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-357-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests/fixtures/card-fire-replay -maxdepth 1 -name '*.json' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find .planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re -maxdepth 1 -name '357-*.md' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 357: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 357: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi

echo "======================================"
echo "Phase 357: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
