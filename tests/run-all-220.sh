#!/usr/bin/env bash
# Phase 220 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# web-ingestion-agent cluster (the Tavily Extract adapter + Part 8 egress fence
# from Plan 01, with file-gated legs for the ingest pipeline, safety fixtures,
# URL sensor, and crawl loop that Plans 02-04 land later).
#
# The phase gate has TWO legs (the 218 fixture-green-lied lesson):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the live URL + navigator leg recorded in 220-VERIFICATION.md (Plan 05):
#       one real URL ingested end-to-end with entities visible via graph_query.
#       Fixture-green alone is NOT phase-done.
#
# EGRESS RULE (Part 8, restated): real-room content NEVER reaches a network
# judge. Every leg runs offline (stubbed extract adapter, zero-network preload);
# the live-URL acceptance is verified by the human leg, not an automated judge.
#
# Every 220 leg is run_if FILE-GATED so a partially-landed tree (Plans 02-04
# land their files later; 219 lands in parallel) SKIPs cleanly rather than
# RED-failing on absence. Regression legs chain backward: 219, 218, and 216
# (which itself chains 215 and 211 -- no duplicate standalone legs, the 216-04
# precedent). bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211/216/218): the offline preload
# flips transformers.js env.allowRemoteModels=false in every spawned leg AND its
# children, so an uncached model load fails fast and degrades instead of
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

# (a) Plan 01: the Tavily Extract adapter contract (typed degrade statuses,
#     full-page markdown pass-through, D-02 size bound + scheme fence) and the
#     REQ-5 constitutional egress fence (planted room-content query -> zero
#     fetch + throw; outbound body key-allowlist; chokepoint uniqueness).
run_if "220-01 extract adapter contract" "tests/test-220-extract-adapter.cjs" \
  node tests/test-220-extract-adapter.cjs
run_if "220-01 Part 8 egress fence (REQ-5)" "tests/test-220-part8-egress.cjs" \
  node tests/test-220-part8-egress.cjs

# (b) Plans 02-04 legs, file-gated so today's tree SKIPs them cleanly.
run_if "220-02 ingest e2e (fixture URL -> file -> extract -> graph)" "tests/test-220-ingest-e2e.cjs" \
  node tests/test-220-ingest-e2e.cjs
run_if "220-02 idempotency (content-hash dedup + SUPERSEDES)" "tests/test-220-idempotency.cjs" \
  node tests/test-220-idempotency.cjs
run_if "220-02 ingest safety (injection-as-data / oversize / path-escape)" "tests/test-220-ingest-safety.cjs" \
  node tests/test-220-ingest-safety.cjs
run_if "220-03 URL sensor (SENS fires, gates, never auto-files)" "tests/test-220-url-sensor.cjs" \
  node tests/test-220-url-sensor.cjs
run_if "220-04 crawl loop (changed-source-only, regulator-capped)" "tests/test-220-crawl-loop.cjs" \
  node tests/test-220-crawl-loop.cjs

# (c) Always-on constitutional gates (Part 11). The shape-declaration check
#     runs in its Phase 210 ADVISORY posture (--check, WARN never block): the
#     --strict hard-fail trips on pre-existing skill declarations that predate
#     Phase 220 and are tracked in the phase deferred-items, not owned here.
run "gate: born-wired connector registry" \
  node scripts/build-connector-registry.cjs --check
run "gate: shape declaration (advisory per Phase 210)" \
  node scripts/check-shape-declaration.cjs --check

# (d) Regression legs, file-gated (219 lands in parallel; 216 chains 215 and
#     211 internally -- no duplicate standalone legs, the 216-04 precedent).
run_if "219 no-regression" "tests/run-all-219.sh" \
  bash tests/run-all-219.sh
run_if "218 no-regression" "tests/run-all-218.sh" \
  bash tests/run-all-218.sh
run_if "216 no-regression (chains 215 + 211)" "tests/run-all-216.sh" \
  bash tests/run-all-216.sh

echo "======================================"
echo "Phase 220: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
