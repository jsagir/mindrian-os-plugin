#!/usr/bin/env bash
# Phase 190 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# shape-f-declaration-mandate cluster (R16: every invocable surface is born with
# a declared HITL Shape-F). Models on tests/run-all-188.sh.
#
# Phase 190 ships the born-declared-shape mandate across FOUR surface classes
# (commands, agents, pipelines, qualifying skills): the closed Shape-F schema
# (data/hitl-shape-declaration-schema.json), the idempotent backfill applier
# (scripts/backfill-hitl-shape.cjs), the pure validation gate
# (scripts/check-shape-declaration.cjs), and the enforcement wiring into
# pre-commit + release.sh + doctor --acceptance. A no-fork skill is EXEMPT via
# its existing connector.excluded:true + reason (Canon Part 11 R1) -- the gate
# reuses that CIRS exclusion signal rather than minting a parallel field.
#
# The required-green legs in this wave (Waves 1-3 landed):
#   (1) the backfill generator's own test file;
#   (2) the gate's own test file;
#   (3) the gate's --check mode against the REAL, backfilled four-class tree
#       (the "check-shape-declaration gate leg" the aggregator must carry).
# The Plan 05 canon FLOOR test is registered as run_if: its file does not exist
# in this wave, so it SKIPs cleanly until Plan 05's canon amendment lands.
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
# SFD-01/02: the backfill generator's own test file (the ground-truth applier
# that wrote the 126 declarations from data/hitl-shape-backfill.json). Required
# green -- it lands in this wave.
# ---------------------------------------------------------------------------
run_if "SFD backfill generator (scripts/backfill-hitl-shape.test.cjs)" \
  scripts/backfill-hitl-shape.test.cjs \
  node scripts/backfill-hitl-shape.test.cjs

# ---------------------------------------------------------------------------
# SFD-04: the gate's own test file (the pure check() predicate validated against
# the synthetic fixtures under data/hitl-shape-declaration-fixtures/). Required
# green -- it lands in this wave.
# ---------------------------------------------------------------------------
run_if "SFD gate unit tests (scripts/check-shape-declaration.test.cjs)" \
  scripts/check-shape-declaration.test.cjs \
  node scripts/check-shape-declaration.test.cjs

# ---------------------------------------------------------------------------
# SFD-04/05: the LIVE gate leg -- --check mode against the real, backfilled
# four-class tree (commands + agents + pipelines + skills). This is the
# check-shape-declaration gate leg the phase aggregator must carry. HARD-FAIL:
# a surface silently missing both a Shape-F declaration and a CIRS exclusion
# exits non-zero and FAILs this leg. The gate walks the tree at run time; it
# never trusts a hardcoded surface count.
# ---------------------------------------------------------------------------
run_if "SFD-04 live gate (--check against the real four-class tree)" \
  scripts/check-shape-declaration.cjs \
  node scripts/check-shape-declaration.cjs --check

# ---------------------------------------------------------------------------
# Plan 05 canon FLOOR: the born-declared-shape canon amendment's guard test.
# Plan 05's navigator-gated canon amendment landed (Part 11 R16 + Appendix D
# entry 36 + canon v1.23), so this leg now RUNS the real entry-36 FLOOR test
# (R16 present naming all four surface classes, entry 36 naming hitl_shape + the
# skills fold-in, prior entries 1-35 preserved, version 1.23, the count framed
# enumerated-from-disk never a frozen scalar) instead of SKIPping.
# ---------------------------------------------------------------------------
run_if "SFD-06 canon FLOOR (entry 36 R16 born-declared-shape canon byte guard)" \
  tests/test-canon-entry-36-shape-declaration-floor.cjs \
  node tests/test-canon-entry-36-shape-declaration-floor.cjs

echo "========================================"
echo "  Summary (190 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
