'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-02 Task 1 -- the turn-start consumer attachment suite
 * (DCW-01 / DCW-04 / DCW-06 / DCW-08).
 * ==============================================================================
 * Wave 1 shipped the shared-core consumer (lib/workflow/f1-pick-consumer.cjs
 * ::consumeF1Pick) and the CLI capture adapter
 * (lib/hmi/f1-pick-capture-cli.cjs::captureCliPick). NOTHING reads the persisted
 * f1_closer_payload back at turn start, so the dial loop still does not record in
 * production. This wave attaches the consumer at TURN START in
 * scripts/intent-classifier.cjs and exports a small helper so the wiring can be
 * driven WITHOUT spawning the whole hook.
 *
 * The helper under test (added to scripts/intent-classifier.cjs module.exports):
 *
 *   consumePriorF1Pick(roomDir, sessionId, currentTurnText)
 *     -> { ok, recorded?, reason?, outcome?, reach_id? }
 *
 * It (1) reads the PRIOR turn's persisted f1_closer_payload from the decision-trace
 * file (path.join(roomDir,'.mindrian','decision-traces',sessionId+'.json'); LAST
 * entry's f1_closer_payload -- the SAME file appendTraceTurnNumber reads; this is
 * the system's own bookkeeping file, NOT room data, so the fs read is Part 9 legal),
 * (2) no-ops immediately when no f1_closer_payload exists (byte-unchanged on non-dial
 * turns, DCW-04), (3) captures the pick from currentTurnText via captureCliPick,
 * opens a caller-owned room.db via navigation.openRoomDbForCaller, calls consumeF1Pick,
 * and ALWAYS closes the handle via navigation.closeRoomDbForCaller in a finally
 * (Part 9, no leak), all wrapped best-effort (a fault is a no-op, never a throw).
 *
 * Four behaviors (159-02-PLAN Task 1 <behavior>):
 *   Test 1 (turn-start read records): a prior trace whose last entry carries an
 *           f1_closer_payload with reachIds {SkillX:'deep_research'} + a current
 *           turn whose pick resolves to SkillX/reject writes EXACTLY ONE keyed
 *           f_selector_decision reject row to room.db.
 *   Test 2 (non-dial byte-unchanged): a prior trace with NO f1_closer_payload (and
 *           no prior trace at all) -> zero rows, structured no-op, no throw (DCW-04).
 *   Test 3 (missing room.db no-op): no room.db present -> no-op, raises nothing,
 *           handle never leaked (DCW-04).
 *   Test 4 (Part 9 source assertion): the new turn-start block opens/closes room.db
 *           ONLY via navigation.openRoomDbForCaller / closeRoomDbForCaller; no direct
 *           better-sqlite3 / node:sqlite open in the consumer attachment (DCW-06).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
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

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function loadClassifier() {
  // Require-safe load: the self-exec is guarded by require.main === module, so a
  // require() from this test loads the module without firing the hook.
  delete require.cache[CLASSIFIER_ABS];
  return require(CLASSIFIER_ABS);
}

const SKILLX = 'mos:deep-research';
const FW = 'Deep Research';

// Make a temp room with a seeded room.db (so the chokepoint open succeeds) and a
// decision-trace file whose LAST entry carries the given f1_closer_payload.
function makeRoom(opts) {
  const o = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-02-turn-start-'));
  const sessionId = 'sess159-02';

  // room.db (unless the test wants it absent).
  if (o.withDb !== false) {
    const db = openRoomDb(dir);
    seedAnchorsFor(db, SKILLX, FW);
    closeRoomDb(db);
  }

  // The decision-trace file: a prior turn entry, optionally carrying the payload.
  const traceDir = path.join(dir, '.mindrian', 'decision-traces');
  fs.mkdirSync(traceDir, { recursive: true });
  const traces = [];
  if (o.withTrace !== false) {
    const entry = { turn: 1, at: new Date().toISOString(), routing_source: 'engine' };
    if (o.payload) entry.f1_closer_payload = o.payload;
    traces.push(entry);
  }
  if (o.withTrace !== false) {
    fs.writeFileSync(
      path.join(traceDir, sessionId + '.json'),
      JSON.stringify({ version: 1, session_id: sessionId, traces: traces }, null, 2)
    );
  }
  return { dir, sessionId };
}

function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p159-02-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

function decisionRows(dir) {
  const db = openRoomDb(dir);
  try {
    return navigation.findRecentChanges(db, 0, { eventType: 'f_selector_decision', limit: 50 });
  } finally {
    closeRoomDb(db);
  }
}

// A prior-turn f1_closer_payload exactly as offer-closer.cjs::buildF1Payload
// persists it: verbs array (command + Free-Text last), the per-verb reachIds map.
function payloadReachGrounded() {
  return {
    verbs: [SKILLX, 'Free-Text'],
    recommendedVerb: SKILLX,
    header: '[NEXT MOVE]',
    reachIds: { [SKILLX]: 'deep_research' },
  };
}

console.log('test-159-turn-start-wiring.cjs (DCW-01/04/06/08): turn-start consumer attachment');

// ---------------------------------------------------------------------------
// The helper must be exported (the wiring is driveable without spawning the hook).
// ---------------------------------------------------------------------------
check('intent-classifier exports consumePriorF1Pick (turn-start helper)', () => {
  const mod = loadClassifier();
  assert.ok(mod && typeof mod === 'object', 'classifier must export an object');
  assert.strictEqual(typeof mod.consumePriorF1Pick, 'function',
    'classifier must export consumePriorF1Pick(roomDir, sessionId, currentTurnText)');
  // The Wave-1 render helper export must still be present (no regression).
  assert.strictEqual(typeof mod.renderEngineDecisionWithDial, 'function',
    'renderEngineDecisionWithDial export preserved');
});

// ---------------------------------------------------------------------------
// Test 1 (turn-start read records): prior payload reach-grounded + a reject pick
// over the current turn text writes EXACTLY ONE keyed reject row.
// ---------------------------------------------------------------------------
check('turn-start read of a prior reach-grounded payload + reject pick writes ONE keyed reject row (DCW-01)', () => {
  const mod = loadClassifier();
  const { dir, sessionId } = makeRoom({ payload: payloadReachGrounded() });
  const before = decisionRows(dir).length;

  // The current turn: the navigator picks the SkillX verb to REJECT. The turn text
  // names the selected verb; the reject outcome is signalled.
  const res = mod.consumePriorF1Pick(dir, sessionId, {
    selectedOption: SKILLX,
    outcome: 'reject',
    text: 'no thanks, not now',
  });

  assert.ok(res && res.ok, 'turn-start consume ok; got reason=' + (res && res.reason));
  assert.strictEqual(res.outcome, 'reject', 'resolved outcome must be reject');
  assert.strictEqual(res.reach_id, 'deep_research', 'resolved reach_id must be deep_research');

  const rows = decisionRows(dir);
  assert.strictEqual(rows.length - before, 1, 'EXACTLY one f_selector_decision row');
  const props = rows[rows.length - 1].properties;
  assert.strictEqual(props.decision, 'reject', 'decision must be reject, NOT coerced to accept');
  assert.strictEqual(props.reach_id, 'deep_research', 'reach_id must be the keyed frozen token');
  assert.strictEqual(props.edge_semantic, 'REJECTED');
});

// ---------------------------------------------------------------------------
// Test 2 (non-dial byte-unchanged): no f1_closer_payload (and no prior trace)
// -> zero rows, structured no-op, no throw (DCW-04, the byte-unchanged invariant).
// ---------------------------------------------------------------------------
check('no prior f1_closer_payload -> zero rows, structured no-op, no throw (DCW-04 byte-unchanged)', () => {
  const mod = loadClassifier();

  // 2a: a prior trace entry that carries NO f1_closer_payload.
  {
    const { dir, sessionId } = makeRoom({ /* no payload */ });
    const before = decisionRows(dir).length;
    let res;
    assert.doesNotThrow(() => {
      res = mod.consumePriorF1Pick(dir, sessionId, { selectedOption: SKILLX, outcome: 'reject' });
    });
    assert.ok(res && res.ok === false, 'non-dial turn returns a no-op (ok:false)');
    assert.strictEqual(res.reason, 'no_prior_payload', 'reason names the absent payload');
    assert.strictEqual(decisionRows(dir).length - before, 0, 'zero rows written');
  }

  // 2b: NO prior trace file at all (the very first turn) -> same clean no-op.
  {
    const { dir, sessionId } = makeRoom({ withTrace: false });
    const before = decisionRows(dir).length;
    let res;
    assert.doesNotThrow(() => {
      res = mod.consumePriorF1Pick(dir, sessionId, { selectedOption: SKILLX, outcome: 'reject' });
    });
    assert.ok(res && res.ok === false, 'first-turn returns a no-op (ok:false)');
    assert.strictEqual(res.reason, 'no_prior_payload', 'reason names the absent payload');
    assert.strictEqual(decisionRows(dir).length - before, 0, 'zero rows written');
  }
});

// ---------------------------------------------------------------------------
// Test 3 (missing room.db no-op): prior payload present but no room.db -> no-op,
// raises nothing, handle never leaked (DCW-04).
// ---------------------------------------------------------------------------
check('prior payload present but room.db absent -> no-op, no throw (DCW-04)', () => {
  const mod = loadClassifier();
  const { dir, sessionId } = makeRoom({ payload: payloadReachGrounded(), withDb: false });
  let res;
  assert.doesNotThrow(() => {
    res = mod.consumePriorF1Pick(dir, sessionId, { selectedOption: SKILLX, outcome: 'reject' });
  });
  assert.ok(res && res.ok === false, 'absent db returns a no-op (ok:false)');
  assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'a reason is surfaced');
  // No room.db was created as a side effect (the helper opens only via the
  // chokepoint, which returns null when room.db is absent).
  assert.ok(!fs.existsSync(path.join(dir, '.mindrian', 'room.db')), 'no room.db created as a side effect');
});

