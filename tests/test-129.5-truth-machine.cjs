'use strict';
// Phase 129.5-03 -- the load-bearing instrumented acceptance test (the phase
// release gate) plus the accept-branch + confirmedFacts unit cases. Mirrors
// tests/test-129-spine-acceptance.cjs + tests/test-navigation-acceptance.cjs
// (Phase 109/129) EXACTLY: direct-CJS (node:assert/strict, no Mocha/Jest, zero
// new npm deps), setupRoom / cleanup / run, the openRoomDb fixture, and the
// fs-instrument zero-reads gate spanning the confirm flow.
//
// What it proves (per 129.5-03-PLAN + the Phase 109/129 precedent): the
// human-confirms-truth lever is LIVE end-to-end. A simulated human APPROVE at a
// Decision Gate (the F.0 accept branch of the selector dispatcher) promotes a
// PROPOSED truth-claim node to confirmed via navigation.confirmNode with a
// USER.md byUser; confirmedFacts returns the freshly human-confirmed node; an
// agent-attributed confirm is REJECTED and the node stays proposed; a
// status_promoted memory_event is emitted on promotion; audit nodes are exempt.
//
// The four LOAD-BEARING acceptance assertions:
//   (1) human APPROVE promotes + confirmedFacts returns it (FULL flow ONLY
//       through navigation.cjs: resolveByUser -> confirmNode -> getRoomHomeView).
//   (2) agent confirm REJECTED: confirmNode(db, id2, 'system') returns
//       {ok:false, reason:'agent_attribution_forbidden'} AND id2 stays proposed
//       AND it does NOT appear in confirmedFacts.
//   (3) memory_event emitted on promotion: findRecentChanges(eventType:
//       'status_promoted') includes the promotion event for the decision node
//       with the human byUser; the event target_node_id == the node id.
//   (4) audit-node exemption: a system-bookkeeping node (the focus_changed
//       memory_event audit node written by navigation.setFocus with
//       created_by=system review_status=confirmed) does NOT trigger the guard,
//       does NOT appear in confirmedFacts (confirmedFacts is truth-claim-typed),
//       and setFocus still succeeds.
//
// Plus: the fs-instrument gate (mirror 129) -- install before the confirm flow,
// uninstall after; assert zero non-SQLite filesystem reads during the confirm
// flow EXCEPT the allow-listed USER.md read that resolveByUser performs. USER.md
// is the single allow-listed non-room.db read for this gate.
//
// Canon Part 3 (the tri-context Decision Gate APPROVE produces a typed change).
// Canon Part 4 (every promotion is a typed memory_event in the local graph).
// Canon Part 8 (the confirm flow reaches room.db only through navigation; no folder scan).
// Canon Part 9 (the human confirms truth; agents may propose but not confirm;
//   audit nodes are exempt; SQL is the local mind, proven by instrumentation).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const roomHome = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-home.cjs'));
const selectorDecisions = require(path.join(REPO_ROOT, 'lib', 'workflow', 'selector-decisions.cjs'));
const fsInstrument = require(path.join(__dirname, 'helpers', 'fs-instrument.cjs'));

const SEED_SQL = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-129.5', 'sample-room', 'seed.sql');

// The truth-claim node the human APPROVEs (a decision, so the disjointness
// invariant on getRiskyAssumptions is untouched).
const APPROVE_NODE = 'decision:ship-mcp-first';
// The truth-claim node the agent-attributed confirm is REJECTED against.
const REJECT_NODE = 'claim:market-ready';
// The USER.md navigator identity (a human, never an agent).
const NAV_USER = 'navigator-acceptance';

// resolveByUser reads roomDir/USER.md. That single read is EXPECTED and
// allow-listed by the test filter below; every OTHER non-SQLite read is a leak.
const ALLOWED_NON_DB_FILENAMES = ['USER.md'];

function isAllowedNonDbRead(call) {
  const t = typeof call.target === 'string' ? call.target : String(call.target);
  return ALLOWED_NON_DB_FILENAMES.some((name) => t.endsWith(name));
}

