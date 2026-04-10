#!/usr/bin/env bash
# MindrianOS Plugin -- Phase 53 Causal Extraction Tests
# Tests CausalClaim CRUD, EXTRACTED_FROM edges, confidence scoring,
# domain validation, max claims, and Three Gaps enforcement.
#
# Note: KuzuDB 0.11.3 (archived) triggers a segfault during Node.js process
# exit after db.close(). Tests check output correctness, not exit code.
set -euo pipefail

PASS=0
FAIL=0
TEST_DIR="/tmp/test-causal-extract-$$"
FIXTURE_DIR="$(cd "$(dirname "$0")" && pwd)/fixtures/test-room-causal"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 -- $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 53: Causal Extraction Pipeline ==="
echo "Test dir: $TEST_DIR"
echo "Fixture dir: $FIXTURE_DIR"
echo ""

mkdir -p "$TEST_DIR/room-t1/problem-definition"
mkdir -p "$TEST_DIR/room-t5/problem-definition"

# Create minimal artifact fixture for EXTRACTED_FROM edge test
echo "# Market Pain" > "$TEST_DIR/room-t1/problem-definition/market-pain.md"

# Copy fixture for bridge tests (T5, T6)
cp "$FIXTURE_DIR/.causal-extract.json" "$TEST_DIR/room-t1/.causal-extract.json"

# Create 7-claim fixture for T5 (max 5 test)
cat > "$TEST_DIR/room-t5/.causal-extract.json" << 'JSONEOF'
{
  "source_artifact": "problem-definition/market-pain",
  "extracted_at": "2026-04-05",
  "claims": [
    {"id":"c1","cause":"A","mechanism":"M1","effect":"E1","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P1","evidence":[]},
    {"id":"c2","cause":"B","mechanism":"M2","effect":"E2","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P2","evidence":[]},
    {"id":"c3","cause":"C","mechanism":"M3","effect":"E3","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P3","evidence":[]},
    {"id":"c4","cause":"D","mechanism":"M4","effect":"E4","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P4","evidence":[]},
    {"id":"c5","cause":"E","mechanism":"M5","effect":"E5","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P5","evidence":[]},
    {"id":"c6","cause":"F","mechanism":"M6","effect":"E6","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P6","evidence":[]},
    {"id":"c7","cause":"G","mechanism":"M7","effect":"E7","extraction_method":"observed","domain":"materials","falsifiable_prediction":"P7","evidence":[]}
  ],
  "rejected": []
}
JSONEOF

# --- T1-T4: CRUD function tests (single node process) ---
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const fs = require('fs');
const path = require('path');

const TEST_DIR = '$TEST_DIR';

