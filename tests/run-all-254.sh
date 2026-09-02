#!/usr/bin/env bash
# Phase 254 verification aggregator (orchestration projection consumption
# wiring: suggest-next / act chain-source blend, vocabulary drift gate,
# server-side composition governance).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   (a) the chain a user sees is the projection's when the projection has an
#       edge for the seed.
#   (b) it is the registry floor when it does not, and never empty.
#   (c) suggest-next and act cannot disagree.
#   (d) the three framework vocabularies cannot silently diverge.
#   (e) no module reachable from decide() gained a Brain require.
#   (f) every mindrian-os handler reaching the Brain is enumerated and
#       belted.
#   (g) an ambiguous Part 8 verdict on the server-side path is disclosed,
#       not silent.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-262.sh). This
# harness globs every tests/test-254-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-254-* file requires NO edit to this runner.
#
# .cjs suites run as PLAIN node scripts (mirrors tests/run-all-271.sh), NOT
# via `node --test` -- this phase's suites use a small local assert-based
# harness (test()/ok() helpers), not node:test.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches (across all six
# plans) for the forbidden U+2014 glyph via its Unicode codepoint escape
# (grep -P '\x{2014}'), so this runner itself carries no literal em-dash
# that would trip its own sweep. Missing paths are skipped, not failed --
# later plans have not landed yet when this file is first committed.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_254_PREFIX=tests/test-254-nonexistent- bash
# tests/run-all-254.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_254_PREFIX:-tests/test-254-}"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

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
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""

# ---------------------------------------------------------------------------
# No-em-dash fence: every file this phase touches, swept for U+2014.
# ---------------------------------------------------------------------------
echo "--- 254 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/workflow/chain-source.cjs"
  "scripts/suggest-next-command.cjs"
  "scripts/act-command.cjs"
  "scripts/check-framework-vocabulary-drift.cjs"
  "lib/mcp/brain-composition-census.cjs"
  "lib/core/brain-client.cjs"
  "lib/mcp/brain-router.cjs"
  "lib/mcp/tools/sensors.cjs"
  "docs/254-NOTE-theo-adaptation-list-additions.md"
  "tests/run-all-254.sh"
  "tests/test-254-projection-chain-source.cjs"
  "tests/test-254-degrade-floor.cjs"
  "tests/test-254-one-chain-source.cjs"
  "tests/test-254-vocabulary-drift.cjs"
  "tests/test-254-composition-census.cjs"
  "tests/test-254-ambiguous-disclosure.cjs"
  "tests/test-254-normalize-roundtrip-probe.cjs"
  "tests/test-254-r7-structural-fence.cjs"
  "tests/test-254-live-normalize-probe.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    (skipped, not yet created): $t"
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 254 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 254 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 254: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
