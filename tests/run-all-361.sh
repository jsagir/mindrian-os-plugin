#!/usr/bin/env bash
# Phase 361 (dominant-design research mode: /mos:dominant-designs gains an
# evidence deep dive backed by a parallel dominant-design-researcher agent)
# verification aggregator.
#
# Modeled on tests/run-all-356.sh (the run/run_if/counter shape, the guarded
# per-planned-test-file idiom, the targeted em-dash guard).
#
# IMPORTANT: this aggregator is written ONCE, here, in 361-01. NO LATER PLAN
# in this phase edits it. A later plan adds its own test file
# (tests/test-361-*.cjs); the run_if legs below pick up a landed file
# automatically because each leg already names its guard file. A missing
# planned test file reports SKIPPED, never PASSED.
#
# exit 0  -> PASSED
# exit 77 -> SKIPPED (ENV GAP), never reported as PASSED
# anything else -> FAILED
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
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  fi
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

# --- Guarded legs, one run_if per planned test file, wave order --------------
run_if "361: pre-phase baseline (361-01)"                tests/test-361-baseline.cjs        node tests/test-361-baseline.cjs
run_if "361: Part 8 known-shape arms (361-02, D-10)"      tests/test-361-egress-shapes.cjs   node tests/test-361-egress-shapes.cjs
run_if "361: Theo input-shape parity (361-02, D-10/D-14)" tests/test-361-theo-parity.cjs     node tests/test-361-theo-parity.cjs
run_if "361: lane-queries composer (361-03, D-02)"        tests/test-361-lane-queries.cjs    node tests/test-361-lane-queries.cjs
run_if "361: evidence-pack validator (361-03, D-06/D-13)" tests/test-361-evidence-pack.cjs   node tests/test-361-evidence-pack.cjs
run_if "361: agent contract (361-04, D-17)"               tests/test-361-agent-contract.cjs  node tests/test-361-agent-contract.cjs
run_if "361: Theo structure fallback (361-05, D-09/D-16)" tests/test-361-theo-structure.cjs  node tests/test-361-theo-structure.cjs
run_if "361: CLI (361-06)"                                tests/test-361-cli.cjs             node tests/test-361-cli.cjs
run_if "361: filing readback (361-06, D-07)"              tests/test-361-filing.cjs          node tests/test-361-filing.cjs
run_if "361: command contract (361-07, D-11/D-12/D-13)"   tests/test-361-command-contract.cjs node tests/test-361-command-contract.cjs

# --- Existing-suite legs (plain run, the files already exist) ---------------
run "361: existing FDA known-tool-shapes"             node tests/test-260906-fda-known-tool-shapes.cjs
run "361: existing part8-egress-guard self-test"      node lib/core/part8-egress-guard.test.cjs
run "361: existing 209 declared-implies-wired"        node tests/test-209-declared-implies-wired.cjs
run "361: existing 250 doctrine fence"                node tests/test-250-doctrine-fence.cjs
run "361: existing 344 surface-layer parity"          node tests/test-344-surface-layer-parity.cjs
run "361: existing 148 engine reaches"                node tests/test-148-engine-reaches.cjs
run "361: existing 341 registry drift"                node tests/test-341-registry-drift.cjs
run "361: existing 265 threshold fanouts"             node tests/test-265-threshold-fanouts.cjs
run "361: existing 265 swarm task grant"              node tests/test-265-swarm-task-grant.cjs
run "361: existing 265 declaration truth"             node tests/test-265-declaration-truth.cjs
run "361: existing fileEvidenceWithReadback contract" node tests/test-fileval-readback.cjs
run "361: existing layer-declaration check"           node scripts/check-layer-declaration.cjs
run "361: existing render-coverage check"             node scripts/check-render-coverage.cjs

# --- Generator legs (plain run) ----------------------------------------------
run "361: command-registry generator --check"         node scripts/build-command-registry.cjs --check
run "361: connector-registry generator --check"       node scripts/build-connector-registry.cjs --check
run "361: skill-mirrors generator --check"             node scripts/build-skill-mirrors.cjs --check
run "361: orchestration-projection generator --check" node scripts/build-orchestration-projection.cjs --check

# --- CIRS plan-declaration leg (over every landed 361 plan file) ------------
PD=".planning/phases/361-dominant-design-research-mode-mos-dominant-designs-gains-a-r"
CIRS_PLANS=()
while IFS= read -r -d '' f; do
  CIRS_PLANS+=("$f")
done < <(find "$PD" -maxdepth 1 -name '361-*-PLAN.md' -print0 2>/dev/null)
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo "--- 361: CIRS plan-declaration check ---"
  echo ">>> 361: CIRS plan-declaration check: SKIPPED (no $PD/361-*-PLAN.md found)"
  SKIP=$((SKIP+1))
  echo ""
else
  run "361: CIRS plan-declaration check" node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
fi

# --- Em-dash guard (always) --------------------------------------------------
# The non-test files Phase 361 plans modify or create directly, named
# explicitly; a missing file is skipped, never an error. Plus a targeted glob
# of landed tests/test-361-*.cjs, tests/fixtures/361-*, and the 361 phase-dir
# docs.

echo "--- 361: em-dash guard ---"
EMDASH_HIT=0
PHASE_361_SURFACES=(
  "agents/dominant-design-researcher.md"
  "commands/dominant-designs.md"
  "skills/dominant-designs/SKILL.md"
  "references/methodology/dominant-designs.md"
  "scripts/dominant-design-research.cjs"
  "data/subagent-dispatch-grants.json"
  "tests/run-all-361.sh"
)
EMDASH_FILES=("${PHASE_361_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find lib/core/dominant-design -maxdepth 1 -name '*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-361-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests/fixtures -maxdepth 1 -name '361-*' -print0 2>/dev/null)
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find "$PD" -maxdepth 1 -name '361-*.md' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 361: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 361: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
exit $(( FAIL > 0 ? 1 : 0 ))
