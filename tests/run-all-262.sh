#!/usr/bin/env bash
# Phase 262 verification aggregator (FLOOR-01 measurement machinery, FLOOR-02
# fixture inversion, D-07 projection probe).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   (a) the ratified denominator is not narrowed and matches the live
#       frontmatter scan 1:1.
#   (b) the orchestration projection surfaces zero <SEP> nodes (D-07).
#   (c) a successful probe carrying a payload the gate cannot read produces
#       VOID with exit 3, never a false MISS (the Theo tripwire, D-04).
#   (d) the keyless fixture asserts REFUSAL and was never deleted (FLOOR-02).
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-259.sh). This
# harness globs every tests/test-262-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-262-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   tests/test-262-floor-denominator.cjs
#   tests/test-262-sep-projection-probe.cjs
#   tests/test-262-unrecognized-shape-voids.cjs
#   tests/test-262-refusal-fixture-retained.cjs
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
# without editing this file: TEST_262_PREFIX=tests/test-262-nonexistent- bash
# tests/run-all-262.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_262_PREFIX:-tests/test-262-}"

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
echo "--- 262 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "scripts/check-flagship-floor.cjs"
  "scripts/build-brain-census.cjs"
  "tests/test-262-floor-denominator.cjs"
  "tests/test-262-sep-projection-probe.cjs"
  "tests/test-262-unrecognized-shape-voids.cjs"
  "tests/test-262-refusal-fixture-retained.cjs"
  "tests/test-127-03-acceptance-gates.sh"
  "tests/test-127-02-doctor-class-m.sh"
  "tests/test-127-00-shim-handshake.sh"
  "tests/fixtures/127-03-acceptance/no-identity-refusal/README.md"
  "docs/262-FLOOR-01-GAP-LEDGER.md"
  "docs/262-LIVE-MEASUREMENT-EVIDENCE.md"
  "docs/262-WORKORDER-brain-repo-floor-remediation.md"
  "docs/262-NOTE-theo-adaptation-list-additions.md"
  "tests/run-all-262.sh"
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
  echo ">>> 262 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 262 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 262: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
