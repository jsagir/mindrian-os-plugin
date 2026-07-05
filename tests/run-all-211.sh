#!/usr/bin/env bash
# Phase 211 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# eureka-generator-mvp cluster (tri-modal room.db + sqlite-vec + the local
# embedding spine; default model MongoDB/mdbr-leaf-ir per quick(260706-13z) D3).
# Models on tests/run-all-200.sh.
#
# The phase gate the ROADMAP names has three legs:
#   (1) run-all-211 green (this script),
#   (2) the deployed Cross-Topic Connection judge wired on SYNTHETIC gold-card
#       text only (test-211-judge-gate.cjs; SKIPs + writes a deferred baseline
#       when no key resolves or the endpoint is unreachable),
#   (3) the real-room eureka spot-check (a HUMAN reads evals/eureka/211-room-report.md).
#
# EGRESS RULE (Part 8, restated): Plurai is BUILD/CI only, synthetic gold-card
# data only, NEVER on the runtime path and NEVER on real-room content. The
# eureka-room-report runner makes zero network calls; the real room database is
# verified by the human spot-check, not by a network judge.
#
# Each leg is run_if, GUARDED ON A FILE that must exist, so a partially-landed
# phase exits cleanly with SKIPs rather than RED-failing on absence. bash only.
# No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (must-have #4): once the eureka deps are installed, a
# networked machine could download a model and break the offline contract. This
# preload flips transformers.js env.allowRemoteModels=false in every spawned leg
# (and its children). No-op when the dep is absent. See eureka-offline-preload.cjs.
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

# (1) Embedding spine (211-01): local mdbr-leaf-ir encoder + graceful degrade.
run_if "211-01 embedding spine" "tests/test-211-embedding-spine.cjs" \
  node tests/test-211-embedding-spine.cjs

# (2) Tri-modal index + hybrid retrieve (211-02): fts5/bm25 + sqlite-vec/cjs + RRF.
run_if "211-02 tri-modal index + hybrid retrieve" "tests/test-211-tri-modal.cjs" \
  node tests/test-211-tri-modal.cjs

# (3) Measured differential (211-03): scoreMeasured (signed, provenance) + jaccard-v1.
run_if "211-03 measured differential" "tests/test-211-measured-differential.cjs" \
  node tests/test-211-measured-differential.cjs

# (4) Critic gold-set (211-04): gray-matter schema drift guard + no-real-names deny-list.
run_if "211-04 case cards (schema + no-real-names)" "tests/test-211-case-cards.cjs" \
  node tests/test-211-case-cards.cjs

# (5) Judge gate (211-05): offline directional contract + key-gated Cross-Topic
#     Connection judge on SYNTHETIC gold-card text only. SKIPs offline (deferred baseline).
run_if "211-05 judge gate (offline contract + deployed judge)" "tests/test-211-judge-gate.cjs" \
  node tests/test-211-judge-gate.cjs

# (6) Vertical-slice runner smoke (211-05): the whole measured pipeline offline
#     against the real room database. Guarded on the runner script.
run_if "211-05 eureka-room-report offline smoke" "scripts/eureka-room-report.cjs" \
  node scripts/eureka-room-report.cjs --db room --offline --top 5 --out /tmp/211-gate-smoke.md

# (7) D1 vector-store adapter (260706-13z): ensureStore + eureka_meta +
#     dim-rebuild-on-model-swap contract, cjs-fallback path.
run_if "260706-13z vector-store adapter" "tests/test-211-vector-store.cjs" \
  node tests/test-211-vector-store.cjs

# (8) Class S eureka-smoke (260706-13z): 4-layer probe contract (mock seams +
#     real doctor spawn), non-cascading, deterministic offline.
run_if "260706-13z eureka-smoke (class S)" "tests/test-eureka-smoke.cjs" \
  node tests/test-eureka-smoke.cjs

echo "======================================"
echo "Phase 211: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
