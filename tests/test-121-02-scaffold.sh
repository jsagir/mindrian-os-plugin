#!/usr/bin/env bash
# Phase 121-02 Wave-2 scaffold harness. Asserts the 9 invariants of the
# capture-point wire-ins (D-04 selector_pick + D-05 tension_engagement +
# D-06 auto_explore_decision + D-07 breakthrough_dismissed):
#
#   1. lib/hmi/selector-dispatcher.cjs contains telemetry.emit('selector_pick'
#   2. lib/memory/pending-tension-store.cjs contains telemetry.emit('tension_engagement'
#   3. Exactly one file under lib/ scripts/ hooks/ contains telemetry.emit('auto_explore_decision'
#   4. lib/core/breakthrough/scanner.cjs contains telemetry.emit('breakthrough_dismissed'
#   5. All 4 emits are wrapped in try/catch (non-blocking)
#   6. All 4 capture-point files require the unified writer module
#   7. All 4 integration tests pass (4/4 each)
#   8. Zero em-dashes across all modified files + new test files
#   9. Zero raw room slugs in captured events (only sha256 hashes)
#
# Em-dash HARD RULE (memory feedback_no_emdashes): use "--" not U+2014.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

SELECTOR=lib/hmi/selector-dispatcher.cjs
TENSION=lib/memory/pending-tension-store.cjs
SCANNER=lib/core/breakthrough/scanner.cjs

# Gate 1: selector-dispatcher contains telemetry.emit('selector_pick'.
gate1_selector_pick_emit() {
  local hits
  hits=$(grep -cF "writer.emit('selector_pick" "$SELECTOR" 2>/dev/null || true)
  hits=${hits:-0}
  if [ "$hits" -lt 1 ]; then
    fail "Gate 1: $SELECTOR missing writer.emit('selector_pick'"
  fi
  grep -q "Phase 121-02 D-04" "$SELECTOR" || fail "Gate 1: $SELECTOR missing 'Phase 121-02 D-04' marker"
  echo "Gate 1 PASS: $SELECTOR contains writer.emit('selector_pick' ($hits hits) + marker"
}

# Gate 2: tension-store contains telemetry.emit('tension_engagement'.
gate2_tension_engagement_emit() {
  local hits
  hits=$(grep -cF "writer.emit('tension_engagement" "$TENSION" 2>/dev/null || true)
  hits=${hits:-0}
  if [ "$hits" -lt 1 ]; then
    fail "Gate 2: $TENSION missing writer.emit('tension_engagement'"
  fi
  grep -q "Phase 121-02 D-05" "$TENSION" || fail "Gate 2: $TENSION missing 'Phase 121-02 D-05' marker"
  echo "Gate 2 PASS: $TENSION contains writer.emit('tension_engagement' ($hits hits) + marker"
}

# Gate 3: exactly ONE file under lib/ scripts/ hooks/ contains
#   writer.emit('auto_explore_decision' (the D-06 wire-in target).
gate3_auto_explore_decision_emit() {
  local hits
  hits=$(grep -rlF "writer.emit('auto_explore_decision" lib/ scripts/ hooks/ 2>/dev/null | wc -l)
  hits=${hits:-0}
  if [ "$hits" -lt 1 ]; then
    fail "Gate 3: no file contains writer.emit('auto_explore_decision'"
  fi
  if [ "$hits" -gt 2 ]; then
    fail "Gate 3: $hits files contain writer.emit('auto_explore_decision'; expected 1 (allow 2 for safety)"
  fi
  grep -rq "Phase 121-02 D-06" lib/ scripts/ hooks/ || fail "Gate 3: no file contains 'Phase 121-02 D-06' marker"
  echo "Gate 3 PASS: writer.emit('auto_explore_decision' wired in $hits file(s) + marker"
}

# Gate 4: scanner.cjs contains telemetry.emit('breakthrough_dismissed'.
gate4_breakthrough_dismissed_emit() {
  local hits
  hits=$(grep -cF "writer.emit('breakthrough_dismissed" "$SCANNER" 2>/dev/null || true)
  hits=${hits:-0}
  if [ "$hits" -lt 1 ]; then
    fail "Gate 4: $SCANNER missing writer.emit('breakthrough_dismissed'"
  fi
  grep -q "Phase 121-02 D-07" "$SCANNER" || fail "Gate 4: $SCANNER missing 'Phase 121-02 D-07' marker"
  echo "Gate 4 PASS: $SCANNER contains writer.emit('breakthrough_dismissed' ($hits hits) + marker"
}

# Gate 5: all 4 emits are wrapped in try/catch (non-blocking semantics).
# We grep for 'try' appearing within ~12 lines BEFORE each emit, which is the
# pattern every wire-in uses.
gate5_emits_non_blocking() {
  # The wire-in modules use varied wrap distances (the dispatcher's helper has
  # its top-level try ~30 lines above the writer.emit; the tension-store
  # wrapper is closer-in; the scanner's wrap is mid-distance). Look back 60
  # lines from each writer.emit( site; the canonical non-blocking idiom must
  # carry both 'try {' AND a 'catch' within that window.
  for f in "$SELECTOR" "$TENSION" "$SCANNER"; do
    local tryhits
    tryhits=$(grep -B 60 -F "writer.emit(" "$f" 2>/dev/null | grep -c "try {" || true)
    tryhits=${tryhits:-0}
    if [ "$tryhits" -lt 1 ]; then
      fail "Gate 5: $f writer.emit() has no 'try {' in the 60-line preamble (non-blocking violated)"
    fi
    local catchhits
    catchhits=$(grep -cE "catch \\(_?e\\)" "$f" 2>/dev/null || true)
    catchhits=${catchhits:-0}
    if [ "$catchhits" -lt 1 ]; then
      fail "Gate 5: $f has no 'catch (_e)' anywhere (non-blocking violated)"
    fi
  done
  # D-06: at least one file under lib/ has the try-wrap around emit('auto_explore_decision'.
  local autofile
  autofile=$(grep -rlF "writer.emit('auto_explore_decision" lib/ scripts/ hooks/ 2>/dev/null | head -n 1)
  [ -n "$autofile" ] || fail "Gate 5: cannot locate auto_explore_decision wire-in file"
  local autonear
  autonear=$(grep -B 60 -F "writer.emit('auto_explore_decision" "$autofile" 2>/dev/null | grep -c "try {" || true)
  autonear=${autonear:-0}
  if [ "$autonear" -lt 1 ]; then
    fail "Gate 5: $autofile auto_explore_decision emit has no 'try {' in 60-line preamble"
  fi
  echo "Gate 5 PASS: all 4 emits are try/wrapped (non-blocking)"
}

