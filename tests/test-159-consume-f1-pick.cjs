'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-01 Task 2 -- consumeF1Pick shared-core consumer suite
 * (DCW-01 / DCW-03 / DCW-04 / DCW-06).
 * ==============================================================================
 * Proves the turn-N+1 consumer that reads a prior f1_closer_payload, matches the
 * navigator's pick to a verb deterministically, resolves {verb, outcome,
 * reach_id}, and delegates persistence to closeOffer over a caller-owned
 * roomState.db. Mirrors the test-158 / offer-closer.test temp-room.db fixture
 * (opened through the shipped room-db / navigation chokepoint).
 *
 * Six behaviors (159-01-PLAN Task 2 <behavior>):
 *   Test 1 (reject keyed -- MEDIUM-2 load-bearing): a reject pick over a real db
 *           writes EXACTLY ONE f_selector_decision row with reach_id='deep_research'
 *           AND decision === 'reject' (NOT coerced to 'accept').
 *   Test 2 (accept / defer / Free-Text): each routes correctly.
 *   Test 3 (no prior payload no-op): structured no-op, zero rows, no throw.
 *   Test 4 (unmatched pick no-op): no-op, zero rows, no throw.
 *   Test 5 (absent db no-op): closeOffer invalid_db surfaced, zero rows, no throw.
 *   Test 6 (Part 9): source-level assertion -- no direct better-sqlite3 /
 *           node:sqlite require, no fs read of room data.
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
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { consumeF1Pick } = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f1-pick-consumer.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-01-consume-f1-pick-'));
  return { db: openRoomDb(dir), dir };
}

function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p159-01-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

function decisionRows(db) {
  return navigation.findRecentChanges(db, 0, {
    eventType: 'f_selector_decision',
    limit: 50,
  });
}
function missRows(db) {
  return navigation.findRecentChanges(db, 0, {
    eventType: 'f_selector_miss',
    limit: 50,
  });
}

const SKILLX = 'mos:deep-research';
const FW = 'Deep Research';

// A prior-turn f1_closer_payload exactly as offer-closer.cjs::buildF1Payload
// persists it: verbs array (command + Free-Text last), the per-verb reachIds map.
function priorPayloadReachGrounded() {
  return {
    verbs: [SKILLX, 'Free-Text'],
    recommendedVerb: SKILLX,
    header: '[NEXT MOVE]',
    reachIds: { [SKILLX]: 'deep_research' },
  };
}

console.log('test-159-consume-f1-pick.cjs (DCW-01/03/04/06): consumeF1Pick shared-core consumer');

