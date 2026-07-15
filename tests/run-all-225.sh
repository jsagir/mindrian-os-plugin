#!/usr/bin/env bash
# Phase 225 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# per-session-room-binding zero-score no-match gate + the WAL-reset doctor
# advisory. Cloned verbatim from tests/run-all-194.sh (run/run_if helpers
# byte-identical), retargeted to the three 225 test files.
#
# Phase 225 is gap-closure on Phase 194's already-shipped substrate (see
# 225-RESEARCH.md: Phase 194 shipped all four SEED-039 pillars). It closes two
# disjoint holes: (1) the intent-classifier.cjs:509 zero-score early-return that
# silently suppressed the F.8 gate on a conversational reframe that matched NO
# room (SEED-039 proving_case_2, the Gaurav student-reframe incident); and (2)
# a never-block doctor advisory for the Phase-218 upstream SQLite WAL-reset
# corruption window (< 3.51.3 AND a live co-session).
#
# WAVE CONTRACT: each 225 test leg is run_if (SKIP-safe until its file exists),
# so an out-of-order wave merge exits cleanly with SKIPs. By this final wave all
# three 225 test files are on disk, so nothing SKIPs. The last leg is an
# UNCONDITIONAL run of tests/run-all-194.sh: the shipped Phase-194 substrate must
# stay green under this phase's classifier edit (RESEARCH.md Sampling Rate), so a
# 194 regression fails THIS phase's gate (threat T-225-11, shipped-substrate guard).
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
# Leg (a): REQ-1/REQ-2 zero-score no-match gate (proving_case_2 FIRE + the four
# legitimate-silence legs + the consumer-compatibility trace proof). Fires the
# distinct F.8 "no room matched" gate (continue-in-primary / new-project /
# no-room), never the arbitrary corpus[0] best.name.
# ---------------------------------------------------------------------------
run_if "REQ-1/REQ-2 zero-score no-match gate (proving_case_2 fire + 4 silence legs)" \
  tests/test-225-zero-score-gate.cjs \
  node tests/test-225-zero-score-gate.cjs

# ---------------------------------------------------------------------------
# Leg (b): REQ-3 gate degrade -- a poisoned binding / corrupt trace degrades to
# exit-0 silence, never a hard-block (the 83-07 never-block contract).
# ---------------------------------------------------------------------------
run_if "REQ-3 gate degrade (poisoned binding/trace -> exit-0 silence)" \
  tests/test-225-gate-degrade.cjs \
  node tests/test-225-gate-degrade.cjs

# ---------------------------------------------------------------------------
# Leg (c): REQ-4 doctor WAL-reset advisory -- fires a never-block WARN only on
# bundled SQLite < 3.51.3 AND a live co-session; never fires otherwise; never
# crashes; never blocks (report.healthy + exit code untouched).
# ---------------------------------------------------------------------------
run_if "REQ-4 doctor WAL-reset advisory (fire/no-fire/never-crash/never-block)" \
  tests/test-225-wal-advisory.cjs \
  node tests/test-225-wal-advisory.cjs

# ---------------------------------------------------------------------------
# Leg (c2): 225-REVIEW-FIX CR-01/WR-03 -- the zero-score gate's answer-
# consumption path must never silently narrow a multi-room session bind (the
# gate's fixed 3-option set never lists sibling bound rooms as toggles, so
# answering it must union with, never replace, the prior bound set).
# ---------------------------------------------------------------------------
run_if "225-REVIEW-FIX CR-01/WR-03 answer-narrowing regression (multi-bound session survives the gate answer)" \
  tests/test-225-answer-narrowing.cjs \
  node tests/test-225-answer-narrowing.cjs

# ---------------------------------------------------------------------------
# Leg (d): Phase-194 substrate regression guard (PSB suite), UNCONDITIONAL.
# The shipped substrate this phase edits (intent-classifier.cjs) must stay green.
# A 194 regression fails THIS phase's gate (threat T-225-11).
# ---------------------------------------------------------------------------
run "Phase-194 substrate regression guard (PSB suite)" \
  bash tests/run-all-194.sh

echo "========================================"
echo "  Summary (225 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
