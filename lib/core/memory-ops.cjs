/**
 * MindrianOS Plugin -- Memory Layer Operations
 * Persistent memory tables on the same room/.mindrian/room.db as lazygraph-ops.cjs.
 * Covers L0 Identity, L1 Facts, and schema for L2 Sessions, L3 Fragments, Assumptions.
 *
 * Exports: initMemorySchema, getIdentity, setIdentity, addFact, getValidFacts, invalidateFact,
 *          startSession, endSession, addFragment, getSessionHistory,
 *          createAssumption, updateAssumptionValidity, getAssumptions
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

    CREATE TABLE IF NOT EXISTS scaffold_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      section TEXT NOT NULL,
      collection TEXT,
      user_reason TEXT,
      surface TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      command TEXT NOT NULL,
      question TEXT,
      answer_summary TEXT,
      artifacts_cited TEXT,
      confidence INTEGER,
      contradictions_flagged TEXT
    );

    CREATE TABLE IF NOT EXISTS held_contradictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      source_artifact TEXT,
      target_artifact TEXT,
      tension_summary TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions_index (
      id TEXT PRIMARY KEY,
      decision TEXT NOT NULL,
      rationale TEXT,
      reversibility TEXT,
      witnesses TEXT,
      date TEXT,
      pressure_context TEXT,
      status TEXT,
      artifact_path TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_scaffold_log_section ON scaffold_log(section);
    CREATE INDEX IF NOT EXISTS idx_voice_log_timestamp ON voice_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_held_contradictions_status ON held_contradictions(status);
    CREATE INDEX IF NOT EXISTS idx_decisions_index_status ON decisions_index(status);
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

// --- L2 Sessions ---

/**
 * Start a new session. Creates a row with started_at = now.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @returns {Promise<{id: number, started_at: string}>}
 */
async function startSession(db) {
  const startedAt = new Date().toISOString();
  const info = db.prepare(
    'INSERT INTO sessions (started_at) VALUES (?)'
  ).run(startedAt);
  return Promise.resolve({
    id: Number(info.lastInsertRowid),
    started_at: startedAt,
  });
}

/**
 * End a session by setting ended_at and optional metadata fields.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {number} sessionId - Session ID to end
 * @param {object} [opts={}] - Optional fields
 * @param {string} [opts.summary] - Session summary
 * @param {Array|string} [opts.key_decisions] - Key decisions (array or JSON string)
 * @param {Array|string} [opts.open_questions] - Open questions (array or JSON string)
 * @param {string} [opts.methodology_used] - Methodology used
 * @param {Array|string} [opts.artifacts_filed] - Artifacts filed (array or JSON string)
 * @returns {Promise<{success: boolean, id: number, ended_at: string}>}
 */
async function endSession(db, sessionId, opts = {}) {
  const endedAt = new Date().toISOString();
  const summary = opts.summary || null;
  const methodologyUsed = opts.methodology_used || null;

  // JSON fields: if array, stringify; if string, use as-is; if undefined, use default '[]'
  const keyDecisions = Array.isArray(opts.key_decisions)
    ? JSON.stringify(opts.key_decisions)
    : (typeof opts.key_decisions === 'string' ? opts.key_decisions : '[]');
  const openQuestions = Array.isArray(opts.open_questions)
    ? JSON.stringify(opts.open_questions)
    : (typeof opts.open_questions === 'string' ? opts.open_questions : '[]');
  const artifactsFiled = Array.isArray(opts.artifacts_filed)
    ? JSON.stringify(opts.artifacts_filed)
    : (typeof opts.artifacts_filed === 'string' ? opts.artifacts_filed : '[]');

  db.prepare(
    'UPDATE sessions SET ended_at = ?, summary = ?, key_decisions = ?, open_questions = ?, methodology_used = ?, artifacts_filed = ? WHERE id = ?'
  ).run(endedAt, summary, keyDecisions, openQuestions, methodologyUsed, artifactsFiled, sessionId);

  return Promise.resolve({ success: true, id: sessionId, ended_at: endedAt });
}

