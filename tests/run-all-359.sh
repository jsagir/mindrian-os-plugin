#!/usr/bin/env bash
# Phase 359 (Missed-fork detection: Larry poses a genuine decision in prose)
# verification aggregator, the 359 standing gate.
#
# Modeled on tests/run-all-357.sh (run/run_if counter shape, exit 77 = SKIPPED
# ENV GAP, the em-dash guard loop, final exit) and tests/run-all-238.sh.
#
# WRITTEN ONCE, HERE, IN 359-08. Hyphens only. A leg SKIPs until its file
# lands (the prose-budget leg lands in plan 09). If a later plan needs a new
# leg, re-open this file deliberately.
#
# The known pre-existing red suites recorded by 357 (R-J) are NOT added here:
# tests/test-card-fire-relevance-gate.cjs and tests/test-ga4-card-fire-e2e-179.cjs.
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED (ENV GAP), never reported as PASSED
# anything else -> FAILED
#
# House rule: hyphens only, no em-dashes, no en-dashes, no emoji.

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

# --- 359 legs ----------------------------------------------------------------
run "359: fork declaration parser (FORK359-03)" node tests/test-359-fork-declaration.cjs
run "359: declared arm (FORK359-04)" node tests/test-359-declared-arm.cjs
run "359: R5 tripwires, no free-text fork heuristic (FORK359-05)" node tests/test-359-declared-arm.cjs --tripwires
run "359: MCP declared card (FORK359-07)" node tests/test-359-mcp-declared.cjs
run "359: fork corpus (FORK359-01)" node tests/test-359-corpus.cjs
run "359: inertness on the 357 corpus (FORK359-05)" node tests/test-359-inertness.cjs
run "359: replay metrics and baseline (FORK359-02, FORK359-06, FORK359-07)" node tests/test-359-replay.cjs
run "359: mutation, arm removed and free-text regex fail (FORK359-10)" node tests/test-359-replay.cjs --mutation
run "359: dev-only tripwire (FORK359-10)" node tests/test-359-devonly-tripwire.cjs
run "359: moonshot scorer (N-3)" node tests/test-359-moonshot-scorer.cjs
run "359: forward harness offline (FORK359-09)" node tests/test-359-forward-harness.cjs
run_if "359: prose budget and declaration drift (FORK359-08)" tests/test-359-prose-budget.cjs node tests/test-359-prose-budget.cjs

# --- Regression legs (plain run) ---------------------------------------------
run_if "regression: 357 replay harness" tests/test-357-replay.cjs node tests/test-357-replay.cjs
run_if "regression: 357 corpus loader" tests/test-357-corpus-loader.cjs node tests/test-357-corpus-loader.cjs
run_if "regression: 357 labeler refusal" tests/test-357-labeler-refusal.cjs node tests/test-357-labeler-refusal.cjs
run_if "regression: 198 stop-gate retry ceiling" tests/test-198-stop-gate-retry-ceiling.test.cjs node tests/test-198-stop-gate-retry-ceiling.test.cjs
run_if "regression: 209 primary sidechannel" tests/test-209-primary-sidechannel.cjs node tests/test-209-primary-sidechannel.cjs
run_if "regression: 238 card-fire corpus" tests/test-238-card-fire-corpus.cjs node tests/test-238-card-fire-corpus.cjs
run_if "regression: larry voice mark 182" tests/test-larry-voice-mark-182.cjs node tests/test-larry-voice-mark-182.cjs
run_if "regression: 205 voice mark hybrid" tests/test-205-voice-mark-hybrid.cjs node tests/test-205-voice-mark-hybrid.cjs
run_if "regression: larry handoff seam" tests/test-larry-handoff-seam.cjs node tests/test-larry-handoff-seam.cjs
run_if "regression: gate-native fire w1" tests/test-gate-native-fire-w1.cjs node tests/test-gate-native-fire-w1.cjs
run_if "regression: 251 skeleton split" tests/test-251-skeleton-split.cjs node tests/test-251-skeleton-split.cjs
run_if "regression: mcp no-instructions" lib/mcp/no-instructions.test.cjs node lib/mcp/no-instructions.test.cjs

# --- Vendor gate leg -----------------------------------------------------------
run "359: no api.typesafe.ai under lib/ or hooks/" bash -c '! grep -rn "api.typesafe.ai" lib/ hooks/'

# --- Em-dash and en-dash guard (always) ---------------------------------------
echo "--- 359: em-dash and en-dash guard ---"
DASH_HIT=0
PHASE_359_SURFACES=(
  "lib/core/fork-declaration.cjs"
  "scripts/check-card-fire.cjs"
  "lib/mcp/stop-gate-handler.cjs"
  "lib/core/gate-relevance.cjs"
  "scripts/replay-card-fire.cjs"
  "scripts/card-fire-replay-corpus.cjs"
  "scripts/label-card-fire-replay.cjs"
  "scripts/score-moonshots-359.cjs"
  "scripts/forward-fork-scenarios-359.cjs"
  "scripts/fork359-permission-probe.cjs"
  "data/jev-policies/fork359-moonshot.json"
  "agents/larry-extended.md"
  "skills/larry-personality/SKILL.md"
  "scripts/session-start"
  "lib/mcp/runtime-instructions.cjs"
  "tests/run-all-238.sh"
  "tests/run-all-359.sh"
)
DASH_FILES=("${PHASE_359_SURFACES[@]}")
while IFS= read -r -d '' f; do
  DASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-359-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  DASH_FILES+=("$f")
done < <(find tests/fixtures -maxdepth 2 -name '*359*.json' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  DASH_FILES+=("$f")
done < <(find .planning/phases/359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros -maxdepth 1 -name '359-*.md' -print0 2>/dev/null)
for f in "${DASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')\|$(printf '\xe2\x80\x93')" "$f" 2>/dev/null; then
    echo "em-dash or en-dash found in $f"
    DASH_HIT=1
  fi
done
if [ "$DASH_HIT" -eq 0 ]; then
  echo ">>> 359: em-dash and en-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 359: em-dash and en-dash guard: FAILED"; FAIL=$((FAIL+1))
fi

echo "======================================"
echo "Phase 359: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
