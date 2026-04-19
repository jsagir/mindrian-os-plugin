#!/usr/bin/env node
'use strict';

/**
 * Plan 87-06 Test: indexArtifact transaction wrap + lock-release semantics
 * ========================================================================
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * Closes CASCADE-04. Proves three independent invariants of the indexArtifact
 * flow (lib/core/graph-ops.cjs -> lib/core/lazygraph-ops.cjs):
 *
 *   1. Happy path: filing a single artifact produces the expected Artifact
 *      and Section nodes, and the outer enqueueWrite lock is released on
 *      success (write.lock file absent after call).
 *
 *   2. Mid-transaction rollback (R-87-06-ROLLBACK): when an error is
 *      injected INSIDE the BEGIN/COMMIT boundary (after the first INSERT has
 *      fired but before COMMIT), SQLite must roll back the partial writes.
 *      We assert countAfter === countBefore on the Artifact node count;
 *      if the rollback did not fire, the first INSERT would persist and
 *      the assertion would fail.
 *
 *   3. Lock release after commit (testLockReleaseAfterCommit): a DIFFERENT
 *      failure mode -- the caller's fn inside enqueueWrite throws OUTSIDE
 *      the SQLite transaction (here: fs.readFileSync on a nonexistent
 *      path). The outer try/finally in enqueueWrite must still release the
 *      write-lock. This tests the lock-release semantic, not the txn
 *      rollback semantic; both matter, both are tested separately.
 *
 *   4. Rollback does not leak the lock (testRollbackDoesNotLeakLock): a
 *      throw INSIDE the transaction (same injection strategy as Test 2)
 *      must still release the enqueueWrite write-lock. This combines the
 *      two concerns: ROLLBACK happens AND the outer finally fires.
 *      Distinct from Test 3 because Test 3 throws BEFORE the txn even
 *      starts; this one throws WITH an active BEGIN/COMMIT block that
 *      must be rolled back.
 *
 * Why three failure tests (2, 3, 4 are distinct):
 *   - Test 2 exercises the BEGIN/COMMIT/ROLLBACK inside indexArtifact.
 *   - Test 3 exercises the acquireLock/releaseLock finally when no txn
 *     was ever opened.
 *   - Test 4 exercises BOTH: txn rolls back AND lock releases.
 *   Either one failing silently would leave a different kind of breakage in
 *   prod. Bundling them into one test would mask which guarantee regressed.
 *
 * Exit codes:
 *   0 -- all tests passed
 *   1 -- any test failed (real regression)
 *
 * Business Source License 1.1 -- see repository LICENSE.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const lazygraph = require('../core/lazygraph-ops.cjs');
const graphOps = require('../core/graph-ops.cjs');

const FIXTURE = path.resolve(__dirname, '../../test/fixtures/cascade-e2e/seed-room');

// ----------------------------------------------------------------------------
// Test 1: Happy path -- indexArtifact via graph-ops wrapper (lock + txn OK)
// ----------------------------------------------------------------------------

async function testHappyPath(tmpRoom, dbPath, goodFile, mindrian) {
  const res = await graphOps.indexArtifact(tmpRoom, goodFile);
  assert.strictEqual(res.success, true, 'happy path must return success');

  const db1 = new DatabaseSync(dbPath, { readOnly: true });
  const nodeCount1 = db1.prepare("SELECT COUNT(*) as n FROM nodes WHERE type = 'Artifact'").get().n;
  db1.close();
  assert.ok(nodeCount1 >= 1, `happy path must insert at least one Artifact node (got ${nodeCount1})`);

  // Write lock released after successful call (enqueueWrite finally)
  const lockPath = path.join(mindrian, 'write.lock');
  assert.strictEqual(fs.existsSync(lockPath), false, 'write lock must be released after happy path');
  return nodeCount1;
}

// ----------------------------------------------------------------------------
// Test 2: Mid-transaction rollback (R-87-06-ROLLBACK)
// ----------------------------------------------------------------------------
//
// Injection strategy: patch conn.prepare so the FIRST prepare (BEGIN) returns
// the real stmt, the SECOND prepare (first INSERT) returns a stmt whose
// .run() throws. That places the throw AFTER BEGIN has fired but BEFORE any
// INSERT commits. With the BEGIN/COMMIT wrap in place, indexArtifact's catch
// issues ROLLBACK and the Artifact count stays identical to the pre-call
// value. Without the wrap, the first INSERT would persist and the assertion
// would fail. This is the concrete proof of rollback behavior.
//
// We call lazygraph.indexArtifact directly (not graphOps.indexArtifact) so
// we control the conn that is patched; graphOps opens its own conn inside
// enqueueWrite and we cannot intercept it at the lazygraph-body level.

async function testMidTransactionRollback(tmpRoom, dbPath) {
  const db2 = new DatabaseSync(dbPath);
  lazygraph.initSchema(db2); // idempotent

  // Capture pre-call Artifact count
  const countBefore = db2.prepare("SELECT COUNT(*) as n FROM nodes WHERE type = 'Artifact'").get().n;

  // Patch: intercept conn.prepare so the 3rd prepare (the 2nd INSERT in the
  // indexArtifact body, AFTER BEGIN and AFTER the first Artifact INSERT) gets
  // a stmt whose .run() throws. This guarantees:
  //   prepare #1 -> 'BEGIN'                  -> real run() fires, txn starts
  //   prepare #2 -> INSERT Artifact node     -> real run() fires, row written
  //   prepare #3 -> INSERT Section node      -> stub run() throws mid-txn
  //
  // That placement matters: at least ONE INSERT has already hit the database
  // inside the BEGIN block before the throw. If indexArtifact lacks the
  // BEGIN/COMMIT wrap, that first INSERT auto-commits and countAfter would
  // be countBefore + 1 (regression caught). With the wrap in place, the
  // catch block issues ROLLBACK and undoes the first INSERT, so
  // countAfter === countBefore. This is the ONLY injection point that
  // proves rollback actually fired (vs. "the throw happened before any
  // write, so there was nothing to roll back").
  //
  // runCount >= 2 is the canonical marker per plan: "throw after the 2nd
  // stmt.run() invocation" -- our prepareCount === 3 means two real run()
  // calls already succeeded (BEGIN + first INSERT).
  const origPrepare = db2.prepare.bind(db2);
  let prepareCount = 0;
  db2.prepare = function (sql) {
    prepareCount++;
    const stmt = origPrepare(sql);
    if (prepareCount === 3) {
      stmt.run = function (..._args) {
        // Restore prepare() BEFORE throwing so ROLLBACK (which also goes
        // through db2.prepare) reaches the real implementation. Otherwise
        // ROLLBACK would loop back into this stub.
        db2.prepare = origPrepare;
        throw new Error('injected mid-transaction failure at prepare #' + prepareCount + ' (runCount >= 2)');
      };
    }
    return stmt;
  };

  // Try to index an artifact -- should throw due to injection
  const anotherFile = path.join(tmpRoom, 'market-analysis', 's-curve-mature-market.md');
  let threw = false;
  let threwMsg = '';
  try {
    await lazygraph.indexArtifact(db2, tmpRoom, anotherFile);
  } catch (e) {
    threw = true;
    threwMsg = e.message;
  }

  // Safety: restore prepare in case the stub was never triggered
  db2.prepare = origPrepare;

  assert.ok(threw, 'injected failure must propagate to caller');
  assert.ok(
    threwMsg.includes('injected mid-transaction') || threwMsg.includes('runCount >= 2'),
    `error message should carry injection marker, got: ${threwMsg}`
  );

  // The critical assertion: ROLLBACK reverted the partial write.
  const countAfter = db2.prepare("SELECT COUNT(*) as n FROM nodes WHERE type = 'Artifact'").get().n;
  assert.strictEqual(
    countAfter,
    countBefore,
    `ROLLBACK FAILED: node count changed from ${countBefore} to ${countAfter} -- partial write survived`
  );

  db2.close();
  return { countBefore, countAfter };
}

// ----------------------------------------------------------------------------
// Test 3: testLockReleaseAfterCommit -- distinct failure mode, distinct name
// ----------------------------------------------------------------------------
//
// This test is INTENTIONALLY distinct from testMidTransactionRollback. It
// verifies that enqueueWrite's try/finally releases the lock even when the
// caller's fn throws OUTSIDE the SQLite transaction (here: fs.readFileSync
// fails on a nonexistent file, before any prepare() runs). That is a lock
// release semantic, not a transaction rollback semantic.
//
// Why the name: "after commit" refers to "after the transaction boundary
// is complete OR was never entered". Both paths exercise the same finally
// block in enqueueWrite. If a future refactor moves BEGIN before the
// fs.readFileSync (shouldn't happen, but defensive), this test still
// catches a lock leak because fs.readFileSync throwing before any INSERT
// would hit the ROLLBACK path and then the finally.

async function testLockReleaseAfterCommit(tmpRoom, mindrian) {
  const lockPath = path.join(mindrian, 'write.lock');
  let graphOpsThrewOnBadFile = false;
  try {
    await graphOps.indexArtifact(tmpRoom, path.join(tmpRoom, 'does-not-exist.md'));
  } catch (_) {
    graphOpsThrewOnBadFile = true;
  }

  assert.ok(graphOpsThrewOnBadFile, 'bad file path must cause indexArtifact to throw');
  assert.strictEqual(
    fs.existsSync(lockPath),
    false,
    'write lock must be released even when indexArtifact throws (enqueueWrite finally)'
  );
}

// ----------------------------------------------------------------------------
// Test 4: testRollbackDoesNotLeakLock -- combined concern
// ----------------------------------------------------------------------------
//
// This test proves that BOTH the SQLite ROLLBACK AND the enqueueWrite
// finally fire when the inner transaction body throws. We go through the
// public graphOps.indexArtifact API so enqueueWrite is in the stack, and
// we monkey-patch lazygraph.indexArtifact so that the call opens its own
// BEGIN, issues one INSERT, then throws. The patched version includes its
// own ROLLBACK on catch -- same pattern as production indexArtifact --
// so we verify (a) the throw propagates out through enqueueWrite's fn
// callback, (b) enqueueWrite's finally still fires releaseLock, (c) the
// partial INSERT did not survive.

async function testRollbackDoesNotLeakLock(tmpRoom, dbPath, mindrian) {
  const lockPath = path.join(mindrian, 'write.lock');
  assert.strictEqual(fs.existsSync(lockPath), false, 'precondition: no lock before test');

  // Capture pre-test Artifact count
  const dbRead = new DatabaseSync(dbPath, { readOnly: true });
  const countBefore = dbRead.prepare("SELECT COUNT(*) as n FROM nodes WHERE type = 'Artifact'").get().n;
  dbRead.close();

  // Save the real indexArtifact so we can restore after
  const realIndex = lazygraph.indexArtifact;

  // Replace with a version that simulates "threw inside the transaction"
  // after one real INSERT fires. This mirrors the production flow: BEGIN,
  // one INSERT, throw, ROLLBACK, throw-out. The caller (enqueueWrite) must
  // still hit its finally.
  lazygraph.indexArtifact = async function (conn, roomDir, _filePath) {
    conn.prepare('BEGIN').run();
    try {
      conn.prepare(
        "INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties"
      ).run('t4-partial-artifact', 'Artifact', '{"title":"will-not-survive"}');
      throw new Error('injected mid-transaction failure for testRollbackDoesNotLeakLock');
      // unreachable:
      // eslint-disable-next-line no-unreachable
      conn.prepare('COMMIT').run();
    } catch (err) {
      try { conn.prepare('ROLLBACK').run(); } catch (_) {}
      throw err;
    }
  };

  let threw = false;
  try {
    await graphOps.indexArtifact(tmpRoom, path.join(tmpRoom, 'market-analysis', 's-curve-mature-market.md'));
  } catch (_) {
    threw = true;
  }

  // Restore
  lazygraph.indexArtifact = realIndex;

  assert.ok(threw, 'injected mid-transaction failure must propagate out of graphOps.indexArtifact');

  // Lock released in enqueueWrite finally, even though the inner fn threw.
  assert.strictEqual(
    fs.existsSync(lockPath),
    false,
    'write lock MUST be released even when the inner transaction rolled back'
  );

  // Partial INSERT did not survive (ROLLBACK fired correctly).
  const dbRead2 = new DatabaseSync(dbPath, { readOnly: true });
  const countAfter = dbRead2.prepare("SELECT COUNT(*) as n FROM nodes WHERE type = 'Artifact'").get().n;
  dbRead2.close();
  assert.strictEqual(
    countAfter,
    countBefore,
    `ROLLBACK FAILED in testRollbackDoesNotLeakLock: ${countBefore} -> ${countAfter}`
  );

  return { countBefore, countAfter };
}

// ----------------------------------------------------------------------------
// Test runner
// ----------------------------------------------------------------------------

async function run() {
  const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'indexart-'));
  try {
    fs.cpSync(FIXTURE, tmpRoom, { recursive: true });
    const mindrian = path.join(tmpRoom, '.mindrian');
    fs.mkdirSync(mindrian, { recursive: true });

    const dbPath = path.join(mindrian, 'room.db');
    const goodFile = path.join(tmpRoom, 'problem-definition', 'jtbd-underservice.md');

    // Test 1: happy path
    const nodeCount1 = await testHappyPath(tmpRoom, dbPath, goodFile, mindrian);

    // Test 2: REAL mid-transaction rollback
    const rollback = await testMidTransactionRollback(tmpRoom, dbPath);

    // Test 3: lock release after commit (distinct concern)
    await testLockReleaseAfterCommit(tmpRoom, mindrian);

    // Test 4: combined -- rollback inside txn AND lock released
    const t4 = await testRollbackDoesNotLeakLock(tmpRoom, dbPath, mindrian);

    process.stdout.write(
      `index-artifact-transaction: all tests passed` +
        ` (happy-path nodes=${nodeCount1}, rollback-countBefore=${rollback.countBefore},` +
        ` rollback-countAfter=${rollback.countAfter},` +
        ` t4-lock-released-after-rollback=${t4.countBefore}==${t4.countAfter})\n`
    );
    process.exit(0);
  } catch (e) {
    process.stderr.write('FAIL: ' + e.message + '\n');
    if (e.stack) process.stderr.write(e.stack + '\n');
    process.exit(1);
  } finally {
    try {
      fs.rmSync(tmpRoom, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
}

run();
