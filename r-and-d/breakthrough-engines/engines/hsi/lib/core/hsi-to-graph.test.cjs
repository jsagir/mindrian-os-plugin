'use strict';
/*
 * Phase 140-01 -- HARD-02 regression test (both-schema node-insert safety).
 *
 * This suite proves the shared NOT-NULL-safe node-insert helper
 * (lib/core/node-insert.cjs, exporting insertNode) is robust to BOTH the
 * Phase-109-migrated 4-col nodes schema (where the bare 3-col insert fails
 * with `NOT NULL constraint failed: nodes.source_path`) AND the legacy
 * un-migrated 3-col schema (the current dogfood room), per Canon decision
 * D-02a.
 *
 * The helper is the single chokepoint the HSI-to-graph writer and the three
 * lazygraph-ops siblings route through (D-02). The two node-write sites in
 * scripts/hsi-to-graph.cjs are the Section upserts at the HSI reverse-salient
 * path (a Section node carrying name + label). This suite exercises the
 * helper directly with the exact id/type/properties shape those sites use.
 *
 * Canon Part 8: all data is scalar + local. The test writes ONLY to
 * os.tmpdir fixtures -- never to any real room under ~/MindrianRooms.
 *
 * Test A (migrated schema): build a fixture room.db via lib/core/room-db.cjs
 *   openRoomDb (runs the Phase 109 migration so nodes has source_path /
 *   created_by / created_at / last_seen_at NOT NULL), run the helper, assert
 *   Section + edge nodes land with NO NOT NULL constraint failed error.
 *
 * Test B (un-migrated schema): build a fixture room.db with only the legacy
 *   3-column nodes table (id, type, properties), run the helper, assert it
 *   completes with no error.
 *
 * Test C (provenance values): assert inserted nodes carry
 *   source_path = 'system:hsi-to-graph' and created_by = 'system' on the
 *   migrated schema (the CHECK constraint on created_by is satisfied).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
const { insertNode } = require('./node-insert.cjs');

// Build a per-test tmp room dir under os.tmpdir. Never touches a real room.
function makeTmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hsi-to-graph-test-'));
}

function rmTmpRoom(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    /* best-effort cleanup */
  }
}

// Build an un-migrated room.db with the legacy 3-column nodes table only.
// This mirrors the dogfood room schema (id, type, properties), which the
// helper must accept without error per D-02a.
function makeUnmigratedDb(roomDir) {
  const dbDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}'
    );
  `);
  return db;
}

test('HARD-02 Test A: migrated schema accepts insertNode with no NOT NULL failure', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);

    // The exact shape the scripts/hsi-to-graph.cjs Section upsert writes.
    const sectionId = 'market-analysis';
    const props = JSON.stringify({ name: sectionId, label: 'MARKET ANALYSIS' });

    // On a migrated db, the bare 3-col insert throws
    // `NOT NULL constraint failed: nodes.source_path`. The helper must NOT.
    // epistemic_type 'observation' mirrors scripts/hsi-to-graph.cjs's real
    // call (R17-02, 260903-gdm): system-bookkeeping, required, no default.
    assert.doesNotThrow(() => {
      insertNode(db, sectionId, 'Section', props, { epistemic_type: 'observation' });
    }, /NOT NULL constraint failed/);

    const row = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(sectionId);
    assert.ok(row, 'Section node should be present after insertNode');
    assert.strictEqual(row.type, 'Section');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('HARD-02 Test B: un-migrated 3-column schema accepts insertNode with no error', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = makeUnmigratedDb(roomDir);

    const sectionId = 'solution-design';
    const props = JSON.stringify({ name: sectionId, label: 'SOLUTION DESIGN' });

    assert.doesNotThrow(() => {
      insertNode(db, sectionId, 'Section', props, { epistemic_type: 'observation' });
    });

    const row = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(sectionId);
    assert.ok(row, 'Section node should be present on the un-migrated schema');
    assert.strictEqual(row.type, 'Section');
  } finally {
    if (db) {
      try { db.close(); } catch (_e) { /* ignore */ }
    }
    rmTmpRoom(roomDir);
  }
});

test('HARD-02 Test C: migrated schema carries system provenance scalars', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);

    const sectionId = 'competitive-analysis';
    const props = JSON.stringify({ name: sectionId, label: 'COMPETITIVE ANALYSIS' });
    insertNode(db, sectionId, 'Section', props, { epistemic_type: 'observation' });

    const row = db
      .prepare('SELECT source_path, created_by FROM nodes WHERE id = ?')
      .get(sectionId);
    assert.ok(row, 'node row should exist');
    assert.strictEqual(row.source_path, 'system:hsi-to-graph');
    assert.strictEqual(row.created_by, 'system');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('HARD-02 upsert: re-inserting the same id updates properties (ON CONFLICT)', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);

    const sectionId = 'team-execution';
    insertNode(db, sectionId, 'Section', JSON.stringify({ name: sectionId, label: 'OLD' }), { epistemic_type: 'observation' });
    insertNode(db, sectionId, 'Section', JSON.stringify({ name: sectionId, label: 'NEW' }), { epistemic_type: 'observation' });

    const rows = db.prepare('SELECT id, properties FROM nodes WHERE id = ?').all(sectionId);
    assert.strictEqual(rows.length, 1, 'upsert must not create a duplicate row');
    assert.match(rows[0].properties, /NEW/);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});
