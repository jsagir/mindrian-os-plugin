#!/usr/bin/env bash
# MindrianOS Plugin -- Phase 27-03 Meeting + Speaker KuzuDB Integration Tests
# Tests indexArtifact meeting-aware indexing: SEGMENT_OF, SPOKE_IN, CONSULTED_ON edges
#
# Note: KuzuDB 0.11.3 (archived) triggers a segfault during Node.js process
# exit after db.close(). Tests check output correctness, not exit code.
set -euo pipefail

PASS=0
FAIL=0
TEST_DIR="/tmp/test-meetings-$$"
FIXTURE_DIR="$(cd "$(dirname "$0")" && pwd)/fixtures/test-room-meeting"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 -- $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 27-03: Meeting + Speaker Integration ==="
echo "Test dir: $TEST_DIR"
echo "Fixture dir: $FIXTURE_DIR"
echo ""

mkdir -p "$TEST_DIR/room"

# Run all DB tests in single node process (KuzuDB segfault on exit)
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
const fs = require('fs');
const path = require('path');

const FIXTURE = '$FIXTURE_DIR';
const TEST_DIR = '$TEST_DIR';

async function run() {
  // Copy fixtures to temp dir so we have a clean room with sections
  const cpSync = (src, dst) => {
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) cpSync(path.join(src, f), path.join(dst, f));
    } else {
      fs.copyFileSync(src, dst);
    }
  };
  cpSync(FIXTURE, TEST_DIR + '/room');

  const { db, conn } = await lg.openGraph(TEST_DIR + '/room');

  // [1] Index a file-meeting artifact -> creates SEGMENT_OF edge
  try {
    await lg.indexArtifact(conn, TEST_DIR + '/room', TEST_DIR + '/room/market-analysis/investor-segment.md');
    const segEdges = await lg.queryGraph(conn, \"MATCH (a:Artifact)-[e:SEGMENT_OF]->(m:Meeting) RETURN a.id AS aid, m.id AS mid, e.segment_type AS st, e.confidence AS conf\");
    console.log('T1:segment_of_count=' + segEdges.length);
    if (segEdges.length > 0) {
      console.log('T1:segment_type=' + segEdges[0]['st']);
      console.log('T1:confidence=' + segEdges[0]['conf']);
      console.log('T1:meeting_id=' + segEdges[0]['mid']);
    }
  } catch (e) {
    console.log('T1:error=' + e.message);
  }

  // [2] Meeting node created with correct name and date
  try {
    const meetings = await lg.queryGraph(conn, \"MATCH (m:Meeting) RETURN m.id AS id, m.name AS name, m.date AS date\");
    console.log('T2:meeting_count=' + meetings.length);
    if (meetings.length > 0) {
      console.log('T2:meeting_name=' + meetings[0]['name']);
      console.log('T2:meeting_date=' + meetings[0]['date']);
    }
  } catch (e) {
    console.log('T2:error=' + e.message);
  }

  // [3] Speaker node created from attribution block
  try {
    const speakers = await lg.queryGraph(conn, \"MATCH (s:Speaker) RETURN s.id AS id, s.name AS name, s.role AS role, s.profile_path AS pp\");
    console.log('T3:speaker_count=' + speakers.length);
    if (speakers.length > 0) {
      console.log('T3:speaker_name=' + speakers[0]['name']);
      console.log('T3:speaker_role=' + speakers[0]['role']);
      console.log('T3:speaker_id=' + speakers[0]['id']);
    }
  } catch (e) {
    console.log('T3:error=' + e.message);
  }

  // [4] SPOKE_IN edge connects speaker to meeting
  try {
    const spokeEdges = await lg.queryGraph(conn, \"MATCH (s:Speaker)-[:SPOKE_IN]->(m:Meeting) RETURN s.id AS sid, m.id AS mid\");
    console.log('T4:spoke_in_count=' + spokeEdges.length);
    if (spokeEdges.length > 0) {
      console.log('T4:speaker_id=' + spokeEdges[0]['sid']);
      console.log('T4:meeting_id=' + spokeEdges[0]['mid']);
    }
  } catch (e) {
    console.log('T4:error=' + e.message);
  }

  // [5] CONSULTED_ON edge connects speaker to section
  try {
    const consultEdges = await lg.queryGraph(conn, \"MATCH (s:Speaker)-[:CONSULTED_ON]->(sec:Section) RETURN s.id AS sid, sec.name AS secname\");
    console.log('T5:consulted_on_count=' + consultEdges.length);
    if (consultEdges.length > 0) {
      console.log('T5:section=' + consultEdges[0]['secname']);
    }
  } catch (e) {
    console.log('T5:error=' + e.message);
  }

  // [6] Non-meeting artifact does NOT create Meeting/Speaker nodes
  // Index the core-problem.md which has methodology: explore-domains
  try {
    // Clear DB first to isolate
    await conn.query('MATCH (n) DETACH DELETE n');
    // Re-init schema
    await lg.initSchema(conn);
    await lg.migrateSchema(conn);

    await lg.indexArtifact(conn, TEST_DIR + '/room', TEST_DIR + '/room/problem-definition/core-problem.md');
    const meetingsAfter = await lg.queryGraph(conn, \"MATCH (m:Meeting) RETURN count(*) AS cnt\");
    const speakersAfter = await lg.queryGraph(conn, \"MATCH (s:Speaker) RETURN count(*) AS cnt\");
    console.log('T6:meeting_count_after_non_meeting=' + meetingsAfter[0]['cnt']);
    console.log('T6:speaker_count_after_non_meeting=' + speakersAfter[0]['cnt']);
  } catch (e) {
    console.log('T6:error=' + e.message);
  }

  // [7] graph.json from build-graph-from-kuzu contains meeting and speaker nodes
  try {
    // Rebuild with meeting artifact
    await conn.query('MATCH (n) DETACH DELETE n');
    await lg.initSchema(conn);
    await lg.migrateSchema(conn);
    await lg.indexArtifact(conn, TEST_DIR + '/room', TEST_DIR + '/room/market-analysis/investor-segment.md');

    // Close DB first, then run build-graph-from-kuzu
    await lg.closeGraph(db);

    const { execSync } = require('child_process');
    const graphJsonPath = TEST_DIR + '/room/.presentation/graph.json';
    try {
      execSync('node \"' + '$SCRIPT_DIR' + '/scripts/build-graph-from-kuzu.cjs\" \"' + TEST_DIR + '/room\" \"' + graphJsonPath + '\"', {
        timeout: 15000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (_) {
      // KuzuDB segfault on exit is expected
    }

    if (fs.existsSync(graphJsonPath)) {
      const graphJson = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));
      const meetingNodes = graphJson.elements.nodes.filter(n => n.classes === 'meeting');
      const speakerNodes = graphJson.elements.nodes.filter(n => n.classes === 'speaker');
      console.log('T7:graph_meeting_nodes=' + meetingNodes.length);
      console.log('T7:graph_speaker_nodes=' + speakerNodes.length);
      console.log('T7:graph_has_edges=' + (graphJson.elements.edges.length > 0));
    } else {
      console.log('T7:graph_json_exists=false');
    }

    console.log('ALL_DONE');
    return; // DB already closed
  } catch (e) {
    console.log('T7:error=' + e.message);
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

echo "[1] Filing meeting segment creates SEGMENT_OF edge"
check "SEGMENT_OF edge created" "T1:segment_of_count=1"
check "Segment type correct" "T1:segment_type=insight"
check "Confidence is 0.8" "T1:confidence=0.8"
check "Meeting ID correct" "T1:meeting_id=2026-03-15-investor-call"

echo "[2] Meeting node created with correct name and date"
check "Meeting node exists" "T2:meeting_count=1"
check "Meeting name" "T2:meeting_name=Investor Call Q1"
check "Meeting date" "T2:meeting_date=2026-03-15"

echo "[3] Speaker node created from attribution"
check "Speaker exists" "T3:speaker_count=1"
check "Speaker name" "T3:speaker_name=Jane Doe"
check "Speaker role" "T3:speaker_role=investor"
check "Speaker ID format" "T3:speaker_id=speaker/jane-doe"

echo "[4] SPOKE_IN edge connects speaker to meeting"
check "SPOKE_IN edge exists" "T4:spoke_in_count=1"
check "Speaker in SPOKE_IN" "T4:speaker_id=speaker/jane-doe"
check "Meeting in SPOKE_IN" "T4:meeting_id=2026-03-15-investor-call"

echo "[5] CONSULTED_ON edge connects speaker to section"
check "CONSULTED_ON edge exists" "T5:consulted_on_count=1"
check "Section in CONSULTED_ON" "T5:section=market-analysis"

echo "[6] Non-meeting artifact does NOT create Meeting/Speaker"
check "No Meeting from non-meeting artifact" "T6:meeting_count_after_non_meeting=0"
check "No Speaker from non-meeting artifact" "T6:speaker_count_after_non_meeting=0"

echo "[7] graph.json contains meeting and speaker nodes"
check "Meeting nodes in graph.json" "T7:graph_meeting_nodes=1"
check "Speaker nodes in graph.json" "T7:graph_speaker_nodes=1"
check "Graph has edges" "T7:graph_has_edges=true"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