function setupRoom() {
  // openRoomDb bootstraps the lazygraph + memory schema (filesystem writes +
  // schema reads). This MUST happen BEFORE the fs proxy installs; the proxy only
  // wraps reads, and the seed.sql readFileSync below also happens pre-proxy.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129.5-acceptance-'));
  const roomDir = tmp;
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  // Apply the phase-129.5 fixture seed (single db.exec into node:sqlite; the
  // seed.sql readFileSync is pre-proxy).
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  closeRoomDb(db);

  // Write the USER.md carrying a human navigator identity. resolveByUser reads
  // this file; the read is allow-listed by the fs-instrument filter. Pre-proxy.
  fs.writeFileSync(
    path.join(roomDir, 'USER.md'),
    '---\nuser_id: ' + NAV_USER + '\ncanonical_role: founder\n---\n# Navigator\n',
    'utf8'
  );
  return { tmp, roomDir };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function reviewStatusOf(db, id) {
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  return row ? row.review_status : null;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    process.stdout.write('PASS ' + name + '\n');
  } catch (err) {
    results.push({ name, ok: false, err: err && err.message ? err.message : String(err) });
    process.stderr.write('FAIL ' + name + ': ' + (err && err.message ? err.message : String(err)) + '\n'
      + ((err && err.stack) ? err.stack + '\n' : ''));
  }
}

// ===========================================================================
// INSTRUMENTED ACCEPTANCE (the phase release gate) -- 4 LOAD-BEARING assertions
// ===========================================================================

