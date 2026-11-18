#!/usr/bin/env bash
# Quick 261118-o1d aggregator: the Theo health file gets a writer and a 15-minute TTL
# (statusline and panel readers), and doctor names a retired Theo address.
# Hyphens only. exit 0 -> FAIL=0.
#
# Four tests were red before this work (exit 1 at 5ebf332a2) and are NOT legs here:
#   test-341-retired-classes-a-h, test-353-doctor-section-ruling,
#   test-341-retired-topology-halves (each pins 29 registry modules; the registry has 32 or more),
#   test-l8g-theo-bare.

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
  else echo ">>> $label: FAILED (exit $status)"; FAIL=$((FAIL+1)); fi
  echo ""
}

run "o1d brain health file" node tests/test-261118-o1d-brain-health.cjs
run "o1d brain origin doctor" node tests/test-261118-o1d-brain-origin-doctor.cjs
run "339 brain prewarm cold start" node tests/test-339-brain-prewarm-cold-start.cjs
run "384 prewarm timer" node tests/test-384-ca-prewarm-timer.cjs all
run "context monitor d02 broadcast" node tests/test-context-monitor-d02-broadcast.cjs
run "339 origin single source" node tests/test-339-origin-single-source.cjs
run "257 refusal egress kind" node tests/test-257-refusal-egress-kind.cjs
run "doctor module contract parity" node tests/test-doctor-module-contract-parity.cjs
run "doctor doc parity" node tests/test-doctor-doc-parity.cjs
run "build-mos-face check" node scripts/build-mos-face.cjs --check
run "build-connector-registry check" node scripts/build-connector-registry.cjs --check
run "380 build" node tests/test-380-build.cjs
run "380 copy" node tests/test-380-copy.cjs
run "380 status parity" node tests/test-380-status-parity.cjs
run "380 engine tests" node tests/test-380-engine-tests.cjs

run "no em-dash or en-dash in 261118-o1d files" bash -c '
  files=$(ls -d tests/test-261118-o1d-*.cjs tests/run-all-261118-o1d.sh lib/core/doctor/brain-origin-module.cjs 2>/dev/null)
  hits=$(LC_ALL=C grep -lP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
