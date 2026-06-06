'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-05 -- dial graph relationship-layer assert (MEMDIAL-01 + FILEVAL-01).
 * ===============================================================================
 * Locks the dial-as-relationship-layer queryability across ALL THREE edge families
 * REQUIREMENTS.md MEMDIAL-01 names, plus the FILEVAL-01 selection-writes-typed-edge
 * invariant:
 *
 *   (a) MEMDIAL-01: after a few closeReach commits, the 5 reach ids + the
 *       SELECTED_REACH + PIVOTED edges are queryable via navigation.getNeighborhood
 *       -- a graph traversal returns them as TYPED edges via edgeTypeIn, proving a
 *       relationship layer (not a flat log).
 *   (a.DRSCH) ADDITIONALLY the pre-existing DRSCH research-conclusion evidence edges
 *       (Phase 141 Complete; FILEVAL-02 substrate) are reachable via the SAME
 *       getNeighborhood traversal as part of the dial relationship layer. This is an
 *       ASSERT-ONLY addition: the fixture seeds a DRSCH evidence edge through the
 *       SHIPPED navigation.fileEvidenceWithReadback substrate (no DRSCH producer is
 *       built here), then queries + asserts it is reachable.
 *   (b) FILEVAL-01: a Shape-F selection (a closeReach commit) writes the typed edge
 *       to the LOCAL room.db at the moment of selection -- the edge exists in the
 *       graph immediately after closeReach returns, not only in an MD file.
 *
 * Real room.db schema via openRoomDb (mirrors the Phase 143.1-03 close-reach test).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_) {
  process.stdout.write('SKIP test-dial-graph-relationship-layer.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { closeReach } = require(path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'));
const { REACH_IDS } = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

const SESSION = 'session:dial-relationship-layer-test';
const FOCUS_ID = 'node:problem-formulation';

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1431-05-dial-rel-'));
  return openRoomDb(dir);
}

function seedNode(db, id, type) {
  const now = Date.now();
  db.prepare(
    'INSERT OR IGNORE INTO nodes (id, type, properties, source_path, source_section, created_by, confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, ?, '{}', 'p1431-05-fixture', 'problem-formulation', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, now, now);
}

function seedReachAnchors(db, command, framework, declined) {
  seedNode(db, FOCUS_ID, 'focus_anchor');
  seedNode(db, 'cmd:' + command, 'command');
  seedNode(db, 'framework:' + framework, 'framework');
  if (declined) seedNode(db, declined, 'command');
  navigation.setFocus(db, SESSION, FOCUS_ID, 'user');
}

function reachFor(command, framework) {
  return {
    command,
    jtbd: 'find-problem',
    framework,
    recommended: true,
    decision_id: 'dec:' + command + ':' + Date.now(),
  };
}

// ---------- Test 1: FILEVAL-01 -- a closeReach commit writes the typed edge AT selection time ----------

function testFileval01TypedEdgeAtSelection() {
  const db = freshDb();
  seedReachAnchors(db, 'mos:beautiful-question', 'Beautiful Question Framework');

  const r = closeReach({
    outcome: 'sync',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    sessionId: SESSION,
    roomState: { db, investment_level: 0.3 },
    recordNextAction: () => ({ ok: true }),
  });
  assert.ok(r.ok, 'closeReach sync ok; reason=' + (r && r.reason));

  // FILEVAL-01: the typed edge exists in room.db immediately after closeReach
  // returns -- a graph fact at the selection moment, not only an MD projection.
  const row = db.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = ? AND target = ? AND type = 'SELECTED_REACH'"
  ).get(FOCUS_ID, 'cmd:mos:beautiful-question');
  assert.equal(row.c, 1, 'FILEVAL-01: SELECTED_REACH typed edge written to room.db at selection time');
  db.close();
}

// ---------- Test 2: MEMDIAL-01 -- SELECTED_REACH + PIVOTED queryable via getNeighborhood ----------

