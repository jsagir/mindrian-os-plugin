#!/usr/bin/env bash
# Phase 188 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# f7-multiselect-toggleable-hitl cluster. Models on tests/run-all-187.sh.
#
# Phase 188 ships the full Shape-F selector family: F.8 (multiSelect toggle),
# F.9 (ordered per-item APPROVE/REJECT/DEFER gate), F.3/F.4 capture+consumer+state
# parity, the bare-F.7 -> dial collapse (SFS-06), the hitl-stages schema+validator
# (SFS-07), a per-shape render-coverage predicate (SFS-10), and a navigator-gated
# canon amendment (SFS-11). It mints NO new frozen scalar: the Part 3 contracts
# (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate) are UNTOUCHED; F.8's toggle bound
# is its OWN MAX_TOGGLE_N, never MAX_K.
#
# WAVE 0 CONTRACT: this runner is authored before the modules land. Every module
# leg is run_if (SKIP-safe until the file exists), so Wave 0 exits cleanly with
# SKIPs. The two legs that MUST be green in Wave 0 are:
#   (1) the SFS-12 membrane grep -- CLAUDE.md:46 still carries the frozen-scalar
#       membrane substring;
#   (2) test-canon-frozen-scalars-floor.cjs -- the guard the 188-05 canon
#       amendment must keep GREEN.
# Missing test files SKIP, they do not FAIL. As the waves land, the SKIPs flip to
# runs and the gate tightens.
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
# SFS-12: the frozen-scalar membrane grep leg (HARD, green in Wave 0).
# CLAUDE.md:46 must still carry the exact membrane substring. This is a pure
# read-only assertion over a tracked file; it never mutates anything.
# ---------------------------------------------------------------------------
membrane_grep() {
  grep -qF "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen" "$ROOT/CLAUDE.md"
}
run "SFS-12 membrane grep (CLAUDE.md frozen-scalar line)" membrane_grep

# ---------------------------------------------------------------------------
# FLOOR tests (SFS-11 + SFS-10). The frozen-scalar floor MUST be green now (it
# is the guard for the 188-05 canon amendment). The per-shape hard-fail floor
# is run_if until it lands.
# ---------------------------------------------------------------------------
run_if "SFS-11 frozen-scalar FLOOR (canon byte-identical)" \
  tests/test-canon-frozen-scalars-floor.cjs \
  node tests/test-canon-frozen-scalars-floor.cjs

run_if "SFS-10 per-shape coverage hard-fail FLOOR" \
  tests/test-per-shape-coverage-gate-hardfail.cjs \
  node tests/test-per-shape-coverage-gate-hardfail.cjs

# ---------------------------------------------------------------------------
# F.8 renderer + capture + fan-out consumer (SFS-01/02/03, Wave C).
# ---------------------------------------------------------------------------
run_if "F.8 renderer (multiSelect toggle card)" \
  lib/hmi/shape-f8-renderer.test.cjs \
  node lib/hmi/shape-f8-renderer.test.cjs

run_if "F.8 capture (array of N toggles)" \
  lib/hmi/f8-capture.test.cjs \
  node lib/hmi/f8-capture.test.cjs

run_if "F.8 fan-out consumer (N edges on one confirm)" \
  lib/workflow/f8-consumer.test.cjs \
  node lib/workflow/f8-consumer.test.cjs

# ---------------------------------------------------------------------------
# F.9 ordered renderer + consumer (SFS-04/05, Wave C).
# ---------------------------------------------------------------------------
run_if "F.9 renderer (ordered per-item gate, paged)" \
  lib/hmi/shape-f9-renderer.test.cjs \
  node lib/hmi/shape-f9-renderer.test.cjs

run_if "F.9 consumer (APPROVE writes edge, DEFER leaves CONTRADICTS pair)" \
  lib/workflow/f9-consumer.test.cjs \
  node lib/workflow/f9-consumer.test.cjs

# ---------------------------------------------------------------------------
# F.3 / F.4 parity: capture + consumer + state (SFS-08/09, Wave A).
# ---------------------------------------------------------------------------
run_if "F.3 parity (pick sets depth state)" \
  lib/hmi/shape-f3-parity.test.cjs \
  node lib/hmi/shape-f3-parity.test.cjs

run_if "F.4 parity (pick accumulates harvest scope)" \
  lib/hmi/shape-f4-parity.test.cjs \
  node lib/hmi/shape-f4-parity.test.cjs

# ---------------------------------------------------------------------------
# Dispatcher branch: bare F.7 -> dial collapse extends the shared selector
# suite (SFS-06, Wave A). run_if because the F.7 branch is extended in 188-01.
# ---------------------------------------------------------------------------
run_if "selector-dispatcher (bare F.7 -> dial branch)" \
  lib/hmi/selector-dispatcher.test.cjs \
  node lib/hmi/selector-dispatcher.test.cjs

# ---------------------------------------------------------------------------
# Pure-code CI gates (SFS-07 hitl-stages, SFS-10 render coverage). run_if the
# hitl gate until it lands; the render gate ships today so it runs unconditionally.
# ---------------------------------------------------------------------------
run_if "hitl-stages schema validator gate" \
  scripts/check-hitl-stages.cjs \
  node scripts/check-hitl-stages.cjs

run "render-coverage gate (--check)" node scripts/check-render-coverage.cjs --check

echo "========================================"
echo "  Summary (188 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
