#!/usr/bin/env bash
# Phase 399: decision-model advisor keyed on the job. Runs the phase's own tests in order; exits non-zero on the first failure.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0
for t in tests/test-399-job-vocabulary.cjs tests/test-399-problem-axes.cjs tests/test-399-job-labels.cjs tests/test-399-capability-labels.cjs tests/test-399-adapter.cjs tests/test-399-advisor-fence.cjs tests/test-399-egress-line.cjs tests/test-399-transport-capture.cjs tests/test-399-run-steps.cjs tests/test-399-table.cjs tests/test-399-selector-advisor.cjs tests/test-399-workflow-advisor.cjs tests/test-399-one-selector-fence.cjs tests/test-399-selection-log.cjs tests/test-399-bench.cjs; do
  echo "--- 399: $t ---"
  if node "$t"; then echo ">>> 399: $t: PASSED"; else echo ">>> 399: $t: FAILED"; FAIL=1; break; fi
done
# Phase-owned drift checks. Run only when every test passed. One PASSED or FAILED line each.
if [ "$FAIL" -eq 0 ]; then
  for c in "build-decision-advisor-table.cjs --check" "apply-job-labels.cjs --check" "build-command-registry.cjs --check" "build-skill-mirrors.cjs --check" "build-orchestration-projection.cjs --check"; do
    echo "--- 399 check: $c ---"
    if node scripts/$c; then echo ">>> 399 check: $c: PASSED"; else echo ">>> 399 check: $c: FAILED"; FAIL=1; fi
  done
fi
exit $FAIL
