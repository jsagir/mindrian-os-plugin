#!/usr/bin/env bash
# MindrianOS Plugin — Phase 17 Visual Identity Tests
# Tests visual-ops.cjs exports, symbol mappings, color helpers
# Covers VIS-01
set -euo pipefail

PASS=0
FAIL=0
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 — $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 17: Visual Identity Operations ==="
echo ""

# --- Test 1: visual-ops.cjs is requirable ---
echo "[1] visual-ops.cjs is requirable"
RESULT=$(node -e "require('$SCRIPT_DIR/lib/core/visual-ops.cjs'); console.log('OK')" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "module loads"
else
  fail "module loads" "$RESULT"
fi

# --- Test 2: SYMBOLS object has all categories ---
echo "[2] SYMBOLS has brand, stages, edges, modes, health, box"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const has = ['brand','stages','edges','modes','health','box'].every(k => v.SYMBOLS[k]);
console.log(has ? 'OK' : 'MISSING');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "SYMBOLS categories complete"
else
  fail "SYMBOLS categories" "$RESULT"
fi

# --- Test 3: stageSymbol maps all 5 stages ---
echo "[3] stageSymbol maps all 5 stages"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const stages = [
  ['pre-opportunity', '\u25CC'],
  ['discovery', '\u25CE'],
  ['validation', '\u25C9'],
  ['design', '\u25C6'],
  ['investmentReady', '\u2605']
];
const all = stages.every(([name, sym]) => v.stageSymbol(name) === sym);
console.log(all ? 'OK' : 'MISMATCH');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "all 5 stages map correctly"
else
  fail "stageSymbol mapping" "$RESULT"
fi

# --- Test 4: edgeSymbol maps all 5 edge types ---
echo "[4] edgeSymbol maps all 5 edge types"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const edges = [
  ['INFORMS', '\u2192'],
  ['CONTRADICTS', '\u2297'],
  ['CONVERGES', '\u2295'],
  ['ENABLES', '\u25B6'],
  ['INVALIDATES', '\u2298']
];
const all = edges.every(([type, sym]) => v.edgeSymbol(type) === sym);
console.log(all ? 'OK' : 'MISMATCH');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "all 5 edge types map correctly"
else
  fail "edgeSymbol mapping" "$RESULT"
fi

# --- Test 5: healthSymbol returns correct symbols ---
echo "[5] healthSymbol returns correct symbols for 0, 1, and 5"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const ok = v.healthSymbol(0) === '\u25A1'
        && v.healthSymbol(1) === '\u25A0'
        && v.healthSymbol(5) === '\u25A0';
console.log(ok ? 'OK' : 'MISMATCH');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "healthSymbol correct for 0/1/5"
else
  fail "healthSymbol" "$RESULT"
fi

# --- Test 6: colorize wraps text with ANSI codes ---
echo "[6] colorize wraps text with ANSI codes"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const colored = v.colorize('hello', 'red');
const hasAnsi = colored.includes('\x1b[') && colored.includes('\x1b[0m');
console.log(hasAnsi ? 'OK' : 'NO_ANSI');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "colorize adds ANSI codes"
else
  fail "colorize" "$RESULT"
fi

# --- Test 7: formatEdge produces correct formatted string ---
echo "[7] formatEdge produces formatted edge string"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const edge = v.formatEdge('problem', 'market', 'INFORMS');
const ok = edge.includes('problem') && edge.includes('market') && edge.includes('INFORMS') && edge.includes('\x1b[');
console.log(ok ? 'OK' : 'BAD_FORMAT');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "formatEdge produces correct output"
else
  fail "formatEdge" "$RESULT"
fi

# --- Test 8: formatSectionHeader produces correct output ---
echo "[8] formatSectionHeader produces correct output"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const header = v.formatSectionHeader('problem-definition', 3, 'discovery');
const ok = header.includes('\u25CE') && header.includes('problem-definition') && header.includes('\u25A0') && header.includes('3');
console.log(ok ? 'OK' : 'BAD: ' + header);
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "formatSectionHeader correct"
else
  fail "formatSectionHeader" "$RESULT"
fi

# --- Test 9: ANSI and ANSI_BASIC both have all color keys ---
echo "[9] ANSI and ANSI_BASIC have matching keys"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const keys = ['red','blue','yellow','green','sienna','amethyst','cyan','cream','muted','reset','bold','dim'];
const ansiOk = keys.every(k => v.ANSI[k]);
const basicOk = keys.every(k => v.ANSI_BASIC[k]);
console.log(ansiOk && basicOk ? 'OK' : 'MISSING_KEYS');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "ANSI and ANSI_BASIC have all keys"
else
  fail "ANSI palette keys" "$RESULT"
fi

# --- Test 10: EDGE_COLORS maps all 5 edge types ---
echo "[10] EDGE_COLORS maps all 5 edge types"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const ok = ['INFORMS','CONTRADICTS','CONVERGES','ENABLES','INVALIDATES'].every(k => v.EDGE_COLORS[k]);
console.log(ok ? 'OK' : 'MISSING');
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "EDGE_COLORS complete"
else
  fail "EDGE_COLORS" "$RESULT"
fi

# --- Test 11: symbol-system.md exists and contains all symbol categories ---
echo "[11] symbol-system.md contains all symbols"
SYMFILE="$SCRIPT_DIR/references/visual/symbol-system.md"
if [ ! -f "$SYMFILE" ]; then
  fail "symbol-system.md exists" "file not found"
else
  COUNT=$(grep -c '⬡\|◌\|◎\|◉\|◆\|★\|→\|⊗\|⊕\|▶\|⊘' "$SYMFILE" || true)
  if [ "$COUNT" -ge 11 ]; then
    pass "symbol-system.md has >= 11 symbol references ($COUNT found)"
  else
    fail "symbol-system.md symbols" "only $COUNT found, need >= 11"
  fi
fi

# --- Test 12: context-monitor still has Node shebang ---
echo "[12] context-monitor has Node shebang and requires visual-ops"
MONITOR="$SCRIPT_DIR/scripts/context-monitor"
if head -1 "$MONITOR" | grep -q "#!/usr/bin/env node"; then
  if grep -q "require.*visual-ops" "$MONITOR"; then
    pass "context-monitor valid"
  else
    fail "context-monitor" "missing visual-ops require"
  fi
else
  fail "context-monitor shebang" "missing #!/usr/bin/env node"
fi

# --- Test 13: all exports present ---
echo "[13] All expected exports present"
RESULT=$(node -e "
const v = require('$SCRIPT_DIR/lib/core/visual-ops.cjs');
const expected = ['SYMBOLS','ANSI','ANSI_BASIC','EDGE_COLORS','stageSymbol','edgeSymbol','healthSymbol','colorize','formatEdge','formatSectionHeader'];
const ok = expected.every(k => v[k] !== undefined);
console.log(ok ? 'OK' : 'MISSING: ' + expected.filter(k => !v[k]).join(','));
" 2>&1 || true)
if echo "$RESULT" | grep -q "OK"; then
  pass "all 10 exports present"
else
  fail "exports" "$RESULT"
fi

# --- Summary ---
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
