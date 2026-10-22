#!/usr/bin/env bash
# Phase 379.1 verification aggregator: the ONE-COMMAND PASS/FAIL/SKIP gate for the
# graph-derive drain and scout runaway-CPU repair (embed once, bound the pairs,
# cap the threads, heartbeat the lock, bound the scout, declare the artifact scope).
# Mirrors tests/run-all-224.sh's run/run_if aggregator shape and its comment-stripped
# grep-sweep legs. Decision D-379.1-10 names the files tests/test-379.1-<topic>.cjs.
#
# Legs, in order:
#   (1) the nine tests/test-379.1-*.cjs node proofs (Wave 0 ships them RED by design;
#       every later wave turns its own file GREEN)
#   (2) the regression legs the phase must not break (224, 233, 272, 211, 245, 354,
#       the derive sweep and the derive health module)
#   (3) the Part 8 sweep: no network primitive on an executable line of the new
#       modules, the fixture builder and the four probes (CPU379-09)
#   (4) the em-dash sweep over every file this phase's plans name (CLAUDE.md rule)
# Every file leg is run_if-guarded so a partially-landed phase reports SKIPPED, never
# a crash. Exits 1 when any leg FAILED.
#
# bash only. No network. No model downloads. No emoji. No em-dashes. Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# Strip whole-line comments (// or block-comment body lines starting with optional
# whitespace then // or * or /*) so header prose never trips a grep.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# (1) Phase proofs: tests/test-379.1-<topic>.cjs
# ---------------------------------------------------------------------------
run_if "379.1 large-fixture (CPU379-08 run-time builder)" "tests/test-379.1-large-fixture.cjs" \
  node tests/test-379.1-large-fixture.cjs
run_if "379.1 vector-cache (CPU379-01 embed once per content hash)" "tests/test-379.1-vector-cache.cjs" \
  node tests/test-379.1-vector-cache.cjs
run_if "379.1 artifact-scope (CPU379-10 declared scope exclusion)" "tests/test-379.1-artifact-scope.cjs" \
  node tests/test-379.1-artifact-scope.cjs
run_if "379.1 queue-lock (CPU379-05 heartbeat and PID check)" "tests/test-379.1-queue-lock.cjs" \
  node tests/test-379.1-queue-lock.cjs
run_if "379.1 worker-caps (CPU379-03 budget, priority, threads)" "tests/test-379.1-worker-caps.cjs" \
  node tests/test-379.1-worker-caps.cjs
run_if "379.1 pair-cursor (CPU379-02 and CPU379-04 bounded pairs)" "tests/test-379.1-pair-cursor.cjs" \
  node tests/test-379.1-pair-cursor.cjs
run_if "379.1 scout-bound (CPU379-06 scout cap and single flight)" "tests/test-379.1-scout-bound.cjs" \
  node tests/test-379.1-scout-bound.cjs
run_if "379.1 doctor-check (CPU379-07 abandoned entries and dead locks)" "tests/test-379.1-doctor-check.cjs" \
  node tests/test-379.1-doctor-check.cjs
run_if "379.1 svd-parity (CPU379-06 and D-379.1-14 solver gate)" "tests/test-379.1-svd-parity.cjs" \
  node tests/test-379.1-svd-parity.cjs
run_if "379.1 rss-probe (CPU379-03 drain RSS probe, gap closure plan 07)" "tests/test-379.1-rss-probe.cjs" \
  node tests/test-379.1-rss-probe.cjs
run_if "379.1 rss-decision (CPU379-03 recorded human decision, gap closure plan 08)" "tests/test-379.1-rss-decision.cjs" \
  node tests/test-379.1-rss-decision.cjs

# ---------------------------------------------------------------------------
# (2) Regression legs
# ---------------------------------------------------------------------------
run_if "no-regression: run-all-224.sh (graph derivation gate)" "tests/run-all-224.sh" \
  bash tests/run-all-224.sh
run_if "no-regression: run-all-233.sh (derive health gate)" "tests/run-all-233.sh" \
  bash tests/run-all-233.sh
run_if "no-regression: run-all-272.sh (rs-engine port gate)" "tests/run-all-272.sh" \
  bash tests/run-all-272.sh
run_if "no-regression: 272-rs-engine-contract" "tests/272-rs-engine-contract.test.cjs" \
  node tests/272-rs-engine-contract.test.cjs
run_if "no-regression: 272-cache-location" "tests/272-cache-location.test.cjs" \
  node tests/272-cache-location.test.cjs
run_if "no-regression: test-211-embedding-spine" "tests/test-211-embedding-spine.cjs" \
  node tests/test-211-embedding-spine.cjs
run_if "no-regression: test-211-embed-batching" "tests/test-211-embed-batching.cjs" \
  node tests/test-211-embed-batching.cjs
run_if "no-regression: test-245-drain-budget" "tests/test-245-drain-budget.cjs" \
  node tests/test-245-drain-budget.cjs
run_if "no-regression: test-354-write-lock-ownership" "tests/test-354-write-lock-ownership.cjs" \
  node tests/test-354-write-lock-ownership.cjs
run_if "no-regression: test-graph-derive-sweep (queue contract)" "tests/test-graph-derive-sweep.cjs" \
  node tests/test-graph-derive-sweep.cjs
run_if "no-regression: test-233-graph-derive-health" "tests/test-233-graph-derive-health.cjs" \
  node tests/test-233-graph-derive-health.cjs

