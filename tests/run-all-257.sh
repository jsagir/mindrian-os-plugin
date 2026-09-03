#!/usr/bin/env bash
# Phase 257 verification aggregator -- part-8-enforcement-locus-host-independent-
# egress-guard (the SKIP-safe PASS/FAIL/SKIP gate for this phase's own test
# files, plus the three adjacent regression suites this phase must not break).
# Cloned from tests/run-all-239.sh's structure and SKIP-safe discipline.
#
# WHAT A SKIP MEANS HERE: a Plan in this phase's own wave sequence has not
# landed yet, so its test file is absent (e.g. Plan 08's
# tests/test-257-strict-input-shapes.cjs before Plan 08 runs). A SKIP is
# expected and NOT a failure while the phase is mid-execution; it becomes a
# real PASS/FAIL leg the moment that plan's test file is authored, with zero
# change needed to this script.
#
# This aggregator is reported AGAINST
# .planning/phases/257-part-8-enforcement-locus-host-independent-egress-guard/257-BASELINE.md
# (the pre-change value of every gate this phase reports against, per D-10),
# never claimed green in isolation.
#
# bash only. No emoji. No em-dashes.

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
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# ---------------------------------------------------------------------------
# Glob-derived member census (Pitfall 4 discipline -- same reason
# tests/test-257-brain-tool-egress-invariant.cjs derives its tool list from a
# live tools/list instead of freezing an array): the actual member set on
# disk is discovered by globbing, not hand-maintained as a second frozen
# list. Any tests/test-257-*.cjs file present on disk that this script does
# NOT already know how to run is printed as an explicit UNEXPECTED MEMBER
# line, so a new 257 test added later is visible rather than silently
# skipped by the run_if legs below (which still need their own explicit
# call to actually execute a new file -- the glob census is the tripwire
# that tells a reader to add one).
# ---------------------------------------------------------------------------
EXPECTED_MEMBERS="tests/test-257-refusal-egress-kind.cjs
tests/test-257-envelope-passthrough.cjs
tests/test-257-shim-honest-refusal.cjs
tests/test-257-brain-tool-egress-invariant.cjs
tests/test-257-strict-input-shapes.cjs"

GLOBBED_MEMBERS="$(ls tests/test-257-*.cjs 2>/dev/null | sort)"
if [ -n "$GLOBBED_MEMBERS" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    found=0
    while IFS= read -r e; do
      [ "$f" = "$e" ] && found=1
    done <<< "$EXPECTED_MEMBERS"
    if [ "$found" -eq 0 ]; then
      echo ">>> UNEXPECTED MEMBER: $f is present on disk but not in this aggregator's expected member list -- add an explicit run_if leg for it."
    fi
  done <<< "$GLOBBED_MEMBERS"
fi
echo ""

# ---------------------------------------------------------------------------
# 257's own arms, one run_if leg per Plan-owned test file. Plans 01/02/06/07
# are landed as of this script's authoring (Plan 07); Plan 08 has not yet
# run, so its leg SKIPs cleanly until it does.
# ---------------------------------------------------------------------------
run_if "Plan 01 (LOCUS-01) refusal egress kind" \
  tests/test-257-refusal-egress-kind.cjs \
  node tests/test-257-refusal-egress-kind.cjs

run_if "Plan 02 (LOCUS-02) envelope passthrough" \
  tests/test-257-envelope-passthrough.cjs \
  node tests/test-257-envelope-passthrough.cjs

run_if "Plan 06 (LOCUS-01/02) shim honest refusal, G1/G3 wire proof" \
  tests/test-257-shim-honest-refusal.cjs \
  node tests/test-257-shim-honest-refusal.cjs

run_if "Plan 07 (LOCUS-03, D-06) brain-tool egress invariant, the locked proof" \
  tests/test-257-brain-tool-egress-invariant.cjs \
  node tests/test-257-brain-tool-egress-invariant.cjs

run_if "Plan 08 (LOCUS-07) strict input shapes" \
  tests/test-257-strict-input-shapes.cjs \
  node tests/test-257-strict-input-shapes.cjs

# ---------------------------------------------------------------------------
# Adjacent regression suites this phase must not break. Labelled REGRESSION,
# never counted as a 257 arm -- these are pre-existing suites Phase 257 reads
# but does not own.
# ---------------------------------------------------------------------------
run_if "REGRESSION 239 query egress canary (must stay green)" \
  tests/test-239-query-egress-canary.cjs \
  node tests/test-239-query-egress-canary.cjs

run_if "REGRESSION 254 ambiguous disclosure (must stay green)" \
  tests/test-254-ambiguous-disclosure.cjs \
  node tests/test-254-ambiguous-disclosure.cjs

run_if "REGRESSION 254 composition census (must stay green)" \
  tests/test-254-composition-census.cjs \
  node tests/test-254-composition-census.cjs

echo "========================================"
echo "  Summary (257 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
