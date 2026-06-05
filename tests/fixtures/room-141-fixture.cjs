'use strict';
// Phase 141 Wave-0 fixture: a populated in-memory room.db builder.
//
// buildFixtureDb() opens an in-memory node:sqlite DatabaseSync, applies a
// minimal nodes + edges + sessions + fragments schema inline (mirrors the
// applySchema idiom from tests/test-feynman-timeline-canon-part-9-invariant.cjs
// and the live schemas in lib/core/lazygraph-ops.cjs + lib/core/memory-ops.cjs +
// lib/core/migrations/phase-109-nodes-provenance.cjs), and seeds:
//   - one section node + two claim nodes (one CONTRADICTS edge between the
//     claims so neighborhood ranking has a top-weighted edge to surface)
//   - one EvidenceClaim-shaped node slot the FILEVAL suite can read back
//   - one session with ~6 fragments whose section_context points at the section
//
// This single fixture feeds the RETR-01 fusion, RETR-02 seed, RETR-04 latency,
// and FILEVAL-02 read-back suites. Caller-owned handle: the caller closes the db.
// It NEVER opens a real room.db (Canon Part 9 chokepoint discipline).
//
// node:sqlite-unavailable SKIP idiom (exit 77) mirrors the canon-invariant test.
// House rule: hyphens only, no em-dashes.

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP room-141-fixture.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

// The nodes schema mirrors the Phase 109 nodes-provenance migrated shape so the
// neighborhood CTE (which reads source_section, review_status, created_by,
// confidence, last_seen_at, created_at, source_path) and the EvidenceClaim
// writer (which UPSERTs id/type/properties/source_path/created_by/confidence/
// review_status/created_at/last_seen_at) both find every column they expect.
function applySchema(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS nodes (' +
    '  id TEXT PRIMARY KEY,' +
    '  type TEXT NOT NULL,' +
    "  properties TEXT DEFAULT '{}'," +
    '  source_path TEXT NOT NULL,' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system'))," +
    '  confidence REAL,' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed'" +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated'))," +
    '  created_at INTEGER NOT NULL,' +
    '  last_seen_at INTEGER NOT NULL,' +
    '  source_section TEXT,' +
    '  confirmed_by TEXT,' +
    '  confirmed_at INTEGER' +
    ');'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS edges (' +
    '  source TEXT NOT NULL,' +
    '  target TEXT NOT NULL,' +
    '  type TEXT NOT NULL,' +
    "  properties TEXT DEFAULT '{}'," +
    '  PRIMARY KEY (source, target, type)' +
    ');'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS sessions (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  started_at TEXT NOT NULL,' +
    '  ended_at TEXT,' +
    '  summary TEXT,' +
    "  key_decisions TEXT DEFAULT '[]'," +
    "  open_questions TEXT DEFAULT '[]'," +
    '  methodology_used TEXT,' +
    "  artifacts_filed TEXT DEFAULT '[]'" +
    ');'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS fragments (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  session_id INTEGER NOT NULL REFERENCES sessions(id),' +
    '  role TEXT NOT NULL,' +
    '  content TEXT NOT NULL,' +
    '  timestamp TEXT NOT NULL,' +
    '  section_context TEXT' +
    ');'
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_fragments_session_id ON fragments(session_id);');
}

function insertNode(db, node) {
  db.prepare(
    'INSERT INTO nodes ' +
    '(id, type, properties, source_path, created_by, confidence, review_status, ' +
    ' created_at, last_seen_at, source_section) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    node.id,
    node.type,
    JSON.stringify(node.properties || {}),
    node.source_path,
    node.created_by || 'system',
    typeof node.confidence === 'number' ? node.confidence : null,
    node.review_status || 'proposed',
    node.created_at,
    node.last_seen_at,
    node.source_section || null
  );
}

function insertEdge(db, edge) {
  db.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)'
  ).run(edge.source, edge.target, edge.type, JSON.stringify(edge.properties || {}));
}

