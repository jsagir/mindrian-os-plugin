#!/usr/bin/env bash
# Phase 209 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# Shape-F Native Fire cluster. Models on tests/run-all-201.sh / run-all-196.sh.
#
# Phase 209 closes the declared-vs-rendered gap: every surface that DECLARES a
# Shape-F Decision Gate must FIRE the AskUserQuestion card natively. Wave 1
# (E1 imperative trailer, P1-P4 doctrine) already shipped as
# quick(gate-native-fire-w1). This phase lands: (01) E3+E4 engine-arm and
# F.8-binding-gate seam fixes (folding the never-shipped E2); (02) B1 the
# command-plane firing-block stamp; (04) the mandatory eval GATE (this file's
# own leg); (03) B2+B3 the declared-implies-wired build gate; (05) E5 the
# room-pick sensor bridge; (06) H3+H4 the PRIMARY side-channel + session-start
# exemplar fix; (07) H1+H2 backstop tuning + the incident-replay adversarial
# verification, deliberately LAST per the LOCKED wave order.
#
# Every leg is run_if, guarded on a file that must exist, so a partially-
# landed phase exits cleanly with SKIPs. All nine legs are pre-declared here
# by plan 04 so no later-wave plan ever edits this runner. bash only. No
# em-dashes.

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
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

run_if "209-01 engine-arm contract (E2/E3/E4)" "tests/test-209-engine-arm-contract.cjs" \
  node tests/test-209-engine-arm-contract.cjs
run_if "209-02 stamp-firing-block (B1)" "tests/test-209-stamp-firing-block.cjs" \
  node tests/test-209-stamp-firing-block.cjs
run_if "209-03 declared-implies-wired (B2+B3)" "tests/test-209-declared-implies-wired.cjs" \
  node tests/test-209-declared-implies-wired.cjs
run_if "209-04 card-fire-gate (Plurai parity, this plan's own leg)" "tests/test-209-card-fire-gate.cjs" \
  node tests/test-209-card-fire-gate.cjs
run_if "209-05 room-pick sensor (E5)" "tests/test-209-room-pick-sensor.cjs" \
  node tests/test-209-room-pick-sensor.cjs
run_if "209-06 PRIMARY side-channel (H3)" "tests/test-209-primary-sidechannel.cjs" \
  node tests/test-209-primary-sidechannel.cjs
run_if "209-06 session-start exemplar fix (H4)" "tests/test-209-session-start-exemplar.cjs" \
  node tests/test-209-session-start-exemplar.cjs
run_if "209-07 backstop tuning (H1+H2)" "tests/test-209-backstop-tuning.cjs" \
  node tests/test-209-backstop-tuning.cjs
run_if "209-07 incident replay (adversarial verification)" "tests/test-209-incident-replay.cjs" \
  node tests/test-209-incident-replay.cjs

echo "======================================"
echo "Phase 209: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
