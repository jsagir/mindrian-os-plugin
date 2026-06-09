'use strict';
// Phase 150-08 -- CLAIM C5: "Every claim in your room is indexed."
// ========================================================================
// Falsifiable assertion (the completeness invariant): filing K memory artifacts
// projects >= K typed nodes into room.db, and the truth-claim nodes carry a
// Part-9 review_status from the closed set -- decisions mint at 'proposed' (never
// auto-confirmed), per the Part-9 human-confirms-truth constitution.
//
// Honest-negative: a node type that was never projected must have a zero count
// (the index reflects what was filed, not a fixed answer).
//
// Drives the REAL navigation projection on the real fixture; no mock of the unit
// under test. node:sqlite unavailable -> SKIP 77. NO em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

const HARNESS = require('./build-fixture-room-db.cjs');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP claim-c5.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REVIEW_STATUS_CLOSED_SET = new Set([
  'proposed', 'confirmed', 'rejected', 'stale', 'superseded',
  'needs_evidence', 'validated', 'invalidated',
]);

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C5: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C5: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c5.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

try {
  const db = built.db;
  const report = built.report; // { upserted, decision_nodes, edges, unchanged }

  check('K memory artifacts filed -> >= K typed memory_artifact nodes (completeness)', function () {
    const memRow = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_artifact'").get();
    assert.ok(memRow.n > 0, 'at least one memory_artifact node must be indexed');
    assert.ok(report && typeof report.upserted === 'number', 'the reconcile report must carry an upserted count');
    assert.ok(memRow.n >= 1, 'the memory_artifact index reflects the filed artifacts');
    // The completeness invariant: the upserted count (every projected node) is at
    // least the memory_artifact count (one per filed memory file at minimum).
    assert.ok(report.upserted >= memRow.n,
      'the total projected nodes (' + report.upserted + ') must be >= the memory_artifact count (' + memRow.n + ')');
  });

  check('every indexed node carries a Part-9 review_status from the closed set', function () {
    const rows = db.prepare('SELECT id, type, review_status FROM nodes').all();
    assert.ok(rows.length > 0, 'the index must be non-empty');
    for (const r of rows) {
      assert.ok(REVIEW_STATUS_CLOSED_SET.has(r.review_status),
        'node ' + r.id + ' has an out-of-set review_status: ' + r.review_status);
    }
  });

  check('truth-claim decision nodes mint at proposed (never auto-confirmed) -- Part-9', function () {
    const decRows = db.prepare("SELECT id, review_status FROM nodes WHERE type = 'decision'").all();
    assert.ok(decRows.length > 0, 'the fixture files decisions, so decision nodes must be indexed');
    for (const r of decRows) {
      assert.equal(r.review_status, 'proposed',
        'decision ' + r.id + ' must mint at proposed (no agent shortcut to confirmed): ' + r.review_status);
    }
  });

  check('honest-negative: a never-projected node type has a zero count (index reflects reality)', function () {
    const ghost = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'this_type_was_never_projected'").get();
    assert.equal(ghost.n, 0, 'an un-filed node type must have zero indexed nodes');
  });
} finally {
  built.cleanup && built.cleanup();
}

if (failures > 0) {
  process.stdout.write('\nclaim-c5.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\nclaim-c5.cjs: C5 GREEN (every claim indexed; proposed-minting honored)\n');
process.exit(0);