function test_truthMachine_instrumented() {
  const { tmp, roomDir } = setupRoom();
  try {
    // Drive the human-APPROVE flow ONLY through navigation.cjs, under the
    // fs-instrument proxy. resolveByUser performs the single allow-listed
    // USER.md read; confirmNode reaches room.db only via the chokepoint.
    let byUser;
    let approveResult;
    const db1 = openRoomDb(roomDir);
    fsInstrument.install({ throwOnViolation: false });
    try {
      byUser = navigation.resolveByUser(roomDir);
      approveResult = navigation.confirmNode(db1, APPROVE_NODE, byUser, 'approved at gate');
    } finally {
      fsInstrument.uninstall();
      closeRoomDb(db1);
    }

    // ---- fs-instrument gate: zero non-SQLite reads outside the allow-listed USER.md.
    const allLeaks = fsInstrument.calls();
    const nonAllowedLeaks = allLeaks.filter((c) => !isAllowedNonDbRead(c));
    ok(
      nonAllowedLeaks.length === 0,
      'fs-instrument gate: zero non-SQLite filesystem reads outside the allow-listed USER.md during the confirm flow; leaked: '
        + JSON.stringify(nonAllowedLeaks.map((c) => ({ method: c.method, target: c.target })))
    );

    // The resolved byUser is the human navigator from USER.md, never an agent.
    equal(byUser, NAV_USER, 'resolveByUser returns the USER.md human navigator identity');

    // ---- LOAD-BEARING (1): human APPROVE promotes + confirmedFacts returns it.
    ok(approveResult && approveResult.ok === true,
      'LOAD-BEARING (1a): confirmNode promotes the proposed decision (got ' + JSON.stringify(approveResult) + ')');

    const db = openRoomDb(roomDir);
    try {
      equal(reviewStatusOf(db, APPROVE_NODE), 'confirmed', 'LOAD-BEARING (1b): node review_status is confirmed');

      const view = navigation.getRoomHomeView(db, 'phase-129.5-fixture', { _mocks: {} });
      const factIds = new Set(view.confirmedFacts.map((x) => x.id));
      ok(factIds.has(APPROVE_NODE),
        'LOAD-BEARING (1c): confirmedFacts contains the freshly human-confirmed node (got ids '
          + JSON.stringify(Array.from(factIds)) + ')');
      const fact = view.confirmedFacts.find((x) => x.id === APPROVE_NODE);
      equal(fact.reviewStatus, 'confirmed', 'LOAD-BEARING (1c): the confirmed-fact reviewStatus is confirmed');

      // ---- LOAD-BEARING (3): a status_promoted memory_event is emitted on promotion.
      const promoted = memoryEvents.findRecentChanges(db, 0, { eventType: 'status_promoted', limit: 100 });
      const promoForNode = promoted.filter((e) => e.properties && e.properties.target_node_id === APPROVE_NODE);
      ok(promoForNode.length >= 1,
        'LOAD-BEARING (3a): a status_promoted memory_event was emitted for the node (got ' + promoForNode.length + ')');
      const hasHumanAttribution = promoForNode.some((e) => e.properties && e.properties.confirmed_by === NAV_USER);
      ok(hasHumanAttribution,
        'LOAD-BEARING (3b): the promotion event carries the human byUser in confirmed_by');
      const hasTarget = promoForNode.some((e) => e.properties && e.properties.target_node_id === APPROVE_NODE);
      ok(hasTarget, 'LOAD-BEARING (3c): the promotion event target_node_id == the node id');
    } finally {
      closeRoomDb(db);
    }

    // ---- LOAD-BEARING (2): an agent-attributed confirm is REJECTED.
    const db2 = openRoomDb(roomDir);
    try {
      const rejectResult = navigation.confirmNode(db2, REJECT_NODE, 'system');
      equal(rejectResult.ok, false, 'LOAD-BEARING (2a): agent confirm is rejected');
      equal(rejectResult.reason, 'agent_attribution_forbidden', 'LOAD-BEARING (2b): reason is agent_attribution_forbidden');
      equal(reviewStatusOf(db2, REJECT_NODE), 'proposed', 'LOAD-BEARING (2c): the node stays proposed');

      const view2 = navigation.getRoomHomeView(db2, 'phase-129.5-fixture', { _mocks: {} });
      const factIds2 = new Set(view2.confirmedFacts.map((x) => x.id));
      ok(!factIds2.has(REJECT_NODE),
        'LOAD-BEARING (2d): the agent-rejected node does NOT appear in confirmedFacts');
    } finally {
      closeRoomDb(db2);
    }

    // ---- LOAD-BEARING (4): audit-node exemption.
    // navigation.setFocus writes a focus_changed memory_event audit node with
    // created_by=system review_status=confirmed. The guard does NOT fire (audit
    // nodes are exempt per the Part 9 carve-out), setFocus succeeds, and the
    // audit node is NOT treated as a truth-claim -- it never appears in
    // confirmedFacts (which is truth-claim-typed).
    const db3 = openRoomDb(roomDir);
    try {
      const focusResult = navigation.setFocus(db3, 'session-acceptance', APPROVE_NODE, 'user');
      ok(focusResult && focusResult.ok === true,
        'LOAD-BEARING (4a): setFocus succeeds (the audit-node write is canon-legal; got ' + JSON.stringify(focusResult) + ')');

      // The focus_changed audit node carries created_by=system review_status=confirmed.
      const auditRow = db3.prepare(
        "SELECT created_by, review_status, type FROM nodes WHERE id = ?"
      ).get(focusResult.eventId);
      ok(auditRow, 'LOAD-BEARING (4b): the focus_changed audit node exists');
      equal(auditRow.created_by, 'system', 'LOAD-BEARING (4b): audit node created_by=system');
      equal(auditRow.review_status, 'confirmed', 'LOAD-BEARING (4b): audit node review_status=confirmed');
      equal(auditRow.type, 'memory_event', 'LOAD-BEARING (4b): audit node is a memory_event (system-bookkeeping type)');

      const view3 = navigation.getRoomHomeView(db3, 'phase-129.5-fixture', { _mocks: {} });
      const factIds3 = new Set(view3.confirmedFacts.map((x) => x.id));
      ok(!factIds3.has(focusResult.eventId),
        'LOAD-BEARING (4c): the system-bookkeeping audit node does NOT appear in confirmedFacts');
    } finally {
      closeRoomDb(db3);
    }
  } finally {
    cleanup(tmp);
  }
}

// ===========================================================================
// UNIT: recordSelectorDecision accept branch (the Decision Gate APPROVE path)
// ===========================================================================

