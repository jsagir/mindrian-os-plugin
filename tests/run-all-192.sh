#!/usr/bin/env bash
# Phase 192 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# shape-f-hitl-selector-completion cluster (SFC-01..SFC-09). Models on
# tests/run-all-188.sh and tests/run-all-200.sh.
#
# Phase 192 closes the Shape-F HITL selector family with four Wave-1/Wave-2 plans,
# then this Wave-3 plan (192-05) aggregates them behind one gate:
#   192-01 -- menu-sweep: the live F.1 selectors that close onboard Step-1
#             mode-picker, suggest-next, and rooms list/where (SEED-020).
#   192-02 -- the F.7-max dial: the ACPT-06 atomic emission contract, the De Stijl
#             preview panel + confidence-bar glyphs, and the Q2 multiSelect
#             modifier pane riding the same card (SEED-021 Findings 1 + 2).
#   192-03 -- stance core: the pure LOCAL 4-pole stance dial (research / tell-act /
#             ask / redteam), the /mos:stance F.0 cycle-and-confirm toggle gate,
#             and the locked red/blue voice-glyph override (SEED-042).
#   192-04 -- statusline cockpit [stance] chip + forced voice-color, plus the
#             Plurai posture-framing-fidelity eval GATE (CSV + hand-labeled
#             baseline). SEED-042 CLI enhancement.
#
# It mints NO new frozen scalar: the Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, the
# 0.70/0.15 gate) are UNTOUCHED, and the frozen posture-id set (exactly 3) and
# reach-id set (exactly 6) are re-fenced here to prove the stance work never
# collided with either vocabulary.
#
# Every module/suite leg is run_if (SKIP-safe until the file exists), defensive
# against wave-ordering surprises: a leg whose test file is not present SKIPs, it
# does NOT FAIL. A present-but-failing suite always counts as FAIL, never SKIP.
# The two born-wired / render-coverage gates already ship in the repo today, so
# they run unconditionally as direct run() legs.
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
# (1) 192-01 -- menu-sweep live selectors (SEED-020).
# ---------------------------------------------------------------------------
run_if "192-01 menu-sweep live selectors (onboard/suggest-next/rooms)" \
  tests/test-192-menu-sweep-live-selectors.cjs \
  node tests/test-192-menu-sweep-live-selectors.cjs

# ---------------------------------------------------------------------------
# (2) 192-02 -- the F.7-max dial (SEED-021 Findings 1 + 2).
#   Finding 1: ACPT-06 atomic-emission contract.
#   Finding 2: De Stijl preview + confidence-bar, then the Q2 multiSelect
#              modifier pane riding the same card.
#   plus the dial-render-states regression carried alongside.
# ---------------------------------------------------------------------------
run_if "192-02 ACPT-06 dial atomic emission (Finding 1)" \
  tests/test-acpt-06-dial-atomic-emission.cjs \
  node tests/test-acpt-06-dial-atomic-emission.cjs

run_if "192-02 F.7-max preview panel + confidence bar (Finding 2 items 1/3/4)" \
  tests/test-f7max-preview-confidence-bar.cjs \
  node tests/test-f7max-preview-confidence-bar.cjs

run_if "192-02 F.7-max Q2 multiSelect modifier pane (Finding 2 item 2)" \
  tests/test-f7max-modifier-pane.cjs \
  node tests/test-f7max-modifier-pane.cjs

run_if "192-02 dial render-states regression" \
  tests/test-dial-render-states.cjs \
  node tests/test-dial-render-states.cjs

# ---------------------------------------------------------------------------
# (3) 192-03 -- stance core (SEED-042): pure state, F.0 toggle gate, voice glyph.
# ---------------------------------------------------------------------------
run_if "192-03 stance-state (pure LOCAL 4-pole dial)" \
  tests/test-stance-state.cjs \
  node tests/test-stance-state.cjs

run_if "192-03 stance toggle F.0 cycle-and-confirm gate" \
  tests/test-stance-toggle-f0-gate.cjs \
  node tests/test-stance-toggle-f0-gate.cjs

run_if "192-03 stance locked voice-glyph override" \
  tests/test-stance-voice-glyph-override.cjs \
  node tests/test-stance-voice-glyph-override.cjs

# ---------------------------------------------------------------------------
# (4) 192-04 -- statusline cockpit [stance] chip + forced voice-color (SEED-042).
# ---------------------------------------------------------------------------
run_if "192-04 statusline [stance] chip + forced voice-color" \
  tests/test-192-statusline-stance-chip.cjs \
  node tests/test-192-statusline-stance-chip.cjs

# ---------------------------------------------------------------------------
# CARRIED frozen-set drift fences. These PRE-DATE Phase 192; they are re-run here
# to prove zero regression:
#   posture-ids -- exactly 3, no 4th (the stance/posture work minted no 4th
#                  posture-id and never collided with the posture vocabulary).
#   reach-ids   -- exactly 6, no 7th (this phase minted no new LarryReach).
# ---------------------------------------------------------------------------
run_if "CARRIED posture-ids drift fence (exactly 3, no 4th)" \
  tests/test-posture-ids-drift.cjs \
  node tests/test-posture-ids-drift.cjs

run_if "CARRIED reach-ids drift fence (exactly 6, no 7th)" \
  tests/test-reach-ids-drift.cjs \
  node tests/test-reach-ids-drift.cjs

# ---------------------------------------------------------------------------
# Born-wired + render-coverage gates. These scripts ship in the repo today, so
# they run unconditionally (NOT file-existence-guarded). They confirm the new
# commands/stance.md surface is WIRED-or-EXCLUDED (not dark) and that every
# declared shape still has a render path.
# ---------------------------------------------------------------------------
run "born-wired gate (build-connector-registry --check, stance.md WIRED)" \
  node scripts/build-connector-registry.cjs --check

run "render-coverage gate (check-render-coverage)" \
  node scripts/check-render-coverage.cjs

# ---------------------------------------------------------------------------
# Retired leg (192-04): the LIVE hosted Plurai judge over the posture-framing
# fidelity CSV. Plurai was retired 2026-09-29 (hosted endpoint HTTP 404); live
# judging moved to Jev. It is counted as SKIPPED with a reason, never silently
# dropped and never PASSED: porting this golden CSV to a Jev live judge is a
# recorded follow-on. The local hand-labeled baseline + verdict_map hold the line.
# ---------------------------------------------------------------------------
echo "--- 192-04 live judge (retired) ---"
echo ">>> 192-04 live judge: SKIPPED (RETIRED 2026-09-29: hosted Plurai judge retired, endpoint HTTP 404; live judging moved to Jev; porting this golden CSV to a Jev live judge is a recorded follow-on). Hand-labeled baseline + verdict_map hold the line."
SKIP=$((SKIP+1))
echo ""

echo "======================================"
echo "Phase 192: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