// --- L3 Fragments ---

/**
 * Add a conversation fragment linked to a session.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {object} fragment - Fragment data
 * @param {number} fragment.session_id - Parent session ID (FK)
 * @param {string} fragment.role - Speaker role (e.g. 'user', 'assistant')
 * @param {string} fragment.content - Message content
 * @param {string} [fragment.section_context] - Room section context
 * @returns {Promise<{id: number, session_id: number, timestamp: string}>}
 */
async function addFragment(db, fragment) {
  const timestamp = new Date().toISOString();
  const sectionContext = fragment.section_context || null;

  const info = db.prepare(
    'INSERT INTO fragments (session_id, role, content, timestamp, section_context) VALUES (?, ?, ?, ?, ?)'
  ).run(fragment.session_id, fragment.role, fragment.content, timestamp, sectionContext);

  return Promise.resolve({
    id: Number(info.lastInsertRowid),
    session_id: fragment.session_id,
    timestamp,
  });
}

/**
 * Get session history with nested fragments, ordered by started_at DESC.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {number} [limit=10] - Maximum number of sessions to return
 * @returns {Promise<Array<object>>} Sessions with fragments array property
 */
async function getSessionHistory(db, limit) {
  const effectiveLimit = typeof limit === 'number' ? limit : 10;

  const sessions = db.prepare(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?'
  ).all(effectiveLimit);

  const fragStmt = db.prepare(
    'SELECT * FROM fragments WHERE session_id = ? ORDER BY timestamp ASC'
  );

  for (const session of sessions) {
    session.fragments = fragStmt.all(session.id);
    // Parse JSON fields
    try { session.key_decisions = JSON.parse(session.key_decisions); } catch { session.key_decisions = []; }
    try { session.open_questions = JSON.parse(session.open_questions); } catch { session.open_questions = []; }
    try { session.artifacts_filed = JSON.parse(session.artifacts_filed); } catch { session.artifacts_filed = []; }
  }

  return Promise.resolve(sessions);
}

// --- Assumptions ---

/**
 * Create an assumption with validity = 'untested'.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {object} opts - Assumption data
 * @param {string} opts.claim - The assumption claim text
 * @param {string} [opts.section] - Room section this assumption belongs to
 * @returns {Promise<{id: number, claim: string, section: string|null, validity: string, created_at: string}>}
 */
async function createAssumption(db, opts) {
  const createdAt = new Date().toISOString();
  const section = opts.section || null;

  const info = db.prepare(
    'INSERT INTO assumptions (claim, section, created_at) VALUES (?, ?, ?)'
  ).run(opts.claim, section, createdAt);

  return Promise.resolve({
    id: Number(info.lastInsertRowid),
    claim: opts.claim,
    section,
    validity: 'untested',
    created_at: createdAt,
  });
}

/**
 * Update an assumption's validity status and evidence arrays.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {number} assumptionId - Assumption ID to update
 * @param {string} newValidity - New validity ('supported', 'contradicted', 'stale')
 * @param {object} [opts={}] - Options
 * @param {string} [opts.evidence] - Evidence artifact/source that changed validity
 * @returns {Promise<{success: boolean, id: number, validity: string}>}
 */
async function updateAssumptionValidity(db, assumptionId, newValidity, opts = {}) {
  const lastTested = new Date().toISOString();

  // Read current assumption
  const current = db.prepare('SELECT * FROM assumptions WHERE id = ?').get(assumptionId);
  if (!current) {
    throw new Error(`Assumption ${assumptionId} not found`);
  }

  // Parse existing evidence arrays
  let evidenceFor;
  let evidenceAgainst;
  try { evidenceFor = JSON.parse(current.evidence_for); } catch { evidenceFor = []; }
  try { evidenceAgainst = JSON.parse(current.evidence_against); } catch { evidenceAgainst = []; }

  // Append evidence based on validity direction
  if (newValidity === 'supported' && opts.evidence) {
    evidenceFor.push(opts.evidence);
  } else if (newValidity === 'contradicted' && opts.evidence) {
    evidenceAgainst.push(opts.evidence);
  }

  // Set invalidated_at for stale
  const invalidatedAt = newValidity === 'stale' ? lastTested : current.invalidated_at;

  db.prepare(
    'UPDATE assumptions SET validity = ?, evidence_for = ?, evidence_against = ?, last_tested = ?, invalidated_at = ? WHERE id = ?'
  ).run(newValidity, JSON.stringify(evidenceFor), JSON.stringify(evidenceAgainst), lastTested, invalidatedAt, assumptionId);

  return Promise.resolve({ success: true, id: assumptionId, validity: newValidity });
}