function test_acceptBranch_promotesViaConfirmNode() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'accept',
      nodeId: APPROVE_NODE,
      roomState: { db, roomDir },
    });
    ok(res && res.ok === true, 'accept branch returns ok (got ' + JSON.stringify(res) + ')');
    ok(typeof res.decision_id === 'string' && res.decision_id.length > 0,
      'accept branch returns the status_promoted eventId as decision_id');
    equal(reviewStatusOf(db, APPROVE_NODE), 'confirmed', 'the decision node is promoted to confirmed');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_acceptBranch_resolvesUserMdByUser() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'accept',
      nodeId: APPROVE_NODE,
      roomState: { db, roomDir },
    });
    ok(res && res.ok === true, 'accept branch ok');
    const confirmedBy = db.prepare('SELECT confirmed_by FROM nodes WHERE id = ?').get(APPROVE_NODE).confirmed_by;
    equal(confirmedBy, NAV_USER, 'the confirmed node confirmed_by == the USER.md user_id');
    // The status_promoted memory_event carries the human in confirmed_by.
    const promoted = memoryEvents.findRecentChanges(db, 0, { eventType: 'status_promoted', limit: 100 });
    const hit = promoted.find((e) => e.properties && e.properties.target_node_id === APPROVE_NODE);
    ok(hit && hit.properties.confirmed_by === NAV_USER,
      'the status_promoted memory_event confirmed_by == the USER.md user_id');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_acceptBranch_aliasApprove() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'approve',
      nodeId: APPROVE_NODE,
      roomState: { db, roomDir },
    });
    ok(res && res.ok === true, "the 'approve' alias is accepted (got " + JSON.stringify(res) + ')');
    equal(reviewStatusOf(db, APPROVE_NODE), 'confirmed', 'approve alias promotes the node');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_acceptBranch_explicitAgentByUserRejected() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // A hostile caller passes an explicit agent byUser. The accept branch must
    // pass it through to confirmNode, where the guard REJECTS it. The node stays
    // proposed.
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'accept',
      nodeId: APPROVE_NODE,
      byUser: 'larry',
      roomState: { db, roomDir },
    });
    equal(res.ok, false, 'explicit agent byUser is rejected');
    equal(res.reason, 'agent_attribution_forbidden', 'reason surfaces unchanged from confirmNode');
    equal(reviewStatusOf(db, APPROVE_NODE), 'proposed', 'the node stays proposed');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_acceptBranch_unknownNode() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'accept',
      nodeId: 'decision:does-not-exist',
      roomState: { db, roomDir },
    });
    equal(res.ok, false, 'unknown node rejected');
    equal(res.reason, 'unknown_node', 'reason is unknown_node');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_acceptBranch_invalidDb() {
  const { tmp, roomDir } = setupRoom();
  try {
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'accept',
      nodeId: APPROVE_NODE,
      roomState: { roomDir }, // no db
    });
    equal(res.ok, false, 'missing db rejected');
    equal(res.reason, 'invalid_db', 'reason is invalid_db');
  } finally {
    cleanup(tmp);
  }
}

function test_acceptBranch_invalidNodeId() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const res = selectorDecisions.recordSelectorDecision({
      decision: 'accept',
      roomState: { db, roomDir }, // no nodeId
    });
    equal(res.ok, false, 'missing nodeId rejected');
    equal(res.reason, 'invalid_node_id', 'reason is invalid_node_id');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

// ===========================================================================
// UNIT: defer + reject branches are byte-unchanged (regression)
// ===========================================================================

