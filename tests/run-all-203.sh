#!/usr/bin/env bash
# Phase 203 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# synthetic-expert-skill cluster. Models on tests/run-all-200.sh.
#
# Phase 203 lands, in three waves: (1) the fan-out-composed expert GENESIS
# (Directive 1: composeSyntheticExpert fans one research cell per framework x lens x
# subdomain and writes ONE proposed SyntheticExpert node), (2) the /mos:skill
# --from-expert materializer that projects a CONFIRMED node into a room-scoped
# born-EXCLUDED SKILL.md, plus the wired reach sensor, and (3) the two-surface Plurai
# ACCEPTANCE GATE (Directive 2): construction fidelity (surface A) judges the genesis
# costume, behavioral fidelity (surface B) judges the invoked performance, and two
# deterministic local parity gates reproduce BOTH judgments offline so CI is green
# WITHOUT a live Plurai call (Plurai is BUILD/CI only, synthetic data only, Part 8).
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so a partially-landed phase
# exits cleanly with SKIPs rather than RED-failing on absence. bash only. No em-dashes.

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
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# (1) Wave 1 -- the fan-out-composed genesis (Directive 1)
run_if "203-01 genesis fan-out + synthesize + write" "tests/test-203-genesis-fanout.cjs" \
  node tests/test-203-genesis-fanout.cjs

# (2) Wave 2 -- the --from-expert materializer + the wired reach sensor
run_if "203-02 skill materialize (--from-expert born-excluded SKILL.md)" "tests/test-203-skill-materialize.cjs" \
  node tests/test-203-skill-materialize.cjs
run_if "203-03 reach sensor (wired dispatch)" "tests/test-203-reach-sensor.cjs" \
  node tests/test-203-reach-sensor.cjs

# (3) Wave 3 -- the two-surface Plurai acceptance gate (Directive 2)
run_if "203-04 construction gate (surface A, Plurai parity)" "lib/core/synthetic-expert-construction-gate.cjs" \
  node tests/test-203-construction-gate.cjs
run_if "203-04 behavior gate (surface B, Plurai parity)" "lib/core/synthetic-expert-behavior-gate.cjs" \
  node tests/test-203-behavior-gate.cjs

# Deferred leg: the LIVE hosted Plurai fable judge over both CSVs. It runs only via
# the interactive /evals:eval MCP flow (start_evaluator -> ask_user model=fable ->
# get_results), which cannot run non-interactively here. It is DEFERRED and REPORTED,
# never silently skipped: evals/plurai/203-baseline.json carries baseline_deferred:true
# and the two local parity gates above hold the line until it is re-run interactively.
if [ -f "evals/plurai/203-baseline.json" ]; then
  echo "--- 203-04 live Plurai judge (both surfaces) ---"
  echo ">>> 203-04 live Plurai judge: DEFERRED (baseline_deferred; re-run /evals:eval model=fable interactively). Local parity gates hold the line."
  echo ""
fi

echo "======================================"
echo "Phase 203: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