// ---------------------------------------------------------------------------
// Test 4 (Part 9 / DCW-06): source-level assertion -- the new turn-start block
// opens/closes room.db ONLY via the navigation chokepoint; no direct sqlite open.
// ---------------------------------------------------------------------------
check('Part 9: the turn-start consumer block opens room.db ONLY via the navigation chokepoint (DCW-06)', () => {
  const src = fs.readFileSync(CLASSIFIER_ABS, 'utf8');
  // Isolate the consumePriorF1Pick helper body for the assertion.
  const start = src.indexOf('function consumePriorF1Pick');
  assert.ok(start !== -1, 'consumePriorF1Pick must be defined in intent-classifier.cjs');
  // Take a generous window from the function start (the helper is small).
  const window = src.slice(start, start + 4000);
  // The helper must reference the navigation chokepoint open + close.
  assert.ok(/openRoomDbForCaller/.test(window), 'helper opens room.db via openRoomDbForCaller');
  assert.ok(/closeRoomDbForCaller/.test(window), 'helper closes room.db via closeRoomDbForCaller');
  assert.ok(/finally/.test(window), 'helper closes the handle in a finally (no leak)');
  // No direct sqlite open inside the helper.
  const code = window
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  assert.ok(!/better-sqlite3/.test(code), 'no better-sqlite3 require in the helper');
  assert.ok(!/node:sqlite/.test(code), 'no node:sqlite require in the helper');
  assert.ok(!/require\(\s*['"][^'"]*room-db/.test(code), 'no direct room-db open in the helper');
});

console.log('');
console.log('PASS test-159-turn-start-wiring.cjs (' + passed + ' checks)');
process.exit(0);
