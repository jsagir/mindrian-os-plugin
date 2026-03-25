#!/usr/bin/env bash
# MindrianOS Plugin — Phase 15 LazyGraph Integration Tests
# Tests lazygraph-ops.cjs against test-room-graph fixtures
set -euo pipefail

PASS=0
FAIL=0
TEST_DIR="/tmp/test-lazygraph-$$"
FIXTURE_DIR="$(cd "$(dirname "$0")/../tests/fixtures/test-room-graph" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 — $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 15: LazyGraph Operations ==="
echo "Test dir: $TEST_DIR"
echo "Fixture dir: $FIXTURE_DIR"
echo ""

# --- Test 1: kuzu loads ---
echo "[1] kuzu loads"
if node -e "require('kuzu'); console.log('OK')" 2>/dev/null | grep -q OK; then
  pass "kuzu loads"
else
  fail "kuzu loads" "require('kuzu') failed"
fi

# --- Test 2: openGraph creates .lazygraph/ and returns db,conn ---
echo "[2] openGraph creates .lazygraph/ directory"
mkdir -p "$TEST_DIR/room"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  const exists = require('fs').existsSync('$TEST_DIR/room/.lazygraph');
  console.log('dir_exists=' + exists);
  console.log('has_db=' + (!!db));
  console.log('has_conn=' + (!!conn));
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "dir_exists=true" && echo "$RESULT" | grep -q "has_db=true" && echo "$RESULT" | grep -q "has_conn=true"; then
  pass "openGraph creates dir and returns db,conn"
else
  fail "openGraph" "$RESULT"
fi

# Clean up for fresh test
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 3: initSchema is idempotent ---
echo "[3] initSchema is idempotent (call twice without error)"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.initSchema(conn);
  await lg.initSchema(conn);
  console.log('idempotent=true');
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "idempotent=true"; then
  pass "initSchema idempotent"
else
  fail "initSchema idempotent" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 4: indexArtifact creates node with correct properties ---
