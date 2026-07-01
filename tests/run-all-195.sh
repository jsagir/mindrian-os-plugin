#!/usr/bin/env bash
# Phase 195 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# fractal-cross-room-memory cluster. Cloned from tests/run-all-188.sh (run/run_if
# SKIP-safe helpers + PASS/FAIL/SKIP counters + the frozen-scalar membrane grep).
#
# Phase 195 ships fractal (recursive) room-tree memory + a cross-room umbilical
# cord. It mints EXACTLY ONE net-new frozen-set member (the UMBILICAL_TO edge
# type) and ONE net-new memory kind (DRIFT). It mints NO new frozen scalar: the
# Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate) are UNTOUCHED;
# F.8's basket bound stays its OWN MAX_TOGGLE_N, never MAX_K.
#
# WAVE 0 CONTRACT: this runner is authored before the modules land. Every module
# leg is run_if (SKIP-safe until the file exists), so Wave 0 exits cleanly with
# SKIPs. The legs that MUST be green in Wave 0 are:
#   (1) the frozen-scalar membrane grep -- CLAUDE.md still carries the frozen-scalar
#       membrane substring;
#   (2) test-195-canon-7-kind-floor.cjs -- the guard the Wave-4 FCM-08 canon
#       amendment must keep GREEN (six-kind complement now, seven after the flip).
# Missing test files SKIP, they do not FAIL. As the waves land, the SKIPs flip to
# runs and the gate tightens. The UMBILICAL_TO edge floor is authored in Wave 0
# and is itself SKIP-safe: it asserts the current membership floor now and
# auto-activates the UMBILICAL_TO assertion the instant 195-04 mints the type.
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
# tracked file; it never mutates anything. (Clone of run-all-188.sh:55-58.)
# ---------------------------------------------------------------------------
membrane_grep() {
  grep -qF "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen" "$ROOT/CLAUDE.md"
}
run "membrane grep (CLAUDE.md frozen-scalar line)" membrane_grep

# ---------------------------------------------------------------------------
# Wave-0 FLOORs. The canon 7-kind floor MUST be green now (it is the guard the
# Wave-4 FCM-08 amendment must keep green). The UMBILICAL_TO edge floor is
# authored in Wave 0 too and is internally SKIP-safe until the type is minted.
# ---------------------------------------------------------------------------
run "FCM-08 canon 7-kind FLOOR (six-kind complement now)" \
  node tests/test-195-canon-7-kind-floor.cjs

run_if "FCM-11 UMBILICAL_TO edge FLOOR (membership, never .size)" \
  tests/test-195-umbilical-edge-floor.cjs \
  node tests/test-195-umbilical-edge-floor.cjs

# ---------------------------------------------------------------------------
# Module legs. Each is run_if (SKIP until its wave lands), flipping to a run as
# the file appears. Ordered by wave.
# ---------------------------------------------------------------------------

# Wave 1 -- recursive reconcile (FCM-01/02) + DRIFT kind registration (FCM-07).
run_if "FCM-01/02 recursive reconcile (depth-3 project, depth-4 not, pass-2 idempotent)" \
  tests/test-195-recursive-reconcile.cjs \
  node tests/test-195-recursive-reconcile.cjs

run_if "FCM-07 DRIFT memory kind (BASENAME_TO_KIND additive)" \
  tests/test-195-drift-kind.cjs \
  node tests/test-195-drift-kind.cjs

# Wave 2 -- umbilical v2 inheritance + inherit-on-seed + born-wired birth + gate.
run_if "FCM-03 umbilical v2 inheritance-map parse (v1 defaults all-local)" \
  tests/test-195-umbilical-v2.cjs \
  node tests/test-195-umbilical-v2.cjs

run_if "FCM-04 child USER/BRAIN derive from parent on seed" \
  tests/test-195-inherit-seed.cjs \
  node tests/test-195-inherit-seed.cjs

run_if "FCM-05 born-wired birth (5 side-effects atomic, fail-closed rollback)" \
  tests/test-195-born-wired-birth.cjs \
  node tests/test-195-born-wired-birth.cjs

run_if "FCM-06 birth human-approval gate (fires BEFORE mkdir; reject -> no folder)" \
  tests/test-195-birth-gate.cjs \
  node tests/test-195-birth-gate.cjs

# Wave 3 -- cross-room relevance + F.8 umbilical fan-out + resume triggers.
run_if "FCM-09 cross-room relevance emitter (Part-8 fence holds, no prose egress)" \
  tests/test-195-xroom-relevance.cjs \
  node tests/test-195-xroom-relevance.cjs

run_if "FCM-10 F.8 umbilical basket (0.70 pre-check; 1 confirm -> N UMBILICAL_TO)" \
  tests/test-195-f8-umbilical.cjs \
  node tests/test-195-f8-umbilical.cjs

run_if "FCM-12 cross-room resume triggers (fire only when siblings changed)" \
  tests/test-195-triggers.cjs \
  node tests/test-195-triggers.cjs

# ---------------------------------------------------------------------------
# SEED-004 Wave-0 precondition: the write-scope-check nested-room fix rides the
# existing 83 scope-injection suite (extended with the 3 SEED-004 fixtures).
# ---------------------------------------------------------------------------
run "SEED-004 write-scope nested-room fix (scope-injection suite)" \
  node scripts/83-scope-injection.test.cjs

echo "========================================"
echo "  Summary (195 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
