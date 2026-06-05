'use strict';
// Phase 142 Wave-0 fixture: a populated in-memory room.db builder.
//
// Cloned from tests/fixtures/room-141-fixture.cjs (Canon Part 7, Reuse Before
// Build) with the same Phase-109 nodes-provenance schema (nodes + edges +
// sessions + fragments). Seeded RICHER than 141 so the Phase 142 loop-fires
// suites have real signal to assert against:
//   - one room: root node + one section node
//   - two claim nodes joined by a CONTRADICTS edge (so getNeighborhood ranking
//     returns a non-empty, top-weighted neighborhood for the spine-navigates +
//     tier-rise suites)
//   - two INFORMS edges (section -> each claim) so a section-seeded walk reaches
//     the claims
//   - one EvidenceClaim-shaped node slot the FILEVAL read-back-surface suite can
//     target
//   - one session with 6 fragments whose section_context points at the section
//     (so the getRoomContext Leg-B windowed-session-history seed resolves)
//
// The db handle is CALLER-OWNED: the caller closes it. This fixture NEVER opens
// a real room.db and NEVER imports room-db.cjs (Canon Part 9 chokepoint
// discipline -- the only allowed graph read is via the navigation chokepoint,
// and a fixture must not reach for the real handle).
//
// node:sqlite-unavailable SKIP idiom (exit 77) mirrors the 141 fixture.
// House rule: hyphens only, no em-dashes.

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP room-142-fixture.cjs (node:sqlite unavailable)\n');
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

  // One room: root node -- the top of the ICM hierarchy (Canon Part 1).
  insertNode(db, {
    id: 'room:fixture-room',
    type: 'room',
    properties: { title: 'Fixture Venture Room', summary: 'A seeded venture room for the Phase 142 loop-fires suites.' },
    source_path: '.',
    created_by: 'user',
    confidence: 0.9,
    review_status: 'confirmed',
    created_at: NOW_MS - 200000,
    last_seen_at: NOW_MS - 500,
    source_section: null,
  });

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
  // The room contains the section.
  insertEdge(db, { source: 'room:fixture-room', target: 'section:market-analysis', type: 'CONTAINS', properties: { reason: 'room_contains_section' } });

  // Two claim nodes with a CONTRADICTS edge so neighborhood ranking (CONTRADICTS
  // weight 1.0) returns a non-empty, top-ranked relevant node for the
  // spine-navigates + tier-rise neighborhood walks.
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

  // One EvidenceClaim-shaped node slot the FILEVAL read-back-surface suite can target.
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

  // One session with 6 fragments whose section_context points at the section,
  // so the getRoomContext Leg-B windowed-session-history seed resolves.
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
