#!/usr/bin/env bash
# Phase 247-02 verification aggregator (CONTRACT-01, the plugin-side Brain
# surface contract).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. callTool distinguishes a tier denial (HTTP 403, tier_denied sentinel)
#      from an outage (null), and every direct callTool consumer handles the
#      sentinel (passthrough or explicit), hermetically, with a demonstrated
#      red proof.
#   2. The client fixture test derives its expectations from the vendored
#      data/brain-surface-contract.json -- a contract edit propagates without
#      test rewrites -- and the drift-detection checker itself can fail
#      (proven against an in-memory mutated contract).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-246.sh). This
# harness globs every tests/test-247-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-247-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   247-02  tests/test-247-brain-client-403.cjs
#   247-02  tests/test-247-contract-client.cjs
#
# scripts/probe-brain-contract.cjs (conformance leg 3, the live drift probe)
# is NOT run by this harness -- it is a RELEASE GATE against the deployed
# Render service, not a commit gate. This runner only syntax-checks it
# (node --check), matching the plan's own verify command.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'), so this
# runner itself carries no literal em-dash that would trip its own sweep.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_247_PREFIX=tests/test-247-nonexistent- bash
# tests/run-all-247.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_247_PREFIX:-tests/test-247-}"

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
# scripts/probe-brain-contract.cjs -- syntax-check only. It is the live
# drift probe (release gate, not a commit gate); it is not invoked against
# Render by this runner.
# ---------------------------------------------------------------------------
echo "--- scripts/probe-brain-contract.cjs (syntax check only) ---"
if node --check "$ROOT/scripts/probe-brain-contract.cjs"; then
  echo ">>> probe-brain-contract.cjs syntax check: PASSED"; PASS=$((PASS+1))
else
  echo ">>> probe-brain-contract.cjs syntax check: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# No-em-dash fence: every file this phase touches, swept for U+2014.
# ---------------------------------------------------------------------------
echo "--- 247 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "data/brain-surface-contract.json"
  "docs/BRAIN-SURFACE-CONTRACT.md"
  "lib/core/brain-client.cjs"
  "tests/test-247-brain-client-403.cjs"
  "tests/test-247-contract-client.cjs"
  "scripts/probe-brain-contract.cjs"
  "tests/run-all-247.sh"
)
# rc 0 = a hit, rc 1 = clean, rc >= 2 = the scan itself broke (fence FAILURE,
# per the run-all-246.sh precedent: a grep that errors must never report a
# silent pass).
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
  echo ">>> 247 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 247 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 247: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
