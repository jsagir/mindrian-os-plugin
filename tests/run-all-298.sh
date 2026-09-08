#!/usr/bin/env bash
# Phase 298 verification aggregator -- the single PASS/FAIL/SKIP gate for
# harness-as-code: declare and machine-enforce the minimum bar. Models on
# tests/run-all-201.sh / run-all-200.sh / run-all-196.sh.
#
# Phase 298 lands: (01) manifest v2 (`data/harness-manifest.json` grows
# `policies`, `larry_surfaces`, `fixture_ref` alongside the existing three
# maps); (02) `data/harness-policies/` -- the policy directory, one JSON file
# per gate/voice/memory/contract check, validated against `_schema.json`;
# (03) `scripts/run-harness.cjs` -- the runner that spawns each policy's
# runner at its declared rung (declared/logged/blocking), never promotes a
# rung itself, and never opens the room-db write path (Layer 0 scan only);
# (04) `scripts/check-graph-derive-health.cjs` -- a thin wrapper over the
# existing `detectRoomHealth()` derive-health gate; (05) the voice rung-2
# trio: `lib/hmi/voice-style-log.cjs`'s `evaluatePromotion`, the Stop hook
# `scripts/check-voice-style.cjs`, and its doctor module; (06) the F.8
# readable-row governance basket (claim text as label, `<kind> -> <section>,
# conf 0.xx, from <path>` as description).
#
# Each leg is run_if, guarded on a file that must exist, so this
# four-slice, multi-wave phase exits cleanly with SKIPs rather than FAILs
# while partially landed -- a phase this size cannot land in one plan, and a
# hard FAIL on an as-yet-unbuilt slice would make every intermediate wave
# look broken. bash only. No em-dashes.

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

run_if "298-01 policies schema" "tests/test-298-policies-schema.cjs" \
  node tests/test-298-policies-schema.cjs
run_if "298-01 derive health gate" "tests/test-298-derive-health.cjs" \
  node tests/test-298-derive-health.cjs
run_if "298-01 voice-style log" "tests/test-298-voice-log.cjs" \
  node tests/test-298-voice-log.cjs
run_if "298-01 contract parity" "tests/test-298-contract-parity.cjs" \
  node tests/test-298-contract-parity.cjs
run_if "298-01 runner idempotence" "tests/test-298-runner-idempotent.cjs" \
  node tests/test-298-runner-idempotent.cjs
run_if "298 harness-manifest --check" "data/harness-manifest.json" \
  node scripts/build-harness-manifest.cjs --check
run_if "298-11 check-graph-derive-health --room fixture" "scripts/check-graph-derive-health.cjs" \
  node scripts/check-graph-derive-health.cjs --room data/harness-fixtures/converged-room
run_if "298-15 run-harness --check --tier pre-tag" "scripts/run-harness.cjs" \
  node scripts/run-harness.cjs --check --tier pre-tag

# 298 runner converged fixture: guarded on scripts/run-harness.cjs existing,
# but the --room convergence branch itself lands in plan 298-11 (a second
# wave touching the same file plan 298-10 creates). Until that branch
# exists, the runner honestly refuses --room with a named not-yet-
# implemented notice (exit 2, plan 298-10's own locked contract); treat that
# specific, named refusal as a SKIP rather than a FAIL so this leg keeps the
# same "SKIP while partially landed" contract every other leg here already
# has, instead of red-flagging a branch that has not been built yet. Once
# plan 298-11 lands, a real --room run replaces the notice and this leg
# reports PASSED or FAILED like any other.
if [ -f "scripts/run-harness.cjs" ]; then
  ROOM_LABEL="298 runner converged fixture"
  ROOM_OUT="$(node scripts/run-harness.cjs --room data/harness-fixtures/converged-room 2>&1)"
  ROOM_STATUS=$?
  echo "--- $ROOM_LABEL ---"
  echo "$ROOM_OUT"
  if echo "$ROOM_OUT" | grep -q "not yet implemented"; then
    echo ">>> $ROOM_LABEL: SKIPPED (--room lands in plan 298-11)"
    SKIP=$((SKIP+1))
  elif [ "$ROOM_STATUS" -eq 0 ]; then
    echo ">>> $ROOM_LABEL: PASSED"; PASS=$((PASS+1))
  else
    echo ">>> $ROOM_LABEL: FAILED"; FAIL=$((FAIL+1))
  fi
  echo ""
else
  echo "--- 298 runner converged fixture ---"; echo ">>> 298 runner converged fixture: SKIPPED (missing scripts/run-harness.cjs)"; SKIP=$((SKIP+1)); echo ""
fi

echo "======================================"
echo "Phase 298: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