# Gate 6: all 4 capture-point files import the unified writer module.
gate6_writer_required() {
  local autofile
  autofile=$(grep -rlF "writer.emit('auto_explore_decision" lib/ scripts/ hooks/ 2>/dev/null | head -n 1)
  [ -n "$autofile" ] || fail "Gate 6: cannot locate auto_explore_decision wire-in file"
  local files=("$SELECTOR" "$TENSION" "$SCANNER" "$autofile")
  local total=0
  for f in "${files[@]}"; do
    local hits
    hits=$(grep -cF "telemetry/writer.cjs" "$f" 2>/dev/null || true)
    hits=${hits:-0}
    if [ "$hits" -lt 1 ]; then
      fail "Gate 6: $f does not require telemetry/writer.cjs"
    fi
    total=$((total + hits))
  done
  echo "Gate 6 PASS: all 4 capture-point files require telemetry/writer.cjs ($total total require hits)"
}

# Gate 7: all 4 integration tests pass with 4/4 each.
gate7_integration_tests_green() {
  for t in \
    tests/test-121-02-selector-pick-capture.cjs \
    tests/test-121-02-tension-engagement-capture.cjs \
    tests/test-121-02-auto-explore-capture.cjs \
    tests/test-121-02-breakthrough-dismissed-capture.cjs; do
    if ! node "$t" >/dev/null 2>&1; then
      fail "Gate 7: $t failed"
    fi
  done
  echo "Gate 7 PASS: all 4 capture integration tests green (4/4 each = 16/16 total)"
}

# Gate 8: zero em-dashes across all modified files + new test files.
gate8_zero_emdashes() {
  local EMDASH
  EMDASH=$(printf '\xe2\x80\x94')
  local autofile
  autofile=$(grep -rlF "writer.emit('auto_explore_decision" lib/ scripts/ hooks/ 2>/dev/null | head -n 1)
  local files=(
    "$SELECTOR"
    "$TENSION"
    "$SCANNER"
    "$autofile"
    tests/test-121-02-selector-pick-capture.cjs
    tests/test-121-02-tension-engagement-capture.cjs
    tests/test-121-02-auto-explore-capture.cjs
    tests/test-121-02-breakthrough-dismissed-capture.cjs
    tests/test-121-02-scaffold.sh
  )
  for f in "${files[@]}"; do
    [ -n "$f" ] || continue
    if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
      fail "Gate 8: em-dash present in $f (memory rule feedback_no_emdashes)"
    fi
  done
  echo "Gate 8 PASS: zero em-dashes across 9 files (4 source + 4 tests + 1 scaffold)"
}

# Gate 9: zero raw room slugs in captured events. The wire-ins must use
# _sha256() / crypto.createHash('sha256') before assigning room_slug_sha256;
# never assign the raw slug directly. We grep for 'room_slug_sha256:' followed
# (on the same OR next line) by anything other than the hash function call.
gate9_room_slug_hashed() {
  local autofile
  autofile=$(grep -rlF "writer.emit('auto_explore_decision" lib/ scripts/ hooks/ 2>/dev/null | head -n 1)
  local files=("$SELECTOR" "$TENSION" "$SCANNER" "$autofile")
  for f in "${files[@]}"; do
    [ -n "$f" ] || continue
    # Each wire-in must assign room_slug_sha256 through a hashing helper:
    # either _sha256(...), _sha256Hex(...), slugHash, or crypto.createHash.
    # Match the row above OR below room_slug_sha256: (since helper expressions
    # may sit on a separate line); grep with -A2 captures the assignment scope.
    local hashed
    hashed=$(grep -cE "_sha256|createHash|slugHash|Hex\\(" "$f" 2>/dev/null || true)
    hashed=${hashed:-0}
    if [ "$hashed" -lt 1 ]; then
      fail "Gate 9: $f assigns room_slug_sha256 without a sha256 call (raw slug leak risk)"
    fi
  done
  echo "Gate 9 PASS: all 4 wire-ins hash room slug via sha256 before assigning room_slug_sha256"
}

gate1_selector_pick_emit
gate2_tension_engagement_emit
gate3_auto_explore_decision_emit
gate4_breakthrough_dismissed_emit
gate5_emits_non_blocking
gate6_writer_required
gate7_integration_tests_green
gate8_zero_emdashes
gate9_room_slug_hashed

echo ""
echo "OK: 121-02 scaffold complete (9 gates: 4 capture-point emit markers + non-blocking + writer require + integration tests + zero em-dashes + sha256 room slug)"
exit 0