function buildFixtureDb() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);

  const NOW_MS = 1717000000000;
  const SECTION = 'market-analysis';

  // One section node -- the conversation seed resolves to this via section_context.
  insertNode(db, {
    id: 'section:market-analysis',
    type: 'section',
    properties: { title: 'Market Analysis', summary: 'Market sizing and competitive landscape for the venture.' },
    source_path: 'market-analysis',
    created_by: 'user',
    confidence: 0.8,
    review_status: 'confirmed',
    created_at: NOW_MS - 100000,
    last_seen_at: NOW_MS - 1000,
    source_section: SECTION,
  });

  // Two claim nodes with a CONTRADICTS edge so neighborhood ranking (CONTRADICTS
  // weight 1.0) returns a non-empty, top-ranked relevant node for Leg C.
  insertNode(db, {
    id: 'claim:tam-large',
    type: 'claim',
    properties: { claim: 'The total addressable market exceeds two billion dollars.', summary: 'TAM is very large.' },
    source_path: 'market-analysis',
    created_by: 'larry',
    confidence: 0.6,
    review_status: 'proposed',
    created_at: NOW_MS - 90000,
    last_seen_at: NOW_MS - 2000,
    source_section: SECTION,
  });
  insertNode(db, {
    id: 'claim:tam-small',
    type: 'claim',
    properties: { claim: 'The serviceable market is under fifty million dollars.', summary: 'Serviceable market is small.' },
    source_path: 'market-analysis',
    created_by: 'larry',
    confidence: 0.7,
    review_status: 'proposed',
    created_at: NOW_MS - 80000,
    last_seen_at: NOW_MS - 3000,
    source_section: SECTION,
  });
  // The section node links to the two claims so a section-seeded neighborhood
  // walk reaches them, and the claims contradict each other.
  insertEdge(db, { source: 'section:market-analysis', target: 'claim:tam-large', type: 'INFORMS', properties: { reason: 'section_informs_claim' } });
  insertEdge(db, { source: 'section:market-analysis', target: 'claim:tam-small', type: 'INFORMS', properties: { reason: 'section_informs_claim' } });
  insertEdge(db, { source: 'claim:tam-large', target: 'claim:tam-small', type: 'CONTRADICTS', properties: { reason: 'tam_vs_sam' } });

  // One EvidenceClaim-shaped node slot the FILEVAL read-back suite can target.
  insertNode(db, {
    id: 'EvidenceClaim:fixture:seed',
    type: 'EvidenceClaim',
    properties: {
      source: 'Fixture Source',
      url: 'https://example.org/fixture-evidence',
      retrieved_at: '2026-06-05',
      evidence_tier: 'Practitioner',
      topic: 'market sizing methodology',
      summary: 'A seeded evidence claim for the read-back fixture.',
    },
    source_path: 'research:Fixture Source:fixture',
    created_by: 'system',
    confidence: null,
    review_status: 'proposed',
    created_at: NOW_MS - 50000,
    last_seen_at: NOW_MS - 50000,
    source_section: SECTION,
  });

  // One session with 6 fragments whose section_context points at the section.
  const sessionInfo = db.prepare(
    'INSERT INTO sessions (started_at, summary, methodology_used) VALUES (?, ?, ?)'
  ).run('2026-06-05T08:00:00Z', 'Discussed market sizing and the TAM/SAM tension.', 'market-analysis');
  const sessionId = Number(sessionInfo.lastInsertRowid);

  const fragments = [
    { role: 'user', content: 'Let us look at the market for this venture.', ts: '2026-06-05T08:00:01Z' },
    { role: 'assistant', content: 'The total addressable market looks large at first pass.', ts: '2026-06-05T08:00:05Z' },
    { role: 'user', content: 'But how much of that can we actually serve?', ts: '2026-06-05T08:00:10Z' },
    { role: 'assistant', content: 'The serviceable slice is much smaller, under fifty million.', ts: '2026-06-05T08:00:15Z' },
    { role: 'user', content: 'Do you remember what we decided about the TAM earlier?', ts: '2026-06-05T08:00:20Z' },
    { role: 'assistant', content: 'We flagged a contradiction between the TAM and the serviceable market.', ts: '2026-06-05T08:00:25Z' },
  ];
  const fragStmt = db.prepare(
    'INSERT INTO fragments (session_id, role, content, timestamp, section_context) VALUES (?, ?, ?, ?, ?)'
  );
  for (const f of fragments) {
    fragStmt.run(sessionId, f.role, f.content, f.ts, SECTION);
  }

  return db;
}

module.exports = { buildFixtureDb, applySchema };