/**
 * Get assumptions, optionally filtered by section and/or validity.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {object} [filters={}] - Optional filters
 * @param {string} [filters.section] - Filter by room section
 * @param {string} [filters.validity] - Filter by validity status
 * @returns {Promise<Array<object>>}
 */
async function getAssumptions(db, filters = {}) {
  let query = 'SELECT * FROM assumptions';
  const conditions = [];
  const params = [];

  if (filters.section) {
    conditions.push('section = ?');
    params.push(filters.section);
  }
  if (filters.validity) {
    conditions.push('validity = ?');
    params.push(filters.validity);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const rows = db.prepare(query).all(...params);

  // Parse JSON evidence fields
  for (const row of rows) {
    try { row.evidence_for = JSON.parse(row.evidence_for); } catch { row.evidence_for = []; }
    try { row.evidence_against = JSON.parse(row.evidence_against); } catch { row.evidence_against = []; }
  }

  return Promise.resolve(rows);
}

// --- Scaffold + Voice Log Helpers (Phase 84) ---

/**
 * Insert a row into scaffold_log. Records a materialization audit event.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {object} opts
 * @param {string} opts.action - e.g. 'materialize', 'dematerialize'
 * @param {string} opts.section - Room section name
 * @param {string} [opts.collection] - Optional collection identifier
 * @param {string} [opts.user_reason] - Optional user-provided reason
 * @param {string} opts.surface - 'cli' | 'desktop' | 'cowork'
 * @returns {Promise<{id: number, timestamp: string}>}
 */
async function logScaffoldAction(db, opts) {
  const timestamp = new Date().toISOString();
  const collection = opts.collection || null;
  const userReason = opts.user_reason || null;

  const info = db.prepare(
    'INSERT INTO scaffold_log (timestamp, action, section, collection, user_reason, surface) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(timestamp, opts.action, opts.section, collection, userReason, opts.surface);

  return Promise.resolve({
    id: Number(info.lastInsertRowid),
    timestamp,
  });
}

/**
 * Insert a stub row into voice_log. Used by PostCompact/Stop hooks in v1.10.8
 * to reserve schema space for the synthesis voice. question/confidence are null,
 * artifacts_cited and contradictions_flagged default to '[]'.
 * @param {import('better-sqlite3').Database} db - better-sqlite3 Database instance
 * @param {object} opts
 * @param {string} opts.command - Command that triggered the stub write
 * @param {string} [opts.answer_summary] - Optional summary text
 * @returns {Promise<{id: number, timestamp: string}>}
 */
async function writeVoiceLogStub(db, opts) {
  const timestamp = new Date().toISOString();
  const answerSummary = opts.answer_summary || null;

  const info = db.prepare(
    'INSERT INTO voice_log (timestamp, command, question, answer_summary, artifacts_cited, confidence, contradictions_flagged) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(timestamp, opts.command, null, answerSummary, '[]', null, '[]');

  return Promise.resolve({
    id: Number(info.lastInsertRowid),
    timestamp,
  });
}

// --- Exports ---

module.exports = {
  initMemorySchema,
  setIdentity,
  getIdentity,
  addFact,
  getValidFacts,
  invalidateFact,
  startSession,
  endSession,
  addFragment,
  getSessionHistory,
  createAssumption,
  updateAssumptionValidity,
  getAssumptions,
  logScaffoldAction,
  writeVoiceLogStub,
};
