#!/usr/bin/env bash
# Phase 182 verification aggregator -- the single PASS/FAIL gate for the SIGNAL
# Voice-Color + Render cluster. Mirrors tests/run-all-180.sh.
#
# Phase 182 makes the Part 12 Voice Signature ENFORCED, not aspirational: a Larry
# CLI turn missing its De Stijl voice-color mark fails a test (SIGNAL-02), and the
# R15 render-coverage gate (SIGNAL-01) is re-run as a permanent, repeatable check.
# The honest residual is preserved: this gate proves the DECLARED CONVENTION + the
# detector predicate + the frozen contracts, NOT a per-token runtime recolor (no
# such mechanism exists; the residual is a named, asserted doctrine line in the
# SIGNAL-02 test). The 182 build mints NO reach, NO posture, NO edge, NO node, NO
# new color, and opens NO Brain wire (Part 8 LOCAL).
#
# Four legs:
#   (a) SIGNAL-01 R15 gate: node scripts/check-render-coverage.cjs --check
#       (the R15 render-coverage gate from Plan 182-01 Task 1, enshrined here as a
#       permanent check). UNGUARDED + hard-FAIL: the SIGNAL-01 verify can never be
#       silently skipped.
#   (b) SIGNAL-01 lean: node tests/test-ga4-card-fire-interceptor.cjs (the Phase 179
#       GA-4 interceptor still passes). File-guarded: a missing 179 suite is a SKIP,
#       not a hard FAIL.
#   (c) SIGNAL-02: node tests/test-larry-voice-mark-182.cjs (the missing-mark +
#       doctrine-declaration drift test).
#   (d) carried frozen-set drift fences (proof D2/D4 mint no frozen-set member):
#       reach-ids-drift (frozen 6) + posture-ids-drift (frozen 3), each file-guarded.
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
# run_if: run a suite only when its file exists; otherwise record a SKIP. Used for
# the carried 179 lean + the frozen-set fences so a leaned-on suite that is absent
# is a visible SKIP, not a silent hard FAIL.
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

# (a) SIGNAL-01 -- the R15 render-coverage gate, UNGUARDED + hard-FAIL (the SIGNAL-01
#     verify enshrined as a permanent check; it can never be silently skipped).
run "SIGNAL-01 R15 render-coverage gate" node scripts/check-render-coverage.cjs --check

# (b) SIGNAL-01 lean -- the Phase 179 GA-4 card-fire interceptor still passes.
run_if "SIGNAL-01 lean: 179 GA-4 card-fire interceptor" \
  tests/test-ga4-card-fire-interceptor.cjs \
  node tests/test-ga4-card-fire-interceptor.cjs

# (c) SIGNAL-02 -- the missing-mark + doctrine-declaration drift test.
run "SIGNAL-02 larry-voice-mark missing-mark test" node tests/test-larry-voice-mark-182.cjs

# (d) carried frozen-set drift fences (additive phase -- 182 mints NO reach, NO
#     posture, NO edge, NO node; these stay GREEN, proving D2/D4).
run_if "reach-ids-drift (frozen 6)"   tests/test-reach-ids-drift.cjs   node tests/test-reach-ids-drift.cjs
run_if "posture-ids-drift (frozen 3)" tests/test-posture-ids-drift.cjs node tests/test-posture-ids-drift.cjs

echo "========================================"
echo "  Summary (182 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
