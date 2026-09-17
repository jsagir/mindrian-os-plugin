#!/usr/bin/env bash
# Phase 353 (ICM Section Ruling System: self-locating room map, JTBD-rooted)
# verification aggregator.
#
# RULE ids each leg gates:
#   test-353-room-map.cjs             RULE-01, RULE-02
#   test-353-self-block.cjs           RULE-02, RULE-03
#   test-353-doctor-room-map.cjs      RULE-04
#   test-353-subroom-birth.cjs        RULE-05, RULE-06, RULE-29
#   test-353-turn-budget.cjs          RULE-07
#   test-353-fleet-report.cjs         RULE-08, RULE-09
#   test-353-section-canon.cjs        Plan 02 (not yet authored)
#   test-353-ledger-shape.cjs         Plan 02 (not yet authored)
#   test-353-ruling-doc.cjs           Plan 02 (not yet authored)
#   test-353-anchor-edge.cjs          Plan 02 (not yet authored)
#   test-353-filing-gate.cjs          Plan 02 (not yet authored)
#   test-353-decide-budget.cjs        Plan 02 (not yet authored)
#   test-353-doctor-section-ruling.cjs Plan 02 (not yet authored)
#   test-353-release-wiring.cjs       Plan 02 (not yet authored)
#   test-353-reach-hitrate.cjs        Plan 03 (not yet authored)
#   test-353-grader-agreement.cjs     Plan 03 (not yet authored)
#   test-353-tripwires.cjs            Plan 03 (not yet authored)
#
# Modeled on tests/run-all-345.sh (the run/run_if/counter shape, the guarded
# per-planned-test-file idiom, the targeted em-dash guard).
#
# IMPORTANT: this aggregator is written ONCE, here, in 353-01. NO LATER PLAN
# in this phase edits it. A later plan adds its own test file
# (tests/test-353-*.cjs); the run_if legs below and the em-dash guard's
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

# The em-dash guard's file list. Every non-test file this phase's plans touch
# directly. tests/test-353-*.cjs is discovered by a targeted glob, not
# hand-enumerated here, and tests/run-all-353.sh itself is unioned in below,
# so a landed test file or this aggregator is always covered without hand
# editing this array.
PHASE_353_SURFACES=(
  "lib/core/room-map.cjs"
  "lib/core/section-registry.cjs"
  "lib/core/room-skeleton-scaffold.cjs"
  "lib/core/frontmatter-schemas.cjs"
  "lib/core/doctor/room-map-module.cjs"
  "data/doctor-modules.json"
  "lib/core/navigation/room-birth.cjs"
  "lib/core/navigation/room-context.cjs"
  "evals/icm/cases/turns.json"
)

# --- Always-green regression legs -------------------------------------------

run "353: bash syntax check"                    bash -n tests/run-all-353.sh
run "353: section schema (inherited, 275)"      node tests/test-275-section-schema.cjs
run "353: connector registry check (inherited)" node scripts/build-connector-registry.cjs --check
run "353: command registry check (inherited)"   node scripts/build-command-registry.cjs --check

# --- Guarded legs, one run_if per planned test file (SKIP until it lands) ---

run_if "353: room map (RULE-01/02)"                tests/test-353-room-map.cjs             node tests/test-353-room-map.cjs
run_if "353: self block (RULE-02/03)"              tests/test-353-self-block.cjs           node tests/test-353-self-block.cjs
run_if "353: doctor room-map (RULE-04)"            tests/test-353-doctor-room-map.cjs      node tests/test-353-doctor-room-map.cjs
run_if "353: subroom birth (RULE-05/06/29)"        tests/test-353-subroom-birth.cjs        node tests/test-353-subroom-birth.cjs
run_if "353: turn budget (RULE-07)"                tests/test-353-turn-budget.cjs          node tests/test-353-turn-budget.cjs
run_if "353: fleet report (RULE-08/09)"            tests/test-353-fleet-report.cjs         node tests/test-353-fleet-report.cjs
run_if "353: section canon (plan 02)"              tests/test-353-section-canon.cjs        node tests/test-353-section-canon.cjs
run_if "353: ledger shape (plan 02)"               tests/test-353-ledger-shape.cjs         node tests/test-353-ledger-shape.cjs
run_if "353: ruling doc (plan 02)"                 tests/test-353-ruling-doc.cjs           node tests/test-353-ruling-doc.cjs
run_if "353: anchor edge (plan 02)"                tests/test-353-anchor-edge.cjs          node tests/test-353-anchor-edge.cjs
run_if "353: filing gate (plan 02)"                tests/test-353-filing-gate.cjs          node tests/test-353-filing-gate.cjs
run_if "353: decide budget (plan 02)"              tests/test-353-decide-budget.cjs        node tests/test-353-decide-budget.cjs
run_if "353: doctor section-ruling (plan 02)"      tests/test-353-doctor-section-ruling.cjs node tests/test-353-doctor-section-ruling.cjs
run_if "353: release wiring (plan 02)"             tests/test-353-release-wiring.cjs       node tests/test-353-release-wiring.cjs
run_if "353: reach hitrate (plan 03)"              tests/test-353-reach-hitrate.cjs        node tests/test-353-reach-hitrate.cjs
run_if "353: grader agreement (plan 03)"           tests/test-353-grader-agreement.cjs     node tests/test-353-grader-agreement.cjs
run_if "353: tripwires (plan 03)"                  tests/test-353-tripwires.cjs            node tests/test-353-tripwires.cjs

# --- Em-dash guard (always) --------------------------------------------------
# Named files (PHASE_353_SURFACES) plus a targeted glob of landed
# tests/test-353-*.cjs plus this aggregator itself; plus a recursive sweep of
# the two directory trees this phase adds (fixtures + evals), since those
# hold many small files no single array entry names.

echo "--- 353: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_353_SURFACES[@]}" "tests/run-all-353.sh")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-353-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ -d tests/fixtures/icm-rooms ]; then
  HITS="$(grep -rl "$(printf '\xe2\x80\x94')" tests/fixtures/icm-rooms 2>/dev/null || true)"
  if [ -n "$HITS" ]; then
    echo "em-dash found in:"
    echo "$HITS"
    EMDASH_HIT=1
  fi
fi
if [ -d evals/icm ]; then
  HITS="$(grep -rl "$(printf '\xe2\x80\x94')" evals/icm 2>/dev/null || true)"
  if [ -n "$HITS" ]; then
    echo "em-dash found in:"
    echo "$HITS"
    EMDASH_HIT=1
  fi
fi
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 353: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 353: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
