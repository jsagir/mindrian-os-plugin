#!/usr/bin/env bash
# Phase 298 verification aggregator -- the single PASS/FAIL/SKIP gate for
# harness-as-code: declare and machine-enforce the minimum bar. Models on
# tests/run-all-201.sh / run-all-200.sh / run-all-196.sh.
#
# Phase 298 lands: (01) manifest v2 (`data/harness-manifest.json` grows
# `policies`, `larry_surfaces`, `fixture_ref` alongside the existing three
# maps); (02) `data/harness-policies/` -- the policy directory, one JSON file
# per gate/voice/memory/contract check, validated against `_schema.json`;
# (03) `scripts/run-harness.cjs` -- the runner that spawns each policy's
# runner at its declared rung (declared/logged/blocking), never promotes a
# rung itself, and never opens the room-db write path (Layer 0 scan only);
# (04) `scripts/check-graph-derive-health.cjs` -- a thin wrapper over the
# existing `detectRoomHealth()` derive-health gate; (05) the voice rung-2
# trio: `lib/hmi/voice-style-log.cjs`'s `evaluatePromotion`, the Stop hook
# `scripts/check-voice-style.cjs`, and its doctor module; (06) the F.8
# readable-row governance basket (claim text as label, `<kind> -> <section>,
# conf 0.xx, from <path>` as description).
#
# Each leg is run_if, guarded on a file that must exist, so this
# four-slice, multi-wave phase exits cleanly with SKIPs rather than FAILs
# while partially landed -- a phase this size cannot land in one plan, and a
# hard FAIL on an as-yet-unbuilt slice would make every intermediate wave
# look broken. bash only. No em-dashes.

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

run_if "298-01 policies schema" "tests/test-298-policies-schema.cjs" \
  node tests/test-298-policies-schema.cjs
run_if "298-01 derive health gate" "tests/test-298-derive-health.cjs" \
  node tests/test-298-derive-health.cjs
run_if "298-01 voice-style log" "tests/test-298-voice-log.cjs" \
  node tests/test-298-voice-log.cjs
run_if "298-01 contract parity" "tests/test-298-contract-parity.cjs" \
  node tests/test-298-contract-parity.cjs
run_if "298-01 runner idempotence" "tests/test-298-runner-idempotent.cjs" \
  node tests/test-298-runner-idempotent.cjs
run_if "298 harness-manifest --check" "data/harness-manifest.json" \
  node scripts/build-harness-manifest.cjs --check
run_if "298 runner converged fixture" "scripts/run-harness.cjs" \
  node scripts/run-harness.cjs --room data/harness-fixtures/converged-room

echo "======================================"
echo "Phase 298: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