echo "[4] indexArtifact creates Artifact node with correct properties"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.indexArtifact(conn, '$FIXTURE_DIR', '$FIXTURE_DIR/problem-definition/market-trends.md');
  const rows = await lg.queryGraph(conn, \"MATCH (a:Artifact) RETURN a.id, a.title, a.section, a.methodology\");
  const r = rows[0];
  console.log('id=' + r['a.id']);
  console.log('title=' + r['a.title']);
  console.log('section=' + r['a.section']);
  console.log('methodology=' + r['a.methodology']);
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "id=problem-definition/market-trends" && \
   echo "$RESULT" | grep -q "title=Market Trends in EdTech" && \
   echo "$RESULT" | grep -q "section=problem-definition" && \
   echo "$RESULT" | grep -q "methodology=trend-analysis"; then
  pass "indexArtifact creates correct node"
else
  fail "indexArtifact node" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 5: indexArtifact creates BELONGS_TO edge ---
echo "[5] indexArtifact creates BELONGS_TO edge to Section"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.indexArtifact(conn, '$FIXTURE_DIR', '$FIXTURE_DIR/problem-definition/market-trends.md');
  const rows = await lg.queryGraph(conn, \"MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section) RETURN a.id, s.name\");
  console.log('edges=' + rows.length);
  console.log('section=' + rows[0]['s.name']);
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "edges=1" && echo "$RESULT" | grep -q "section=problem-definition"; then
  pass "BELONGS_TO edge created"
else
  fail "BELONGS_TO edge" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 6: rebuildGraph indexes all 5 fixtures ---
echo "[6] rebuildGraph indexes all 5 fixtures with correct counts"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  const result = await lg.rebuildGraph(conn, '$FIXTURE_DIR');
  console.log('artifacts=' + result.artifacts);
  console.log('sections=' + result.sections);
  console.log('success=' + result.success);
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "artifacts=5" && echo "$RESULT" | grep -q "sections=3" && echo "$RESULT" | grep -q "success=true"; then
  pass "rebuildGraph indexes all fixtures"
else
  fail "rebuildGraph counts" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 7: Verify BELONGS_TO edges (5 total) ---
echo "[7] Verify 5 BELONGS_TO edges after rebuild"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.rebuildGraph(conn, '$FIXTURE_DIR');
  const rows = await lg.queryGraph(conn, \"MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section) RETURN count(*) AS cnt\");
  console.log('belongs_to=' + rows[0]['cnt']);
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "belongs_to=5"; then
  pass "5 BELONGS_TO edges"
else
  fail "BELONGS_TO count" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 8: Verify INFORMS edges exist ---
echo "[8] Verify INFORMS edges from wikilinked artifacts"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.rebuildGraph(conn, '$FIXTURE_DIR');
  const rows = await lg.queryGraph(conn, \"MATCH (a:Artifact)-[:INFORMS]->(b:Artifact) RETURN a.id, b.id\");
  console.log('informs_count=' + rows.length);
  for (const r of rows) {
    console.log('  ' + r['a.id'] + ' -> ' + r['b.id']);
  }
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
INFORMS_COUNT=$(echo "$RESULT" | grep "informs_count=" | sed 's/informs_count=//')
if [ "$INFORMS_COUNT" -gt 0 ] 2>/dev/null; then
  pass "INFORMS edges exist ($INFORMS_COUNT)"
else
  fail "INFORMS edges" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 9: queryGraph executes Cypher and returns rows ---
echo "[9] queryGraph returns structured rows"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.rebuildGraph(conn, '$FIXTURE_DIR');
  const rows = await lg.queryGraph(conn, \"MATCH (a:Artifact) RETURN a.title ORDER BY a.title\");
  console.log('rows=' + rows.length);
  console.log('first=' + rows[0]['a.title']);
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "rows=5"; then
  pass "queryGraph returns 5 rows"
else
  fail "queryGraph" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 10: graphStats returns correct structure ---
echo "[10] graphStats returns node/edge/total counts"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.rebuildGraph(conn, '$FIXTURE_DIR');
  const stats = await lg.graphStats(conn);
  console.log('artifact_nodes=' + stats.nodes.Artifact);
  console.log('section_nodes=' + stats.nodes.Section);
  console.log('belongs_to_edges=' + stats.edges.BELONGS_TO);
  console.log('total_nodes=' + stats.total.nodes);
  console.log('total_edges=' + stats.total.edges);
  console.log('has_informs=' + (stats.edges.INFORMS >= 0));
  await lg.closeGraph(db);
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "artifact_nodes=5" && \
   echo "$RESULT" | grep -q "section_nodes=3" && \
   echo "$RESULT" | grep -q "belongs_to_edges=5" && \
   echo "$RESULT" | grep -q "total_nodes=8"; then
  pass "graphStats correct"
else
  fail "graphStats" "$RESULT"
fi

rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR/room"

# --- Test 11: closeGraph closes without error ---
echo "[11] closeGraph closes DB without error"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
(async () => {
  const { db, conn } = await lg.openGraph('$TEST_DIR/room');
  await lg.closeGraph(db);
  console.log('closed=true');
})().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1)
if echo "$RESULT" | grep -q "closed=true"; then
  pass "closeGraph"
else
  fail "closeGraph" "$RESULT"
fi

# --- Test 12: Module exports all 7 functions ---
echo "[12] Module exports all 7 functions"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const expected = ['openGraph','closeGraph','initSchema','indexArtifact','rebuildGraph','queryGraph','graphStats'];
const missing = expected.filter(k => typeof lg[k] !== 'function');
if (missing.length === 0) console.log('exports=OK');
else console.log('missing=' + missing.join(','));
" 2>&1)
if echo "$RESULT" | grep -q "exports=OK"; then
  pass "all 7 exports"
else
  fail "exports" "$RESULT"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