# ---------------------------------------------------------------------------
# (3) Part 8 sweep (CPU379-09): no network primitive on an executable line of the new
#     modules, the fixture builder and the four probes. A target that does not exist yet
#     is reported and skipped (the phase lands in waves); a present target with a
#     forbidden token fails the leg.
# ---------------------------------------------------------------------------
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
PART8_TARGETS=(
  lib/core/semantic-index/vector-cache.cjs
  lib/core/artifact-scope.cjs
  lib/core/job-lock.cjs
  scripts/release-lib/large-room-leg.cjs
  tests/fixtures/large-room/build-fixture.cjs
  tests/fixtures/379.1/probe-k.cjs
  tests/fixtures/379.1/probe-allow-spinning.cjs
  tests/fixtures/379.1/probe-svd-parity.cjs
  tests/fixtures/379.1/probe-tfidf-density.cjs
  tests/fixtures/379.1/probe-drain-rss.cjs
)
echo "--- Part 8 sweep (CPU379-09): no egress in the phase modules and probes ---"
PART8_OK=1
PART8_SEEN=0
for tgt in "${PART8_TARGETS[@]}"; do
  if [ ! -f "$tgt" ]; then
    echo "    not present yet (skipped): $tgt"
  elif strip_comments "$tgt" | grep -nE "$PART8_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN egress token on an executable line in: $tgt"; PART8_OK=0; PART8_SEEN=$((PART8_SEEN+1))
  else
    PART8_SEEN=$((PART8_SEEN+1))
  fi
done
if [ "$PART8_SEEN" -eq 0 ]; then
  echo ">>> Part 8 sweep (CPU379-09): SKIPPED (no target present)"; SKIP=$((SKIP+1))
elif [ "$PART8_OK" -eq 1 ]; then
  echo ">>> Part 8 sweep (CPU379-09): PASSED ($PART8_SEEN files)"; PASS=$((PASS+1))
else
  echo ">>> Part 8 sweep (CPU379-09): FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# (4) Em-dash sweep over every tracked file the six phase plans name (the seed files
#     under .planning are not tracked and are not listed). A hit is a FAIL.
# ---------------------------------------------------------------------------
EMDASH=$'\xe2\x80\x94'
EMDASH_TARGETS=(
  tests/fixtures/large-room/build-fixture.cjs
  tests/test-379.1-large-fixture.cjs
  tests/run-all-379.1.sh
  tests/test-379.1-vector-cache.cjs
  tests/test-379.1-pair-cursor.cjs
  tests/test-379.1-worker-caps.cjs
  tests/test-379.1-queue-lock.cjs
  tests/test-379.1-scout-bound.cjs
  tests/test-379.1-artifact-scope.cjs
  tests/test-379.1-doctor-check.cjs
  tests/test-379.1-svd-parity.cjs
  tests/fixtures/379.1/probe-k.cjs
  tests/fixtures/379.1/probe-allow-spinning.cjs
  tests/fixtures/379.1/probe-svd-parity.cjs
  tests/fixtures/379.1/probe-tfidf-density.cjs
  tests/fixtures/379.1/probe-k.json
  tests/fixtures/379.1/probe-allow-spinning.json
  tests/fixtures/379.1/probe-svd-parity.json
  tests/fixtures/379.1/probe-tfidf-density.json
  tests/fixtures/379.1/probe-drain-rss.cjs
  tests/fixtures/379.1/probe-drain-rss.json
  tests/test-379.1-rss-probe.cjs
  tests/test-379.1-rss-decision.cjs
  tests/fixtures/379.1/rss-decision.json
  lib/core/semantic-index/vector-cache.cjs
  lib/core/artifact-scope.cjs
  lib/core/job-lock.cjs
  tests/helpers/job-lock-holder-379.cjs
  lib/core/semantic-index/embedding-spine.cjs
  tests/fixtures/379.1-stub-deps/node_modules/@huggingface/transformers/package.json
  tests/fixtures/379.1-stub-deps/node_modules/@huggingface/transformers/index.js
  lib/core/numeric/svd.cjs
  tests/272-rank-agreement.test.cjs
  lib/core/graph-derive-classifier.cjs
  lib/core/rs-differential-scorer.cjs
  lib/core/graph-backfill.cjs
  scripts/gsd-graph-derive-drain.cjs
  lib/core/rs-engine.cjs
  lib/core/hsi-engine.cjs
  scripts/scout-cadence-runner.cjs
  lib/core/doctor/graph-derive-health-module.cjs
  data/doctor-modules.json
  scripts/release-lib/large-room-leg.cjs
  scripts/real-room-run.cjs
  scripts/release-lib/real-room-gate.sh
  docs/ENV-TUNING.md
  docs/RELEASE-CEREMONY-RULING-SYSTEM.md
  .claude/includes/release-process.md
)
echo "--- em-dash sweep: no em-dash in any file the phase plans name ---"
EMDASH_OK=1
EMDASH_SEEN=0
for tgt in "${EMDASH_TARGETS[@]}"; do
  [ -f "$tgt" ] || continue
  EMDASH_SEEN=$((EMDASH_SEEN+1))
  if grep -lF "$EMDASH" "$tgt" >/dev/null 2>&1; then
    echo "    em-dash found in: $tgt"; EMDASH_OK=0
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then echo ">>> em-dash sweep: PASSED ($EMDASH_SEEN files)"; PASS=$((PASS+1)); else echo ">>> em-dash sweep: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

echo "======================================"
echo "Phase 379.1: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