// ---------------------------------------------------------------------------
// Test 1 (MEDIUM-2 load-bearing): a reach-grounded reject pick records ONE
// keyed reject row, decision NOT coerced to accept.
// ---------------------------------------------------------------------------
check('reject pick for a reach-grounded verb writes ONE row with decision=reject AND reach_id=deep_research (MEDIUM-2)', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, SKILLX, FW);
  const before = decisionRows(db).length;
  const res = consumeF1Pick({
    priorPayload: priorPayloadReachGrounded(),
    pick: { verb: SKILLX, outcome: 'reject' },
    roomState: { db, offer: { framework: FW } },
  });
  assert.ok(res && res.ok, 'consume ok; got reason=' + (res && res.reason));
  assert.strictEqual(res.outcome, 'reject', 'resolved outcome must be reject');
  assert.strictEqual(res.reach_id, 'deep_research', 'resolved reach_id must be deep_research');
  const rows = decisionRows(db);
  assert.strictEqual(rows.length - before, 1, 'EXACTLY one f_selector_decision row');
  const props = rows[0].properties;
  // The MEDIUM-2 guard: the verb must NOT be passed as {pick} (that falls through
  // to accept). decision MUST be reject, reach_id MUST be keyed.
  assert.strictEqual(props.decision, 'reject', 'decision must be reject, NOT coerced to accept');
  assert.strictEqual(props.reach_id, 'deep_research', 'reach_id must be the keyed frozen token');
  assert.strictEqual(props.edge_semantic, 'REJECTED');
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 2: accept / defer route to recordSelectorDecision (defer) and the
// node-less accept signals offer_acted; Free-Text routes to recordSelectorMiss.
// ---------------------------------------------------------------------------
check('accept / defer / Free-Text each route to the correct outcome (DCW-03)', () => {
  // defer -> a decision row with decision=defer
  {
    const { db } = freshDb();
    seedAnchorsFor(db, SKILLX, FW);
    const res = consumeF1Pick({
      priorPayload: priorPayloadReachGrounded(),
      pick: { verb: SKILLX, outcome: 'defer' },
      roomState: { db, offer: { framework: FW } },
    });
    assert.ok(res && res.ok, 'defer consume ok; got ' + (res && res.reason));
    const rows = decisionRows(db);
    assert.strictEqual(rows.length, 1, 'defer writes one decision row');
    assert.strictEqual(rows[0].properties.decision, 'defer', 'decision must be defer');
    assert.strictEqual(rows[0].properties.reach_id, 'deep_research', 'defer row is keyed too');
    closeRoomDb(db);
  }
  // accept (node-less) -> closeOffer returns offer_acted; no decision row written
  {
    const { db } = freshDb();
    seedAnchorsFor(db, SKILLX, FW);
    const res = consumeF1Pick({
      priorPayload: priorPayloadReachGrounded(),
      pick: { verb: SKILLX, outcome: 'accept' },
      roomState: { db, offer: { framework: FW } },
    });
    assert.ok(res && res.ok, 'accept consume ok; got ' + (res && res.reason));
    assert.strictEqual(res.outcome, 'accept', 'resolved outcome must be accept');
    // The node-less accept does not write a decision edge (closeOffer offer_acted).
    assert.strictEqual(decisionRows(db).length, 0, 'node-less accept writes no decision edge');
    closeRoomDb(db);
  }
  // Free-Text -> recordSelectorMiss (a memory_event, no decision edge)
  {
    const { db } = freshDb();
    seedAnchorsFor(db, SKILLX, FW);
    const res = consumeF1Pick({
      priorPayload: priorPayloadReachGrounded(),
      pick: { verb: 'Free-Text', outcome: 'Free-Text' },
      roomState: { db, offer: { framework: FW } },
    });
    assert.ok(res && res.ok, 'Free-Text consume ok; got ' + (res && res.reason));
    assert.strictEqual(res.outcome, 'Free-Text', 'resolved outcome must be Free-Text');
    assert.strictEqual(decisionRows(db).length, 0, 'Free-Text writes no decision edge');
    assert.strictEqual(missRows(db).length, 1, 'Free-Text writes exactly one miss event');
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 3 (no prior payload no-op): structured no-op, zero rows, no throw.
// ---------------------------------------------------------------------------
check('no prior payload -> structured no-op, zero rows, no throw (DCW-04)', () => {
  const { db } = freshDb();
  const before = decisionRows(db).length;
  let res;
  assert.doesNotThrow(() => {
    res = consumeF1Pick({ priorPayload: null, pick: { verb: SKILLX, outcome: 'reject' }, roomState: { db } });
  });
  assert.ok(res && res.ok === false, 'cold turn returns a no-op (ok:false)');
  assert.strictEqual(res.reason, 'no_prior_payload', 'reason names the cold turn');
  assert.strictEqual(decisionRows(db).length - before, 0, 'zero rows written');
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 4 (unmatched pick no-op): a pick matching no verb -> no-op, zero rows.
// ---------------------------------------------------------------------------
check('unmatched pick -> no-op, zero rows, no throw (DCW-04)', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, SKILLX, FW);
  const before = decisionRows(db).length;
  let res;
  assert.doesNotThrow(() => {
    res = consumeF1Pick({
      priorPayload: priorPayloadReachGrounded(),
      pick: { verb: 'mos:does-not-exist', outcome: 'reject' },
      roomState: { db, offer: { framework: FW } },
    });
  });
  assert.ok(res && res.ok === false, 'unmatched pick returns a no-op');
  assert.strictEqual(res.reason, 'unmatched', 'reason names the unmatched pick');
  assert.strictEqual(decisionRows(db).length - before, 0, 'zero rows written');
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 5 (absent db no-op): roomState.db absent -> no-op surfaced, zero rows.
// ---------------------------------------------------------------------------
check('absent roomState.db -> no-op surfaced from closeOffer invalid_db, no throw (DCW-04)', () => {
  let res;
  assert.doesNotThrow(() => {
    res = consumeF1Pick({
      priorPayload: priorPayloadReachGrounded(),
      pick: { verb: SKILLX, outcome: 'reject' },
      roomState: {},
    });
  });
  assert.ok(res && res.ok === false, 'absent db returns a no-op (ok:false)');
  // The no-op surfaces the downstream invalid_db reason (or a guard reason).
  assert.ok(typeof res.reason === 'string' && res.reason.length > 0, 'a reason is surfaced');
});

// ---------------------------------------------------------------------------
// Test 6 (Part 9 / DCW-06): source-level assertion -- no direct db / fs read.
// ---------------------------------------------------------------------------
check('Part 9: f1-pick-consumer.cjs has no direct better-sqlite3 / node:sqlite / fs read of room data (DCW-06)', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'lib', 'workflow', 'f1-pick-consumer.cjs'),
    'utf8'
  );
  // Strip block + line comments so header prose never self-invalidates the gate.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  assert.ok(!/better-sqlite3/.test(code), 'no better-sqlite3 require');
  assert.ok(!/node:sqlite/.test(code), 'no node:sqlite require');
  assert.ok(!/require\(\s*['"][^'"]*room-db/.test(code), 'no direct room-db open');
  assert.ok(!/fs\.(readFileSync|readFile|createReadStream|openSync)\b/.test(code),
    'no fs read of room data');
});

console.log('');
console.log('PASS test-159-consume-f1-pick.cjs (' + passed + ' checks)');
process.exit(0);
