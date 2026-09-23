#!/usr/bin/env bash
# Phase 360 (Room-bind picker fires on harness turns, UserPromptSubmit F.8)
# verification aggregator.
#
# Modeled on tests/run-all-354.sh and tests/run-all-357.sh (the run/run_if/
# counter shape, exit 77 = SKIPPED ENV GAP, the targeted em-dash guard).
#
# WRITTEN ONCE, HERE, IN 360-01. NO LATER 360 PLAN EDITS THIS FILE (D-15).
# Every 360 leg is pre-declared below, guarded on its own test file, so a
# leg SKIPs until that file lands later in the phase -- expected mid-phase,
# not a failure. If a later plan believes it needs a new leg not already
# listed below, that is a signal to re-open this file deliberately, not to
# silently patch around it.
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

# --- Isolation (T-360-05, T-360-07, RESEARCH Pitfall 2) ----------------------
# Every leg below runs under a fresh HOME / MINDRIAN_HOME /
# CARD_FIRE_SIDECHANNEL_PATH / TMPDIR so nothing here can write the real
# ~/.mindrian/card-fire-reached.json (the live Stop hook reads it) and
# nothing can make a keyed network call. MOS360_SNAPSHOT_DIR and
# MOS360_REPLAY_ROOMS_HOME are captured from the REAL home BEFORE the
# isolated HOME is exported, so the R7 local-only snapshot replay leg can
# still find the real snapshot even though HOME itself is now isolated.
REAL_HOME="$HOME"
export MOS360_SNAPSHOT_DIR="${MOS360_SNAPSHOT_DIR:-$REAL_HOME/.cache/mindrian-dev/357-raw}"
export MOS360_REPLAY_ROOMS_HOME="${MOS360_REPLAY_ROOMS_HOME:-$REAL_HOME/MindrianRooms}"

ISO="$(mktemp -d)"
cleanup_iso() { rm -rf "$ISO" 2>/dev/null || true; }
trap cleanup_iso EXIT

mkdir -p "$ISO/home" "$ISO/mh" "$ISO/tmp"
export HOME="$ISO/home"
export MINDRIAN_HOME="$ISO/mh"
export CARD_FIRE_SIDECHANNEL_PATH="$ISO/mh/card-fire-reached.json"
export TMPDIR="$ISO/tmp"
unset TYPESAFE_API_KEY MINDRIAN_BRAIN_KEY

# --- --r3-compare: run only the suites leg and exit with its status --------
# R3_ONLY skips every other 360/357 leg below (including the em-dash guard)
# so the suites leg is the ONLY label printed, and the script exits with
# exactly that leg's own pass/fail status (D-15).
R3_ONLY=0
if [ "${1:-}" = "--r3-compare" ]; then
  R3_ONLY=1
fi

# --- 360 legs, pre-declared once (D-15) --------------------------------------
if [ "$R3_ONLY" -eq 0 ]; then
  run_if "360: leads and shared rule body (BIND360-04, BIND360-05)" tests/test-360-leads.cjs node tests/test-360-leads.cjs </dev/null
  run_if "360: harness picker R1/R2/R3/R6 (BIND360-01, -02, -03, -06)" tests/test-360-harness-picker.cjs node tests/test-360-harness-picker.cjs </dev/null
  run_if "360: picker policy cwd and no-room memory (BIND360-10, BIND360-11)" tests/test-360-picker-policy.cjs node tests/test-360-picker-policy.cjs </dev/null
  run_if "360: tripwire R4/R8/R9 (BIND360-04, -08, -09)" tests/test-360-tripwire.cjs node tests/test-360-tripwire.cjs </dev/null
  run_if "360: snapshot replay, local only (BIND360-07, BIND360-10)" tests/test-360-snapshot-replay.cjs node tests/test-360-snapshot-replay.cjs </dev/null
fi
run_if "360: R3, MCP and wider suites vs pre-phase (BIND360-03, BIND360-09)" tests/fixtures/ups-harness-360/pre-phase.json node tests/test-360-r3-suites.cjs </dev/null

if [ "$R3_ONLY" -eq 1 ]; then
  exit $(( FAIL > 0 ? 1 : 0 ))
fi

# --- 357 compatibility leg (D-11, R5) ----------------------------------------
run_if "357: full runner, R5 compatibility (D-11)" tests/run-all-357.sh bash tests/run-all-357.sh </dev/null

# --- Em-dash guard (360 files only) ------------------------------------------
run "360: no em-dashes in 360 files" bash -c '
  hit=0
  for f in tests/test-360-*.cjs tests/run-all-360.sh tests/fixtures/ups-harness-360/*; do
    [ -f "$f" ] || continue
    if grep -lq "$(printf "\xe2\x80\x94")" "$f" 2>/dev/null; then
      echo "em-dash found in $f"
      hit=1
    fi
  done
  if [ -f lib/core/room-bind-picker-policy.cjs ]; then
    if grep -lq "$(printf "\xe2\x80\x94")" lib/core/room-bind-picker-policy.cjs 2>/dev/null; then
      echo "em-dash found in lib/core/room-bind-picker-policy.cjs"
      hit=1
    fi
  fi
  exit $hit
'

echo "======================================"
echo "Phase 360: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
