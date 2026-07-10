#!/usr/bin/env bash
# Phase 215 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-portfolio-scale-fusion cluster (AHP criterion weights + the two
# deterministic classifiers + the Opportunity Statement emitter + the composed
# portfolio batch runner). Pure composition of shipped engines (Canon Part 7).
#
# The phase gate has TWO legs (the 211-05 pattern):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the Plan 05 navigator spot-check verdict recorded (a HUMAN reads the
#       real-room portfolio report at the checkpoint:human-verify leg).
#
# EGRESS RULE (Part 8, restated): real-room content NEVER reaches a network
# judge. The portfolio runner makes zero network calls; the real room is
# verified by the human spot-check, not by Plurai.
#
# Each guarded leg is run_if, GATED ON A FILE that must exist, so a
# partially-landed phase exits cleanly with SKIPs rather than RED-failing on
# absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211): the offline preload flips
# transformers.js env.allowRemoteModels=false in every spawned leg (and its
# children), so an uncached model load fails fast and degrades instead of
# reaching the network. No-op when the eureka dep is absent.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

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

# (1) AHP criterion-weight module (215-01): 3x3 Saaty weights + CR gate.
run "215-01 AHP criterion weights" \
  node tests/test-215-ahp-weights.cjs

# (2) Three-dimension score (215-02): scoreTech/scorePair + weak + complementary.
run "215-02 portfolio dimensions" \
  node tests/test-215-score.cjs

# (3) Weak-signal tail classifier (215-02): quantile quadrant + degeneracy guards.
run "215-02 tail quadrant" \
  node tests/test-215-tail.cjs

# (4) Opportunity Statement emitter (215-03): canonical shape + honest critic gate.
run "215-03 opportunity statement" \
  node tests/test-215-opp-statement.cjs

# (5) Composed portfolio runner (215-04): offline structural e2e, both pair modes.
run "215-04 portfolio report (offline e2e)" \
  node tests/test-215-portfolio-report.cjs

# (5b) Field contract (215-05): the emitter shape (csv-to-idea-graph edge_count/
#      primary_label/labels) must be reconciled by loadGraph into the scorer
#      contract (pair_count/primary_problem/problems). Hermetic, offline; the
#      permanent regression guard for the degenerate-tie bug fixed in 215-05.
run "215-05 field contract (emitter <-> scorer)" \
  node tests/test-215-field-contract.cjs

# (6) Plan 05 reproduction leg: reads the REAL-room GRAPH-MODE portfolio JSON
#     (DG-2 navigator call: graph is the canonical acceptance substrate; the
#     full-catalog sibling is a supplementary, non-gating sweep -- see
#     tests/test-215-reproduction.cjs header). SKIPs cleanly until the real
#     graph-mode run lands (guarded on that JSON's existence).
run_if "215-05 reproduction (real-room graph-mode JSON)" "evals/eureka/215-jhtv-portfolio-report.graph-mode.json" \
  node tests/test-215-reproduction.cjs

# (7) Dependency no-regression: the additive export to the 211 runner must not
#     regress the 211 gate. Guarded on the 211 aggregator.
run_if "211 dependency no-regression" "tests/run-all-211.sh" \
  bash tests/run-all-211.sh

echo "======================================"
echo "Phase 215: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
