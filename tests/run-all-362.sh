#!/usr/bin/env bash
# Phase 362 (Card gate: text-dependent relevance false block, the R-C
# follow-on from Phase 357) verification aggregator: the standing gate.
#
# Modeled on tests/run-all-357.sh (run/run_if/counter shape, exit 77 =
# SKIPPED, the targeted em-dash guard loop, final exit).
#
# WRITTEN ONCE, HERE, IN 362-03. Every leg is guarded on its own file, so a
# missing file reports SKIPPED, never PASSED. On the residual branch
# (362-SIGNALS.md `SIGNAL: NONE`) the disposition mutation leg exits 77 and
# reports SKIPPED: there is no signal to revert.
#
# The R-J pre-existing reds (tests/test-card-fire-relevance-gate.cjs and
# tests/test-ga4-card-fire-e2e-179.cjs) are deliberately NOT legs here; their
# counts are compared with the PRE362 baseline in 362-SIGNALS.md at close.
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED, never reported as PASSED
# anything else -> FAILED
#
# House rule: hyphens only, no em-dashes, no en-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PD=".planning/phases/362-card-gate-text-dependent-relevance-false-block-r-c-follow-on"

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
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
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

# --- 362 legs -------------------------------------------------------------------
run_if "362: disposition (CARD362-04, CARD362-05)" tests/test-362-disposition.cjs node tests/test-362-disposition.cjs
run_if "362: mutation, reverting the signal reproduces the false block (CARD362-04)" tests/test-362-disposition.cjs node tests/test-362-disposition.cjs --mutation
run "362: standing replay bar, both surfaces (CARD362-05)" env -u TYPESAFE_API_KEY node scripts/replay-card-fire.cjs --surface both --baseline compare
run_if "362: measurement reproducible (CARD362-03)" scripts/measure-relevance-signals-362.cjs bash -c '
  sig="$(head -1 "'"$PD"'/362-SIGNALS.md" 2>/dev/null)"
  got="$(env -u TYPESAFE_API_KEY node scripts/measure-relevance-signals-362.cjs --json 2>/dev/null | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{process.stdout.write(JSON.parse(s).verdict)}catch(e){process.stdout.write(\"PARSE-ERROR\")}})")"
  echo "SIGNALS line 1: $sig"; echo "measured:       $got"
  [ -n "$sig" ] && [ "$sig" = "$got" ]
'

# --- 357 legs (the 357 bar this phase must keep) ---------------------------------
run_if "357: replay harness and parity" tests/test-357-replay.cjs node tests/test-357-replay.cjs
run_if "357: mutation, reverted fix fails" tests/test-357-replay.cjs node tests/test-357-replay.cjs --mutation
run_if "357: dogfood strict" tests/test-357-corpus-loader.cjs node tests/test-357-corpus-loader.cjs --dogfood-strict
run_if "357: F.1 dial chrome strip" tests/test-357-f1-chrome.cjs node tests/test-357-f1-chrome.cjs
run_if "357: harness source class" tests/test-357-harness-source.cjs node tests/test-357-harness-source.cjs
run_if "357: shared tripwires (D-11)" tests/test-353-tripwires.cjs node tests/test-353-tripwires.cjs

# --- 359 legs (SKIPPED until each 359 file lands; D-01 AMENDED) -------------------
run_if "359: inertness (FORK359-05)" tests/test-359-inertness.cjs node tests/test-359-inertness.cjs
run_if "359: replay" tests/test-359-replay.cjs node tests/test-359-replay.cjs
run_if "359: replay mutation" tests/test-359-replay.cjs node tests/test-359-replay.cjs --mutation
run_if "359: declared arm" tests/test-359-declared-arm.cjs node tests/test-359-declared-arm.cjs
run_if "359: A13 tripwires" tests/test-359-declared-arm.cjs node tests/test-359-declared-arm.cjs --tripwires
run_if "359: MCP declared" tests/test-359-mcp-declared.cjs node tests/test-359-mcp-declared.cjs

# --- Card-gate regression legs ---------------------------------------------------
run_if "regression: 209 primary sidechannel" tests/test-209-primary-sidechannel.cjs node tests/test-209-primary-sidechannel.cjs
run_if "regression: 238 card-fire corpus" tests/test-238-card-fire-corpus.cjs node tests/test-238-card-fire-corpus.cjs
run_if "regression: 198 stop-gate retry ceiling" tests/test-198-stop-gate-retry-ceiling.test.cjs node tests/test-198-stop-gate-retry-ceiling.test.cjs

# --- Vendor and dev-only legs ----------------------------------------------------
run "362: no api.typesafe.ai under lib/ or hooks/" bash -c '! grep -rn "api.typesafe.ai" lib/ hooks/'
run "362: measurement script never referenced from lib/ or hooks/" bash -c '! grep -rn --include="*.cjs" --include="*.js" --include="*.json" --include="*.sh" "measure-relevance-signals-362" lib/ hooks/'

# --- CIRS plan declarations --------------------------------------------------------
shopt -s nullglob
PLANS=("$PD"/362-*-PLAN.md)
shopt -u nullglob
if [ "${#PLANS[@]}" -eq 0 ]; then
  echo "--- 362: CIRS plan declarations ---"; echo ">>> 362: CIRS plan declarations: SKIPPED (no 362 plans)"; SKIP=$((SKIP+1)); echo ""
else
  run "362: CIRS plan declarations" node scripts/check-cirs-declaration.cjs --check "${PLANS[@]}"
fi

# --- Em-dash and en-dash guard (always) ----------------------------------------------
echo "--- 362: em-dash and en-dash guard ---"
DASH_HIT=0
DASH_FILES=(
  "tests/run-all-362.sh"
  "scripts/measure-relevance-signals-362.cjs"
  "tests/fixtures/card-fire-replay/pre-362.json"
  "tests/fixtures/card-fire-replay/dogfood.json"
  "lib/core/gate-relevance.cjs"
  "scripts/check-card-fire.cjs"
  "lib/hmi/turn-text.cjs"
  "tests/test-359-inertness.cjs"
  "tests/test-357-f1-chrome.cjs"
)
while IFS= read -r -d '' f; do
  DASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-362-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  DASH_FILES+=("$f")
done < <(find "$PD" -maxdepth 1 -name '362-*.md' -print0 2>/dev/null)
for f in "${DASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq -e "$(printf '\xe2\x80\x94')" -e "$(printf '\xe2\x80\x93')" "$f" 2>/dev/null; then
    echo "em-dash or en-dash found in $f"
    DASH_HIT=1
  fi
done
if [ "$DASH_HIT" -eq 0 ]; then
  echo ">>> 362: em-dash and en-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 362: em-dash and en-dash guard: FAILED"; FAIL=$((FAIL+1))
fi

echo "======================================"
echo "Phase 362: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