function seedAnchorNode(db, id, type) {
  // The defer/reject branches write a typed edge cmd:<command> -> framework:<fw>;
  // edges FK to nodes(id), so both anchors must exist before the edge write.
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

function test_deferRejectBranches_unchanged() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // Seed the cmd + framework anchor nodes the defer/reject edge writes require.
    seedAnchorNode(db, 'cmd:mos:explore-domains', 'command');
    seedAnchorNode(db, 'framework:SWOT', 'framework');
    seedAnchorNode(db, 'cmd:mos:challenge-assumptions', 'command');
    seedAnchorNode(db, 'framework:Porter', 'framework');
    const deferRes = selectorDecisions.recordSelectorDecision({
      decision: 'defer',
      command: 'mos:explore-domains',
      framework: 'SWOT',
      roomState: { db, roomDir },
    });
    ok(deferRes && deferRes.ok === true, 'defer branch still works (got ' + JSON.stringify(deferRes) + ')');
    ok(typeof deferRes.decision_id === 'string', 'defer returns decision_id');
    ok(typeof deferRes.edge_id !== 'undefined', 'defer returns edge_id');

    const rejectRes = selectorDecisions.recordSelectorDecision({
      decision: 'reject',
      command: 'mos:challenge-assumptions',
      framework: 'Porter',
      reason: 'not now',
      roomState: { db, roomDir },
    });
    ok(rejectRes && rejectRes.ok === true, 'reject branch still works');

    // An unknown decision is still rejected with invalid_decision.
    const badRes = selectorDecisions.recordSelectorDecision({
      decision: 'frobnicate',
      command: 'x',
      framework: 'y',
      roomState: { db, roomDir },
    });
    equal(badRes.ok, false, 'unknown decision rejected');
    equal(badRes.reason, 'invalid_decision', 'reason is invalid_decision');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

// ===========================================================================
// UNIT: getConfirmedFacts contract fix
// ===========================================================================

function test_getConfirmedFacts_returnsConfirmed() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // Promote the decision via the human path, then assert getConfirmedFacts
    // returns the now-confirmed node (the contract fix: confirmed, not only validated).
    const r = navigation.confirmNode(db, APPROVE_NODE, NAV_USER);
    ok(r.ok === true, 'confirm succeeds');
    const facts = roomHome.getRoomHomeView(db, 'phase-129.5-fixture', { _mocks: {} }).confirmedFacts;
    const ids = new Set(facts.map((x) => x.id));
    ok(ids.has(APPROVE_NODE), 'getConfirmedFacts returns the confirmed node');
    // The still-proposed claim is NOT returned.
    ok(!ids.has(REJECT_NODE), 'a proposed node is NOT returned by getConfirmedFacts');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_getConfirmedFacts_validatedBackCompat() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // Seed a validated claim directly. It must STILL be returned (back-compat
    // with the 109 'validated'-only contract).
    const nowMs = Date.now();
    db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) "
      + "VALUES (?, 'claim', ?, 'fixture', 'user', 0.8, 'validated', ?, ?, 'solution-design')"
    ).run('claim:validated-old', JSON.stringify({ summary: 'old validated fact' }), nowMs, nowMs);
    const facts = roomHome.getRoomHomeView(db, 'phase-129.5-fixture', { _mocks: {} }).confirmedFacts;
    const ids = new Set(facts.map((x) => x.id));
    ok(ids.has('claim:validated-old'), 'a validated node is STILL returned (109 back-compat)');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

function test_disjointness_preserved() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // Confirm the decision, seed a needs_evidence assumption, then assert the
    // two sets are disjoint by id.
    navigation.confirmNode(db, APPROVE_NODE, NAV_USER);
    const nowMs = Date.now();
    db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) "
      + "VALUES (?, 'assumption', ?, 'fixture', 'larry', 0.4, 'needs_evidence', ?, ?, 'solution-design')"
    ).run('assumption:risky', JSON.stringify({ claim: 'risky' }), nowMs, nowMs);
    const view = roomHome.getRoomHomeView(db, 'phase-129.5-fixture', { _mocks: {} });
    const factIds = new Set(view.confirmedFacts.map((x) => x.id));
    const riskyIds = new Set(view.riskyAssumptions.map((x) => x.id));
    for (const id of factIds) {
      ok(!riskyIds.has(id), 'id ' + id + ' appears in BOTH confirmedFacts and riskyAssumptions');
    }
    ok(riskyIds.has('assumption:risky'), 'the needs_evidence assumption is a risky assumption');
  } finally {
    closeRoomDb(db);
    cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const tests = [
  test_truthMachine_instrumented,
  test_acceptBranch_promotesViaConfirmNode,
  test_acceptBranch_resolvesUserMdByUser,
  test_acceptBranch_aliasApprove,
  test_acceptBranch_explicitAgentByUserRejected,
  test_acceptBranch_unknownNode,
  test_acceptBranch_invalidDb,
  test_acceptBranch_invalidNodeId,
  test_deferRejectBranches_unchanged,
  test_getConfirmedFacts_returnsConfirmed,
  test_getConfirmedFacts_validatedBackCompat,
  test_disjointness_preserved,
];

for (const t of tests) {
  test(t.name, t);
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
}
process.stdout.write('\ntest-129.5-truth-machine: ' + (results.length - failed) + '/' + results.length + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
