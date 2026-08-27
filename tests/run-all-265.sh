#!/usr/bin/env bash
# Phase 265 verification aggregator (capability-radar-absorption-routing).
#
# WHAT THIS PHASE HAS TO PROVE (Plan 01, the mechanism-first plan): the
# capability ledger this phase's later plans write to is machine-readable,
# schema-valid, and cannot silently rot -- a freshness tripwire fails a build
# when the ledger falls behind the installed Claude Code version, on two
# independent paths (a plain test script AND a registered doctor organ).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-264.sh). This
# harness globs every tests/test-265-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-265-* file requires NO edit to this runner.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_265_ALLOW_PENDING=1 is set (waves 1 and 2 run with it set; plan
# 265-06's phase gate runs WITHOUT it -- that is what proves every target
# file actually exists).
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_265_PREFIX=tests/test-265-nonexistent- bash
# tests/run-all-265.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_265_PREFIX:-tests/test-265-}"

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
# DISCOVERY: glob every tests/test-265-* file. Bare `node "$t"`, NOT
# `node --test "$t"` -- every Phase 265 test is a plain script that throws or
# calls process.exit(1), not a node:test file.
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
# EXPLICIT ALWAYS-PRESENT GATE LINES: pre-existing, already-shipped gates
# that already support --check. Listed explicitly rather than relying on the
# glob (they carry no test-265- prefix).
# ---------------------------------------------------------------------------
run "connector registry born-wired --check (Canon Part 11)" node scripts/build-connector-registry.cjs --check
run "skill mirrors drift --check (commands-to-mirrors)"     node scripts/build-skill-mirrors.cjs --check

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (house rule): sweeps every file this phase touches for the
# forbidden U+2014 glyph via its Unicode codepoint escape. DIVERGENCE FROM
# THE DONOR run-all-264.sh, deliberate: the missing-target escape here is
# TEST_265_ALLOW_PENDING (not the donor's TEST_264_ALLOW_MISSING) -- waves 1
# and 2 run with it set; plan 265-06 runs the phase gate WITHOUT it, which is
# what proves every target file actually exists.
# ---------------------------------------------------------------------------
echo "--- 265 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  "data/capability-ledger.json"
  "lib/core/doctor/capability-ledger-module.cjs"
  "lib/mcp/gate-render.cjs"
  "commands/act.md"
  "commands/persona.md"
  "commands/grade.md"
  "commands/radar.md"
  "commands/trending-to-absurd.md"
  "commands/explore-opportunity.md"
  "references/capability-radar/capabilities-index.md"
  "references/capability-radar/changelog-cache.md"
  "docs/RADAR-ABSORPTION-265.md"
  "tests/test-265-capability-ledger-schema.cjs"
  "tests/test-265-ledger-freshness.cjs"
  "tests/run-all-265.sh"
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_265_ALLOW_PENDING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_265_ALLOW_PENDING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 265 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 265 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 265: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
