#!/usr/bin/env bash
# Phase 202 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# agent-lightning-apo-lab cluster (SEED-002). Models on tests/run-all-196.sh.
#
# Phase 202 builds the lab-side APO (Automatic Prompt Optimization) loop:
#   202-01 -- the telemetry consumer + reward table (the scoring signal).
#   202-02 -- the propose/score/select loop over one target prompt (Path A,
#             recommend-then-ratify; the loop never writes commands/act.md).
#   202-03 -- the voice-contract eval gate: Canon Part 12 makes the Larry voice
#             contract a HARD disqualifier so reward can never buy a violation.
# Plurai is BUILD/CI only, synthetic data only, never on the runtime path
# (Canon Part 8); the local gates are pure + offline for the mechanical checks.
#
# WAVE 0 CONTRACT: every leg is run_if, GUARDED ON THE RUNTIME MODULE FILE (not
# the test file), so an early wave exits cleanly with SKIPs. As each module
# lands, its leg flips from SKIP to a real run and the gate tightens.
#
# bash only. No emoji. No em-dashes.

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
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# ---------------------------------------------------------------------------
# 202-01: telemetry consumer + reward table (the scoring signal). run_if guarded
# on the runtime module lab/apo/telemetry-consumer.cjs.
# ---------------------------------------------------------------------------
run_if "202-01 telemetry consumer + reward table" \
  lab/apo/telemetry-consumer.cjs \
  node tests/test-202-telemetry-consumer.cjs

# ---------------------------------------------------------------------------
# 202-02: the APO loop core (propose/score/select, Path A recommend-then-ratify).
# run_if guarded on lab/apo/apo-loop.cjs.
# ---------------------------------------------------------------------------
run_if "202-02 APO loop core (Path A recommend-then-ratify)" \
  lab/apo/apo-loop.cjs \
  node tests/test-202-apo-loop.cjs

# ---------------------------------------------------------------------------
# 202-03: the voice-contract eval gate (Canon Part 12 hard disqualifier). run_if
# guarded on lab/apo/voice-contract-gate.cjs.
# ---------------------------------------------------------------------------
run_if "202-03 voice-contract gate (Part 12 disqualifier)" \
  lab/apo/voice-contract-gate.cjs \
  node tests/test-202-voice-contract-gate.cjs

echo "========================================"
echo "  Summary (202 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
