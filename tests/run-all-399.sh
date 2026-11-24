#!/usr/bin/env bash
# Phase 399: decision-model advisor keyed on the job. Runs the phase's own tests in order; exits non-zero on the first failure.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0
for t in tests/test-399-job-vocabulary.cjs tests/test-399-problem-axes.cjs tests/test-399-job-labels.cjs; do
  echo "--- 399: $t ---"
  if node "$t"; then echo ">>> 399: $t: PASSED"; else echo ">>> 399: $t: FAILED"; FAIL=1; break; fi
done
exit $FAIL
