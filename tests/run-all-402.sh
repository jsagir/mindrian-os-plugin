#!/usr/bin/env bash
# Phase 402 (lighter runtime), slice 1 and slice 2 gate runner. Quick
# 261127-k4f, binding addendum 402-K4F-PLAN-ADDENDUM.md section 7.
#
# Modeled on tests/run-all-357.sh (run/run_if/counter shape).
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED (ENV GAP), never reported as PASSED
# anything else -> FAILED
#
# The runner sets MINDRIAN_HOME and CARD_FIRE_SIDECHANNEL_PATH to a new temp
# folder, so no leg writes the live ~/.mindrian. It never runs
# node scripts/doctor.cjs --acceptance.
#
# Group "must pass" and group "Larry pins (406-P1)": a FAILED leg fails the runner.
# Group "known red, report only": the runner prints the result and does not count it in FAIL;
# the quick 261127-k4f SUMMARY compares it with the measured baseline.
#
# House rule: hyphens only, no em dash, no en dash, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_HOME="$(mktemp -d)"
export MINDRIAN_HOME="$RUN_HOME"
export CARD_FIRE_SIDECHANNEL_PATH="$RUN_HOME/card-fire-reached.json"
unset TYPESAFE_API_KEY
unset MINDRIAN_MCP_FIRST
trap 'rm -rf "$RUN_HOME"' EXIT

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

report_only() {
  local label="$1"; shift
  echo "--- $label (known red, report only) ---"
  "$@"
  local status=$?
  echo ">>> $label: exit $status (report only, not counted)"
  echo ""
}

# --- Group "must pass" -------------------------------------------------------
run_if "402 K4: card-fire envelope" tests/test-402-card-fire-envelope.cjs node tests/test-402-card-fire-envelope.cjs
run_if "402 K4-R5: card-fire lock wait" tests/test-402-card-fire-lock-wait.cjs node tests/test-402-card-fire-lock-wait.cjs
run_if "402 F2: session-start cap" tests/test-402-session-start-cap.cjs node tests/test-402-session-start-cap.cjs
run "ga4 card-fire interceptor" node tests/test-ga4-card-fire-interceptor.cjs
run "359 declared arm" node tests/test-359-declared-arm.cjs
run "359 declared arm tripwires" node tests/test-359-declared-arm.cjs --tripwires
run "238 retry counter fence" node tests/test-238-retry-counter-fence.cjs
run "238 card-fire corpus" node tests/test-238-card-fire-corpus.cjs
run "209 primary sidechannel" node tests/test-209-primary-sidechannel.cjs
run "209 backstop tuning" node tests/test-209-backstop-tuning.cjs
run "209 incident replay" node tests/test-209-incident-replay.cjs
run "198 adapter budget" node tests/test-198-adapter-budget.test.cjs
run "198 stop-gate retry ceiling" node tests/test-198-stop-gate-retry-ceiling.test.cjs
run "383 card fork" node tests/test-383-card-fork.cjs
run "346 watch replay" node tests/test-346-watch-replay.cjs
run "doctor card-fire health" node tests/test-doctor-card-fire-health.cjs
run "357 replay" node tests/test-357-replay.cjs
run "359 replay" node tests/test-359-replay.cjs
run "replay bar (both surfaces, baseline compare)" node scripts/replay-card-fire.cjs --surface both --baseline compare
run "Stop hook schema compatibility" node scripts/check-hook-schema-compatibility.cjs
run "391 hooks contract" node tests/test-391-hooks-contract.cjs
run "k1u session-start envelope" node tests/test-k1u-session-start-envelope.cjs
run "lx3 session-start skip" node tests/test-261029-lx3-sessionstart-skip.cjs
run_if "402 K3: hook stdout shape" tests/test-402-hook-stdout-shape.cjs node tests/test-402-hook-stdout-shape.cjs

# --- Group "Larry pins (406-P1)" --------------------------------------------
run "359 prose budget" node tests/test-359-prose-budget.cjs
run "3696 voice-first budget" node tests/test-3696-voice-first-budget.cjs

# --- Group "known red, report only" ------------------------------------------
report_only "ga4 card-fire e2e 179" node tests/test-ga4-card-fire-e2e-179.cjs
report_only "card-fire relevance gate" node tests/test-card-fire-relevance-gate.cjs
report_only "qef hook timeouts" node tests/test-261029-qef-hook-timeouts.cjs

echo "======================================"
echo "Phase 402: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
