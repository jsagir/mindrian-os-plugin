#!/usr/bin/env bash
# Phase 121-03 Wave-2 scaffold harness. Asserts the 8 invariants of the
# 3 secondary D-09 capture points: empathy_observation CLI + room-receipt-emit
# helper + command_invocation PostToolUse hook + drowning-protection fixture.
# Mirrors tests/test-121-01-scaffold.sh shape (set -euo pipefail, fail() helper,
# function-wrapped gates, per-gate PASS message). Em-dash-free per memory rule
# feedback_no_emdashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: empathy-observation-emit.cjs exists AND emits empathy_observation.
gate1_empathy_emit_exists() {
  [ -f "scripts/empathy-observation-emit.cjs" ] || fail "Gate 1: scripts/empathy-observation-emit.cjs missing"
  local hits
  hits=$(grep -c "telemetry.emit('empathy_observation'" scripts/empathy-observation-emit.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 1: empathy-observation-emit.cjs missing telemetry.emit('empathy_observation'"
  fi
  echo "Gate 1 PASS: empathy-observation-emit.cjs exists with empathy_observation emit ($hits hits)"
}

# Gate 2: room-receipt-emit.cjs exists AND exports emitReceiptWritten.
gate2_room_receipt_emit_exists() {
  [ -f "lib/core/room-receipt-emit.cjs" ] || fail "Gate 2: lib/core/room-receipt-emit.cjs missing"
  local hits
  hits=$(grep -c "emitReceiptWritten" lib/core/room-receipt-emit.cjs || true)
  if [ "$hits" -lt 2 ]; then
    fail "Gate 2: room-receipt-emit.cjs missing emitReceiptWritten (export + internal call)"
  fi
  grep -q "module.exports" lib/core/room-receipt-emit.cjs || fail "Gate 2: room-receipt-emit.cjs missing module.exports"
  echo "Gate 2 PASS: lib/core/room-receipt-emit.cjs exports emitReceiptWritten ($hits hits)"
}

# Gate 3: telemetry-command-invocation.cjs exists AND emits command_invocation.
gate3_command_invocation_hook_exists() {
  [ -f "scripts/telemetry-command-invocation.cjs" ] || fail "Gate 3: scripts/telemetry-command-invocation.cjs missing"
  local hits
  hits=$(grep -c "telemetry.emit('command_invocation'" scripts/telemetry-command-invocation.cjs || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 3: telemetry-command-invocation.cjs missing telemetry.emit('command_invocation'"
  fi
  # Inner /^/mos:/ filter is the script-level guard.
  grep -q '/\^\\/mos:/' scripts/telemetry-command-invocation.cjs || fail "Gate 3: telemetry-command-invocation.cjs missing /^/mos:/ inner filter"
  echo "Gate 3 PASS: telemetry-command-invocation.cjs exists with command_invocation emit + /^/mos:/ filter"
}

# Gate 4: hooks/hooks.json contains telemetry-command-invocation AND is valid JSON.
gate4_hooks_json_registered() {
  local hits
  hits=$(grep -c "telemetry-command-invocation" hooks/hooks.json || true)
  if [ "$hits" -lt 1 ]; then
    fail "Gate 4: hooks/hooks.json missing telemetry-command-invocation entry"
  fi
  node -e "JSON.parse(require('node:fs').readFileSync('hooks/hooks.json','utf8'))" >/dev/null 2>&1 \
    || fail "Gate 4: hooks/hooks.json is not valid JSON"
  # 4 SessionStart entries must remain (preservation contract).
  local ss
  ss=$(node -e "const j=JSON.parse(require('node:fs').readFileSync('hooks/hooks.json','utf8')); process.stdout.write(String(j.hooks.SessionStart.length))")
  if [ "$ss" != "4" ]; then
    fail "Gate 4: hooks.json SessionStart entries changed (expected 4, got $ss)"
  fi
  echo "Gate 4 PASS: hooks/hooks.json registers telemetry-command-invocation + valid JSON + 4 SessionStart entries preserved"
}

# Gate 5: drowning-protection fixture passes (the constitutional invariant).
gate5_drowning_protection() {
  node tests/test-121-03-drowning-protection.cjs >/dev/null 2>&1 \
    || fail "Gate 5: tests/test-121-03-drowning-protection.cjs failed (D-09 invariant violated)"
  echo "Gate 5 PASS: drowning-protection fixture green (100 cmd_inv + 10 selector_pick, filter-isolatable)"
}

# Gate 6: All 3 integration tests pass.
gate6_integration_tests_green() {
  node tests/test-121-03-empathy-observation.cjs >/dev/null 2>&1 \
    || fail "Gate 6a: test-121-03-empathy-observation.cjs failed"
  node tests/test-121-03-room-receipt-emit.cjs >/dev/null 2>&1 \
    || fail "Gate 6b: test-121-03-room-receipt-emit.cjs failed"
  node tests/test-121-03-command-invocation-hook.cjs >/dev/null 2>&1 \
    || fail "Gate 6c: test-121-03-command-invocation-hook.cjs failed"
  echo "Gate 6 PASS: 3 integration test files green (empathy + room-receipt + command-invocation)"
}

# Gate 7: zero em-dashes across all 121-03 new files (printf-encoded U+2014
# literal to keep THIS script em-dash-free per memory rule).
gate7_zero_emdashes() {
  local EMDASH
  EMDASH=$(printf '\xe2\x80\x94')
  local files=(
    scripts/empathy-observation-emit.cjs
    lib/core/room-receipt-emit.cjs
    scripts/telemetry-command-invocation.cjs
    tests/test-121-03-empathy-observation.cjs
    tests/test-121-03-room-receipt-emit.cjs
    tests/test-121-03-command-invocation-hook.cjs
    tests/test-121-03-drowning-protection.cjs
    tests/test-121-03-scaffold.sh
  )
  for f in "${files[@]}"; do
    if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
      fail "Gate 7: em-dash present in $f (memory rule feedback_no_emdashes)"
    fi
  done
  echo "Gate 7 PASS: zero em-dashes across 8 121-03 files"
}

# Gate 8: Canon Part 8 chokepoint -- all 3 new emit sources route through
# writer.cjs (single chokepoint per Canon Part 9 navigation.cjs precedent).
gate8_chokepoint_invariant() {
  local hits
  hits=$(grep -c "telemetry/writer" scripts/empathy-observation-emit.cjs lib/core/room-receipt-emit.cjs scripts/telemetry-command-invocation.cjs 2>/dev/null | awk -F: '{s+=$2} END{print s}')
  if [ -z "$hits" ] || [ "$hits" -lt 3 ]; then
    fail "Gate 8: expected >= 3 require('.../telemetry/writer...') hits across 3 emit sources, got $hits"
  fi
  echo "Gate 8 PASS: all 3 new emit sources route through writer.cjs chokepoint ($hits hits)"
}

gate1_empathy_emit_exists
gate2_room_receipt_emit_exists
gate3_command_invocation_hook_exists
gate4_hooks_json_registered
gate5_drowning_protection
gate6_integration_tests_green
gate7_zero_emdashes
gate8_chokepoint_invariant

echo ""
echo "OK: 121-03 scaffold complete (8 gates: 3 emit sources + hooks.json + drowning protection + 3 integration tests + zero em-dashes + Canon Part 9 chokepoint)"
exit 0
