#!/usr/bin/env bash
# Phase 395: selection by job. Runs the phase's own tests in order; exits non-zero on the first failure.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0
for t in tests/test-395-job-real.cjs tests/test-395-job-shown.cjs tests/test-395-hook-reaches-selector.cjs; do
  echo "--- 395: $t ---"
  if node "$t"; then echo ">>> 395: $t: PASSED"; else echo ">>> 395: $t: FAILED"; FAIL=1; break; fi
done
exit $FAIL
