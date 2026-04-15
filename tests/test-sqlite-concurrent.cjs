/**
 * MindrianOS Plugin -- SQLite WAL Concurrent Access Tests
 * Verifies SQLITE-03: Two separate processes can read room.db simultaneously.
 * Uses child_process.fork() for multi-process verification.
 *
 * Run: node tests/test-sqlite-concurrent.cjs
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');

const lazygraph = require('../lib/core/lazygraph-ops.cjs');

// --- Helpers ---

function createTempRoom() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-concurrent-'));
  const sectionDir = path.join(tmpDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  return tmpDir;
}

function cleanupRoom(roomDir) {
  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup errors
  }
}

// ============================================================
// SQLITE-03: WAL concurrent access
// ============================================================

describe('SQLITE-03: WAL concurrent access', () => {
  let roomDir;

  before(async () => {
    roomDir = createTempRoom();

    // Create a test artifact
    const artifactPath = path.join(roomDir, 'problem-definition', 'test-entry.md');
    fs.writeFileSync(artifactPath, '---\ntitle: Test Entry\n---\n# Test Entry\nSome content for concurrent testing.');

    // Build the graph with test data
    const { db, conn } = await lazygraph.openGraph(roomDir);
    await lazygraph.indexArtifact(conn, roomDir, artifactPath);
    await lazygraph.closeGraph(db);
  });

  after(() => {
    cleanupRoom(roomDir);
  });

  it('WAL mode is active on database', async () => {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
    const result = db.prepare('PRAGMA journal_mode').all();
    assert.deepStrictEqual(result, [{ journal_mode: 'wal' }]);
    db.close();
  });

  it('two processes can read room.db simultaneously', async () => {
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');

    // Create a helper script for the child process
    // node:sqlite is a Node builtin on Node >=22.5 so no path resolution needed
    const childScript = path.join(roomDir, 'child-reader.cjs');
    fs.writeFileSync(childScript, `
      'use strict';
      const { DatabaseSync } = require('node:sqlite');
      const dbPath = process.argv[2];
      try {
        const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
        db.exec('PRAGMA journal_mode = WAL');
        const rows = db.prepare('SELECT COUNT(*) AS cnt FROM nodes').all();
        db.close();
        process.send({ success: true, count: rows[0].cnt });
      } catch (e) {
        process.send({ success: false, error: e.message });
      }
    `);

    // Fork child process
    const child = fork(childScript, [dbPath], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });

    // Parent reads simultaneously
    const { DatabaseSync } = require('node:sqlite');
    const parentDb = new DatabaseSync(dbPath, { open: true, readOnly: true });
    parentDb.exec('PRAGMA journal_mode = WAL');
    const parentRows = parentDb.prepare('SELECT COUNT(*) AS cnt FROM nodes').all();
    parentDb.close();

    // Wait for child result
    const childResult = await new Promise((resolve, reject) => {
      child.on('message', resolve);
      child.on('error', reject);
      setTimeout(() => reject(new Error('Child process timeout')), 5000);
    });

    // Both must succeed
    assert.ok(parentRows[0].cnt >= 1, 'Parent read should find at least 1 node');
    assert.strictEqual(childResult.success, true, 'Child process should read successfully');
    assert.ok(childResult.count >= 1, 'Child read should find at least 1 node');
    assert.strictEqual(parentRows[0].cnt, childResult.count, 'Both readers should see same data');
  });

  it('reader does not block during write', async () => {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');

    const reader = new DatabaseSync(dbPath, { open: true, readOnly: true });
    reader.exec('PRAGMA journal_mode = WAL');

    // Read count before
    const before = reader.prepare('SELECT COUNT(*) AS cnt FROM nodes').get();

    // Write from a separate connection
    const writer = new DatabaseSync(dbPath);
    writer.exec('PRAGMA journal_mode = WAL');
    writer.exec('PRAGMA foreign_keys = ON');
    writer.prepare(
      "INSERT INTO nodes (id, type, properties) VALUES (?, 'Artifact', ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties"
    ).run('concurrent-test-artifact', JSON.stringify({ title: 'Concurrent Test', section: 'test' }));
    writer.close();

    // Reader should still work (may or may not see the new row depending on snapshot isolation)
    const afterRead = reader.prepare('SELECT COUNT(*) AS cnt FROM nodes').get();
    assert.ok(afterRead.cnt >= before.cnt, 'Reader should not fail during/after concurrent write');

    reader.close();

    // Clean up the test node
    const cleanup = new DatabaseSync(dbPath);
    cleanup.prepare("DELETE FROM nodes WHERE id = 'concurrent-test-artifact'").run();
    cleanup.close();
  });

  it('queryGraph gracefully returns empty results for invalid input', async () => {
    // queryGraph with a query that returns no rows
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      const rows = await lazygraph.queryGraph(conn, "SELECT * FROM nodes WHERE id = 'nonexistent-id-xyz'");
      assert.ok(Array.isArray(rows), 'Should return an array');
      assert.strictEqual(rows.length, 0, 'Should return empty array for no matches');
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
});
