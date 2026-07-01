#!/usr/bin/env bash
# Phase 201 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# harness-as-code-manifest cluster. Models on tests/run-all-200.sh / run-all-196.sh.
#
# Phase 201 lands: (01) a sibling runtime-surface manifest declaring the harness code
# surfaces (leaving the LOCKED 3-map digest untouched); (02) SEED-033 L1 opt-in bounded
# Ralph verify+retry on autonomous_safe steps in chain-executor.cjs (default OFF, token
# economy preserved, B3 intact); (03) SEED-033 L2 the self-improving graph loop
# (propose/fact-check/refine, LOCAL, human-gated, Part-9 chokepoint writes); (04) the
# Plurai behavior eval gate (a local deterministic loop-trace classifier, Plurai-parity
# CSV; Plurai is BUILD/CI only, synthetic data only, never on the runtime path).
#
# Each leg is run_if, guarded on a file that must exist, so a partially-landed phase
# exits cleanly with SKIPs. bash only. No em-dashes.

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

run_if "201-01 harness runtime manifest" "scripts/build-harness-runtime-manifest.cjs" \
  node tests/test-201-harness-runtime-manifest.cjs
run_if "201-01 runtime-manifest --check (drift tripwire)" "data/harness-runtime-manifest.json" \
  node scripts/build-harness-runtime-manifest.cjs --check
run_if "201-02 bounded Ralph retry (L1)" "tests/test-201-bounded-retry.cjs" \
  node tests/test-201-bounded-retry.cjs
run_if "201-03 self-improving graph loop (L2)" "lib/core/graph-refine-loop.cjs" \
  node tests/test-201-graph-refine-loop.cjs
run_if "201-04 Ralph-loop behavior gate (Plurai parity)" "lib/core/ralph-loop-gate.cjs" \
  node tests/test-201-ralph-loop-gate.cjs

echo "======================================"
echo "Phase 201: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
