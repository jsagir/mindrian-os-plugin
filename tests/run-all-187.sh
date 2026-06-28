#!/usr/bin/env bash
# Phase 187 verification aggregator -- the single PASS/FAIL gate for the
# statusline-navigator-cockpit cluster. Mirrors tests/run-all-182.sh.
#
# Phase 187 ships the FOUR-TIER NAVIGATOR COCKPIT statusline
# (docs/STATUSLINE-CONTRACT.md, LOCKED 2026-06-28): a pure four-tier renderer
# (identity / orientation+health / Next-move / Ctx-risk), the LOCAL signal
# collector, the post-update + room-health corrective wiring, the Tier-1 Voice
# Signature glyph bind (Phase 182.1 detector), and the INV-SL-2 LOCAL
# measurement hook. It mints NO reach, NO posture, NO edge, NO node, NO new
# color, and opens NO Brain wire (Part 8 LOCAL). The frozen Part 3 contracts
# (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the dial
# glyphs) are UNTOUCHED.
#
# Legs:
#   (a) the cockpit suite (4 states / 50-80 thresholds / reorder-at-cliff /
#       INV-SL-4 / post-update doctor-fix / no em-dash / Part-8 / graceful
#       fallback / INV-SL-2 hook). HARD. Its Test 8 carries the per-module
#       glyph fence (proof the 3 cockpit modules contain NONE of the 3 EXCLUSIVE
#       carve-out glyphs), so the Phase-187 glyph contract is gated here.
#   (b) the carried D-02 broadcast fence (proof the preserved two-row block +
#       the chart / target / gear / compaction-imminent contract are byte-intact
#       beneath the cockpit hero line). File-guarded.
#
# NOTE: the global tests/test-statusline-glyph-isolation.cjs fence is NOT carried
# here. It currently fails on a PRE-EXISTING, unrelated violation in
# scripts/coherence-smoke-test.cjs (a file Phase 187 does not touch; last changed
# by commit ecd4aa01). Phase 187's own glyph contract is enforced by suite Test 8.
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

# (a) the cockpit suite -- HARD (carries the per-module glyph fence in Test 8).
run "cockpit four-tier suite (Phase 187)" node tests/test-statusline-cockpit-187.cjs

# (b) carried D-02 broadcast fence -- the preserved two-row block stays intact
#     beneath the cockpit hero line.
run_if "context-monitor D-02 broadcast fence" \
  tests/test-context-monitor-d02-broadcast.cjs \
  node tests/test-context-monitor-d02-broadcast.cjs

echo "========================================"
echo "  Summary (187 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
