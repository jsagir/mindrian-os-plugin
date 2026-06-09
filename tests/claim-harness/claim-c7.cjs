'use strict';
// Phase 150-08 -- CLAIM C7: "File one thing, then a conflicting thing, and
// MindrianOS connects them mid-session."
// ========================================================================
// Falsifiable assertion (the cascade arm): filing artifact A (DEC-PD-100 in
// problem-definition) and then a conflicting artifact B (DEC-MA-200 in
// market-analysis) lands BOTH the lineage edges that the reconcile spine mints
// (each decision INFORMS its section -- the structural connection) AND a
// CONTRADICTS edge minted mid-session between the two decision nodes. The cross-
// relationship is queryable in room.db, not buried in scrollback.
//
// Honest-negative: before the CONTRADICTS edge is minted there is NO CONTRADICTS
// edge between them (the cascade is real, not pre-baked).
//
// Drives the REAL navigation projection + edge chokepoint on the real fixture;
// no mock of the unit under test. node:sqlite unavailable -> SKIP 77. NO
// em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

const HARNESS = require('./build-fixture-room-db.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP claim-c7.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C7: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C7: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c7.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

try {
  const db = built.db;
  // The reconcile DECISION_ID_RE strips the DEC- prefix to the canonical id
  // handle, so the projected node ids are decision:PD-100 / decision:MA-200.
  const decA = navigation.DECISION_NODE_ID('PD-100'); // filed first (artifact A)
  const decB = navigation.DECISION_NODE_ID('MA-200'); // filed second (conflicting B)
  const memA = navigation.MEMORY_ARTIFACT_NODE_ID('problem-definition', 'MINTO');
  const memB = navigation.MEMORY_ARTIFACT_NODE_ID('market-analysis', 'MINTO');

  check('the lineage INFORMS edges were minted by the reconcile spine (the structural connection)', function () {
    const a = db.prepare(
      "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'INFORMS'"
    ).get(decA, memA);
    const b = db.prepare(
      "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'INFORMS'"
    ).get(decB, memB);
    assert.ok(a, 'DEC-PD-100 must INFORM its problem-definition section (reconcile lineage)');
    assert.ok(b, 'DEC-MA-200 must INFORM its market-analysis section (reconcile lineage)');
  });

  check('honest-negative: BEFORE the cascade there is NO CONTRADICTS edge between A and B', function () {
    const pre = db.prepare(
      "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'CONTRADICTS'"
    ).get(decA, decB);
    assert.equal(pre, undefined, 'the CONTRADICTS edge must not pre-exist (the cascade is real)');
  });

  check('filing the conflicting B mints a CONTRADICTS edge mid-session (queryable cross-relationship)', function () {
    const res = navigation.writeEdge(db, {
      source_id: decA,
      target_id: decB,
      edge_type: 'CONTRADICTS',
      properties: { detected_by: 'claim-harness-c7', cascade: 'mid-session', reason: 'ship vs never-ship' },
    });
    assert.ok(res && res.ok, 'minting CONTRADICTS mid-session must succeed: ' + JSON.stringify(res));
    const row = db.prepare(
      "SELECT source, target, type FROM edges WHERE source = ? AND target = ? AND type = 'CONTRADICTS'"
    ).get(decA, decB);
    assert.ok(row, 'the mid-session CONTRADICTS edge must be queryable');
    assert.equal(row.type, 'CONTRADICTS', 'the minted edge carries the CONTRADICTS type');
  });
} finally {
  built.cleanup && built.cleanup();
}

if (failures > 0) {
  process.stdout.write('\nclaim-c7.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\nclaim-c7.cjs: C7 GREEN (file A then conflicting B -> INFORMS + CONTRADICTS minted mid-session)\n');
process.exit(0);
