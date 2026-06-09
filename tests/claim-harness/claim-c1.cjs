'use strict';
// Phase 150-08 -- CLAIM C1: "MindrianOS picks up where you left off."
// ========================================================================
// Falsifiable assertion: the focus node written in one session has a STABLE
// GRAPH IDENTITY that the next session reads back by node id -- not a string
// re-match, not a re-derivation. We build the fixture room.db (session 1, via
// navigation.cjs), capture a real cortex node id, close the db, RE-OPEN the same
// dbPath (session 2), and assert the same node id resolves to the same node with
// the same type. Graph identity == continuity.
//
// Honest-negative arm: a node id that was NEVER written must NOT resolve from
// the re-opened db (the read is real, not a fixture that answers anything).
//
// Drives a REAL shipped unit (the navigation-projected room.db) on the real
// fixture; no mock of the unit under test. node:sqlite unavailable -> SKIP 77.
// NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const HARNESS = require('./build-fixture-room-db.cjs');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP claim-c1.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C1: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C1: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c1.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

try {
  // SESSION 1: capture a real persisted cortex node id (a governing_thought is
  // the section anchor -- the kind of node a focus would point at).
  const session1 = built.db.prepare(
    "SELECT id, type FROM nodes WHERE type = 'governing_thought' ORDER BY id LIMIT 1"
  ).get();

  check('session 1 wrote a real governing_thought anchor node (graph identity exists)', function () {
    assert.ok(session1 && typeof session1.id === 'string' && session1.id.length > 0,
      'a governing_thought node must exist in the projected cortex');
    assert.equal(session1.type, 'governing_thought', 'the anchor node carries its type');
  });

  // Close session 1's handle; the db is on disk at built.dbPath.
  built.db.close();

  // SESSION 2: re-open the SAME dbPath (a fresh session) and read the node back
  // by its id. Graph identity, not string-match.
  const session2 = new DatabaseSync(built.dbPath);
  try {
    check('session 2 reads the SAME focus node id back (continuity by graph identity)', function () {
      const row = session2.prepare('SELECT id, type FROM nodes WHERE id = ?').get(session1.id);
      assert.ok(row, 'the prior session focus node id must resolve in the re-opened db');
      assert.equal(row.id, session1.id, 'the node id is byte-identical across sessions');
      assert.equal(row.type, session1.type, 'the node type is preserved across sessions');
    });

    // Honest-negative: a never-written id does NOT resolve (the read is real).
    check('honest-negative: a node id never written does not resolve (the read is real)', function () {
      const ghost = session2.prepare('SELECT id FROM nodes WHERE id = ?')
        .get('governing_thought:this-section-was-never-written');
      assert.equal(ghost, undefined, 'a never-written node id must NOT resolve from the db');
    });
  } finally {
    session2.close();
  }
} finally {
  built.cleanup && built.cleanup();
}

if (failures > 0) {
  process.stdout.write('\nclaim-c1.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\nclaim-c1.cjs: C1 GREEN (picks up where you left off)\n');
process.exit(0);
