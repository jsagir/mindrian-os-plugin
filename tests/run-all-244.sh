#!/usr/bin/env bash
# Phase 244 verification aggregator: the single PASS/FAIL/SKIP gate for the
# semantic trigger tier cluster (bm25 content relevance, cross-family rank
# fusion, MMR diversity).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. A turn with real lexical relevance to a room's stored material but no
#      structural signal and no sensor keyword hit still produces a fired
#      candidate.
#   2. Cross-family rank fusion is threaded into rankForSelector through an
#      optional argument whose absence is a byte-identical no-op.
#   3. The top-K cut applies a diversity term so same-family candidates
#      cannot crowd out a cross-family hit.
#
# DISCOVERY IS BY GLOB, NOT BY LIST. This harness globs every tests/test-244-*
# file (both .cjs and .sh) and runs it. Adding a tests/test-244-* file
# requires NO edit to this runner. There is no hand-maintained execution list
# anywhere below, deliberately: a list is a second place to forget something.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   244-01  tests/test-244-trigger-tier-vocab.cjs
#   244-01  tests/test-244-fts-query-sanitize.cjs
#   244-0x  tests/test-244-fts-index-lifecycle.cjs
#   244-0x  tests/test-244-fts-rebuild-reconcile.cjs
#   244-0x  tests/test-244-rrf-fusion.cjs
#   244-0x  tests/test-244-content-sensor-fires.cjs
#   244-0x  tests/test-244-doctor-fts-health.cjs
#   244-0x  tests/test-244-mmr-diversity.cjs
#
# That is EIGHT files. The glob is the executor; the list above is the
# reading checklist. A test named above that is missing from disk is NOT
# reported by this runner as a failure, because a file that does not exist
# cannot be globbed. That is the honest limitation of glob discovery and the
# reason the names are written out here. What the runner DOES catch, loudly,
# is the case where NOTHING at all is discovered.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green. A clean summary over an
# empty discovery is the same false-success shape this phase exists to
# close.
#
# run_may_skip is kept even though no .sh test is planned for Plan 01, so a
# later plan that adds one inherits the behavior: an environment self-skip is
# tallied as SKIP, never as a pass it did not earn.
#
# RED-first is intended: at the moment this file lands (before Tasks 2-3 of
# 244-01 land), zero tests/test-244-* files exist, so the found-eq-0 guard
# makes this exit 1. That observed failure is transcribed live in
# 244-01-SUMMARY.md, not assumed.
#
# NO-EM-DASH FENCE (an extra runner leg beyond discovery): sweeps every file
# this phase touches for the forbidden U+2014 glyph. The pattern is matched
# via its Unicode codepoint escape (grep -P '\x{2014}') rather than a literal
# em-dash, so this runner itself carries no literal em-dash to trip its own
# sweep. Missing paths (files not yet created by a later plan/task) are
# skipped rather than treated as a failure. Offending paths are printed in
# full, never a bare count, per the false-success class this phase exists to
# close.
#
# bash only. No em-dashes.

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

# A leg that may legitimately self-SKIP on environment. Exit 0 plus a SKIP
# line is tallied as SKIP, not as a pass it did not earn.
run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

shopt -s nullglob
found=0
for t in tests/test-244-*.cjs; do
  found=1
  run "$(basename "$t")" node "$t"
done
for t in tests/test-244-*.sh; do
  found=1
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no tests/test-244-* files discovered"
  exit 1
fi

# ---------------------------------------------------------------------------
# No-em-dash fence: every file this phase touches, swept for U+2014. The
# codepoint escape means this runner file itself carries no literal em-dash
# that would otherwise trip its own sweep.
# ---------------------------------------------------------------------------
echo "--- 244 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "tests/test-244-trigger-tier-vocab.cjs"
  "tests/test-244-fts-query-sanitize.cjs"
  "tests/test-244-fts-index-lifecycle.cjs"
  "tests/test-244-fts-rebuild-reconcile.cjs"
  "tests/test-244-rrf-fusion.cjs"
  "tests/test-244-content-sensor-fires.cjs"
  "tests/test-244-doctor-fts-health.cjs"
  "tests/test-244-mmr-diversity.cjs"
  "lib/core/sensors/sensor-types.cjs"
  "lib/core/sensors/sensor-content-relevance.cjs"
  "lib/core/eureka/tri-modal-index.cjs"
  "lib/core/eureka/fts-index-lifecycle.cjs"
  "lib/core/lazygraph-ops.cjs"
  "lib/core/navigation-engine.cjs"
  "lib/core/insight-sensors.cjs"
  "lib/workflow/f-selector-ranker.cjs"
  "lib/core/orchestration-candidate-lift.cjs"
  "lib/core/doctor/eureka-fts-health-module.cjs"
  "scripts/fts-index-drain.cjs"
  "tests/run-all-244.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(grep -lP '\x{2014}' "$f" || true)"
    if [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 244 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 244 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 244: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
