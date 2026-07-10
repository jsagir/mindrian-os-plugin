#!/usr/bin/env bash
# Phase 213 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-reach-wiring-the-key cluster (SENS-13 detector + spine wiring + the
# Shape-F offer + the three post-210 softened touchpoints + the cross-surface
# Part-8 boundary sweep). Modeled line-for-line on tests/run-all-211.sh.
#
# THE PHASE GATE CONTRACT (RESEARCH V2): this script green with FAIL=0 is the
# MECHANICAL half of the 213 gate. The OTHER half is the plan-06 human real-
# conversation Larry probe (Task 3, checkpoint:human-verify, blocking). Phase 213
# is NOT "done" until BOTH are satisfied: a proof phase that self-certifies proves
# nothing; the human probe + these mechanical gates are the credibility.
#
# EGRESS RULE (Part 8, restated): every 213 surface crosses only handles / enums /
# quantized scalars. The boundary leg (test-213-part8-boundary) is the fence, and
# it REUSES the Phase 196 classify() guard across all four surfaces (side-channel
# file, offer text, APO signal seam, grill annotation), never a second auditor.
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so a partially-landed
# phase exits cleanly with SKIPs rather than RED-failing on absence. bash only.
# No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from run-all-211): once the eureka deps are
# installed, a networked machine could download a model and break the offline
# contract. This preload flips transformers.js env.allowRemoteModels=false in
# every spawned leg (and its children). No-op when the dep is absent.
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

# (1) The COMPRESSION meter (213-01): Score = CompressionDelta x GuardGate x StatusQuoGate.
run_if "213-01 compression meter" "tests/test-213-compression-meter.cjs" \
  node tests/test-213-compression-meter.cjs

# (2) The two eval-side graders (213-01): arrival-grader + status-quo-judge, verdict-by-code.
run_if "213-01 eureka graders" "tests/test-213-graders.cjs" \
  node tests/test-213-graders.cjs

# (3) SENS-13 detector + side-channel producer (213-02): sensor + runEurekaScan closed schema.
run_if "213-02 sensor-eureka + reach runner" "tests/test-213-sensor-eureka.cjs" \
  node tests/test-213-sensor-eureka.cjs

# (4) Born-wired reachability proof (213-03): SENS-13 reaches through the REAL decide().
run_if "213-03 reach-wired (born-wired proof)" "tests/test-213-reach-wired.cjs" \
  node tests/test-213-reach-wired.cjs

# (5) Recommend-never-trigger invariants (213-03): the fired reach executes NOTHING.
run_if "213-03 no-force invariants" "tests/test-213-no-force.cjs" \
  node tests/test-213-no-force.cjs

# (6) The Shape-F eureka OFFER composer (213-04): one hedged handles+enum line, offline-full.
run_if "213-04 eureka offer composer" "tests/test-213-eureka-offer.cjs" \
  node tests/test-213-eureka-offer.cjs

# (7) The three post-210 softened touchpoints (213-05): 202 APO signal + 205 adapter + grill.
run_if "213-05 touchpoints (202 + 205)" "tests/test-213-touchpoints.cjs" \
  node tests/test-213-touchpoints.cjs

# (8) The cross-surface Part-8 boundary sweep (213-06): handles/enums-only over all 4 surfaces.
run_if "213-06 part-8 boundary sweep" "tests/test-213-part8-boundary.cjs" \
  node tests/test-213-part8-boundary.cjs

echo "======================================"
echo "Phase 213: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
