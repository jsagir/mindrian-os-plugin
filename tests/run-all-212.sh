#!/usr/bin/env bash
# Phase 212 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-substrate-grounding-guard cluster (the local two-stage critic: Stage A
# deterministic gates + Stage B two-pass rubric + verdict-by-code + the D1 MCP
# wire). Modeled on tests/run-all-211.sh.
#
# THE D7 PHASE GATE has two parts and this script is the automated half:
#   (1) run-all-212 green (this script) -- legs a-d plus the supporting suites, AND
#   (2) the plan-05 HUMAN calibration checkpoint (Q2 lock): the >=0.85 accuracy bar
#       is a human-verify leg, NOT an automated assertion. This script asserts
#       verdict-by-code ROUTING and the Part 8 / D5 boundary; it does not claim
#       real-judge accuracy.
#
# D7 legs (each labeled with its letter):
#   (a) test-212-gold-cards.cjs       -- fixture suite: 6 cards vs expected verdicts
#   (b) test-212-negative-corpus.cjs  -- D6: the recorded junk outputs stay rejected
#   (c) test-212-part8-boundary.cjs   -- Part 8 boundary scan; ALSO carries leg
#   (d)                                  the D5 per-call-resolution CHECK 4 (same file)
# Supporting suites: Stage A gates, the Stage B rubric, and the OPTIONAL Plurai leg.
#
# EGRESS RULE (Part 8, restated): Plurai is BUILD/CI only, synthetic gold-card
# data only, NEVER the runtime path and NEVER real-room content. The optional
# Plurai leg degrades to SKIP + a baseline_deferred record when no key resolves
# or the endpoint 404s; it can never fail this gate (navigator Q3 lock).
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so a partially-landed
# phase (or a plan-03 leg not yet merged in this wave) exits cleanly with SKIPs
# rather than RED-failing on absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from run-all-211.sh): the eureka-offline-preload
# flips transformers.js env.allowRemoteModels=false in every spawned leg (and its
# children), so a networked machine cannot silently download a model and break the
# offline contract. No-op when the dep is absent.
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

# Supporting suite: Stage A deterministic gates (212-01) -- the four no-LLM gates.
run_if "212-01 critic Stage A gates" "tests/test-212-critic-stage-a.cjs" \
  node tests/test-212-critic-stage-a.cjs

# Supporting suite: Stage B rubric + verdict-by-code + criticRule (212-02).
run_if "212-02 critic Stage B rubric + criticRule" "tests/test-212-critic-rubric.cjs" \
  node tests/test-212-critic-rubric.cjs

# Leg (a): the gold-card fixture suite -- 6 cards routed vs their expected verdicts.
run_if "212-04 (a) gold-card fixture suite" "tests/test-212-gold-cards.cjs" \
  node tests/test-212-gold-cards.cjs

# Leg (b): the D6 negative corpus -- the three recorded junk outputs stay rejected.
run_if "212-02 (b) D6 negative corpus" "tests/test-212-negative-corpus.cjs" \
  node tests/test-212-negative-corpus.cjs

# Legs (c) + (d): the Part 8 boundary scan carries BOTH the D7(c) boundary checks
# and the D7(d) D5 per-call-resolution CHECK 4 in the same file.
run_if "212-03 (c+d) Part 8 boundary + D5 per-call-resolution" "tests/test-212-part8-boundary.cjs" \
  node tests/test-212-part8-boundary.cjs

# Optional leg: the deployed Plurai classifier signal. SKIP-degrades on a missing
# key or an unreachable endpoint (writes evals/plurai/212-baseline.json deferred);
# it can never fail this gate.
run_if "212-04 optional Plurai leg (SKIP-degrading)" "tests/test-212-plurai-leg.cjs" \
  node tests/test-212-plurai-leg.cjs

echo "======================================"
echo "Phase 212: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
