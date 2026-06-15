'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-03 Task 1 -- the scripted 2-turn producer->consumer->penalty
 * LIVE-suppression integration test (DCW-09 / DCW-06). THE HEADLINE GATE.
 * ============================================================================
 * Phase 158 is green only via SEEDED reach_id-keyed rows + the roomState
 * injection seam; no test drives the REAL producer->consumer->penalty loop end
 * to end. This suite proves suppression fires from REAL recorded rejections --
 * the exact behavior the phase exists to deliver:
 *
 *   turn N   : persist a real f1_closer_payload (reachIds {SkillX:'deep_research'})
 *              to the decision-trace FILE (the producer's persisted shape).
 *   turn N+1 : drive the Wave-2 exported turn-start helper consumePriorF1Pick to
 *              record the reject -- a REAL keyed f_selector_decision row lands in
 *              a real room.db (read back via the navigation chokepoint).
 *   repeat   : 3 REAL rejects of ONE reach (deep_research), plus M(=2) REAL
 *              reach_presented rows emitted via navigation.logMemoryEvent so the
 *              M-floor is satisfied by REAL db rows.
 *   then     : computeReachPenalties(db, roomState) -> suppressedReachIds ->
 *              buildReachList -> assert 'deep_research' ABSENT.
 *
 * THE MEDIUM-1 ANTI-VACUOUS GUARD (load-bearing, do NOT regress):
 *   The fixture mechanism mirrors test-159-turn-start-wiring.cjs (REAL trace
 *   files + real room.db via openRoomDb) and test-158-reach-presentation-counter
 *   + test-158-reach-reject-only (REAL rows via navigation.logMemoryEvent /
 *   recordSelectorDecision via the live consumer). It does NOT use the 158
 *   roomState injection seam for the FIXTURE.
 *   test-158-reach-hard-suppress is used ONLY as the reference for a parole-safe
 *   presentation count (pres meets M=2 and is NOT on a P=5 boundary: 2 % 5 != 0),
 *   NEVER for its roomState injection style.
 *
 *   The roomState passed to computeReachPenalties MUST carry NO presentationsCount
 *   key and NO rejectCountInWindow key -- asserted explicitly -- so suppression is
 *   provably READ FROM THE DB, not the injection seam. Otherwise "reach absent"
 *   could pass for the wrong reason and the LIVE proof would be vacuous.
 *
 * Test 3 is the negative-control (RED-on-consumer-removal proof): the SAME
 * parameterized driver, run with the consumer OFF (consumer:false) -> 0 rejects
 * recorded -> computeReachPenalties reads 0 -> the reach is NOT suppressed ->
 * PRESENT in buildReachList. If the consumer were removed, Test 2 would flip to
 * the Test-3 (not-suppressed) outcome, going RED. The two tests share ONE driver
 * differing only in the consumer-on/off flag.
 *
 * Canon binding:
 *   Part 4: every dial reject becomes a typed graph row (the loop this closes).
 *   Part 8: the reject pick text rides the FIX-05 LOCAL sentence lane; the reader
 *           reads enums/scalars only (proven by the 158 SECRETREASON suites + the
 *           159 Part 8 sweep). This test asserts the BEHAVIOR (suppression), not
 *           a leak; the leak sweep is its own suite.
 *   Part 9: every read/write is through navigation.cjs / the closer modules / the
 *           shipped room-db opener. No direct better-sqlite3 / node:sqlite handle
 *           in the consumer path (the consumer opens via openRoomDbForCaller).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. NO RNG. NO live Brain.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER_ABS = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

// The frozen reach we drive (a frozen REACH_IDS member; never an edited const).
const REACH = 'deep_research';
// The dial verb the navigator picks (the command the F.1 card offered).
const SKILLX = 'mos:deep-research';
const FW = 'Deep Research';

// The penalty constants (READ from the shipped reader; never re-declared).
const N = reader.REJECT_SUPPRESS_THRESHOLD; // 3
const M = reader.MIN_PRESENTATIONS;         // 2
const P = reader.PAROLE_PERIOD;             // 5

// A presentation count that meets M but is NOT on a parole boundary (the
// test-158-reach-hard-suppress invariant, used ONLY for this parole-safety
// reference). pres=M=2: 2 >= M and 2 % P !== 0.
const PRES_SAFE = M;
assert.ok(PRES_SAFE >= M && PRES_SAFE % P !== 0,
  'fixture invariant: presentation count meets M and is not a parole turn');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function loadClassifier() {
  // The self-exec is guarded by require.main === module, so a require() loads the
  // module (and the exported turn-start helper) WITHOUT firing the hook.
  delete require.cache[CLASSIFIER_ABS];
  return require(CLASSIFIER_ABS);
}

// Seed the command + framework anchor nodes so the REJECTED cascade edge inside
// recordSelectorDecision succeeds (FK (source,target)->nodes(id); mirrors the
// 158 + 159-02 seedAnchorsFor idiom).
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p159-03-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

// The prior-turn f1_closer_payload EXACTLY as the producer persists it: a verbs
// array (command + Free-Text last), the per-verb reachIds map, and the generic
// framework handle (the 159-02 additive carry the consumer needs to write the
// decision edge). NOT the 158 injection seam -- this is the REAL persisted shape.
function payloadReachGrounded() {
  return {
    verbs: [SKILLX, 'Free-Text'],
    recommendedVerb: SKILLX,
    header: '[NEXT MOVE]',
    reachIds: { [SKILLX]: REACH },
    framework: FW,
  };
}

// Write the decision-trace FILE whose LAST entry carries the f1_closer_payload --
// the producer's persisted-to-disk shape the turn-start consumer reads back. This
// is the system's own bookkeeping file (NOT room data), mirroring
// test-159-turn-start-wiring.cjs makeRoom.
function writeTraceFile(dir, sessionId, payload) {
  const traceDir = path.join(dir, '.mindrian', 'decision-traces');
  fs.mkdirSync(traceDir, { recursive: true });
  const entry = { turn: 1, at: new Date().toISOString(), routing_source: 'engine' };
  if (payload) entry.f1_closer_payload = payload;
  fs.writeFileSync(
    path.join(traceDir, sessionId + '.json'),
    JSON.stringify({ version: 1, session_id: sessionId, traces: [entry] }, null, 2)
  );
}

// Count the f_selector_decision rows currently in room.db (read back through the
// navigation chokepoint -- never a direct handle).
function decisionRows(dir) {
  const db = openRoomDb(dir);
  try {
    return navigation.findRecentChanges(db, 0, { eventType: 'f_selector_decision', limit: 100 });
  } finally {
    closeRoomDb(db);
  }
}

// Emit ONE REAL reach_presented memory_event via the chokepoint (the SAME write
// the live engine arm performs). REAL rows -- NOT the injection seam.
function presentReachReal(dir, reach_id) {
  const db = openRoomDb(dir);
  try {
    const r = navigation.logMemoryEvent(db, 'reach_presented', {
      reach_id: reach_id,
      source_path: 'dial:presented:' + reach_id,
      created_by: 'system',
    });
    assert.ok(r && r.ok, 'logMemoryEvent(reach_presented) ok; got reason=' + (r && r.reason));
  } finally {
    closeRoomDb(db);
  }
}

// ===========================================================================
// THE SHARED PARAMETERIZED DRIVER (Test 2 and Test 3 differ ONLY in `consumer`).
// ===========================================================================
// Runs the full 2-turn loop `rejectTurns` times against a fresh real room.db.
//
//   consumer === true  : turn N+1 drives the REAL Wave-2 turn-start helper
//                        consumePriorF1Pick -> a REAL keyed reject row lands.
//   consumer === false : the consumer is BYPASSED (the negative-control); no
//                        reject row is recorded, so computeReachPenalties reads 0.
//
// In BOTH modes M REAL reach_presented rows are emitted (so the only variable is
// whether the rejects land). Returns the live db handle + the room dir so the
// caller runs computeReachPenalties + buildReachList over the SAME real db.
function runLoop(opts) {
  const o = opts || {};
  const consumerOn = o.consumer !== false;
  const rejectTurns = (typeof o.rejectTurns === 'number') ? o.rejectTurns : N;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-03-integration-'));
  const sessionId = 'sess159-03';

  // Real room.db + seeded anchors (so the decision edge resolves).
  {
    const db = openRoomDb(dir);
    seedAnchorsFor(db, SKILLX, FW);
    closeRoomDb(db);
  }

  const mod = consumerOn ? loadClassifier() : null;
  let recordedRejects = 0;

  for (let turn = 0; turn < rejectTurns; turn += 1) {
    // M REAL reach_presented rows per loop are overkill; emit exactly enough total
    // across the run so the final db carries >= M presentations. We emit one per
    // loop and one extra below so the total meets PRES_SAFE = M deterministically.
    // (Emitting inside the loop keeps the presentations REAL and chronologically
    // interleaved with the rejects, mirroring the live engine arm.)

    // turn N: persist the REAL f1_closer_payload to the decision-trace FILE.
    writeTraceFile(dir, sessionId, payloadReachGrounded());

    // turn N+1: drive the pick.
    if (consumerOn) {
      const res = mod.consumePriorF1Pick(dir, sessionId, {
        selectedOption: SKILLX,
        outcome: 'reject',
        text: 'no thanks, not now',
      });
      assert.ok(res && res.ok, 'consume turn ' + turn + ' ok; got reason=' + (res && res.reason));
      assert.strictEqual(res.outcome, 'reject', 'outcome must be reject (not coerced to accept)');
      assert.strictEqual(res.reach_id, REACH, 'reach_id must be the keyed frozen token');
      recordedRejects += 1;
    }
    // consumer OFF: the pick is dropped on the floor -- the negative-control.
  }

  // Emit M REAL reach_presented rows (the M-floor satisfied by REAL db rows, NOT
  // an injected presentationsCount). PRES_SAFE = M = 2, parole-safe (2 % 5 != 0).
  for (let i = 0; i < PRES_SAFE; i += 1) {
    presentReachReal(dir, REACH);
  }

  return { dir, sessionId, recordedRejects };
}

console.log('test-159-integration-2turn-suppress.cjs (DCW-09): producer->consumer->penalty LIVE suppression');

// ---------------------------------------------------------------------------
// Test 1 (one loop): the 2-turn loop lands EXACTLY ONE keyed reject row from the
// LIVE consumer (read back via the chokepoint). The producer->consumer wire fires.
// ---------------------------------------------------------------------------
check('one 2-turn loop lands EXACTLY one keyed f_selector_decision reject row (DCW-01)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-03-oneloop-'));
  const sessionId = 'sess159-03-one';
  {
    const db = openRoomDb(dir);
    seedAnchorsFor(db, SKILLX, FW);
    closeRoomDb(db);
  }
  const before = decisionRows(dir).length;

  const mod = loadClassifier();
  // turn N: persist the REAL payload.
  writeTraceFile(dir, sessionId, payloadReachGrounded());
  // turn N+1: feed the reject pick through the LIVE turn-start helper.
  const res = mod.consumePriorF1Pick(dir, sessionId, {
    selectedOption: SKILLX,
    outcome: 'reject',
    text: 'no thanks',
  });
  assert.ok(res && res.ok, 'consume ok; got reason=' + (res && res.reason));

  const rows = decisionRows(dir);
  assert.strictEqual(rows.length - before, 1, 'EXACTLY one f_selector_decision row');
  const props = rows[rows.length - 1].properties;
  assert.strictEqual(props.decision, 'reject', 'decision is reject, NOT coerced to accept');
  assert.strictEqual(props.reach_id, REACH, 'the row is keyed by the frozen reach_id');
  assert.strictEqual(props.edge_semantic, 'REJECTED', 'the reject cascade edge fired');
});

