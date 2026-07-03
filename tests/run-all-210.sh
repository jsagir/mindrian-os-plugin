#!/usr/bin/env bash
# Phase 210 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# revert-persona-enforcement-over-reach cluster. Models on tests/run-all-209.sh.
#
# Phase 210 softens the five v1.15-window HARD-FAIL/BINDING mechanisms (items
# A/B/C/D/E) to advisory/relevance-gated behavior while preserving every
# underlying capability. Every softened gate has a TWO-DIRECTIONAL test: the
# genuine/relevant/unanswered case still fires, the irrelevant/already-answered
# case no longer force-blocks.
#
# ALL Phase 210 legs are pre-declared here by plan 01 (Wave 0, Nyquist rule) so
# no later-wave plan ever edits this runner. Expected state at the end of Wave 0:
# several legs FAIL (RED, awaiting waves 2-3); the runner itself executes end to
# end. Every leg is run_if, guarded on a file that must exist, so a partially-
# landed phase exits cleanly with SKIPs. bash only. No em-dashes.

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

# --- Wave 0 two-directional tests (this phase's own legs) ---
run_if "210-E1 card-fire relevance gate (two-directional)" "tests/test-card-fire-relevance-gate.cjs" \
  node tests/test-card-fire-relevance-gate.cjs
run_if "210-E2 trailer relevance (frozen marker + conditional imperative)" "tests/test-210-trailer-relevance.cjs" \
  node tests/test-210-trailer-relevance.cjs
run_if "210-A shape-declaration advisory (warn-not-fail + --strict)" "tests/test-shape-declaration-advisory.cjs" \
  node tests/test-shape-declaration-advisory.cjs
run_if "210-B voice-glyph advisory (preference, not override)" "tests/test-voice-glyph-advisory.cjs" \
  node tests/test-voice-glyph-advisory.cjs
run_if "210-C voice-contract signal (score, not veto)" "tests/test-voice-contract-signal.cjs" \
  node tests/test-voice-contract-signal.cjs
run_if "210-D elevation quorum advisory (suggest, not force)" "tests/test-elevation-quorum-advisory.cjs" \
  node tests/test-elevation-quorum-advisory.cjs

# --- Per-item existing suites (extended by waves 2-3, preserve floors) ---
run_if "210-A shape-declaration pure-core suite" "scripts/check-shape-declaration.test.cjs" \
  node scripts/check-shape-declaration.test.cjs
run_if "210-B stance voice-glyph doctrine-presence suite" "tests/test-stance-voice-glyph-override.cjs" \
  node tests/test-stance-voice-glyph-override.cjs
run_if "210-C APO loop suite" "tests/test-202-apo-loop.cjs" \
  node tests/test-202-apo-loop.cjs
run_if "210-C voice-contract-gate detector suite" "tests/test-202-voice-contract-gate.cjs" \
  node tests/test-202-voice-contract-gate.cjs
run_if "210-D fusion-router suite" "tests/test-205-fusion-router.cjs" \
  node tests/test-205-fusion-router.cjs

# --- Item-E preserve floors (Phase 209 guarantees, must stay green) ---
run_if "210-E preserve floor: 209 incident replay (adversarial verification)" "tests/test-209-incident-replay.cjs" node "tests/test-209-incident-replay.cjs"
run_if "210-E3 stamp-firing-block suite" "tests/test-209-stamp-firing-block.cjs" \
  node tests/test-209-stamp-firing-block.cjs
run_if "210-E3 stamp sweep clean (--check)" "scripts/stamp-firing-block.cjs" \
  node scripts/stamp-firing-block.cjs --check

echo "======================================"
echo "Phase 210: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