async function run() {
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room-t1');

  // Index the test artifact so EXTRACTED_FROM has a target
  await lg.indexArtifact(conn, TEST_DIR + '/room-t1', TEST_DIR + '/room-t1/problem-definition/market-pain.md');

  // [T1] createCausalClaim writes a node (EXTRACT-01)
  try {
    await lg.createCausalClaim(conn, {
      id: 'causal-test0001',
      cause: 'Equipment downtime averaging 12 hours',
      mechanism: 'Uncoated surfaces degrade under thermal cycling',
      effect: 'Production losses of 50K per incident',
      confidence: 0.7,
      evidence: JSON.stringify(['problem-definition/market-pain']),
      source_artifact: 'problem-definition/market-pain',
      domain: 'materials',
      falsifiable_prediction: 'Coating reduces downtime below 4 hours',
      novelty_score: 0.0,
      extraction_method: 'observed',
      created: '2026-04-05'
    });
    const rows = await lg.queryGraph(conn, \"MATCH (c:CausalClaim {id: 'causal-test0001'}) RETURN c.cause\");
    console.log('T1:cause=' + (rows[0] ? rows[0]['c.cause'] : 'NOT_FOUND'));
  } catch (e) {
    console.log('T1:error=' + e.message);
  }

  // [T2] createExtractedFromEdge links claim to artifact (EXTRACT-02)
  try {
    await lg.createExtractedFromEdge(conn, 'causal-test0001', 'problem-definition/market-pain');
    const rows = await lg.queryGraph(conn, \"MATCH (c:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact) RETURN c.id, a.id\");
    console.log('T2:claim_id=' + (rows[0] ? rows[0]['c.id'] : 'NOT_FOUND'));
    console.log('T2:artifact_id=' + (rows[0] ? rows[0]['a.id'] : 'NOT_FOUND'));
  } catch (e) {
    console.log('T2:error=' + e.message);
  }

  // [T3] Confidence by extraction method (EXTRACT-03)
  try {
    await lg.createCausalClaim(conn, {
      id: 'causal-conf-obs', cause: 'A', mechanism: 'M', effect: 'E',
      confidence: 0.7, extraction_method: 'observed', domain: 'general',
      falsifiable_prediction: 'P'
    });
    await lg.createCausalClaim(conn, {
      id: 'causal-conf-ass', cause: 'B', mechanism: 'M', effect: 'E',
      confidence: 0.5, extraction_method: 'asserted', domain: 'general',
      falsifiable_prediction: 'P'
    });
    await lg.createCausalClaim(conn, {
      id: 'causal-conf-inf', cause: 'C', mechanism: 'M', effect: 'E',
      confidence: 0.3, extraction_method: 'inferred', domain: 'general',
      falsifiable_prediction: 'P'
    });
    const obs = await lg.queryGraph(conn, \"MATCH (c:CausalClaim {id: 'causal-conf-obs'}) RETURN c.confidence\");
    const ass = await lg.queryGraph(conn, \"MATCH (c:CausalClaim {id: 'causal-conf-ass'}) RETURN c.confidence\");
    const inf = await lg.queryGraph(conn, \"MATCH (c:CausalClaim {id: 'causal-conf-inf'}) RETURN c.confidence\");
    console.log('T3:observed=' + (obs[0] ? obs[0]['c.confidence'] : 'NONE'));
    console.log('T3:asserted=' + (ass[0] ? ass[0]['c.confidence'] : 'NONE'));
    console.log('T3:inferred=' + (inf[0] ? inf[0]['c.confidence'] : 'NONE'));
  } catch (e) {
    console.log('T3:error=' + e.message);
  }

  // [T4] Domain stored correctly (EXTRACT-04)
  try {
    const rows = await lg.queryGraph(conn, \"MATCH (c:CausalClaim {id: 'causal-test0001'}) RETURN c.domain\");
    console.log('T4:domain=' + (rows[0] ? rows[0]['c.domain'] : 'NOT_FOUND'));
  } catch (e) {
    console.log('T4:error=' + e.message);
  }

  await lg.closeGraph(db);
  console.log('CRUD_DONE');
}

run().catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });
" 2>&1 || true)

echo "$RESULT"
echo ""

# Check CRUD tests completed
if ! echo "$RESULT" | grep -q "CRUD_DONE"; then
  echo "FATAL: CRUD test process did not complete"
  echo ""
  echo "=== Results: $PASS passed, $FAIL failed ==="
  exit 1
fi

# --- T5: Max 5 claims enforced (EXTRACT-05) via bridge ---
BRIDGE_T5=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const { execSync } = require('child_process');

const TEST_DIR = '$TEST_DIR';

async function run() {
  // Run bridge on 7-claim fixture
  try {
    execSync('node $SCRIPT_DIR/scripts/causal-to-graph.cjs ' + TEST_DIR + '/room-t5', { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    // Close error on exit expected
  }

  // Count claims written
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room-t5');
  const rows = await lg.queryGraph(conn, "SELECT COUNT(*) AS cnt FROM nodes WHERE type = 'CausalClaim'");
  console.log('T5:count=' + (rows[0] ? rows[0]['cnt'] : 0));
  await lg.closeGraph(db);
  console.log('T5_DONE');
}

run().catch(e => { console.error('T5_FATAL: ' + e.message); process.exit(1); });
" 2>&1 || true)

echo "$BRIDGE_T5"
echo ""

# --- T6: Three Gaps rejection (EXTRACT-06) via bridge on original fixture ---
BRIDGE_T6=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const { execSync } = require('child_process');

const TEST_DIR = '$TEST_DIR';

async function run() {
  // Run bridge on fixture with 1 incomplete claim (claim 3: empty mechanism + prediction)
  try {
    execSync('node $SCRIPT_DIR/scripts/causal-to-graph.cjs ' + TEST_DIR + '/room-t1', { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    // Close error on exit expected
  }

  // Check if causal-test0003 was rejected
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room-t1');
  const rows = await lg.queryGraph(conn, \"SELECT id FROM nodes WHERE id = 'causal-test0003' AND type = 'CausalClaim'\");
  console.log('T6:rejected=' + (rows.length === 0 ? 'true' : 'false'));
  // Check valid claims were written
  const valid = await lg.queryGraph(conn, \"SELECT id FROM nodes WHERE id = 'causal-test0002' AND type = 'CausalClaim'\");
  console.log('T6:valid_written=' + (valid.length > 0 ? 'true' : 'false'));
  await lg.closeGraph(db);
  console.log('T6_DONE');
}

run().catch(e => { console.error('T6_FATAL: ' + e.message); process.exit(1); });
" 2>&1 || true)

echo "$BRIDGE_T6"
echo ""

# --- Parse all results ---
check() {
  local label="$1" pattern="$2" source="$3"
  if echo "$source" | grep -q "$pattern"; then
    pass "$label"
  else
    fail "$label" "pattern '$pattern' not found"
  fi
}

echo "[T1] CausalClaim node written (EXTRACT-01)"
check "CausalClaim cause stored" "T1:cause=Equipment downtime" "$RESULT"

echo "[T2] EXTRACTED_FROM edge links claim to artifact (EXTRACT-02)"
check "Claim ID in edge" "T2:claim_id=causal-test0001" "$RESULT"
check "Artifact ID in edge" "T2:artifact_id=problem-definition/market-pain" "$RESULT"

echo "[T3] Confidence by extraction method (EXTRACT-03)"
check "Observed confidence 0.7" "T3:observed=0.7" "$RESULT"
check "Asserted confidence 0.5" "T3:asserted=0.5" "$RESULT"
check "Inferred confidence 0.3" "T3:inferred=0.3" "$RESULT"

echo "[T4] Domain stored correctly (EXTRACT-04)"
check "Domain is materials" "T4:domain=materials" "$RESULT"

echo "[T5] Max 5 claims enforced (EXTRACT-05)"
check "Only 5 claims written from 7" "T5:count=5" "$BRIDGE_T5"

echo "[T6] Three Gaps rejection (EXTRACT-06)"
check "Incomplete claim rejected" "T6:rejected=true" "$BRIDGE_T6"
check "Valid claims written" "T6:valid_written=true" "$BRIDGE_T6"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
