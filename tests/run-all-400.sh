#!/usr/bin/env bash
# Phase 400: job sentences, Cynefin layer, problem-axes fixes, decision relay. Runs the phase-400 tests in order, then the phase drift checks, then bash tests/run-all-399.sh; exits non-zero on any failure.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0
for t in tests/test-400-job-sentence-lib.cjs tests/test-400-description-budget.cjs tests/test-400-job-vocabulary-sentences.cjs; do
  echo "--- 400: $t ---"
  if node "$t"; then echo ">>> 400: $t: PASSED"; else echo ">>> 400: $t: FAILED"; FAIL=1; break; fi
done
# Phase-owned drift checks. Run only when every test passed. One PASSED or FAILED line each.
if [ "$FAIL" -eq 0 ]; then
  for c in; do
    echo "--- 400 check: $c ---"
    if node scripts/$c; then echo ">>> 400 check: $c: PASSED"; else echo ">>> 400 check: $c: FAILED"; FAIL=1; fi
  done
fi
# The 399 runner runs last.
if [ "$FAIL" -eq 0 ]; then
  echo "--- 400: run-all-399 ---"
  if bash tests/run-all-399.sh; then echo ">>> 400: run-all-399: PASSED"; else echo ">>> 400: run-all-399: FAILED"; FAIL=1; fi
fi
exit $FAIL
