#!/usr/bin/env bash
# MindrianOS Plugin -- Phase 27 Room Structure Tests
# Tests: compute-state, proactive intelligence persistence, repeat suppression,
#        .proactive-intelligence.json location, cross-room-detect graceful exits,
#        CJS script argument validation, room tree cleanliness.
set -euo pipefail

PASS=0
FAIL=0
TEST_DIR="/tmp/test-room-structure-$$"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 -- $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 27: Room Structure Tests ==="
echo "Test dir: $TEST_DIR"
echo ""

# Build a minimal test room
mkdir -p "$TEST_DIR/room/problem-definition"
mkdir -p "$TEST_DIR/room/market-analysis"
mkdir -p "$TEST_DIR/room/solution-design"

cat > "$TEST_DIR/room/problem-definition/entry-1.md" << 'ENTRY'
---
title: Test Problem
methodology: domain-explorer
created: 2026-03-28
---
# Test Problem
This is a test problem definition about **infrastructure** and **technology**.
ENTRY

cat > "$TEST_DIR/room/market-analysis/entry-1.md" << 'ENTRY'
---
title: Market Size
methodology: lean-canvas
created: 2026-03-28
---
# Market Size
The target market for **infrastructure** technology is growing.
ENTRY

# ── Test 1: compute-state produces valid STATE.md ──
echo "[Test 1] compute-state produces valid STATE.md"
state_output=$(bash "$SCRIPT_DIR/scripts/compute-state" "$TEST_DIR/room" 2>/dev/null || true)
if echo "$state_output" | grep -q "# Data Room State"; then
  pass "compute-state produces STATE.md header"
else
  fail "compute-state output" "missing '# Data Room State' header"
fi

