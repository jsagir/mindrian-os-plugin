#!/usr/bin/env bash
# Phase 189 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# HITL Memory Governance cluster. Cloned from tests/run-all-195.sh (run/run_if
# SKIP-safe helpers + PASS/FAIL/SKIP counters + the frozen-scalar membrane grep).
#
# Phase 189 repoints the shipped F.8/F.9 confirm/cascade surfaces at the general
# memory-write path (nuggets/claims/edges) per SEED-040. It mints EXACTLY THREE
# net-new frozen-set members (REMEMBERED_AS / ATTRIBUTED_TO / NOT_REMEMBERED_BECAUSE)
# and NO new node label (Canon Part 4/Part 7: additive edge properties only). It
# mints NO new frozen scalar: the Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, the
# 0.70/0.15 gate) are UNTOUCHED.
#
# WAVE 0 CONTRACT: this runner is authored in Wave 1 (189-01). The edge-floor leg is
# HARD from Wave 0 because 189-01 mints the types + authors the floor test in the same
# plan. Every downstream module leg is run_if (SKIP-safe until its file exists), so
# this runner exits cleanly (PASS + SKIP only) before 189-02/03/04 land. As those
# waves land, the SKIPs flip to runs and the gate tightens. Missing test files SKIP,
# they do not FAIL.
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
# The frozen-scalar membrane grep leg (HARD, green in Wave 0). CLAUDE.md must
# still carry the exact membrane substring. Pure read-only assertion over a
# tracked file; it never mutates anything. (Clone of run-all-195.sh:56-59.)
# ---------------------------------------------------------------------------
membrane_grep() {
  grep -qF "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen" "$ROOT/CLAUDE.md"
}
run "membrane grep (CLAUDE.md frozen-scalar line)" membrane_grep

# ---------------------------------------------------------------------------
# Wave-0/Wave-1 HARD FLOOR. The edge-vocabulary floor MUST be green now: 189-01
# mints REMEMBERED_AS / ATTRIBUTED_TO / NOT_REMEMBERED_BECAUSE and authors the
# floor test in the SAME plan, so this leg is HARD (run, not run_if) from the
# moment 189-01 lands. Membership assertion only, never .size (concurrency-safe).
# ---------------------------------------------------------------------------
run "HMG-08 edge FLOOR (three governance types by named membership, never .size)" \
  node tests/test-189-edge-floor.cjs

# ---------------------------------------------------------------------------
# Module legs. Each is run_if (SKIP until its wave lands), flipping to a run as
# the file appears. Named after the test files the later 189-02/03/04 plans author.
# ---------------------------------------------------------------------------

# 189-02 -- governance-candidate contract consumers + the F.8 governance gate.
run_if "189-02 governance candidate contract consumers" \
  tests/test-189-governance-candidates.cjs \
  node tests/test-189-governance-candidates.cjs

run_if "189-02 F.8 governance confirm gate" \
  tests/test-189-f8-governance-gate.cjs \
  node tests/test-189-f8-governance-gate.cjs

# 189-03 -- F.9 cascade repoint + WHO attribution.
run_if "189-03 F.9 cascade repoint (REMEMBERED_AS / NOT_REMEMBERED_BECAUSE)" \
  tests/test-189-cascade-f9.cjs \
  node tests/test-189-cascade-f9.cjs

run_if "189-03 WHO attribution (ATTRIBUTED_TO + memory_layer enum)" \
  tests/test-189-who-attribution.cjs \
  node tests/test-189-who-attribution.cjs

# 189-04 -- multi-session reuse.
run_if "189-04 multi-session candidate reuse" \
  tests/test-189-multisession-reuse.cjs \
  node tests/test-189-multisession-reuse.cjs

echo "========================================"
echo "  Summary (189 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
