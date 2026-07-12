#!/usr/bin/env bash
# Phase 218 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# entity-extraction-pipeline cluster (the typed entity-node writer + domain edge
# vocabulary from Plan 01, the D-05 write-safety + tier-1 prose extractor from
# Plan 02, and the standalone entity-extract.cjs dispatcher + noise-reduction
# outcome from Plan 03). Pure composition + governed wiring over the shipped
# 211-216 Eureka engine (Canon Part 7/11).
#
# The phase gate has TWO legs (the 211-05 / 216 pattern):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the Plan 03 human-verify leg recorded: a HUMAN runs entity-extract
#       against the live aion-eureka-synergy room and confirms the top-25
#       structural-vs-structural share drops below 50% (REQ-5 acceptance number,
#       D-04), logged in the phase VERIFICATION artifact.
#
# ZERO-TOUCH PROOF (D-03/REQ-3/REQ-4): the whole point of routing extraction
# through navigation is that the downstream readers and the embedding store get
# richer results with NO code change on their side. The git-diff --exit-code
# gates below are the enforcement: vector-store.cjs (REQ-3, no second embedding
# path) and insights.cjs + graph-ops.cjs (REQ-4, no reader change) must be
# byte-unchanged. The grep gates enforce Canon Part 8/9: no raw INSERT INTO
# nodes/edges (all writes route through navigation) and no network reach in the
# extractor or dispatcher.
#
# EGRESS RULE (Part 8, restated): real-room content NEVER reaches a network judge.
# Every leg runs offline (stub encoder); the live-room acceptance is verified by
# the human spot-check, not by any automated judge.
#
# The 211 regression leg is run_if, GATED ON A FILE that must exist, so a
# partially-landed tree exits cleanly with a SKIP rather than RED-failing on
# absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211/216): the offline preload flips
# transformers.js env.allowRemoteModels=false in every spawned leg (AND its
# children -- the noise-reduction leg's entity-extract re-embed spawns nothing but
# loads the model), so an uncached model load fails fast and degrades instead of
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

# (a) The Plan 01 + Plan 02 unit tests: the entity-node writer + edge vocabulary,
#     the D-05 write-safety edit, and the tier-1 prose extractor.
run "218-01 edge vocab + entity writer floor" \
  node tests/test-218-edge-vocab.cjs
run "218-01 entity-node writer (proposed-only)" \
  node tests/test-218-entity-writer.cjs
run "218-02 D-05 write-safety (busy timeout + rollback)" \
  node tests/test-218-write-safety.cjs
run "218-02 tier-1 extractor (zero egress)" \
  node tests/test-218-extractor.cjs

# (b) REQ-3 zero-touch gate: no second embedding path, no vector-store signature
#     change. The re-embed rides the EXISTING tri-modal indexNodes path.
run "REQ-3 vector-store unchanged" \
  git diff --exit-code lib/core/eureka/vector-store.cjs

# (c) REQ-4 zero-touch gate: the downstream readers (whitespace_scan via
#     insights.cjs, contradiction_check via graph-ops.cjs) benefit with ZERO code
#     change on their side.
run "REQ-4 readers unchanged" \
  git diff --exit-code lib/core/navigation/insights.cjs lib/core/graph-ops.cjs

# (d) REQ-2 / Canon Part 9 + Part 8 grep gates: every write routes through
#     navigation (no raw INSERT), and the extractor + dispatcher make zero network
#     reach.
run "no raw node/edge INSERT" \
  bash -c '! grep -rnE "INSERT INTO (nodes|edges)" scripts/entity-extract.cjs lib/core/eureka/entity-extractor.cjs'
run "zero network" \
  bash -c "! grep -rnE \"fetch|https?\\.|require\\('node:http\" lib/core/eureka/entity-extractor.cjs scripts/entity-extract.cjs"

# (e) No command surface leaked (D-03: entity-extract.cjs is a plain script, NOT a
#     born-wired /mos: command; the connector registry must stay green as proof).
run "no command surface leaked" \
  node scripts/build-connector-registry.cjs --check

# (f) REQ-5 directional: the noise-reduction mechanism on a hermetic seeded room.
#     The live acceptance NUMBER is the Task 3 human-verify leg (aion room, D-04).
run "REQ-5 noise-reduction (directional, offline)" \
  node tests/test-218-noise-reduction.cjs

# (g) 211 engine no-regression: Plan 02's openRoomDb D-05 edit is GLOBAL to every
#     caller, so the 211 acceptance path must stay green. Guarded on the 211
#     aggregator so a partial tree SKIPs cleanly.
run_if "211 engine no-regression" "tests/run-all-211.sh" \
  bash tests/run-all-211.sh

echo "======================================"
echo "Phase 218: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
