#!/usr/bin/env bash
# Phase 340 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# canon-currency-audit-and-amendment-v1-24-to-next-close-the-d cluster. Models
# on tests/run-all-190.sh.
#
# Phase 340 lands THREE navigator-gated Canon amendments as Appendix D entries
# 38, 39, and 40 (canon v1.24 -> v1.25 -> v1.26 -> v1.27), following the same
# ONE-atomic-lockstep-wave-per-amendment pattern every prior canon amendment
# used. Plan 01 (Wave 0, this aggregator's own wave) writes ZERO bytes to
# docs/MINDRIAN-CANON.md; it only builds the merge gate and the dated
# live-verification record (340-LIVE-VERIFICATION.md) the later waves read
# instead of trusting 340-RESEARCH.md's numbers.
#
# The three entry floor tests below are registered with run_if (not run):
# their files do not exist yet in this wave, so they SKIP cleanly until their
# amendment wave lands. Each wave flips its own leg from SKIPPED to PASSED
# simply by creating the file the run_if already names -- no aggregator edit
# required per wave.
#
# tests/test-canon-crossref-completeness.cjs and
# tests/test-canon-part-9-ratification.cjs are DELIBERATELY NOT registered
# here: both were already RED on main before this phase started (version
# anchors pinned to canon v1.4 and to a pre-Phase-109 document state, per
# 340-LIVE-VERIFICATION.md's "Pre-existing RED baseline" section). Fixing
# historical test anchors is a separate concern, out of this phase's scope.
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
# CANON-01: entry-38 Sourced Claims FLOOR (Part 12 + agents/larry-extended.md
# mirror). Does not exist in this wave -- SKIPs cleanly until 340-02 lands it.
# ---------------------------------------------------------------------------
run_if "CANON-01 entry-38 Sourced Claims FLOOR" \
  tests/test-canon-entry-38-sourced-claims-floor.cjs \
  node tests/test-canon-entry-38-sourced-claims-floor.cjs

# ---------------------------------------------------------------------------
# CANON-02/03/04: entry-39 graph-substrate FLOOR (Theo/Appendix C origin fix +
# Part 9 two-chokepoint split + Appendix B ICM citations). Does not exist in
# this wave -- SKIPs cleanly until 340-03 lands it.
# ---------------------------------------------------------------------------
run_if "CANON-02/03/04 entry-39 graph-substrate FLOOR" \
  tests/test-canon-entry-39-graph-substrate-floor.cjs \
  node tests/test-canon-entry-39-graph-substrate-floor.cjs

# ---------------------------------------------------------------------------
# CANON-05/06/07/08: entry-40 corpus-figures FLOOR (Part 4 edge reconciliation
# + Part 7 command-count correction + Part 2 Pinecone-retired correction +
# Part 11 illustrative surface-count refresh). Does not exist in this wave --
# SKIPs cleanly until 340-04 lands it.
# ---------------------------------------------------------------------------
run_if "CANON-05/06/07/08 entry-40 corpus-figures FLOOR" \
  tests/test-canon-entry-40-corpus-figures-floor.cjs \
  node tests/test-canon-entry-40-corpus-figures-floor.cjs

# ---------------------------------------------------------------------------
# Regression legs, required GREEN on every wave -- these must never go red as
# the three amendment waves land.
# ---------------------------------------------------------------------------
run "frozen-scalars regression (must stay GREEN every wave)" \
  node tests/test-canon-frozen-scalars-floor.cjs

run "entry-31 two-gauge regression (version anchor moves each wave)" \
  node tests/test-canon-entry-31-two-gauge-floor.cjs

run "entry-36 shape-declaration regression (version anchor moves each wave)" \
  node tests/test-canon-entry-36-shape-declaration-floor.cjs

run "195 seven-kind regression (Part 9 memory complement, guards wave B's Part 9 edit)" \
  node tests/test-195-canon-7-kind-floor.cjs

echo "========================================"
echo "  Summary (340 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
