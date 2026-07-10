#!/usr/bin/env bash
# Phase 216 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-user-facing-command cluster (the room-native substrate adapter + the
# additive --pairs room runner mode + the fire-and-return dispatcher + the
# born-wired /mos:eureka command and its six CIRS governance gates). Pure
# composition + governed wiring over the shipped 215 engine (Canon Part 7/11).
#
# The phase gate has TWO legs (the 211-05 / 215-05 pattern):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the Plan 04 navigator spot-check verdict recorded (a HUMAN runs
#       /mos:eureka against a real room at the checkpoint:human-verify leg and
#       confirms the 4-zone render, the honest tail, and the fire-and-return
#       flow).
#
# EGRESS RULE (Part 8, restated): real-room content NEVER reaches a network
# judge. The room-native scan makes zero network calls beyond the one-time
# model-weight fetch by model id; the real room is verified by the human
# spot-check, not by any automated judge.
#
# This phase edited the shipped scripts/eureka-portfolio-report.cjs (additive
# --pairs room mode), so 216-R6 requires the 215 and 211 engines proven
# UNREGRESSED. The 215 aggregator (leg 9) itself chains run-all-211 as its own
# leg 7, so 211 coverage rides along -- no duplicate standalone 211 leg here.
#
# The 215 regression leg is run_if, GATED ON A FILE that must exist, so a
# partially-landed tree exits cleanly with a SKIP rather than RED-failing on
# absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211/215): the offline preload flips
# transformers.js env.allowRemoteModels=false in every spawned leg (AND its
# children -- the dispatcher's detached-start leg spawns child processes), so an
# uncached model load fails fast and degrades instead of reaching the network.
# No-op when the eureka dep is absent.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

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
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# (1) Room-native substrate adapter (216-01): room.db nodes/edges -> the
#     loadGraph {meta, techMap, convergesPairs} shape + graceful sub-MIN_COHORT
#     degradation.
run "216-01 room-native substrate" \
  node tests/test-216-room-substrate.cjs

# (2) Room mode + dispatcher (216-02): the additive --pairs room runner mode and
#     the fire-and-return dispatcher (run|start|status|report|help), offline e2e.
run "216-02 room mode + dispatcher (offline e2e)" \
  node tests/test-216-eureka-command.cjs

# (3-8) The six CIRS governance gates (216-03): the born-wired command must clear
#       all six for /mos:eureka to be a legal invocable surface (Canon Part 11).
run "216-03 gate: connector registry" \
  node scripts/build-connector-registry.cjs --check

run "216-03 gate: shape declaration (strict)" \
  node scripts/check-shape-declaration.cjs --check --strict

run "216-03 gate: command registration" \
  node lib/core/command-registration-check.cjs

run "216-03 gate: help coverage" \
  node scripts/check-help-coverage.cjs

run "216-03 gate: skill mirror" \
  node scripts/build-skill-mirrors.cjs --check

run "216-03 gate: render coverage" \
  node scripts/check-render-coverage.cjs

# (9) 215 engine no-regression (216-R6): this phase edited the shipped
#     scripts/eureka-portfolio-report.cjs, so the 215 acceptance path must stay
#     green. The 215 aggregator chains run-all-211 as its own leg 7, so the 211
#     engine rides along -- do NOT add a duplicate standalone 211 leg. Guarded
#     on the 215 aggregator so a partial tree SKIPs cleanly.
run_if "215 engine no-regression" "tests/run-all-215.sh" \
  bash tests/run-all-215.sh

echo "======================================"
echo "Phase 216: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
