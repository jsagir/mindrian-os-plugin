#!/usr/bin/env bash
# Phase 400.2: persona, hats and research bundle. Runs the phase tests, then the named existing suites, then the drift checks, then bash tests/run-all-400.sh; exits non-zero on any failure.
set -u
cd "$(dirname "$0")/.." || exit 1
FAIL=0
# Loop 1: the phase tests. Each plan appends its test files here.
for t in tests/test-4002-job-statements.cjs tests/test-4002-job-reach.cjs tests/test-4002-persona-freshness.cjs tests/test-4002-quick.cjs tests/test-4002-door-order.cjs tests/test-4002-command-contract.cjs tests/test-4002-per-hat-rules.cjs tests/test-4002-hat-isolation.cjs tests/test-4002-not-run.cjs tests/test-4002-merge.cjs tests/test-4002-rulings.cjs tests/test-4002-research-part8.cjs tests/test-4002-research-states.cjs tests/test-4002-wire-real-db.cjs tests/test-4002-sources.cjs tests/test-4002-spike-overlap.cjs tests/test-4002-compare.cjs tests/test-4002-review-lists.cjs tests/test-4002-advisor-run-prep.cjs tests/test-40021-persona-domain.cjs tests/test-40021-relevance-floor.cjs tests/test-40021-blue-coverage.cjs tests/test-40021-handle-guidance.cjs tests/test-40021-command-notes.cjs; do
  echo "--- 400.2: $t ---"
  if node "$t"; then echo ">>> 400.2: $t: PASSED"; else echo ">>> 400.2: $t: FAILED"; FAIL=1; fi
done
# Loop 2: the named existing suites that were green at the base bb0bfbab3.
if [ "$FAIL" -eq 0 ]; then
  for t in tests/test-bono-cell-fanout.cjs tests/test-bono-cell-selfcritique.cjs tests/test-223-hat-governance.cjs tests/test-223-part8-egress.cjs tests/test-bono-part8-leak.cjs tests/test-265-persona-route.cjs tests/test-130-cognitive-migration.cjs tests/test-130-lens-engine.cjs tests/test-245-sens17-hats.cjs tests/test-265-swarm-task-grant.cjs tests/test-265-no-run-in-background.cjs tests/test-265-resolve-model-argorder.cjs tests/test-265-declaration-truth.cjs tests/test-386-web-credential-hook.cjs tests/test-391-agent-tools-naming.cjs tests/test-276-room-content-honesty.cjs tests/test-353-filing-gate.cjs; do
    echo "--- 400.2 suite: $t ---"
    if node "$t"; then echo ">>> 400.2 suite: $t: PASSED"; else echo ">>> 400.2 suite: $t: FAILED"; FAIL=1; fi
  done
fi
# Known red at the base bb0bfbab3: printed, not counted (rule R-8).
echo "KNOWN_RED at base bb0bfbab3 (not counted): tests/test-130-lens-engine-e2e.cjs tests/test-261029-qef-hook-timeouts.cjs tests/test-369.26-registry-sync.cjs tests/test-276-tool-honesty-findings-closed.cjs tests/test-phase-14.sh"
# Loop 3: drift checks. Run only when every test passed. Each plan appends its checks here.
if [ "$FAIL" -eq 0 ]; then
  for c in "apply-job-labels.cjs --check" "apply-job-sentences.cjs --check --require-all" "build-command-registry.cjs --check" "build-skill-mirrors.cjs --check" "build-connector-registry.cjs --check" "build-harness-manifest.cjs --check" "build-orchestration-projection.cjs --check" "build-decision-advisor-table.cjs --check"; do
    echo "--- 400.2 check: $c ---"
    if node scripts/$c; then echo ">>> 400.2 check: $c: PASSED"; else echo ">>> 400.2 check: $c: FAILED"; FAIL=1; fi
  done
fi
# The 400 runner runs last.
if [ "$FAIL" -eq 0 ]; then
  echo "--- 400.2: run-all-400 ---"
  if bash tests/run-all-400.sh; then echo ">>> 400.2: run-all-400: PASSED"; else echo ">>> 400.2: run-all-400: FAILED"; FAIL=1; fi
fi
exit $FAIL