// ---------------------------------------------------------------------------
// Test 2 (3 REAL rejects -> SUPPRESSED, the headline DCW-09 gate): drive the loop
// 3 times through the LIVE consumer, satisfy the M-floor with REAL reach_presented
// rows, then run computeReachPenalties over the SAME real db (roomState WITHOUT any
// injected-counter key) and assert 'deep_research' is ABSENT from buildReachList.
// ---------------------------------------------------------------------------
check('3 REAL recorded rejects suppress the reach from buildReachList (DCW-09 live, from the DB)', () => {
  const { dir, recordedRejects } = runLoop({ consumer: true, rejectTurns: N });
  assert.strictEqual(recordedRejects, N, 'the LIVE consumer recorded exactly N rejects');

  // Sanity from the DB itself (read back via the chokepoint, NOT injected): the
  // db carries N real rejects of REACH and >= M real presentations of REACH.
  const db = openRoomDb(dir);
  try {
    // The roomState carries NO injected-counter keys -- the readers MUST read the
    // db. This is the MEDIUM-1 anti-vacuous guard, asserted explicitly below.
    const roomState = { reachScores: { [REACH]: 0.9 } };

    // MEDIUM-1: prove the suppression is READ FROM THE DB, not the injection seam.
    assert.ok(
      !Object.prototype.hasOwnProperty.call(roomState, 'presentationsCount'),
      'MEDIUM-1: roomState MUST NOT carry presentationsCount (suppression must read the db)'
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(roomState, 'rejectCountInWindow'),
      'MEDIUM-1: roomState MUST NOT carry rejectCountInWindow (suppression must read the db)'
    );

    // The readers read the REAL db rows (no seam): N rejects, M presentations.
    const realRejects = reader.rejectCountInWindow(db, REACH, roomState);
    const realPres = reader.presentationsCount(db, REACH, roomState);
    assert.strictEqual(realRejects, N, 'the db carries N=' + N + ' REAL rejects; got ' + realRejects);
    assert.ok(realPres >= M, 'the db carries >= M=' + M + ' REAL presentations; got ' + realPres);

    // computeReachPenalties reads the db (roomState seam-free) -> suppresses REACH.
    const pen = reader.computeReachPenalties(db, roomState);
    assert.ok(
      pen.suppressedReachIds.indexOf(REACH) !== -1,
      'computeReachPenalties must suppress the chronically-rejected reach FROM THE DB'
    );

    // Feed the suppressed set into the PURE buildReachList; assert REACH is GONE.
    const folded = Object.assign({}, roomState.reachScores, pen.discountedScores);
    const list = orchestrator.buildReachList({
      tierMode: 'mode_a',
      reachScores: folded,
      suppressedReachIds: pen.suppressedReachIds,
    });
    const present = list.reaches.some((r) => r.reach_id === REACH);
    assert.strictEqual(present, false, 'deep_research must be ABSENT from the rendered reaches (DCW-09)');
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 3 (RED-on-consumer-removal negative control): the SAME driver with the
// consumer OFF records 0 rejects -> computeReachPenalties reads 0 -> the reach is
// NOT suppressed -> PRESENT in buildReachList. Removing the consumer would flip
// Test 2 into THIS outcome, proving Test 2 is load-bearing, not incidental.
// ---------------------------------------------------------------------------
check('bypassing the consumer records 0 rejects -> reach NOT suppressed (RED-on-removal proof)', () => {
  const { dir, recordedRejects } = runLoop({ consumer: false, rejectTurns: N });
  assert.strictEqual(recordedRejects, 0, 'with the consumer OFF, zero rejects are recorded');

  const db = openRoomDb(dir);
  try {
    const roomState = { reachScores: { [REACH]: 0.9 } };
    // Same MEDIUM-1 discipline: no injected-counter keys.
    assert.ok(!Object.prototype.hasOwnProperty.call(roomState, 'presentationsCount'),
      'negative-control roomState carries no presentationsCount');
    assert.ok(!Object.prototype.hasOwnProperty.call(roomState, 'rejectCountInWindow'),
      'negative-control roomState carries no rejectCountInWindow');

    // The db has M real presentations but ZERO rejects (the consumer never ran).
    const realRejects = reader.rejectCountInWindow(db, REACH, roomState);
    assert.strictEqual(realRejects, 0, 'no consumer -> zero recorded rejects in the db; got ' + realRejects);

    const pen = reader.computeReachPenalties(db, roomState);
    assert.strictEqual(pen.suppressedReachIds.indexOf(REACH), -1,
      'with 0 rejects the reach must NOT be suppressed');

    const folded = Object.assign({}, roomState.reachScores, pen.discountedScores);
    const list = orchestrator.buildReachList({
      tierMode: 'mode_a',
      reachScores: folded,
      suppressedReachIds: pen.suppressedReachIds,
    });
    const present = list.reaches.some((r) => r.reach_id === REACH);
    assert.strictEqual(present, true,
      'without the consumer the reach stays PRESENT -- this is the outcome Test 2 would flip to if the consumer were removed (RED-on-removal)');
  } finally {
    closeRoomDb(db);
  }
});

console.log('');
console.log('PASS test-159-integration-2turn-suppress.cjs (' + passed + ' checks)');
process.exit(0);
