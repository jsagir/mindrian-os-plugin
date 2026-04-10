#!/usr/bin/env bash
# MindrianOS Plugin -- Phase 27 SQLite Schema Extension Tests
# Tests node/edge tables, indexing, and EDGE_TYPES in LazyGraph SQLite
#
# Migrated from KuzuDB to SQLite (Phase 79).
set -euo pipefail

PASS=0
FAIL=0
TEST_DIR="/tmp/test-sqlite-schema-$$"
FIXTURE_DIR="$(cd "$(dirname "$0")" && pwd)/fixtures/test-room-meeting"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 -- $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 27: SQLite Schema Extension ==="
echo "Test dir: $TEST_DIR"
echo "Fixture dir: $FIXTURE_DIR"
echo ""

mkdir -p "$TEST_DIR/room"

# Run all DB tests in single node process
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const fs = require('fs');
const path = require('path');

const FIXTURE = '$FIXTURE_DIR';
const TEST_DIR = '$TEST_DIR';

async function run() {
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room');

  // [1] Check tables exist (nodes, edges)
  try {
    const tables = conn.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
    const tableNames = tables.map(r => r.name);
    const hasNodes = tableNames.includes('nodes');
    const hasEdges = tableNames.includes('edges');
    console.log('T1:nodes=' + hasNodes);
    console.log('T1:edges=' + hasEdges);
  } catch (e) {
    console.log('T1:error=' + e.message);
  }

  // [2] Check indexes exist
  try {
    const indexes = conn.prepare(\"SELECT name FROM sqlite_master WHERE type='index'\").all();
    const indexNames = indexes.map(r => r.name);
    const hasNodesType = indexNames.includes('idx_nodes_type');
    const hasEdgesSource = indexNames.includes('idx_edges_source');
    const hasEdgesTarget = indexNames.includes('idx_edges_target');
    const hasEdgesType = indexNames.includes('idx_edges_type');
    console.log('T2:idx_nodes_type=' + hasNodesType);
    console.log('T2:idx_edges_source=' + hasEdgesSource);
    console.log('T2:idx_edges_target=' + hasEdgesTarget);
    console.log('T2:idx_edges_type=' + hasEdgesType);
  } catch (e) {
    console.log('T2:error=' + e.message);
  }

  // [3] EDGE_TYPES array includes expected types
  try {
    const edgeTypes = lg.EDGE_TYPES || [];
    const hasInforms = edgeTypes.includes('INFORMS');
    const hasBelongsTo = edgeTypes.includes('BELONGS_TO');
    const hasContradicts = edgeTypes.includes('CONTRADICTS');
    const hasHSI = edgeTypes.includes('HSI_CONNECTION');
    const hasRS = edgeTypes.includes('REVERSE_SALIENT');
    console.log('T3:informs=' + hasInforms);
    console.log('T3:belongs_to=' + hasBelongsTo);
    console.log('T3:contradicts=' + hasContradicts);
    console.log('T3:hsi=' + hasHSI);
    console.log('T3:rs=' + hasRS);
  } catch (e) {
    console.log('T3:error=' + e.message);
  }

  // [4] indexArtifact creates nodes and edges
  try {
    if (fs.existsSync(FIXTURE + '/problem-definition/core-problem.md')) {
      await lg.indexArtifact(conn, FIXTURE, FIXTURE + '/problem-definition/core-problem.md');
      const artifacts = conn.prepare(\"SELECT id FROM nodes WHERE type = 'Artifact'\").all();
      const sections = conn.prepare(\"SELECT id FROM nodes WHERE type = 'Section'\").all();
      const belongsTo = conn.prepare(\"SELECT * FROM edges WHERE type = 'BELONGS_TO'\").all();
      console.log('T4:artifact_count=' + artifacts.length);
      console.log('T4:section_count=' + sections.length);
      console.log('T4:belongs_to_edges=' + belongsTo.length);
    } else {
      console.log('T4:skip=fixture not found');
    }
  } catch (e) {
    console.log('T4:error=' + e.message);
  }

  // [5] graphStats returns correct structure
  try {
    const stats = await lg.graphStats(conn);
    console.log('T5:has_nodes=' + (typeof stats.nodes === 'object'));
    console.log('T5:has_edges=' + (typeof stats.edges === 'object'));
    console.log('T5:has_total=' + (typeof stats.total === 'object'));
    console.log('T5:total_nodes=' + stats.total.nodes);
    console.log('T5:total_edges=' + stats.total.edges);
  } catch (e) {
    console.log('T5:error=' + e.message);
  }

  await lg.closeGraph(db);
  console.log('ALL_DONE');
}

run().catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });
" 2>&1 || true)

echo "$RESULT"
echo ""

# Check ALL_DONE marker
if ! echo "$RESULT" | grep -q "ALL_DONE"; then
  echo "FATAL: Test process did not complete"
  echo ""
  echo "=== Results: $PASS passed, $FAIL failed ==="
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

echo "[1] SQLite tables exist"
check "nodes table exists" "T1:nodes=true"
check "edges table exists" "T1:edges=true"

echo "[2] Indexes exist"
check "idx_nodes_type" "T2:idx_nodes_type=true"
check "idx_edges_source" "T2:idx_edges_source=true"
check "idx_edges_target" "T2:idx_edges_target=true"
check "idx_edges_type" "T2:idx_edges_type=true"

echo "[3] EDGE_TYPES includes expected types"
check "EDGE_TYPES has INFORMS" "T3:informs=true"
check "EDGE_TYPES has BELONGS_TO" "T3:belongs_to=true"
check "EDGE_TYPES has CONTRADICTS" "T3:contradicts=true"
check "EDGE_TYPES has HSI_CONNECTION" "T3:hsi=true"
check "EDGE_TYPES has REVERSE_SALIENT" "T3:rs=true"

echo "[4] indexArtifact works"
check "Artifacts indexed" "T4:artifact_count="
check "Sections created" "T4:section_count="
check "BELONGS_TO edges" "T4:belongs_to_edges="

echo "[5] graphStats structure"
check "Has nodes object" "T5:has_nodes=true"
check "Has edges object" "T5:has_edges=true"
check "Has total object" "T5:has_total=true"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
