#!/usr/bin/env bash
# Phase 214 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-pattern-transfer cluster (measured two-leg analogy fitness + the online
# pattern-query fence + the darkmatter restatement gold gate). Models on
# tests/run-all-211.sh.
#
# EGRESS RULE (Part 8, restated): every 214 leg is OFFLINE and deterministic,
# zero network. Leg 1 embeds through the shipped local spine's stub seam; the
# online egress fence (leg 2) is proven by a UNIT test that inspects the composed
# query strings, NEVER by a live fetch. No leg may reach a wire or download a
# model.
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so the partially-landed
# phase (plans 214-02 / 214-04 land later) exits cleanly with SKIPs rather than
# RED-failing on absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard: flip transformers.js env.allowRemoteModels=false in every
# spawned leg (and its children) so no leg can silently download a model. No-op
# when the eureka dep is absent. See the offline preload required just below.
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

# (1) Analogy fitness (214-01): two-leg fusion (text cosine + SAPPhIRE band),
#     the restatement gate, honest degrade, provenance on every number.
run_if "214-01 analogy fitness two-leg fusion" "tests/test-214-analogy-fitness.cjs" \
  node tests/test-214-analogy-fitness.cjs

# (2) Online egress fence (214-02): the composed pattern queries carry NO local
#     room bytes; proven by unit inspection of the strings, never a live fetch.
run_if "214-02 online egress fence" "tests/test-214-online-fence.cjs" \
  node tests/test-214-online-fence.cjs

# (3) Darkmatter gate + rank-order (214-04): the archimedes-darkmatter restatement
#     trap and the gold rank-order, asserted against the shipped fitness.
run_if "214-04 darkmatter gate + rank-order" "tests/test-214-darkmatter-gate.cjs" \
  node tests/test-214-darkmatter-gate.cjs

echo "======================================"
echo "Phase 214: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
