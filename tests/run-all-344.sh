#!/usr/bin/env bash
# Phase 344 (the layer contract: name, describe, and pin every engineering
# layer of MindrianOS and every ICM nested part of a room) verification
# aggregator. Modeled on tests/run-all-341.sh. bash only.
#
# IMPORTANT: this aggregator is written ONCE, here, in 344-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-344-*.cjs); the run_if legs below and the em-dash guard's
# glob both pick up a landed file automatically. If a later plan believes it
# needs a new leg, that is a signal to re-open this file deliberately, not to
# silently patch around it.
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

# The em-dash guard's file list. Every path this phase's own plans touch
# directly (not the generated registries they lift into). Entries that do
# not exist yet are skipped by the loop below; tests/test-344-*.cjs is
# discovered by glob, not hand-enumerated here.
PHASE_344_SURFACES=(
  "data/layer-declaration-schema.json"
  "docs/LAYER-DECLARATION-CONTRACT.md"
  "docs/LAYER-CONTRACT.md"
  "docs/ICM-NESTED-PART-CONTRACT.md"
  "data/icm-parts.json"
  "data/layer-backfill.json"
  "scripts/check-layer-declaration.cjs"
  "scripts/backfill-layer.cjs"
  "data/harness-policies/gate-layer-declaration.json"
  "lib/core/doctor/icm-part-wiring-module.cjs"
  "tests/run-all-344.sh"
)

# --- Guarded legs, one per planned test file (SKIP until its own plan lands) -

run_if "344: layer schema"             tests/test-344-layer-schema.cjs             node tests/test-344-layer-schema.cjs
run_if "344: layer gate"               tests/test-344-layer-gate.cjs               node tests/test-344-layer-gate.cjs
run_if "344: registry layer lift"      tests/test-344-registry-layer-lift.cjs      node tests/test-344-registry-layer-lift.cjs
run_if "344: layer backfill"           tests/test-344-layer-backfill.cjs           node tests/test-344-layer-backfill.cjs
run_if "344: surface layer parity"     tests/test-344-surface-layer-parity.cjs     node tests/test-344-surface-layer-parity.cjs
run_if "344: icm part wiring doctor"   tests/test-344-icm-part-wiring-doctor.cjs   node tests/test-344-icm-part-wiring-doctor.cjs
run_if "344: layer contract doc"       tests/test-344-layer-contract-doc.cjs       node tests/test-344-layer-contract-doc.cjs
run_if "344: icm parts contract doc"   tests/test-344-icm-parts-contract.cjs       node tests/test-344-icm-parts-contract.cjs
run_if "344: single canonical icm map" tests/test-344-single-canonical-icm-map.cjs node tests/test-344-single-canonical-icm-map.cjs

# --- Always-on legs: the generator staleness trio --------------------------

run "344: build-command-registry --check (regression)"   node scripts/build-command-registry.cjs --check
run "344: build-connector-registry --check (regression)" node scripts/build-connector-registry.cjs --check
run "344: build-harness-manifest --check (regression)"   node scripts/build-harness-manifest.cjs --check

# --- Em-dash guard (always) -------------------------------------------------

echo "--- 344: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_344_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-344-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 344: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 344: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
