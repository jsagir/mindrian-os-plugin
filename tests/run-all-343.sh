#!/usr/bin/env bash
# Phase 343 (the room-graph audit node and the counter-metric rule) verification
# aggregator. Modeled on tests/run-all-341.sh: reuses its run() and run_if()
# helpers verbatim so a leg whose file has not landed yet reports SKIPPED and
# never PASSED.
#
# This plan (343-01) is Wave 1. Every one of the seven phase-specific legs
# below is registered with run_if because its test file lands in a LATER
# wave (343-02 through 343-08). The rule: a wave flips its own leg from
# SKIPPED to PASSED simply by creating the file the run_if guard already
# names here. No aggregator edit is required per wave, ever - only later
# plans that need a NEW leg (not one of the seven already named) touch this
# file again.
#
# Three existing suites are registered as unguarded `run` legs, not `run_if`:
# this phase extends all three (the doctor module family, the sensor priority
# completeness gate, and the command-registry/connector build), so a
# regression in any of them is this phase's fault, not a later wave's file to
# create.
#
# House rule: hyphens only, no em-dashes, no emoji.

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
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# --- Phase 343 legs, each guarded on its own not-yet-landed file -----------

run_if "343: room-graph integrity module" "tests/test-343-room-graph-integrity.cjs" \
  node tests/test-343-room-graph-integrity.cjs
run_if "343: path hygiene and the name collision" "tests/test-343-path-hygiene.cjs" \
  node tests/test-343-path-hygiene.cjs
run_if "343: counter-metric declaration parity" "tests/test-343-counter-metric-declaration.cjs" \
  node tests/test-343-counter-metric-declaration.cjs
run_if "343: counter-metric first pair" "tests/test-343-counter-metric-pair.cjs" \
  node tests/test-343-counter-metric-pair.cjs
run_if "343: SENS-19 registration and fence" "tests/test-343-sensor-registration.cjs" \
  node tests/test-343-sensor-registration.cjs
run_if "343: Theo stamp gate" "tests/test-343-theo-stamp-gate.cjs" \
  node tests/test-343-theo-stamp-gate.cjs
run_if "343: help family map layer label" "tests/test-343-help-layer-label.cjs" \
  node tests/test-343-help-layer-label.cjs

# --- Existing suites this phase extends, unguarded (a regression here is
#     this phase's fault) --------------------------------------------------

run "343: sensor priority completeness (existing, extended by SENS-19 + the counter-metric field)" \
  node tests/test-245-priority-complete.cjs
run "343: contract parity (existing, extended by the room-graph integrity module)" \
  node tests/test-298-contract-parity.cjs
run "343: build-connector-registry --check (existing, extended by SENS-19 registration)" \
  node scripts/build-connector-registry.cjs --check

# --- Em-dash guard (always) -------------------------------------------------

echo "--- 343: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=(
  "tests/run-all-343.sh"
  "docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md"
)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-343-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 343: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 343: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "Phase 343: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