function testMemdial01SelectedAndPivotedQueryable() {
  const db = freshDb();
  const declined = 'cmd:mos:swot';
  seedReachAnchors(db, 'mos:beautiful-question', 'Beautiful Question Framework', declined);

  // A sync commit (SELECTED_REACH) ...
  const r1 = closeReach({
    outcome: 'sync',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    sessionId: SESSION,
    roomState: { db, investment_level: 0.3 },
    recordNextAction: () => ({ ok: true }),
  });
  assert.ok(r1.ok, 'sync commit ok');
  // ... and a pivot commit (PIVOTED FROM chosen TO declined + ALSO SELECTED_REACH).
  const r2 = closeReach({
    outcome: 'pivot',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    declinedRecommended: declined,
    margin: 0.08,
    sessionId: SESSION,
    roomState: { db, investment_level: 0.2 },
    recordNextAction: () => ({ ok: true }),
  });
  assert.ok(r2.ok, 'pivot commit ok');

  // The graph traversal off the focus node surfaces the SELECTED_REACH edge as a
  // TYPED edge (edgeTypeIn), proving a relationship layer not a flat log.
  const fromFocus = navigation.getNeighborhood(db, FOCUS_ID, { topK: 100, maxDepth: 2 });
  const selectedTyped = fromFocus.filter((n) => n.edgeTypeIn === 'SELECTED_REACH');
  assert.ok(selectedTyped.length >= 1, 'SELECTED_REACH reachable as a typed edge via getNeighborhood off the focus');
  assert.ok(selectedTyped.some((n) => n.id === 'cmd:mos:beautiful-question'),
    'the SELECTED_REACH neighbor is the chosen command');

  // The PIVOTED edge is FROM cmd:chosen TO cmd:declined; traverse from the chosen
  // command node to surface it as a typed edge.
  const fromChosen = navigation.getNeighborhood(db, 'cmd:mos:beautiful-question', { topK: 100, maxDepth: 2 });
  const pivotedTyped = fromChosen.filter((n) => n.edgeTypeIn === 'PIVOTED');
  assert.ok(pivotedTyped.length >= 1, 'PIVOTED reachable as a typed edge via getNeighborhood (why-not is graph data)');
  assert.ok(pivotedTyped.some((n) => n.id === declined), 'the PIVOTED neighbor is the declined-recommended command');

  // The 5 reach ids are the doctrine vocabulary the dial relationship layer is
  // built on (MEMDIAL-01 names "5 reach ids + SELECTED_REACH/PIVOTED edges").
  assert.equal(REACH_IDS.length, 5, 'the dial relationship layer carries exactly 5 reach ids');
  db.close();
}

// ---------- Test 3: MEMDIAL-01 DRSCH -- pre-existing research-conclusion edges queryable ----------

function testMemdial01DrschQueryable() {
  const db = freshDb();
  seedReachAnchors(db, 'mos:beautiful-question', 'Beautiful Question Framework');

  // ASSERT-ONLY over the SHIPPED Phase 141 substrate: seed a DRSCH research-
  // conclusion evidence edge through navigation.fileEvidenceWithReadback (the
  // FILEVAL-02 substrate). This writes a typed EvidenceClaim node + an INFORMS
  // edge to the focus node in one transaction. No DRSCH PRODUCER is built here.
  const filed = navigation.fileEvidenceWithReadback(db, {
    topic: 'CAR-T manufacturing cost curve',
    source: 'arxiv',
    url: 'https://arxiv.org/abs/2099.00001',
    retrieved_at: '2026-06-06T00:00:00Z',
    evidence_tier: 'Academic',
    summary: 'manufacturing cost per dose drops 40 percent at scale',
    sessionId: SESSION,
    informsTargetId: FOCUS_ID,
  });
  assert.ok(filed.ok, 'fileEvidenceWithReadback landed the DRSCH evidence edge; reason=' + (filed && filed.reason));
  const claimId = filed.node_id;

  // The DRSCH research-conclusion evidence edge is reachable via the SAME
  // getNeighborhood traversal that surfaces SELECTED_REACH / PIVOTED. The INFORMS
  // edge is FROM the EvidenceClaim TO the focus, so traverse OFF the claim node.
  const fromClaim = navigation.getNeighborhood(db, claimId, { topK: 100, maxDepth: 2 });
  const informsTyped = fromClaim.filter((n) => n.edgeTypeIn === 'INFORMS');
  assert.ok(informsTyped.length >= 1, 'DRSCH research-conclusion evidence reachable as a typed INFORMS edge via getNeighborhood');
  assert.ok(informsTyped.some((n) => n.id === FOCUS_ID),
    'the DRSCH evidence edge informs the focus node (the dial relationship layer)');

  // The evidence node itself is a typed EvidenceClaim (the DRSCH substrate),
  // confirming the third edge family is part of the same queryable graph.
  const claimRow = db.prepare("SELECT type FROM nodes WHERE id = ?").get(claimId);
  assert.ok(claimRow && claimRow.type === 'EvidenceClaim', 'the DRSCH conclusion is a typed EvidenceClaim node');
  db.close();
}

