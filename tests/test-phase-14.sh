#!/usr/bin/env bash
# test-phase-14.sh -- Phase 14: AI Team Personas tests
# Validates persona generation, listing, invocation, disclaimer presence

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
SAMPLE_ROOM="$FIXTURES_DIR/sample-room-personas"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "=== test-phase-14: AI Team Personas ==="

# --- Test 1: Section discovery ---
echo "Test 1: Section discovery (personas appears in extended sections)"

DISCOVERY_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const r = require('./lib/core/section-registry.cjs');
const d = r.discoverSections('$SAMPLE_ROOM');
console.log(JSON.stringify({ extended: d.extended, all: d.all }));
")

if echo "$DISCOVERY_RESULT" | grep -q '"personas"'; then
  pass "personas discovered as extended section"
else
  fail "personas NOT found in extended sections"
fi

# --- Test 2: Module load ---
echo "Test 2: persona-ops.cjs module loads without error"

if (cd "$PLUGIN_ROOT" && node -e "require('./lib/core/persona-ops.cjs')") 2>/dev/null; then
  pass "persona-ops.cjs loads successfully"
else
  fail "persona-ops.cjs failed to load"
fi

# --- Test 3: Generate personas ---
echo "Test 3: generatePersonas creates 6 files in personas/"

# Clean any previous generation
rm -f "$SAMPLE_ROOM"/personas/*.md

GEN_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/persona-ops.cjs');
const result = ops.generatePersonas('$SAMPLE_ROOM');
console.log(JSON.stringify(result));
")

PERSONA_COUNT=$(find "$SAMPLE_ROOM/personas" -name "*.md" | wc -l)

if [[ "$PERSONA_COUNT" -eq 6 ]]; then
  pass "generatePersonas created 6 persona files"
else
  fail "generatePersonas created $PERSONA_COUNT files (expected 6)"
fi

# --- Test 4: Hat coverage ---
echo "Test 4: Each hat color has a file"

ALL_HATS_FOUND=true
for color in white red black yellow green blue; do
  if ls "$SAMPLE_ROOM/personas/${color}-"*.md 1>/dev/null 2>&1; then
    pass "Found $color hat persona file"
  else
    fail "Missing $color hat persona file"
    ALL_HATS_FOUND=false
  fi
done

# --- Test 5: Frontmatter parsing ---
echo "Test 5: Generated persona has hat and disclaimer in frontmatter"

FM_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/persona-ops.cjs');
const personas = ops.listPersonas('$SAMPLE_ROOM');
if (personas.length > 0) {
  console.log(JSON.stringify(personas[0]));
} else {
  console.log('{}');
}
")

if echo "$FM_RESULT" | grep -q '"hat"'; then
  pass "Persona frontmatter has 'hat' field"
else
  fail "Persona frontmatter missing 'hat' field"
fi

if echo "$FM_RESULT" | grep -q '"disclaimer"'; then
  pass "Persona frontmatter has 'disclaimer' field"
else
  fail "Persona frontmatter missing 'disclaimer' field"
fi

# --- Test 6: Disclaimer presence ---
echo "Test 6: Every generated persona contains 'perspective lens' disclaimer"

DISCLAIMER_MISSING=false
for f in "$SAMPLE_ROOM"/personas/*.md; do
  if ! grep -q "perspective lens" "$f" 2>/dev/null; then
    fail "Disclaimer missing in $(basename "$f")"
    DISCLAIMER_MISSING=true
  fi
done

if [[ "$DISCLAIMER_MISSING" == "false" ]]; then
  pass "All persona files contain 'perspective lens' disclaimer"
fi

# --- Test 7: List personas ---
echo "Test 7: listPersonas returns 6 entries"

LIST_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/persona-ops.cjs');
const result = ops.listPersonas('$SAMPLE_ROOM');
console.log(result.length);
")

if [[ "$LIST_RESULT" -eq 6 ]]; then
  pass "listPersonas returns 6 entries"
else
  fail "listPersonas returned $LIST_RESULT entries (expected 6)"
fi

# --- Test 8: Invoke persona ---
echo "Test 8: invokePersona returns persona content for black hat"

INVOKE_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/persona-ops.cjs');
const result = ops.invokePersona('$SAMPLE_ROOM', 'black');
console.log(JSON.stringify({ hasPersona: !!result.persona, hat: result.hat }));
")

if echo "$INVOKE_RESULT" | grep -q '"hasPersona":true'; then
  pass "invokePersona returns persona content"
else
  fail "invokePersona did not return persona content"
fi

if echo "$INVOKE_RESULT" | grep -q '"hat":"black"'; then
  pass "invokePersona returns correct hat color"
else
  fail "invokePersona returned wrong hat color"
fi

# --- Test 9: Thin room rejection ---
echo "Test 9: generatePersonas rejects room with < 2 populated sections"

THIN_ROOM="/tmp/test-thin-room-p14"
mkdir -p "$THIN_ROOM/problem-definition"
echo "---
venture: Thin Venture
stage: Discovery
---
# Thin Room" > "$THIN_ROOM/STATE.md"
echo "---
title: Only Section
---
# Problem" > "$THIN_ROOM/problem-definition/current.md"

REJECT_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/persona-ops.cjs');
const result = ops.generatePersonas('$THIN_ROOM');
console.log(JSON.stringify(result));
")

if echo "$REJECT_RESULT" | grep -q '"error"'; then
  pass "generatePersonas rejects thin room (< 2 sections)"
else
  fail "generatePersonas did not reject thin room"
fi

# Cleanup
rm -rf "$THIN_ROOM"

# --- Test 10: analyzeAllPerspectives ---
echo "Test 10: analyzeAllPerspectives returns all 6 perspectives"

ANALYZE_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const ops = require('./lib/core/persona-ops.cjs');
const result = ops.analyzeAllPerspectives('$SAMPLE_ROOM');
const keys = Object.keys(result.perspectives);
console.log(JSON.stringify({ count: keys.length, keys: keys }));
")

if echo "$ANALYZE_RESULT" | grep -q '"count":6'; then
  pass "analyzeAllPerspectives returns 6 perspectives"
else
  fail "analyzeAllPerspectives did not return 6 perspectives"
fi

# --- Test 11: Module exports ---
echo "Test 11: persona-ops.cjs exports 5 functions"

EXPORTS_RESULT=$(cd "$PLUGIN_ROOT" && node -e "
const p = require('./lib/core/persona-ops.cjs');
console.log(JSON.stringify(Object.keys(p)));
")

for fn in generatePersonas listPersonas invokePersona analyzeAllPerspectives extractDomainSignals; do
  if echo "$EXPORTS_RESULT" | grep -q "\"$fn\""; then
    pass "Exports $fn"
  else
    fail "Missing export $fn"
  fi
done

# --- Summary ---
echo ""
echo "Phase 14: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
