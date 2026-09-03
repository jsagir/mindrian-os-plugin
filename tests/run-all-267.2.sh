#!/usr/bin/env bash
# Phase 267.2 verification aggregator (First-Install Hooked Loop Repair:
# Reward leg GAP R-1, Investment leg GAP I-1, W0 SEED-021 scope revert).
#
# Mirrors tests/run-all-267.1.sh. Runs `node "$t"` bare, never node's built-in
# test-runner flag -- every Phase 267.2 test is a plain script that throws or
# calls process.exit(1), not a node:test file.
#
# TEST FILE PREFIX uses the dash form `test-267-2-`, not `test-267.2-`: every
# existing phase test is `tests/test-<int>-<slug>.cjs` and a literal dot in the
# filename would collide with extension parsing. The AGGREGATOR filename keeps
# the dot (`run-all-267.2.sh`) to match run-all-267.1.sh's phase-named form.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors run-all-267.1.sh / run-all-266.sh).
# Adding a tests/test-267-2-* file requires NO edit to this runner.
#
# THREE EXPLICIT GATE LINES, named here even though they carry no test-267-2-
# prefix for the glob to find:
#   - tests/test-209-session-start-exemplar.cjs -- W1 rewrites the FIRST_INSTALL
#     COLD_START_MENU region of scripts/session-start this test guards (the
#     FIRST_INSTALL / MODE_MENU= / "Other rooms detected" SEED-021 contract).
#   - tests/test-267-1-first-install-hooked-audit.cjs -- W0 reverts the exact
#     SEED-021 AskUserQuestion clause this audit test pins, and W2 closes the
#     GAP I-1 leg (currently failing) inside the SAME file; both edits land in
#     this phase.
#   - tests/run-all-267.3.sh -- the reward-before-investment guard jurisdiction
#     aggregator; W1/W2 touch scripts/session-start and lib/core/, both inside
#     that guard's declared scope.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix must FAIL,
# not print green; that is what TEST_267_2_PREFIX exists to prove without
# editing this file.
#
# NO-EM-DASH FENCE, split into TWO arrays because one target lives outside
# the repo:
#   EMDASH_TARGETS (repo-relative, resolved as $ROOT/$t) -- a MISSING file is
#     a failure unless TEST_267_2_ALLOW_MISSING=1 is set. Set that override
#     during earlier waves of this phase, since several targets below do not
#     exist until later plans (267.2-03 through -10) land; a later plan's
#     final gate should run without it.
#   EMDASH_ABS_TARGETS (absolute paths) -- a MISSING file increments SKIP and
#     prints an explicit line, never a failure, because the rethinking room
#     (~/MindrianRooms/rethinking-mindrianos/) is machine-local and does not
#     exist on every checkout.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_267_2_PREFIX=tests/test-267-2-nonexistent-
# bash tests/run-all-267.2.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_267_2_PREFIX:-tests/test-267-2-}"

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

# ---------------------------------------------------------------------------
# DISCOVERY: glob every tests/test-267-2-* file. Bare `node "$t"`.
# ---------------------------------------------------------------------------
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
# EXPLICIT GATE LINES: pre-existing, always-present files, listed explicitly
# rather than relying on the glob (they carry no test-267-2- prefix). A test
# that is never discovered is worse than no test, because the harness still
# prints green.
# ---------------------------------------------------------------------------
run "209 session-start exemplar (FIRST_INSTALL / COLD_START_MENU contract W1 rewrites)" node tests/test-209-session-start-exemplar.cjs
run "267.1 first-install hooked audit (W0 reverts its Action-leg pin, W2 closes its GAP I-1 leg)" node tests/test-267-1-first-install-hooked-audit.cjs
run_may_skip "267.3 reward-before-investment guard jurisdiction aggregator" bash tests/run-all-267.3.sh

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE: clone the run-all-267.1.sh fence, split into a
# repo-relative array and an absolute-path array (the room mirror lives
# outside the repo).
# ---------------------------------------------------------------------------
echo "--- 267.2 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0

EMDASH_TARGETS=(
  "scripts/session-start"
  "scripts/first-install-router.cjs"
  "lib/core/greeting-intent-detector.cjs"
  "lib/core/user-archetype.cjs"
  "commands/ignite.md"
  "skills/ignite/SKILL.md"
  "data/first-reward-surfaces.json"
  "hooks/hooks.json"
  "tests/run-all-267.2.sh"
  "tests/test-267-2-helpers.cjs"
)

EMDASH_ABS_TARGETS=(
  "${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}/rethinking-mindrianos/research/2026-08-27-hooked-first-install-audit/2026-08-27-hooked-first-install-audit.md"
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
    echo "    MISSING (not yet created): $t"
    EMDASH_MISSING=$((EMDASH_MISSING+1))
  fi
done
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_267_2_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_267_2_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi

for t in "${EMDASH_ABS_TARGETS[@]}"; do
  if [ -f "$t" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$t" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    SKIP (room mirror not present on this checkout): $t"
    SKIP=$((SKIP+1))
  fi
done

if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 267.2 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 267.2 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 267.2: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
