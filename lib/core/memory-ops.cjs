/**
 * MindrianOS Plugin -- Memory Layer Operations
 * Persistent memory tables on the same room/.mindrian/room.db as lazygraph-ops.cjs.
 * Covers L0 Identity, L1 Facts, and schema for L2 Sessions, L3 Fragments, Assumptions.
 *
 * Exports: initMemorySchema, getIdentity, setIdentity, addFact, getValidFacts, invalidateFact
 *
 * All functions use prepared statements with ? parameters (no string interpolation).
 * Async wrappers for backward compatibility with callers that use await.
 */

'use strict';

// --- Schema ---

/**
 * Create all 5 memory tables and 5 indexes. Idempotent (CREATE IF NOT EXISTS).
 * Call after openGraph() on the same db instance.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 */
function initMemorySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source_artifact TEXT,
      source_meeting TEXT,
      valid_from TEXT NOT NULL,
      invalidated_at TEXT,
      invalidated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      summary TEXT,
      key_decisions TEXT DEFAULT '[]',
      open_questions TEXT DEFAULT '[]',
      methodology_used TEXT,
      artifacts_filed TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS fragments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      section_context TEXT
    );

    CREATE TABLE IF NOT EXISTS assumptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim TEXT NOT NULL,
      section TEXT,
      validity TEXT NOT NULL DEFAULT 'untested' CHECK(validity IN ('untested','supported','contradicted','stale')),
      evidence_for TEXT DEFAULT '[]',
      evidence_against TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      last_tested TEXT,
      invalidated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(subject);
    CREATE INDEX IF NOT EXISTS idx_facts_invalidated_at ON facts(invalidated_at);
    CREATE INDEX IF NOT EXISTS idx_fragments_session_id ON fragments(session_id);
    CREATE INDEX IF NOT EXISTS idx_assumptions_section ON assumptions(section);
    CREATE INDEX IF NOT EXISTS idx_assumptions_validity ON assumptions(validity);
  `);
}

// --- L0 Identity ---

/**
 * Set (upsert) an identity key-value pair.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {string} key - Identity key (e.g. 'venture_name', 'founder', 'stage')
 * @param {string} value - Identity value
 * @returns {Promise<void>}
 */
async function setIdentity(db, key, value) {
  const updatedAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO identity (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, updatedAt);
  return Promise.resolve();
}

/**
 * Get all identity key-value pairs as a plain object.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @returns {Promise<object>} e.g. { venture_name: 'Acme', founder: 'Jane' }
 */
async function getIdentity(db) {
  const rows = db.prepare('SELECT key, value FROM identity').all();
  const identity = {};
  for (const row of rows) {
    identity[row.key] = row.value;
  }
  return Promise.resolve(identity);
}

// --- L1 Facts ---

/**
 * Add a new fact with auto-generated valid_from timestamp.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {object} fact - Fact to add
 * @param {string} fact.subject - Fact subject (e.g. 'market', 'team')
 * @param {string} fact.predicate - Fact predicate (e.g. 'size', 'count')
 * @param {string} fact.object - Fact object value (e.g. '$1B', '5')
 * @param {number} [fact.confidence=1.0] - Confidence score (0-1)
 * @param {string} [fact.source_artifact] - Source artifact ID
 * @param {string} [fact.source_meeting] - Source meeting ID
 * @returns {Promise<{id: number, subject: string, predicate: string, object: string, confidence: number, valid_from: string}>}
 */
async function addFact(db, fact) {
  const validFrom = new Date().toISOString();
  const confidence = typeof fact.confidence === 'number' ? fact.confidence : 1.0;
  const sourceArtifact = fact.source_artifact || null;
  const sourceMeeting = fact.source_meeting || null;

  const info = db.prepare(
    'INSERT INTO facts (subject, predicate, object, confidence, source_artifact, source_meeting, valid_from) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(fact.subject, fact.predicate, fact.object, confidence, sourceArtifact, sourceMeeting, validFrom);

  return Promise.resolve({
    id: Number(info.lastInsertRowid),
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    confidence,
    valid_from: validFrom,
  });
}

/**
 * Get all valid (non-invalidated) facts, optionally filtered by subject.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {string} [subject] - Optional subject filter
 * @returns {Promise<Array<object>>}
 */
async function getValidFacts(db, subject) {
  let rows;
  if (subject) {
    rows = db.prepare('SELECT * FROM facts WHERE invalidated_at IS NULL AND subject = ?').all(subject);
  } else {
    rows = db.prepare('SELECT * FROM facts WHERE invalidated_at IS NULL').all();
  }
  return Promise.resolve(rows);
}

/**
 * Invalidate a fact by setting invalidated_at and invalidated_by.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {number} factId - Fact ID to invalidate
 * @param {string} invalidatedBy - Reason/source for invalidation
 * @returns {Promise<{success: boolean, id: number}>}
 */
async function invalidateFact(db, factId, invalidatedBy) {
  const invalidatedAt = new Date().toISOString();
  db.prepare(
    'UPDATE facts SET invalidated_at = ?, invalidated_by = ? WHERE id = ?'
  ).run(invalidatedAt, invalidatedBy, factId);
  return Promise.resolve({ success: true, id: factId });
}

// --- Exports ---

module.exports = {
  initMemorySchema,
  setIdentity,
  getIdentity,
  addFact,
  getValidFacts,
  invalidateFact,
};
