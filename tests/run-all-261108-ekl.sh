#!/usr/bin/env bash
# Quick 261108-ekl aggregator: /mos:status resolves the registry active room, and doctor
# self-skips the dogfood pass and 4 repo-only acceptance points in an install layout.
# Hyphens only. exit 0 -> FAILED=0.
#
# test-doctor-acceptance-preflight-checks.cjs is ADVISORY here: its Test 7 reads the
# machine install state (version-of-record divergence IP vs PB) and fails on a dev machine
# whose marketplace cache is stale. It failed the same way before this quick (recorded in
# the 261108-ekl summary). Its result prints but does not count.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

advisory() {
  local label="$1"; shift
  echo "--- $label (advisory) ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED (advisory)"
  else echo ">>> $label: FAILED (advisory, not counted)"; fi
  echo ""
}

run "261108-ekl status active room" node tests/test-261108-ekl-status-active-room.cjs
run "261108-ekl doctor install layout" node tests/test-261108-ekl-doctor-install-layout.cjs
run "mos-status renderer" node lib/memory/mos-status-renderer.test.cjs
run "129 read surface events" node tests/test-129-read-surface-events.cjs
advisory "doctor acceptance preflight checks" node tests/test-doctor-acceptance-preflight-checks.cjs

run "no em-dash or en-dash in 261108-ekl files" bash -c '
  files=$(ls -d tests/test-261108-ekl-*.cjs tests/run-all-261108-ekl.sh 2>/dev/null)
  hits=$(LC_ALL=C grep -lP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL"
[ "$FAIL" -eq 0 ]
