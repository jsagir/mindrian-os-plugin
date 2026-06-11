'use strict';
// Phase 150-08 -- CLAIM C3: "MindrianOS catches contradictions in your room."
// ========================================================================
// Falsifiable assertion: the fixture carries a CONTRADICTING PAIR -- DEC-PD-100
// (ship the scheduler) in problem-definition and DEC-MA-200 (never ship the
// scheduler) in market-analysis. Both decision nodes are REAL (projected through
// navigation.cjs by the reconcile spine). Minting a CONTRADICTS edge between them
// via the navigation writeEdge chokepoint lands a queryable edge in room.db.
//
// Honest-negative: writeEdge must REJECT a non-taxonomy edge type (the edge
// allow-list is real, not a pass-through) -- a contradiction can only be minted
// through the typed vocabulary.
//
// Drives the REAL navigation edge chokepoint on the real fixture; no mock of the
// unit under test. node:sqlite unavailable -> SKIP 77. NO em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

const HARNESS = require('./build-fixture-room-db.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP claim-c3.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C3: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C3: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c3.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

try {
  const db = built.db;
  // The reconcile DECISION_ID_RE extracts the canonical id token (the DEC- prefix
  // is stripped to the PD-100 / MA-200 handles), so the projected node ids are
  // decision:PD-100 / decision:MA-200.
  const decPd = navigation.DECISION_NODE_ID('PD-100');
  const decMa = navigation.DECISION_NODE_ID('MA-200');

  check('the contradicting pair are REAL decision nodes (projected via navigation.cjs)', function () {
    const a = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(decPd);
    const b = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(decMa);
    assert.ok(a, 'DEC-PD-100 decision node must exist in the projected cortex');
    assert.ok(b, 'DEC-MA-200 decision node must exist in the projected cortex');
    assert.equal(a.type, 'decision', 'DEC-PD-100 is a decision node');
    assert.equal(b.type, 'decision', 'DEC-MA-200 is a decision node');
  });

  check('minting a CONTRADICTS edge between them lands a queryable edge', function () {
    const res = navigation.writeEdge(db, {
      source_id: decPd,
      target_id: decMa,
      edge_type: 'CONTRADICTS',
      properties: { detected_by: 'claim-harness-c3', reason: 'ship vs never-ship the scheduler' },
    });
    assert.ok(res && res.ok, 'writeEdge(CONTRADICTS) must succeed, got: ' + JSON.stringify(res));
    const row = db.prepare(
      "SELECT source, target, type FROM edges WHERE source = ? AND target = ? AND type = 'CONTRADICTS'"
    ).get(decPd, decMa);
    assert.ok(row, 'the CONTRADICTS edge must be queryable in room.db');
    assert.equal(row.type, 'CONTRADICTS', 'the minted edge carries the CONTRADICTS type');
  });

  check('Phase 150.8: minting a REFINES edge on the fixture exercises the new closed-set member', function () {
    // The 150.8-02 amendment adds REFINES to the closed allow-list (navigator-
    // gated, D-150.8). Drive it through the SAME navigation.writeEdge chokepoint
    // on the REAL fixture: a refining claim TIGHTENS the prior decision without
    // invalidating it (valid_from rides the existing properties JSON, TV-01).
    const res = navigation.writeEdge(db, {
      source_id: decMa,
      target_id: decPd,
      edge_type: 'REFINES',
      properties: { reason: 'tightens_conditions', valid_from: '2026-06-11', valid_until: '' },
    });
    assert.ok(res && res.ok, 'writeEdge(REFINES) must succeed, got: ' + JSON.stringify(res));
    const row = db.prepare(
      "SELECT source, target, type, properties FROM edges WHERE source = ? AND target = ? AND type = 'REFINES'"
    ).get(decMa, decPd);
    assert.ok(row, 'the REFINES edge must be queryable in room.db');
    assert.equal(row.type, 'REFINES', 'the minted edge carries the REFINES type');
    const props = JSON.parse(row.properties);
    assert.equal(props.valid_from, '2026-06-11', 'valid_from (TV-01) rides the edge properties JSON');
  });

  check('honest-negative: writeEdge REJECTS a non-taxonomy edge type (the allow-list is real)', function () {
    const res = navigation.writeEdge(db, {
      source_id: decPd,
      target_id: decMa,
      edge_type: 'TOTALLY_MADE_UP_EDGE',
      properties: {},
    });
    assert.ok(res && res.ok === false, 'a non-taxonomy edge type must be rejected');
    assert.equal(res.reason, 'invalid_edge_type', 'rejection reason names the allow-list gate');
    const ghost = db.prepare(
      "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'TOTALLY_MADE_UP_EDGE'"
    ).get(decPd, decMa);
    assert.equal(ghost, undefined, 'no row may be written for a rejected edge type');
  });
} finally {
  built.cleanup && built.cleanup();
}

if (failures > 0) {
  process.stdout.write('\nclaim-c3.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\nclaim-c3.cjs: C3 GREEN (contradiction edge minted + queryable)\n');
process.exit(0);