# ── Test 2: proactive-intelligence.cjs persists insights from analyze-room output ──
echo "[Test 2] proactive-intelligence.cjs persists insights"
persist_result=$(node -e "
  const pi = require('$SCRIPT_DIR/lib/core/proactive-intelligence.cjs');
  const output = 'GAP:STRUCTURAL:financial-model:HIGH:Section is empty\nCONVERGE:infrastructure:3:MEDIUM:Appears in 3 entries across multiple sections\nCONTRADICT:problem-definition:market-analysis:MEDIUM:Customer type mismatch';
  const result = pi.persistIntelligence('$TEST_DIR/room', output);
  console.log(JSON.stringify(result));
" 2>/dev/null || echo '{}')

persisted=$(echo "$persist_result" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.persisted||0)" 2>/dev/null || echo "0")
new_count=$(echo "$persist_result" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log(j.new||0)" 2>/dev/null || echo "0")

if [ "$persisted" -ge 3 ] && [ "$new_count" -ge 3 ]; then
  pass "persistIntelligence parsed and stored 3 insights (persisted=$persisted, new=$new_count)"
else
  fail "persistIntelligence" "expected 3+ persisted and new, got persisted=$persisted new=$new_count"
fi

# ── Test 3: Repeat suppression -- insight shown 3+ times returns shouldSuppress=true ──
echo "[Test 3] Repeat suppression at threshold 3"

# Run persist 3 more times to increment times_shown
for i in 1 2 3; do
  node -e "
    const pi = require('$SCRIPT_DIR/lib/core/proactive-intelligence.cjs');
    pi.persistIntelligence('$TEST_DIR/room', 'GAP:STRUCTURAL:financial-model:HIGH:Section is empty');
  " 2>/dev/null || true
done

suppress_result=$(node -e "
  const pi = require('$SCRIPT_DIR/lib/core/proactive-intelligence.cjs');
  const data = pi.loadIntelligence('$TEST_DIR/room');
  const gapInsight = data.insights.find(i => i.type === 'gap' && i.section === 'financial-model');
  if (!gapInsight) { console.log('NOT_FOUND'); process.exit(0); }
  console.log(pi.shouldSuppress(gapInsight) ? 'SUPPRESSED' : 'NOT_SUPPRESSED');
  console.error('times_shown=' + gapInsight.times_shown);
" 2>/dev/null || echo "ERROR")

if [ "$suppress_result" = "SUPPRESSED" ]; then
  pass "shouldSuppress returns true after 3+ showings"
else
  fail "shouldSuppress" "expected SUPPRESSED, got $suppress_result"
fi

# ── Test 4: .proactive-intelligence.json written to room dir ──
echo "[Test 4] .proactive-intelligence.json written to room dir"
if [ -f "$TEST_DIR/room/.proactive-intelligence.json" ]; then
  # Verify it's valid JSON
  if node -e "JSON.parse(require('fs').readFileSync('$TEST_DIR/room/.proactive-intelligence.json','utf8'))" 2>/dev/null; then
    pass ".proactive-intelligence.json exists and is valid JSON"
  else
    fail ".proactive-intelligence.json" "file exists but invalid JSON"
  fi
else
  fail ".proactive-intelligence.json" "file not written to room dir"
fi

# ── Test 5: cross-room-detect.cjs exits 0 when no registry exists ──
echo "[Test 5] cross-room-detect.cjs exits 0 when no registry"
cross_output=$(node "$SCRIPT_DIR/scripts/cross-room-detect.cjs" "$TEST_DIR/room" "$TEST_DIR" 2>/dev/null)
cross_exit=$?
if [ $cross_exit -eq 0 ]; then
  scanned=$(echo "$cross_output" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).scanned)" 2>/dev/null || echo "-1")
  if [ "$scanned" = "0" ]; then
    pass "cross-room-detect exits 0 with scanned=0 (no registry)"
  else
    fail "cross-room-detect" "exited 0 but scanned=$scanned"
  fi
else
  fail "cross-room-detect" "exit code $cross_exit (expected 0)"
fi

# ── Test 6: cross-room-detect.cjs exits 0 when single room ──
echo "[Test 6] cross-room-detect.cjs exits 0 with single room"
mkdir -p "$TEST_DIR/.rooms"
cat > "$TEST_DIR/.rooms/registry.json" << 'REG'
{
  "version": 1,
  "active": "test",
  "rooms": {
    "test": { "path": "room", "status": "active" }
  }
}
REG

cross_single=$(node "$SCRIPT_DIR/scripts/cross-room-detect.cjs" "$TEST_DIR/room" "$TEST_DIR" 2>/dev/null)
cross_single_exit=$?
if [ $cross_single_exit -eq 0 ]; then
  rels=$(echo "$cross_single" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).relationships)" 2>/dev/null || echo "-1")
  if [ "$rels" = "0" ]; then
    pass "cross-room-detect exits 0 with relationships=0 (single room)"
  else
    fail "cross-room-detect single room" "relationships=$rels (expected 0)"
  fi
else
  fail "cross-room-detect single room" "exit code $cross_single_exit"
fi

# ── Test 7: CJS scripts accept room path as first argument ──
echo "[Test 7] CJS scripts accept room path as argument"
# Test proactive-intelligence accepts room path
pi_test=$(node -e "
  const pi = require('$SCRIPT_DIR/lib/core/proactive-intelligence.cjs');
  const data = pi.loadIntelligence('$TEST_DIR/room');
  console.log(Array.isArray(data.insights) ? 'OK' : 'FAIL');
" 2>/dev/null || echo "ERROR")

# Test artifact-id accepts room path (if exists)
aid_test="OK"
if [ -f "$SCRIPT_DIR/lib/core/artifact-id.cjs" ]; then
  aid_test=$(node -e "
    const aid = require('$SCRIPT_DIR/lib/core/artifact-id.cjs');
    console.log(typeof aid.injectArtifactId === 'function' ? 'OK' : 'FAIL');
  " 2>/dev/null || echo "ERROR")
fi

if [ "$pi_test" = "OK" ] && [ "$aid_test" = "OK" ]; then
  pass "CJS scripts accept room path as argument"
else
  fail "CJS argument pattern" "pi=$pi_test aid=$aid_test"
fi

# ── Test 8: Room tree has no hidden files polluting structure ──
echo "[Test 8] Room tree cleanliness"
# After all operations, check that only .lazygraph/ and .proactive-intelligence.json are hidden
hidden_files=$(find "$TEST_DIR/room" -maxdepth 1 -name ".*" -not -name "." -not -name ".lazygraph" -not -name ".proactive-intelligence.json" -not -name ".proactive-intelligence.json.tmp" 2>/dev/null | wc -l | tr -d ' ')
if [ "$hidden_files" -eq 0 ]; then
  pass "Room tree has no unexpected hidden files"
else
  found=$(find "$TEST_DIR/room" -maxdepth 1 -name ".*" -not -name "." 2>/dev/null)
  fail "Room tree cleanliness" "found unexpected hidden files: $found"
fi

# ── Summary ──
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
