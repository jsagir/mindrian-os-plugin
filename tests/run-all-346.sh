#!/usr/bin/env bash
# Phase 346 (the arbitration node: GRAPH-layer posture arbitration resolving
# the conflict between the enforcement loop and the judgment loop)
# verification aggregator. Modeled on tests/run-all-344.sh. bash only.
#
# IMPORTANT: this aggregator is written ONCE, here, in 346-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-346-*.cjs); the run_if legs below and the em-dash guard's
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
# not exist yet are skipped by the loop below; tests/test-346-*.cjs is
# discovered by glob, not hand-enumerated here.
PHASE_346_SURFACES=(
  "lib/core/arbitration.cjs"
  "lib/core/navigation/arbitration-log.cjs"
  "data/arbitration-rule-catalogue.json"
  "data/harness-policies/gate-arbitration-decision.json"
  "docs/ARBITRATION-CONTRACT.md"
  "tests/fixtures/346-watch-incidents.json"
  "tests/run-all-346.sh"
)

# --- Guarded legs, one per planned test file (SKIP until its own plan lands),
#     in wave order so a partial phase reads as a progress bar ---------------

run_if "346: contract doc"            tests/test-346-contract-doc.cjs            node tests/test-346-contract-doc.cjs
run_if "346: enforcement axis"        tests/test-346-enforcement-axis.cjs        node tests/test-346-enforcement-axis.cjs
run_if "346: catalogue schema"        tests/test-346-catalogue-schema.cjs        node tests/test-346-catalogue-schema.cjs
run_if "346: arbitration resolver"    tests/test-346-arbitration-resolver.cjs    node tests/test-346-arbitration-resolver.cjs
run_if "346: part8 enum only"         tests/test-346-part8-enum-only.cjs         node tests/test-346-part8-enum-only.cjs
run_if "346: no second brain"         tests/test-346-no-second-brain.cjs         node tests/test-346-no-second-brain.cjs
run_if "346: arbitration event"       tests/test-346-arbitration-event.cjs       node tests/test-346-arbitration-event.cjs
run_if "346: watch replay"            tests/test-346-watch-replay.cjs            node tests/test-346-watch-replay.cjs
run_if "346: decide attachment"       tests/test-346-decide-attachment.cjs       node tests/test-346-decide-attachment.cjs

# --- Always-on regression legs: the phase's highest-risk drift, checked from
#     day one -----------------------------------------------------------------

run "346: posture ids drift (regression)"      node tests/test-posture-ids-drift.cjs
run "346: harness manifest fresh (regression)" node scripts/build-harness-manifest.cjs --check

# --- Em-dash guard (always) -------------------------------------------------

echo "--- 346: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_346_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-346-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 346: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 346: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
exit $(( FAIL > 0 ? 1 : 0 ))
