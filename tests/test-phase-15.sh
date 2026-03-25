#!/usr/bin/env bash
# MindrianOS Plugin — Phase 15 LazyGraph Integration Tests
# Tests lazygraph-ops.cjs against test-room-graph fixtures
#
# Note: KuzuDB 0.11.3 (archived) triggers a segfault during Node.js process
# exit after db.close(). All operations complete successfully — the segfault
# occurs in the native destructor after our code finishes. Tests check output
# correctness, not exit code of the node process.
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

# --- Test 2: Module exports all 7 functions ---
echo "[2] Module exports all 7 functions"
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const expected = ['openGraph','closeGraph','initSchema','indexArtifact','rebuildGraph','queryGraph','graphStats'];
const missing = expected.filter(k => typeof lg[k] !== 'function');
if (missing.length === 0) console.log('exports=OK');
else console.log('missing=' + missing.join(','));
" 2>&1 || true)
if echo "$RESULT" | grep -q "exports=OK"; then
  pass "all 7 exports"
else
  fail "exports" "$RESULT"
fi

# --- Tests 3-12: All DB tests in SINGLE node process ---
# KuzuDB segfaults on process exit after close (native destructor issue).
# We capture output and check for ALL DONE marker to confirm completion.
echo ""
echo "[3-12] Running DB tests in single process..."
mkdir -p "$TEST_DIR/room"

RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const fs = require('fs');

const FIXTURE = '$FIXTURE_DIR';
const TEST_DIR = '$TEST_DIR';

async function run() {
  // Test 3: openGraph creates .lazygraph and returns db,conn
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room');
  const exists = fs.existsSync(TEST_DIR + '/room/.lazygraph');
  console.log('T3:dir_exists=' + exists);
  console.log('T3:has_db=' + (!!db));
  console.log('T3:has_conn=' + (!!conn));

  // Test 4: initSchema idempotent
  await lg.initSchema(conn);
  await lg.initSchema(conn);
  console.log('T4:idempotent=true');

  // Test 5: indexArtifact creates Artifact node
  await lg.indexArtifact(conn, FIXTURE, FIXTURE + '/problem-definition/market-trends.md');
  const rows5 = await lg.queryGraph(conn, 'MATCH (a:Artifact) RETURN a.id, a.title, a.section, a.methodology');
  const r = rows5[0];
  console.log('T5:id=' + r['a.id']);
  console.log('T5:title=' + r['a.title']);
  console.log('T5:section=' + r['a.section']);
  console.log('T5:methodology=' + r['a.methodology']);

  // Test 6: BELONGS_TO edge created
  const rows6 = await lg.queryGraph(conn, 'MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section) RETURN a.id, s.name');
  console.log('T6:edges=' + rows6.length);
  console.log('T6:section_name=' + rows6[0]['s.name']);

  // Clear for rebuild test
  await conn.query('MATCH (n) DETACH DELETE n');

  // Test 7: rebuildGraph indexes all 5 fixtures
  const rebuildResult = await lg.rebuildGraph(conn, FIXTURE);
  console.log('T7:artifacts=' + rebuildResult.artifacts);
  console.log('T7:sections=' + rebuildResult.sections);
  console.log('T7:success=' + rebuildResult.success);

  // Test 8: 5 BELONGS_TO edges after rebuild
  const rows8 = await lg.queryGraph(conn, 'MATCH (a:Artifact)-[:BELONGS_TO]->(s:Section) RETURN count(*) AS cnt');
  console.log('T8:belongs_to=' + rows8[0]['cnt']);

  // Test 9: INFORMS edges from wikilinks
  const rows9 = await lg.queryGraph(conn, 'MATCH (a:Artifact)-[:INFORMS]->(b:Artifact) RETURN a.id, b.id');
  console.log('T9:informs_count=' + rows9.length);

  // Test 10: queryGraph returns structured rows
  const rows10 = await lg.queryGraph(conn, 'MATCH (a:Artifact) RETURN a.title ORDER BY a.title');
  console.log('T10:rows=' + rows10.length);
  console.log('T10:first=' + rows10[0]['a.title']);

  // Test 11: graphStats returns correct structure
  const stats = await lg.graphStats(conn);
  console.log('T11:artifact_nodes=' + stats.nodes.Artifact);
  console.log('T11:section_nodes=' + stats.nodes.Section);
  console.log('T11:belongs_to_edges=' + stats.edges.BELONGS_TO);
  console.log('T11:total_nodes=' + stats.total.nodes);
  console.log('T11:total_edges=' + stats.total.edges);
  console.log('T11:has_informs=' + (stats.edges.INFORMS >= 0));

  // Test 12: closeGraph
  await lg.closeGraph(db);
  console.log('T12:closed=true');

  console.log('ALL_DONE');
}

run().catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });
" 2>&1 || true)

echo "$RESULT"
echo ""

# Check ALL_DONE marker (segfault on exit is expected with archived KuzuDB)
if ! echo "$RESULT" | grep -q "ALL_DONE"; then
  echo "FATAL: Test process did not complete"
  exit 1
fi

# Parse results
check() {
  local label="$1" pattern="$2"
  if echo "$RESULT" | grep -q "$pattern"; then
    pass "$label"
  else
    fail "$label" "pattern '$pattern' not found"
  fi
}

echo "[3] openGraph"
check "openGraph creates .lazygraph" "T3:dir_exists=true"
check "openGraph has_db" "T3:has_db=true"
check "openGraph has_conn" "T3:has_conn=true"

echo "[4] initSchema"
check "initSchema idempotent" "T4:idempotent=true"

echo "[5] indexArtifact"
check "indexArtifact id" "T5:id=problem-definition/market-trends"
check "indexArtifact title" "T5:title=Market Trends in EdTech"
check "indexArtifact section" "T5:section=problem-definition"
check "indexArtifact methodology" "T5:methodology=trend-analysis"

echo "[6] BELONGS_TO edge"
check "BELONGS_TO edge count=1" "T6:edges=1"
check "BELONGS_TO section" "T6:section_name=problem-definition"

echo "[7] rebuildGraph"
check "rebuildGraph artifacts=5" "T7:artifacts=5"
check "rebuildGraph sections=3" "T7:sections=3"
check "rebuildGraph success" "T7:success=true"

echo "[8] BELONGS_TO after rebuild"
check "5 BELONGS_TO edges" "T8:belongs_to=5"

echo "[9] INFORMS edges"
INFORMS_COUNT=$(echo "$RESULT" | grep "T9:informs_count=" | sed 's/T9:informs_count=//')
if [ "${INFORMS_COUNT:-0}" -gt 0 ] 2>/dev/null; then
  pass "INFORMS edges exist ($INFORMS_COUNT)"
else
  fail "INFORMS edges" "count=$INFORMS_COUNT"
fi

echo "[10] queryGraph"
check "queryGraph returns 5 rows" "T10:rows=5"

echo "[11] graphStats"
check "graphStats artifact_nodes=5" "T11:artifact_nodes=5"
check "graphStats section_nodes=3" "T11:section_nodes=3"
check "graphStats belongs_to_edges=5" "T11:belongs_to_edges=5"
check "graphStats total_nodes=8" "T11:total_nodes=8"

echo "[12] closeGraph"
check "closeGraph" "T12:closed=true"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
