#!/usr/bin/env bash
# MindrianOS Plugin — Phase 16 Reasoning Engine Tests
# Tests reasoning-ops.cjs against test-room-reasoning fixtures
# Covers REASON-01, REASON-03, REASON-05
set -euo pipefail

PASS=0
FAIL=0
FIXTURE_DIR="$(cd "$(dirname "$0")/../tests/fixtures/test-room-reasoning" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 — $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 16: Reasoning Engine Operations ==="
echo "Fixture dir: $FIXTURE_DIR"
echo ""

# --- Test 1: reasoning-ops.cjs is requirable ---
echo "[1] reasoning-ops.cjs is requirable"
RESULT=$(node -e "require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs'); console.log('OK')" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "module loads"
else
  fail "module loads" "$RESULT"
fi

# --- Test 2: generateReasoning creates .reasoning/{section}/REASONING.md ---
echo "[2] generateReasoning creates REASONING.md"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const result = r.generateReasoning('$FIXTURE_DIR', 'problem-definition');
if (result.generated && result.generated.includes('problem-definition')) {
  console.log('gen=OK');
} else {
  console.log('gen=FAIL: ' + JSON.stringify(result));
}
" 2>&1 || true)
if echo "$RESULT" | grep -q "gen=OK"; then
  pass "generateReasoning creates file"
else
  fail "generateReasoning" "$RESULT"
fi
# Cleanup: restore fixture
cp "$FIXTURE_DIR/../test-room-reasoning/.reasoning/problem-definition/REASONING.md.bak" \
   "$FIXTURE_DIR/.reasoning/problem-definition/REASONING.md" 2>/dev/null || true

# --- Test 3: listReasoning returns array with has_reasoning field ---
echo "[3] listReasoning returns status array"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const list = r.listReasoning('$FIXTURE_DIR');
if (Array.isArray(list) && list.length > 0 && 'has_reasoning' in list[0]) {
  const withReasoning = list.filter(s => s.has_reasoning);
  console.log('list=OK count=' + list.length + ' with_reasoning=' + withReasoning.length);
} else {
  console.log('list=FAIL: ' + JSON.stringify(list));
}
" 2>&1 || true)
if echo "$RESULT" | grep -q "list=OK"; then
  pass "listReasoning returns status array"
else
  fail "listReasoning" "$RESULT"
fi

# --- Test 4: getReasoning returns content for existing section ---
echo "[4] getReasoning returns content"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const result = r.getReasoning('$FIXTURE_DIR', 'problem-definition');
if (result.content && result.frontmatter && result.frontmatter.section === 'problem-definition') {
  console.log('get=OK');
} else {
  console.log('get=FAIL: ' + JSON.stringify(result));
}
" 2>&1 || true)
if echo "$RESULT" | grep -q "get=OK"; then
  pass "getReasoning returns content"
else
  fail "getReasoning" "$RESULT"
fi

# --- Test 5: verifyReasoning returns criteria array ---
echo "[5] verifyReasoning returns criteria"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const result = r.verifyReasoning('$FIXTURE_DIR', 'problem-definition');
if (result.criteria && Array.isArray(result.criteria) && result.criteria.length >= 2 && result.status === 'pending') {
  console.log('verify=OK count=' + result.criteria.length);
} else {
  console.log('verify=FAIL: ' + JSON.stringify(result));
}
" 2>&1 || true)
if echo "$RESULT" | grep -q "verify=OK"; then
  pass "verifyReasoning returns criteria"
else
  fail "verifyReasoning" "$RESULT"
fi

# --- Test 6: getReasoningFrontmatter parses nested object ---
echo "[6] getReasoningFrontmatter parses nested confidence"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const fm = r.getReasoningFrontmatter('$FIXTURE_DIR', 'problem-definition');
if (fm.confidence && Array.isArray(fm.confidence.high) && fm.confidence.high.length >= 1) {
  console.log('fm=OK high=' + fm.confidence.high.length);
} else {
  console.log('fm=FAIL: ' + JSON.stringify(fm));
}
" 2>&1 || true)
if echo "$RESULT" | grep -q "fm=OK"; then
  pass "getReasoningFrontmatter parses nested objects"
else
  fail "getReasoningFrontmatter" "$RESULT"
fi

# --- Test 7: setReasoningFrontmatter updates a field ---
echo "[7] setReasoningFrontmatter updates field"
# Backup first
cp "$FIXTURE_DIR/.reasoning/problem-definition/REASONING.md" "$FIXTURE_DIR/.reasoning/problem-definition/REASONING.md.bak"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const result = r.setReasoningFrontmatter('$FIXTURE_DIR', 'problem-definition', 'brain_enriched', false);
if (result.updated) {
  // Verify persistence
  const fm = r.getReasoningFrontmatter('$FIXTURE_DIR', 'problem-definition');
  if (fm.brain_enriched === false) {
    console.log('set=OK');
  } else {
    console.log('set=FAIL persist: brain_enriched=' + fm.brain_enriched);
  }
} else {
  console.log('set=FAIL: ' + JSON.stringify(result));
}
" 2>&1 || true)
# Restore from backup
cp "$FIXTURE_DIR/.reasoning/problem-definition/REASONING.md.bak" "$FIXTURE_DIR/.reasoning/problem-definition/REASONING.md"
rm -f "$FIXTURE_DIR/.reasoning/problem-definition/REASONING.md.bak"
if echo "$RESULT" | grep -q "set=OK"; then
  pass "setReasoningFrontmatter updates and persists"
else
  fail "setReasoningFrontmatter" "$RESULT"
fi

# --- Test 8: createRun creates file in .reasoning/runs/ ---
echo "[8] createRun creates run artifact"
RESULT=$(node -e "
const r = require('$SCRIPT_DIR/lib/core/reasoning-ops.cjs');
const result = r.createRun('$FIXTURE_DIR', 'problem-definition');
if (result.run_id && result.path) {
  const fs = require('fs');
  const fullPath = require('path').resolve('$FIXTURE_DIR', result.path);
  if (fs.existsSync(fullPath)) {
    console.log('run=OK id=' + result.run_id);
    // Cleanup
    fs.unlinkSync(fullPath);
    try { fs.rmdirSync(require('path').dirname(fullPath)); } catch(e) {}
  } else {
    console.log('run=FAIL file not found: ' + fullPath);
  }
} else {
  console.log('run=FAIL: ' + JSON.stringify(result));
}
" 2>&1 || true)
if echo "$RESULT" | grep -q "run=OK"; then
  pass "createRun creates run artifact"
else
  fail "createRun" "$RESULT"
fi

# --- Test 9: CLI reasoning list (integration — expected to fail until Plan 02) ---
echo "[9] CLI reasoning list (integration — may fail until Plan 02)"
RESULT=$(node "$SCRIPT_DIR/bin/mindrian-tools.cjs" reasoning list "$FIXTURE_DIR" 2>&1 || true)
if echo "$RESULT" | grep -q "has_reasoning"; then
  pass "CLI reasoning list"
else
  echo "  SKIP: CLI integration not wired yet (expected until Plan 02)"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
