#!/usr/bin/env bash
# Phase 345 (the strategy node, graph-engineering learning 3b, blind upward
# movement) verification aggregator.
#
# STRAT ids each leg gates:
#   test-345-rung-mapping.cjs        STRAT-03
#   test-345-goal-record.cjs         STRAT-01, STRAT-02
#   test-345-cadence.cjs             STRAT-04, STRAT-09
#   test-345-cooldown.cjs            STRAT-05
#   test-345-strategy-sensor.cjs     STRAT-06
#   test-345-part8.cjs               STRAT-06 (Part 8 leg)
#   test-345-lockstep.cjs            STRAT-07
#   test-345-producer-fires.cjs      STRAT-08
#   test-345-climb.cjs               STRAT-10
#   test-345-gate-anchor.cjs         STRAT-12
#   test-345-gate-ratify.cjs         STRAT-13
#   test-345-goal-version-stamp.cjs  STRAT-14
#   test-345-doctrine.cjs            STRAT-15, STRAT-16
#   Tripwire A (mcp__theo__)         STRAT-11
#
# Modeled on tests/run-all-341.sh (the run/run_if/counter shape) and
# tests/run-all-347.sh (the guarded-leg-per-planned-test-file idiom). bash
# only.
#
# IMPORTANT: this aggregator is written ONCE, here, in 345-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-345-*.cjs); the run_if legs below and the em-dash guard's
# targeted glob both pick up a landed file automatically. If a later plan
# believes it needs a new leg, that is a signal to re-open this file
# deliberately, not to silently patch around it.
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
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
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

# The em-dash guard's file list. Every path this phase's own plans touch
# directly (not the generated registries they lift into). Entries that do
# not exist yet are skipped by the loop below (a plan not yet executed);
# tests/test-345-*.cjs is discovered by a targeted glob, not hand-enumerated
# here, so a landed test file is always covered without editing this array.
PHASE_345_SURFACES=(
  "docs/2026-09-14-PHASE-345-STRATEGY-NODE-DECISIONS.md"
  "lib/hmi/jtbd-state.cjs"
  "lib/core/strategy/rung-vocabulary.cjs"
  "lib/core/strategy/goal-cadence.cjs"
  "lib/core/strategy/strategy-throttle.cjs"
  "lib/core/strategy/taxonomy-climb.cjs"
  "lib/core/strategy/strategy-card.cjs"
  "lib/core/strategy/goal-gate.cjs"
  "lib/core/sensors/sensor-strategy-reach.cjs"
  "lib/core/navigation/goal-anchor.cjs"
  "lib/core/insight-sensors.cjs"
  "lib/core/sensors/sensor-priority.cjs"
  "lib/core/navigation-engine.cjs"
  "lib/mcp/tools/gate.cjs"
  "scripts/intent-classifier.cjs"
  "skills/larry-personality/SKILL.md"
  "tests/run-all-345.sh"
)

# --- Always-green inherited legs --------------------------------------------
# These already exist and already cover any new file under lib/core/sensors/.

run "345: sensors part8 sweep (inherited)"    node tests/test-sensors-part8-sweep.cjs
run "345: sensors routing fence (inherited)"  node tests/test-sensors-routing-fence.cjs
run "345: priority table complete (inherited)" node tests/test-245-priority-complete.cjs
run "345: connector registry check (inherited)" node scripts/build-connector-registry.cjs --check

# --- Guarded legs, one run_if per planned test file (SKIP until it lands) ---

run_if "345: rung mapping (STRAT-03)"           tests/test-345-rung-mapping.cjs        node tests/test-345-rung-mapping.cjs
run_if "345: goal record (STRAT-01/02)"         tests/test-345-goal-record.cjs         node tests/test-345-goal-record.cjs
run_if "345: cadence (STRAT-04/09)"             tests/test-345-cadence.cjs             node tests/test-345-cadence.cjs
run_if "345: cooldown (STRAT-05)"               tests/test-345-cooldown.cjs            node tests/test-345-cooldown.cjs
run_if "345: strategy sensor (STRAT-06)"        tests/test-345-strategy-sensor.cjs     node tests/test-345-strategy-sensor.cjs
run_if "345: part8 (STRAT-06 Part 8 leg)"       tests/test-345-part8.cjs               node tests/test-345-part8.cjs
run_if "345: lockstep (STRAT-07)"               tests/test-345-lockstep.cjs            node tests/test-345-lockstep.cjs
run_if "345: producer fires (STRAT-08)"         tests/test-345-producer-fires.cjs      node tests/test-345-producer-fires.cjs
run_if "345: climb (STRAT-10)"                  tests/test-345-climb.cjs               node tests/test-345-climb.cjs
run_if "345: gate anchor (STRAT-12)"            tests/test-345-gate-anchor.cjs         node tests/test-345-gate-anchor.cjs
run_if "345: gate ratify (STRAT-13)"            tests/test-345-gate-ratify.cjs         node tests/test-345-gate-ratify.cjs
run_if "345: goal version stamp (STRAT-14)"     tests/test-345-goal-version-stamp.cjs  node tests/test-345-goal-version-stamp.cjs
run_if "345: doctrine (STRAT-15/16)"            tests/test-345-doctrine.cjs            node tests/test-345-doctrine.cjs

# --- Tripwire A (STRAT-11): no direct Theo call under lib/ ------------------
# Implemented as grep -rl over the whole lib/ tree so it names every
# offending path, never as a count over a single file (a count invites
# treating a header-prose mention as equivalent to a real call site) and
# never gated on == 0 against an unfiltered grep of a file that carries the
# token only in its own header prose. The scan target is lib/, and this
# script lives under tests/, so the aggregator's own source is out of scope
# by construction.

echo "--- 345: mcp__theo__ tripwire (STRAT-11) ---"
THEO_HITS="$(grep -rl 'mcp__theo__' lib/ 2>/dev/null || true)"
if [ -z "$THEO_HITS" ]; then
  echo ">>> 345: mcp__theo__ tripwire: PASSED"; PASS=$((PASS+1))
else
  echo "offending path(s):"
  echo "$THEO_HITS"
  echo ">>> 345: mcp__theo__ tripwire: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Em-dash guard (always) -------------------------------------------------

echo "--- 345: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_345_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-345-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 345: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 345: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