// ---------- Test 4: all three edge families coexist in ONE traversal sweep ----------

function testAllThreeFamiliesCoexist() {
  const db = freshDb();
  const declined = 'cmd:mos:swot';
  seedReachAnchors(db, 'mos:beautiful-question', 'Beautiful Question Framework', declined);

  closeReach({
    outcome: 'pivot',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    declinedRecommended: declined,
    margin: 0.05,
    sessionId: SESSION,
    roomState: { db, investment_level: 0.2 },
    recordNextAction: () => ({ ok: true }),
  });
  const filed = navigation.fileEvidenceWithReadback(db, {
    topic: 'pricing elasticity', source: 'arxiv', url: 'https://arxiv.org/abs/2099.00002',
    retrieved_at: '2026-06-06T00:00:00Z', evidence_tier: 'Academic',
    summary: 'demand drops sharply above the reference price', sessionId: SESSION,
    informsTargetId: FOCUS_ID,
  });
  assert.ok(filed.ok, 'DRSCH evidence filed for the coexistence sweep');

  // Sweep the full neighborhood off the focus + the chosen command + the evidence
  // claim at depth 2 and collect every typed edge family. The DRSCH INFORMS edge
  // is FROM the EvidenceClaim TO the focus, so the claim node is a sweep seed (the
  // dial relationship layer is reachable from every node it touches). MEMDIAL-01
  // names exactly three families.
  const seen = new Set();
  for (const seed of [FOCUS_ID, 'cmd:mos:beautiful-question', filed.node_id]) {
    const nbrs = navigation.getNeighborhood(db, seed, { topK: 200, maxDepth: 2 });
    for (const n of nbrs) {
      if (n.edgeTypeIn === 'SELECTED_REACH') seen.add('SELECTED_REACH');
      if (n.edgeTypeIn === 'PIVOTED') seen.add('PIVOTED');
      if (n.edgeTypeIn === 'INFORMS') seen.add('DRSCH');
    }
  }
  assert.ok(seen.has('SELECTED_REACH'), 'family 1 SELECTED_REACH present in the traversal');
  assert.ok(seen.has('PIVOTED'), 'family 2 PIVOTED present in the traversal');
  assert.ok(seen.has('DRSCH'), 'family 3 DRSCH (INFORMS evidence) present in the traversal');
  assert.equal(seen.size, 3, 'all three MEMDIAL-01 edge families are graph-queryable, not a flat log');
  db.close();
}

// ---------- Run ----------

testFileval01TypedEdgeAtSelection();
testMemdial01SelectedAndPivotedQueryable();
testMemdial01DrschQueryable();
testAllThreeFamiliesCoexist();
process.stdout.write('PASS test-dial-graph-relationship-layer.cjs (4 tests)\n');
process.exit(0);
