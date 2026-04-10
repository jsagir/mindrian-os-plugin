/**
 * MindrianOS Plugin -- Memory Layer Operations Tests
 * Covers initMemorySchema + L0 Identity + L1 Facts from lib/core/memory-ops.cjs
 * Uses Node.js built-in test runner (node:test + node:assert)
 *
 * Run: node tests/test-memory-ops.cjs
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const lazygraph = require('../lib/core/lazygraph-ops.cjs');
const {
  initMemorySchema,
  getIdentity,
  setIdentity,
  addFact,
  invalidateFact,
  getValidFacts,
} = require('../lib/core/memory-ops.cjs');

// --- Helpers ---

function createTempRoom() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-mem-test-'));
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
// SQLITE-04: Memory schema creation
// ============================================================

describe('SQLITE-04: Memory schema creation', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = createTempRoom();
    const result = await lazygraph.openGraph(roomDir);
    db = result.db;
    conn = result.conn;
    initMemorySchema(conn);
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanupRoom(roomDir);
  });

  it('initMemorySchema creates identity table', () => {
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='identity'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'identity');
  });

  it('initMemorySchema creates facts table', () => {
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='facts'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'facts');
  });

  it('initMemorySchema creates sessions table', () => {
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'sessions');
  });

  it('initMemorySchema creates fragments table', () => {
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fragments'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'fragments');
  });

  it('initMemorySchema creates assumptions table', () => {
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assumptions'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'assumptions');
  });

  it('initMemorySchema creates index on facts.subject', () => {
    const indexes = conn.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_facts_subject'").all();
    assert.strictEqual(indexes.length, 1);
  });

  it('initMemorySchema creates index on facts.invalidated_at', () => {
    const indexes = conn.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_facts_invalidated_at'").all();
    assert.strictEqual(indexes.length, 1);
  });

  it('initMemorySchema creates index on fragments.session_id', () => {
    const indexes = conn.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_fragments_session_id'").all();
    assert.strictEqual(indexes.length, 1);
  });

  it('initMemorySchema creates index on assumptions.section', () => {
    const indexes = conn.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_assumptions_section'").all();
    assert.strictEqual(indexes.length, 1);
  });

  it('initMemorySchema creates index on assumptions.validity', () => {
    const indexes = conn.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_assumptions_validity'").all();
    assert.strictEqual(indexes.length, 1);
  });

  it('initMemorySchema is idempotent (calling twice does not throw)', () => {
    assert.doesNotThrow(() => {
      initMemorySchema(conn);
      initMemorySchema(conn);
    });
  });
});

// ============================================================
// SQLITE-04: L0 Identity
// ============================================================

describe('SQLITE-04: L0 Identity', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = createTempRoom();
    const result = await lazygraph.openGraph(roomDir);
    db = result.db;
    conn = result.conn;
    initMemorySchema(conn);
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanupRoom(roomDir);
  });

  it('setIdentity stores key-value pair', async () => {
    await setIdentity(conn, 'venture_name', 'Acme Corp');
    const rows = conn.prepare("SELECT * FROM identity WHERE key = 'venture_name'").all();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].value, 'Acme Corp');
    assert.ok(rows[0].updated_at, 'updated_at should be set');
  });

  it('getIdentity returns all identity pairs as object', async () => {
    await setIdentity(conn, 'venture_name', 'Acme Corp');
    await setIdentity(conn, 'founder', 'Jane Doe');
    const identity = await getIdentity(conn);
    assert.strictEqual(typeof identity, 'object');
    assert.strictEqual(identity.venture_name, 'Acme Corp');
    assert.strictEqual(identity.founder, 'Jane Doe');
  });

  it('setIdentity upserts existing key', async () => {
    await setIdentity(conn, 'venture_name', 'Acme Corp');
    await setIdentity(conn, 'venture_name', 'Acme Corp v2');
    const identity = await getIdentity(conn);
    assert.strictEqual(identity.venture_name, 'Acme Corp v2');
    // Should still be just one row for venture_name
    const rows = conn.prepare("SELECT * FROM identity WHERE key = 'venture_name'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('getIdentity returns empty object on fresh db', async () => {
    // Create a fresh db to test empty state
    const freshRoom = createTempRoom();
    const freshResult = await lazygraph.openGraph(freshRoom);
    initMemorySchema(freshResult.conn);
    const identity = await getIdentity(freshResult.conn);
    assert.deepStrictEqual(identity, {});
    await lazygraph.closeGraph(freshResult.db);
    cleanupRoom(freshRoom);
  });
});

// ============================================================
// SQLITE-04: L1 Facts
// ============================================================

describe('SQLITE-04: L1 Facts', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = createTempRoom();
    const result = await lazygraph.openGraph(roomDir);
    db = result.db;
    conn = result.conn;
    initMemorySchema(conn);
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanupRoom(roomDir);
  });

  it('addFact returns fact with id and valid_from', async () => {
    const fact = await addFact(conn, {
      subject: 'market',
      predicate: 'size',
      object: '$1B',
      confidence: 0.9,
    });
    assert.ok(typeof fact.id === 'number', 'id should be a number');
    assert.ok(fact.id > 0, 'id should be positive');
    assert.ok(typeof fact.valid_from === 'string', 'valid_from should be a string');
    assert.strictEqual(fact.subject, 'market');
    assert.strictEqual(fact.predicate, 'size');
    assert.strictEqual(fact.object, '$1B');
    assert.strictEqual(fact.confidence, 0.9);
  });

  it('addFact stores with auto-generated valid_from timestamp', async () => {
    const beforeTime = new Date().toISOString();
    const fact = await addFact(conn, {
      subject: 'team',
      predicate: 'count',
      object: '5',
    });
    const afterTime = new Date().toISOString();
    assert.ok(fact.valid_from >= beforeTime, 'valid_from should be >= beforeTime');
    assert.ok(fact.valid_from <= afterTime, 'valid_from should be <= afterTime');
  });

  it('getValidFacts returns only non-invalidated facts', async () => {
    const facts = await getValidFacts(conn);
    assert.ok(Array.isArray(facts), 'should return an array');
    assert.ok(facts.length >= 2, 'should have at least 2 facts from prior tests');
    for (const f of facts) {
      assert.strictEqual(f.invalidated_at, null, 'invalidated_at should be null for valid facts');
    }
  });

  it('getValidFacts filters by subject', async () => {
    const marketFacts = await getValidFacts(conn, 'market');
    assert.ok(Array.isArray(marketFacts));
    assert.ok(marketFacts.length >= 1);
    for (const f of marketFacts) {
      assert.strictEqual(f.subject, 'market');
    }
  });

  it('invalidateFact sets invalidated_at and invalidated_by', async () => {
    const fact = await addFact(conn, {
      subject: 'competitor',
      predicate: 'threat_level',
      object: 'high',
    });
    const result = await invalidateFact(conn, fact.id, 'new-evidence-artifact');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, fact.id);

    // Verify in database
    const row = conn.prepare('SELECT * FROM facts WHERE id = ?').get(fact.id);
    assert.ok(row.invalidated_at, 'invalidated_at should be set');
    assert.strictEqual(row.invalidated_by, 'new-evidence-artifact');
  });

  it('invalidated fact excluded from getValidFacts', async () => {
    // The competitor fact from the previous test should be excluded
    const facts = await getValidFacts(conn);
    const competitorFacts = facts.filter(f => f.subject === 'competitor');
    assert.strictEqual(competitorFacts.length, 0, 'invalidated competitor fact should not appear');
  });
});
