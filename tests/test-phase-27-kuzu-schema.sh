#!/usr/bin/env bash
# MindrianOS Plugin -- Phase 27 KuzuDB Schema Extension Tests
# Tests Meeting, Speaker, Assumption node tables + new edge types + assumption indexing
#
# Note: KuzuDB 0.11.3 (archived) triggers a segfault during Node.js process
# exit after db.close(). Tests check output correctness, not exit code.
set -euo pipefail

PASS=0
FAIL=0
TEST_DIR="/tmp/test-kuzu-schema-$$"
FIXTURE_DIR="$(cd "$(dirname "$0")" && pwd)/fixtures/test-room-meeting"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 -- $2"; FAIL=$((FAIL + 1)); }

echo "=== Phase 27: KuzuDB Schema Extension ==="
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
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room');

  // [1] Check new node tables exist (Meeting, Speaker, Assumption)
  try {
    const tables = await lg.queryGraph(conn, 'CALL SHOW_TABLES() RETURN *');
    const tableNames = tables.map(r => r.name || r['name']);
    const hasMeeting = tableNames.includes('Meeting');
    const hasSpeaker = tableNames.includes('Speaker');
    const hasAssumption = tableNames.includes('Assumption');
    console.log('T1:meeting=' + hasMeeting);
    console.log('T1:speaker=' + hasSpeaker);
    console.log('T1:assumption=' + hasAssumption);
  } catch (e) {
    console.log('T1:error=' + e.message);
  }

  // [2] Check new edge tables exist
  try {
    const tables = await lg.queryGraph(conn, 'CALL SHOW_TABLES() RETURN *');
    const tableNames = tables.map(r => r.name || r['name']);
    const hasSegmentOf = tableNames.includes('SEGMENT_OF');
    const hasSpokeIn = tableNames.includes('SPOKE_IN');
    const hasConsultedOn = tableNames.includes('CONSULTED_ON');
    const hasHasAssumption = tableNames.includes('HAS_ASSUMPTION');
    const hasAssumptionImpacts = tableNames.includes('ASSUMPTION_IMPACTS');
    console.log('T2:segment_of=' + hasSegmentOf);
    console.log('T2:spoke_in=' + hasSpokeIn);
    console.log('T2:consulted_on=' + hasConsultedOn);
    console.log('T2:has_assumption=' + hasHasAssumption);
    console.log('T2:assumption_impacts=' + hasAssumptionImpacts);
  } catch (e) {
    console.log('T2:error=' + e.message);
  }

  // [3] Existing tables preserved
  try {
    const tables = await lg.queryGraph(conn, 'CALL SHOW_TABLES() RETURN *');
    const tableNames = tables.map(r => r.name || r['name']);
    const hasArtifact = tableNames.includes('Artifact');
    const hasSection = tableNames.includes('Section');
    const hasInforms = tableNames.includes('INFORMS');
    const hasBelongsTo = tableNames.includes('BELONGS_TO');
    console.log('T3:artifact=' + hasArtifact);
    console.log('T3:section=' + hasSection);
    console.log('T3:informs=' + hasInforms);
    console.log('T3:belongs_to=' + hasBelongsTo);
  } catch (e) {
    console.log('T3:error=' + e.message);
  }

  // [4] indexArtifact extracts assumptions and creates Assumption nodes + HAS_ASSUMPTION edges
  try {
    await lg.indexArtifact(conn, FIXTURE, FIXTURE + '/problem-definition/core-problem.md');
    const assumptions = await lg.queryGraph(conn, \"MATCH (a:Assumption) RETURN a.id, a.claim, a.status\");
    console.log('T4:assumption_count=' + assumptions.length);
    if (assumptions.length > 0) {
      console.log('T4:claim=' + assumptions[0]['a.claim']);
      console.log('T4:status=' + assumptions[0]['a.status']);
    }
    const edges = await lg.queryGraph(conn, \"MATCH (:Artifact)-[e:HAS_ASSUMPTION]->(:Assumption) RETURN count(*) AS cnt\");
    console.log('T4:has_assumption_edges=' + edges[0]['cnt']);
    // Check ASSUMPTION_IMPACTS edges
    const impactEdges = await lg.queryGraph(conn, \"MATCH (:Assumption)-[e:ASSUMPTION_IMPACTS]->(:Section) RETURN count(*) AS cnt\");
    console.log('T4:assumption_impacts_edges=' + impactEdges[0]['cnt']);
  } catch (e) {
    console.log('T4:error=' + e.message);
  }

  // [5] indexMeeting creates Meeting node from metadata.yaml
  try {
    const meetingResult = await lg.indexMeeting(conn, FIXTURE, FIXTURE + '/meetings/2026-03-15-investor-call');
    console.log('T5:meeting_id=' + meetingResult.id);
    console.log('T5:meeting_name=' + meetingResult.name);
    console.log('T5:meeting_date=' + meetingResult.date);
    const meetings = await lg.queryGraph(conn, \"MATCH (m:Meeting) RETURN m.id, m.name\");
    console.log('T5:meeting_node_count=' + meetings.length);
  } catch (e) {
    console.log('T5:error=' + e.message);
  }

  // [6] indexSpeaker creates Speaker node with role
  try {
    const speakerResult = await lg.indexSpeaker(conn, 'meeting/2026-03-15-investor-call', { name: 'Jane Doe', role: 'investor' });
    console.log('T6:speaker_id=' + speakerResult.id);
    console.log('T6:speaker_name=' + speakerResult.name);
    const speakers = await lg.queryGraph(conn, \"MATCH (s:Speaker) RETURN s.id, s.name, s.role\");
    console.log('T6:speaker_count=' + speakers.length);
    console.log('T6:speaker_role=' + speakers[0]['s.role']);
    // Check SPOKE_IN edge
    const spokeEdges = await lg.queryGraph(conn, \"MATCH (:Speaker)-[:SPOKE_IN]->(:Meeting) RETURN count(*) AS cnt\");
    console.log('T6:spoke_in_edges=' + spokeEdges[0]['cnt']);
  } catch (e) {
    console.log('T6:error=' + e.message);
  }

  // [7] Confidence on SEGMENT_OF edge is DOUBLE type
  try {
    // Index the meeting segment to create an artifact, then create SEGMENT_OF edge
    await lg.indexArtifact(conn, FIXTURE, FIXTURE + '/meetings/2026-03-15-investor-call/segment-market-size.md');
    // Create SEGMENT_OF edge manually with numeric confidence
    await conn.query(\"MATCH (a:Artifact {id: 'meetings/2026-03-15-investor-call/segment-market-size'}), (m:Meeting {id: 'meeting/2026-03-15-investor-call'}) MERGE (a)-[:SEGMENT_OF {segment_type: 'market-data', confidence: 0.85}]->(m)\");
    const segEdges = await conn.query(\"MATCH (a:Artifact)-[e:SEGMENT_OF]->(m:Meeting) RETURN e.confidence AS conf\");
    const segRows = await segEdges.getAll();
    console.log('T7:confidence_value=' + segRows[0]['conf']);
    console.log('T7:confidence_is_number=' + (typeof segRows[0]['conf'] === 'number'));
  } catch (e) {
    console.log('T7:error=' + e.message);
  }

  // [8] EDGE_TYPES array includes new types
  try {
    const edgeTypes = lg.EDGE_TYPES || [];
    const hasSegmentOf = edgeTypes.includes('SEGMENT_OF');
    const hasSpokeIn = edgeTypes.includes('SPOKE_IN');
    const hasConsultedOn = edgeTypes.includes('CONSULTED_ON');
    const hasHasAssumption = edgeTypes.includes('HAS_ASSUMPTION');
    const hasAssumptionImpacts = edgeTypes.includes('ASSUMPTION_IMPACTS');
    console.log('T8:segment_of=' + hasSegmentOf);
    console.log('T8:spoke_in=' + hasSpokeIn);
    console.log('T8:consulted_on=' + hasConsultedOn);
    console.log('T8:has_assumption=' + hasHasAssumption);
    console.log('T8:assumption_impacts=' + hasAssumptionImpacts);
  } catch (e) {
    console.log('T8:error=' + e.message);
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

echo "[1] New node tables exist"
check "Meeting table exists" "T1:meeting=true"
check "Speaker table exists" "T1:speaker=true"
check "Assumption table exists" "T1:assumption=true"

echo "[2] New edge tables exist"
check "SEGMENT_OF edge table" "T2:segment_of=true"
check "SPOKE_IN edge table" "T2:spoke_in=true"
check "CONSULTED_ON edge table" "T2:consulted_on=true"
check "HAS_ASSUMPTION edge table" "T2:has_assumption=true"
check "ASSUMPTION_IMPACTS edge table" "T2:assumption_impacts=true"

echo "[3] Existing tables preserved"
check "Artifact table preserved" "T3:artifact=true"
check "Section table preserved" "T3:section=true"
check "INFORMS table preserved" "T3:informs=true"
check "BELONGS_TO table preserved" "T3:belongs_to=true"

echo "[4] indexArtifact extracts assumptions"
check "Assumption nodes created" "T4:assumption_count=1"
check "Assumption claim correct" "T4:claim=Market size exceeds"
check "Assumption status" "T4:status=unvalidated"
check "HAS_ASSUMPTION edges" "T4:has_assumption_edges=1"
check "ASSUMPTION_IMPACTS edges" "T4:assumption_impacts_edges=2"

echo "[5] indexMeeting creates Meeting node"
check "Meeting ID" "T5:meeting_id=meeting/2026-03-15-investor-call"
check "Meeting name" "T5:meeting_name=Investor Call Q1"
check "Meeting date" "T5:meeting_date=2026-03-15"
check "Meeting node exists" "T5:meeting_node_count=1"

echo "[6] indexSpeaker creates Speaker node"
check "Speaker ID" "T6:speaker_id=speaker/jane-doe"
check "Speaker name" "T6:speaker_name=Jane Doe"
check "Speaker count" "T6:speaker_count=1"
check "Speaker role" "T6:speaker_role=investor"
check "SPOKE_IN edge" "T6:spoke_in_edges=1"

echo "[7] Confidence on edges is DOUBLE"
check "Confidence value 0.85" "T7:confidence_value=0.85"
check "Confidence is number" "T7:confidence_is_number=true"

echo "[8] EDGE_TYPES includes new types"
check "EDGE_TYPES has SEGMENT_OF" "T8:segment_of=true"
check "EDGE_TYPES has SPOKE_IN" "T8:spoke_in=true"
check "EDGE_TYPES has CONSULTED_ON" "T8:consulted_on=true"
check "EDGE_TYPES has HAS_ASSUMPTION" "T8:has_assumption=true"
check "EDGE_TYPES has ASSUMPTION_IMPACTS" "T8:assumption_impacts=true"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
