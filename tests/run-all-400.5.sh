#!/usr/bin/env bash
# Phase 400.5: ICM-routed prompt hooks. Runs the 400.5 offline tests, then bash tests/run-all-400.4.sh
# (its glob finds tests/test-400.4-dispatch-*.cjs). Runs all of them (no stop at the first failure),
# prints "PASSED=n FAILED=n", and exits 1 when FAILED is above 0.
# Tests run with HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME set to fresh temp dirs (never the real rooms)
# and with stdin from /dev/null. The live load leg (MOS_LIVE_LOAD=1, plan 400.5-05) never runs here.
set -u
cd "$(dirname "$0")/.." || exit 1

TMP_HOME=$(mktemp -d)
trap 'rm -rf "$TMP_HOME"' EXIT
export HOME="$TMP_HOME/home"
export MINDRIAN_HOME="$TMP_HOME/mindrian"
export MINDRIAN_ROOMS_HOME="$TMP_HOME/rooms"
mkdir -p "$HOME" "$MINDRIAN_HOME" "$MINDRIAN_ROOMS_HOME"
unset MOS_LIVE_LOAD

PASSED=0
FAILED=0

run_one() {
  local label="$1"; shift
  if "$@" </dev/null >"$TMP_HOME/out.txt" 2>&1; then
    PASSED=$((PASSED + 1)); echo "PASS $label"
  else
    FAILED=$((FAILED + 1)); echo "FAIL $label"; tail -n 20 "$TMP_HOME/out.txt"
  fi
}

run_one "tests/test-400.5-dispatch-notes.cjs" node tests/test-400.5-dispatch-notes.cjs
run_one "tests/test-400.5-classifier-deadline.cjs" node tests/test-400.5-classifier-deadline.cjs
run_one "tests/test-400.5-load-20.cjs --self-test" node tests/test-400.5-load-20.cjs --self-test

# The 400.4 runner sets its own temp HOME and prints its own PASSED=n FAILED=n KNOWN=n line.
if bash tests/run-all-400.4.sh </dev/null >"$TMP_HOME/run400.4.txt" 2>&1; then
  PASSED=$((PASSED + 1)); echo "PASS tests/run-all-400.4.sh"
else
  FAILED=$((FAILED + 1)); echo "FAIL tests/run-all-400.4.sh"; grep -E '^FAIL' "$TMP_HOME/run400.4.txt" | head -n 40
fi
echo "run-all-400.4: $(grep -E '^PASSED=[0-9]+ FAILED=[0-9]+ KNOWN=[0-9]+' "$TMP_HOME/run400.4.txt" | tail -n 1)"

echo "PASSED=$PASSED FAILED=$FAILED"
[ "$FAILED" -eq 0 ] || exit 1
exit 0
