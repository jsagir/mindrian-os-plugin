#!/usr/bin/env bash
# Phase 250 verification aggregator (HONEST-01, the honesty rail; AVAIL-02,
# the bounded transport retry).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. Four typed refusal kinds (no_key/unreachable/tier_denied/not_ready)
#      land in the refusal-messaging chokepoint (renamed from tier0-messaging
#      in Phase 252-01), honest per-kind, and the shim's
#      transport-null/no-key conflation bug is dead.
#   2. A transient transport failure retries with bounded backoff BEFORE any
#      refusal fires; 401/403 never retry; the null contract is unchanged.
#   3. A not_ready refusal auto-queues an enrichment entry with source
#      refusal, idempotent with the 249 queue.
#   4. The silent-fallback doctrine phrases are dead across skills/, commands/,
#      agents/, dist/ -- proven by a fence that was demonstrably RED first.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-249.sh). This
# harness globs every tests/test-250-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-250-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   250-01  tests/test-250-refusal-shapes.cjs
#   250-01  tests/test-250-transport-retry.cjs
#   250-01  tests/test-250-refusal-queue.cjs
#   250-01  tests/test-250-doctrine-fence.cjs
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'), so this
# runner itself carries no literal em-dash that would trip its own sweep.
# Missing paths are skipped, not failed.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_250_PREFIX=tests/test-250-nonexistent- bash
# tests/run-all-250.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_250_PREFIX:-tests/test-250-}"

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
  run "$(basename "$t")" node --test "$t"
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
echo "--- 250 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/refusal-messaging.cjs"
  "lib/core/brain-client.cjs"
  "bin/mindrian-brain-mcp-client.cjs"
  "lib/core/doctor/class-m-brain-smoke.cjs"
  "skills/brain-connector/SKILL.md"
  "docs/install/BRAIN-SETUP.md"
  "dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md"
  "dist/zed/.agents/skills/brain-connector/SKILL.md"
  "tests/test-250-refusal-shapes.cjs"
  "tests/test-250-transport-retry.cjs"
  "tests/test-250-refusal-queue.cjs"
  "tests/test-250-doctrine-fence.cjs"
  "tests/test-250-provenance-fence.cjs"
  "tests/run-all-250.sh"
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
  echo ">>> 250 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 250 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 250: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
