#!/usr/bin/env bash
# Phase 400.4: cold-start QA fixes. Runs every tests/test-400.4-*.cjs, then the 399 and 400 tests and the named change-site
# tests, then bash tests/run-all-400.sh. Runs all of them (no stop at the first failure), prints
# "PASSED=n FAILED=n KNOWN=n", and exits 1 when FAILED is above 0.
# A test in the KNOWN table fails at base b0b71ecc5. It counts as KNOWN only when its output still holds the base failing
# line (needle). A KNOWN test that fails with another line is FAILED. A KNOWN test that passes is PASSED.
# A test-400.4 file is never KNOWN. Base results: tests/fixtures/400.4/baseline-b0b71ecc5.txt.
# Tests run with HOME and MINDRIAN_ROOMS_HOME set to fresh temp dirs (never the real rooms) and with stdin from /dev/null
# (a test that reads stdin would hang when the runner starts with an open pipe or socket as stdin).
set -u
cd "$(dirname "$0")/.." || exit 1

TMP_HOME=$(mktemp -d)
trap 'rm -rf "$TMP_HOME"' EXIT
export HOME="$TMP_HOME/home"
export MINDRIAN_ROOMS_HOME="$TMP_HOME/rooms"
mkdir -p "$HOME" "$MINDRIAN_ROOMS_HOME"

declare -A KNOWN
# Base failure at b0b71ecc5: Red Teaming is now in framework_index, the test still expects it command-less.
KNOWN["lib/workflow/command-resolver.test.cjs"]="Red Teaming must remain command-less"
# Base failure: Six Thinking Hats now lists /mos:bono first.
KNOWN["lib/memory/suggest-next-workflow.test.cjs"]="Six Thinking Hats resolves to /mos:hat-briefing first"
# Base failure: the registry builder source matches the write-Cypher pattern.
KNOWN["lib/memory/workflow-layer-e2e.test.cjs"]="build-command-registry.cjs must contain no write-Cypher"
# Base failure: hooks.json PreToolUse differs from BASE_NON_STOP.
KNOWN["tests/test-3551-tri-polar.cjs"]="must be unchanged from BASE_NON_STOP"
# Base failure: hooks.json differs from a13ab61f1 in more than timeout and onFailure.
KNOWN["tests/test-261029-qef-hook-timeouts.cjs"]="FAIL A1 shape: only timeout and onFailure differ from a13ab61f1"
# Base failure: SENS-10 is no longer the last sensor registry entry.
KNOWN["tests/test-205-sens10-circularity.cjs"]="SENS-10 is the LAST registry entry"
# Base failure: B2 offers validate-idea in a nest with no job.
KNOWN["tests/test-395-job-shown.cjs"]="FAIL: B2. suggest_next, a nest with no job and candidates"

NAMED="tests/test-395-measure.cjs tests/test-395-carried.cjs tests/test-395-truth-and-cost.cjs tests/test-395-truth-fixes.cjs tests/test-395-job-shown.cjs tests/test-261125-runtime-core-forced-style.cjs tests/test-spine-navigates-decide.cjs tests/test-149-requirement-nodes.cjs tests/test-363-filing.cjs tests/test-149-navigable.cjs tests/test-navigation-perf-10k.cjs tests/test-356-label-sheet.cjs tests/test-251-skeleton-split.cjs tests/test-3551-tri-polar.cjs tests/test-150-orphans.cjs tests/test-209-engine-arm-contract.cjs tests/test-372-omitted.cjs tests/test-347-ranked-set-exclusion.cjs tests/test-navigation-neighborhood.cjs tests/test-navigation-insights.cjs tests/test-navigation-acceptance.cjs tests/test-353-turn-budget.cjs tests/test-347-context-focus.cjs tests/test-legd-recency-golden.cjs tests/test-150-cortex-local-query.cjs tests/test-eureka-graph-projection.cjs lib/core/navigation/engine-projection.test.cjs lib/workflow/command-resolver.test.cjs lib/memory/suggest-next-workflow.test.cjs lib/memory/chain-recommender.test.cjs lib/memory/framework-chain-composer.test.cjs lib/memory/workflow-layer-e2e.test.cjs lib/memory/navigation-hook-resolver.test.cjs tests/test-198-chain-run-halt.test.cjs tests/test-show-share-sensor.cjs tests/test-205-sens10-circularity.cjs tests/test-publish-needs-flow.cjs tests/test-261029-qef-hook-timeouts.cjs tests/test-391-hooks-contract.cjs tests/test-385-hook-unwire.cjs tests/test-270-tool-schema-budget.cjs tests/test-355-naming-honesty.cjs tests/test-36925-brief.cjs tests/test-395-job-statements.cjs"

PASSED=0
FAILED=0
KNOWN_N=0

# run_one <label> <known-key> <command...>
run_one() {
  local label="$1" key="$2"; shift 2
  local out rc
  echo "--- 400.4: $label ---"
  out=$(timeout 900 "$@" 2>&1 </dev/null); rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -eq 0 ]; then
    echo ">>> 400.4: $label: PASSED"; PASSED=$((PASSED + 1))
  elif [ -n "${KNOWN[$key]+x}" ] && printf '%s' "$out" | grep -qF -- "${KNOWN[$key]}"; then
    echo ">>> 400.4: $label: KNOWN"; KNOWN_N=$((KNOWN_N + 1))
  else
    echo ">>> 400.4: $label: FAILED"; FAILED=$((FAILED + 1))
  fi
}

# 1. The phase tests. Never KNOWN.
for t in tests/test-400.4-*.cjs; do
  [ -f "$t" ] || continue
  run_one "$t" "none" node "$t"
done

# 2. The census entries, in the order of the base file.
for t in tests/test-399-*.cjs tests/test-400-*.cjs $NAMED; do
  [ -f "$t" ] || { echo "--- 400.4: $t ---"; echo ">>> 400.4: $t: FAILED (missing)"; FAILED=$((FAILED + 1)); continue; }
  run_one "$t" "$t" node "$t"
done

# 3. The 400 runner.
run_one "tests/run-all-400.sh" "tests/run-all-400.sh" bash tests/run-all-400.sh

echo "PASSED=$PASSED FAILED=$FAILED KNOWN=$KNOWN_N"
[ "$FAILED" -gt 0 ] && exit 1
exit 0
