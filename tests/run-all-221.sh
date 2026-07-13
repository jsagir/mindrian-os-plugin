#!/usr/bin/env bash
# Phase 221 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# llm-engine-recovery cluster (the typed stage envelopes + failure-injection
# harness from Plan 01, the recovery dispatcher + tier ladder from Plan 02,
# the bounded LLM controller + hard fences from Plan 03, and the validation
# matrix + vantage fixture from Plan 04).
#
# FILE-OWNERSHIP RULE (the 219 pattern): every phase leg is registered NOW as
# a run_if file-gated entry, so later plans only ADD their test file and never
# modify this harness. A not-yet-landed leg SKIPs cleanly (never RED on
# absence). Same for the 211/215/216/219/220 regression legs: a partially
# landed tree SKIPs, never RED-fails.
#
# GREP GATES (the 218 comment-filtered idiom, never a bare unfiltered grep):
#   (a) no raw INSERT INTO in lib/core/recovery/ (every write routes through
#       the navigation chokepoint -- Canon Part 9);
#   (b) zero network reach in lib/core/recovery/ (no node:http/https require,
#       no fetch call -- Part 8: the recovery substrate is deterministic and
#       local; the only egress lives behind the audited corpus adapters);
#   (c) em-dash sweep over the new 221 files (CLAUDE.md HARD RULE).
#
# EGRESS RULE (Part 8, restated): real-room content NEVER reaches a network
# judge. Every leg runs offline (stub encoder, zero-network preload below).
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211/216/218): the offline preload
# flips transformers.js env.allowRemoteModels=false in every spawned leg, so
# an uncached model load fails fast and degrades instead of reaching the
# network. No-op when the eureka dep is absent.
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

# (a) Plan 01: the stage-envelope contract + injection harness + converted
#     adapters (REQ-1). The one leg that must exist from wave 1.
run "221-01 stage envelopes + injection harness (REQ-1)" \
  node tests/test-221-envelopes.cjs

# (b) Plans 02-04 legs, file-gated: they SKIP until their plans land them.
run_if "221-02 recovery dispatcher + tier ladder (REQ-2)" "tests/test-221-dispatcher.cjs" \
  node tests/test-221-dispatcher.cjs
run_if "221-03 bounded LLM recovery controller (REQ-3)" "tests/test-221-controller.cjs" \
  node tests/test-221-controller.cjs
run_if "221-03 controller hard fences (D-06)" "tests/test-221-controller-fences.cjs" \
  node tests/test-221-controller-fences.cjs
run_if "221-04 failure-injection validation matrix (REQ-5)" "tests/test-221-matrix.cjs" \
  node tests/test-221-matrix.cjs
run_if "221-04 vantage fixture (authoritative_workspace_unavailable)" "tests/test-221-vantage.cjs" \
  node tests/test-221-vantage.cjs

# (c) Canon Part 9 grep gate, comment-filtered: no raw INSERT INTO anywhere in
#     lib/core/recovery/ (writes route through navigation.cjs only).
run "no raw INSERT INTO in lib/core/recovery (comment-filtered)" \
  bash -c 'hits=$(grep -rn "INSERT INTO" lib/core/recovery/ 2>/dev/null | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)" || true); [ -z "$hits" ] || { echo "$hits"; exit 1; }'

# (d) Canon Part 8 grep gate, comment-filtered: zero network reach in
#     lib/core/recovery/ (no node:http/https require, no fetch call site).
run "zero network reach in lib/core/recovery (comment-filtered)" \
  bash -c 'hits=$(grep -rnE "require\((\x27|\")(node:)?https?(\x27|\")\)|\bfetch\(" lib/core/recovery/ 2>/dev/null | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)" || true); [ -z "$hits" ] || { echo "$hits"; exit 1; }'

# (e) Em-dash sweep over the new 221 files (CLAUDE.md HARD RULE). The pattern
#     is built via printf so this harness itself stays clean.
run "em-dash sweep (221 files)" \
  bash -c 'EMD=$(printf "\342\200\224"); hits=$(grep -rn "$EMD" lib/core/recovery/ tests/test-221-envelopes.cjs tests/run-all-221.sh 2>/dev/null || true); [ -z "$hits" ] || { echo "$hits"; exit 1; }'

# (f) Regression legs, run_if file-gated on each phase aggregator so a
#     partially-landed tree SKIPs cleanly (219 exists today; 220 lands with
#     220-01; both must SKIP on absence, never RED).
run_if "211 engine no-regression" "tests/run-all-211.sh" \
  bash tests/run-all-211.sh
run_if "215 no-regression" "tests/run-all-215.sh" \
  bash tests/run-all-215.sh
run_if "216 no-regression" "tests/run-all-216.sh" \
  bash tests/run-all-216.sh
run_if "219 no-regression" "tests/run-all-219.sh" \
  bash tests/run-all-219.sh
run_if "220 no-regression" "tests/run-all-220.sh" \
  bash tests/run-all-220.sh

echo "======================================"
echo "Phase 221: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
