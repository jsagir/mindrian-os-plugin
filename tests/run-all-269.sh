#!/usr/bin/env bash
# Phase 269 verification aggregator (moat shift: install/update entitlement
# gate replaces per-query key checks).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. MOAT-01: decisions.md row 1 names install/update as the enforcement
#      point, dropping the per-query key-check framing.
#   2. MOAT-02: decisions.md row 5 keeps "remote by design, not optional by
#      default" verbatim and adds the per-query-keys-are-gone clause.
#   3. MOAT-03: moat.md carries a commercial-boundary paragraph.
#   4. MOAT-04: the dated amendment doc records all four cross-cutting flags.
#   5. MOAT-05: zero entitlement-check code ships this phase.
#
# DISCOVERY IS BY GLOB, PLUS AN EXPLICIT ANCHOR LEG (mirrors tests/run-all-266.sh
# for the glob half). This harness globs every tests/test-269-* file (both
# .cjs and .sh) and runs it. Adding a tests/test-269-* file requires NO edit
# to this runner.
#
# WHY AN EXPLICIT ANCHOR LEG IS ALSO NEEDED, written down rather than assumed
# because .planning/ is gitignored and this tracked file is the only place
# the reasoning survives across a machine switch: 269-RESEARCH.md and
# 269-VALIDATION.md both fix the doctrine test's name as
# tests/269-doctrine-reconcile.test.cjs, which the tests/test-269- glob
# cannot see (it does not start with that prefix). Without the anchor leg,
# this phase's own doctrine fence would silently never run and the harness
# would still print green.
#
# WHY tests/test-250-amendment-unit.cjs AND tests/test-250-doctrine-fence.cjs
# ARE EXPLICIT LEGS TOO: they already pin decisions.md rows 1 and 5 by exact
# substring (test-250-amendment-unit.cjs:99-117) and scan decisions.md for
# forbidden doctrine phrases (test-250-doctrine-fence.cjs:113). This is the
# coupling this phase is most likely to break, and no Phase 269 glob will
# ever discover them since they carry no test-269- prefix.
#
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing under an intentionally-nonexistent prefix AND anchor
# must FAIL, not print green; that is what TEST_269_PREFIX and
# TEST_269_ANCHOR exist to prove without editing this file.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'). A
# missing target counts toward EMDASH_MISSING and FAILS the fence unless
# TEST_269_ALLOW_MISSING=1 is set. This plan (269-01) runs with it set,
# because docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md does not
# exist yet (plan 02 creates it). The phase's final gate plan runs WITHOUT
# it -- that unset run is what proves every listed file actually exists.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Both override variables exist ONLY so the discovery legs are provable
# without editing this file:
#   TEST_269_PREFIX=tests/test-269-nonexistent- and
#   TEST_269_ANCHOR=tests/269-nonexistent.test.cjs
# together must make the found-eq-0 guard exit non-zero. Production runs
# never set either.
PREFIX="${TEST_269_PREFIX:-tests/test-269-}"
ANCHOR="${TEST_269_ANCHOR:-tests/269-doctrine-reconcile.test.cjs}"

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
# DISCOVERY: glob every tests/test-269-* file, then the explicit anchor leg.
# Bare `node "$t"`, NOT `node --test "$t"` -- this repo's aggregators invoke
# node:test files bare and still get a non-zero exit on failure
# (tests/run-all-264.sh:98's written comment; tests/test-250-doctrine-fence.cjs
# proves both idioms coexist).
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

if [ -f "$ANCHOR" ]; then
  found=$((found+1))
  run "269 doctrine reconcile (MOAT-01 through MOAT-05)" node "$ANCHOR"
fi

if [ $found -eq 0 ]; then
  echo "!!! no Phase 269 test files discovered"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# EXPLICIT GATE LEGS: the Phase 250 coupling this phase is most likely to
# break, plus the structural born-wired gate. None of these carry a
# tests/test-269- prefix, so the glob above will never discover them.
# ---------------------------------------------------------------------------
run "250 amendment unit (decisions.md rows 1/5/8 lockstep)" node tests/test-250-amendment-unit.cjs
run "250 doctrine fence (living-docs forbidden phrases)"    node tests/test-250-doctrine-fence.cjs
run "connector registry born-wired --check"                 node scripts/build-connector-registry.cjs --check

# ---------------------------------------------------------------------------
# NO-EM-DASH FENCE (C-01): clone the donor's fence at tests/run-all-266.sh
# including the rc >= 2 SCAN BROKE arm (a broken grep -P must FAIL, never
# silently pass). A missing target counts into EMDASH_MISSING and FAILS the
# fence when EMDASH_MISSING > 0, UNLESS TEST_269_ALLOW_MISSING=1 is set.
# ---------------------------------------------------------------------------
echo "--- 269 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_MISSING=0
EMDASH_TARGETS=(
  ".claude/includes/decisions.md"
  ".claude/includes/moat.md"
  "docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md"
  "tests/269-doctrine-reconcile.test.cjs"
  "tests/run-all-269.sh"
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
if [ "$EMDASH_MISSING" -gt 0 ] && [ "${TEST_269_ALLOW_MISSING:-0}" != "1" ]; then
  echo "    $EMDASH_MISSING target(s) missing and TEST_269_ALLOW_MISSING is not set"
  EMDASH_OK=0
fi
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 269 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 269 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 269: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
