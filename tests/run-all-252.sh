#!/usr/bin/env bash
# Phase 252 verification aggregator (SWEEP-01, the guard sweep).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. The frozen guard census (allowlist, seam-liveness, counterfeit-gone,
#      doctrine fence, vocabulary canaries) is green -- proven RED first.
#   2. The counterfeit getTier0Chain/getFrameworkChain chains are deleted and
#      the tier0-messaging chokepoint is renamed with the wire byte-locked.
#   3. Routed/conformed guard sites render the honesty rail visibly; the
#      three vocabulary collisions (tier_mode, rs-* Aura, canon cold-start)
#      are untouched.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-250.sh). This
# harness globs every tests/test-252-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-252-* file requires NO edit to this runner.
#
# THE MANDATORY TEST, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   252-01  tests/test-252-guard-census.cjs
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
# without editing this file: TEST_252_PREFIX=tests/test-252-nonexistent- bash
# tests/run-all-252.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_252_PREFIX:-tests/test-252-}"

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
echo "--- 252 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "tests/test-252-guard-census.cjs"
  "tests/run-all-252.sh"
  "lib/core/refusal-messaging.cjs"
  "lib/core/refusal-messaging.test.cjs"
  "lib/core/brain-client.cjs"
  "bin/mindrian-brain-mcp-client.cjs"
  "lib/core/doctor/class-m-brain-smoke.cjs"
  "lib/mcp/brain-router.cjs"
  "lib/brain/chain-recommender.cjs"
  "lib/brain/framework-chain-slice.cjs"
  "lib/core/research-corpus.cjs"
  "lib/core/brain-derivation.cjs"
  "lib/hmi/tier-check.cjs"
  "lib/core/rs-chain-feeder.cjs"
  "lib/core/rs-brain-substrate.cjs"
  "lib/core/rs-expert-brain-projection.cjs"
  "scripts/rs-explain-command.cjs"
  "scripts/brain-derive-command.cjs"
  "skills/conversation-mode/SKILL.md"
  "skills/rs-experts/SKILL.md"
  "skills/rs-fetch/SKILL.md"
  "skills/rs-explain/SKILL.md"
  "commands/rs-experts.md"
  "commands/rs-fetch.md"
  "commands/rs-explain.md"
  "dist/generic-claude-dir/.claude/skills/conversation-mode/SKILL.md"
  "dist/zed/.agents/skills/conversation-mode/SKILL.md"
  "dist/generic-claude-dir/.claude/skills/rs-experts/SKILL.md"
  "dist/zed/.agents/skills/rs-experts/SKILL.md"
  "dist/generic-claude-dir/.claude/skills/rs-fetch/SKILL.md"
  "dist/zed/.agents/skills/rs-fetch/SKILL.md"
  "dist/generic-claude-dir/.claude/skills/rs-explain/SKILL.md"
  "dist/zed/.agents/skills/rs-explain/SKILL.md"
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
  echo ">>> 252 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 252 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 252: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
