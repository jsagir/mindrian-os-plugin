/**
 * MindrianOS Plugin -- LazyGraph Operations
 * SQLite-backed per-project queryable knowledge graph via node:sqlite DatabaseSync.
 * Graph stored in room/.mindrian/room.db (WAL mode for concurrent reads).
 *
 * Exports: openGraph, closeGraph, initSchema, indexArtifact,
 *          rebuildGraph, queryGraph, graphStats, embedArtifact,
 *          + 12 edge-creator functions + EDGE_TYPES constant
 *
 * All functions remain async for backward compatibility with callers
 * that use await. Awaiting a synchronous return resolves immediately.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { discoverSections } = require('./section-registry.cjs');

// --- Schema ---

/** All relationship (edge) types in the LazyGraph */
const EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO', 'REASONING_INFORMS', 'HSI_CONNECTION', 'REVERSE_SALIENT', 'ANALOGOUS_TO', 'STRUCTURALLY_ISOMORPHIC', 'RESOLVES_VIA', 'CAUSES', 'ROOT_CAUSE_OF', 'CASCADES_TO', 'EXTRACTED_FROM', 'WHITESPACE_DETECTED', 'WHITESPACE_NEAR', 'DISCOVERY_CYCLE_SOURCE', 'DISCOVERED', 'DERIVED_FROM', 'AUTHORED_BY', 'AFFILIATED_WITH'];

/**
 * Create nodes and edges tables with indexes. Idempotent.
 * @param {import('node:sqlite').DatabaseSync} db - node:sqlite DatabaseSync instance
 */
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS edges (
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      PRIMARY KEY (source, target, type),
      FOREIGN KEY (source) REFERENCES nodes(id),
      FOREIGN KEY (target) REFERENCES nodes(id)
    );
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
    CREATE INDEX IF NOT EXISTS idx_edges_source_type ON edges(source, type);
    CREATE INDEX IF NOT EXISTS idx_edges_target_type ON edges(target, type);
    CREATE TABLE IF NOT EXISTS stakeholders (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      canonical_ref TEXT,
      notes TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stakeholders_type ON stakeholders(type);
    CREATE INDEX IF NOT EXISTS idx_stakeholders_canonical ON stakeholders(canonical_ref);
  `);
}

// --- Stakeholder helpers (Phase 84-05, SCOPE-NB-03 / SCOPE-NB-04) ---

/** Allowed stakeholder.type values per Phase 84-05 spec. */
const STAKEHOLDER_TYPES = ['person', 'org', 'coalition', 'role'];

/**
 * Validate a stakeholder type string. Throws TypeError on mismatch.
 * @param {string} type
 */
function validateStakeholderType(type) {
  if (!STAKEHOLDER_TYPES.includes(type)) {
    throw new TypeError(`Invalid stakeholder type: ${type}. Must be one of ${STAKEHOLDER_TYPES.join(', ')}`);
  }
}

/**
 * Create a new Stakeholder row.
 * Generates a UUID, stamps created_at and updated_at, inserts the row.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {object} fields
 * @param {string} fields.type - person | org | coalition | role
 * @param {string} fields.name
 * @param {string} [fields.canonical_ref]
 * @param {string} [fields.notes]
 * @param {object|string} [fields.metadata]
 * @returns {Promise<object|null>} The new row or null on failure.
 */
async function createStakeholder(db, fields) {
  try {
    const { type, name } = fields || {};
    validateStakeholderType(type);
    if (!name || typeof name !== 'string') {
      throw new TypeError('Stakeholder name is required');
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const canonical_ref = fields.canonical_ref || null;
    const notes = fields.notes || null;
    const metadata = typeof fields.metadata === 'string'
      ? fields.metadata
      : JSON.stringify(fields.metadata || {});
    db.prepare(
      'INSERT INTO stakeholders (id, type, name, canonical_ref, notes, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, type, name, canonical_ref, notes, metadata, now, now);
    return Promise.resolve({ id, type, name, canonical_ref, notes, metadata, created_at: now, updated_at: now });
  } catch (e) {
    if (e instanceof TypeError) throw e;
    return Promise.resolve(null);
  }
}

/**
 * Get a Stakeholder row by id.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getStakeholder(db, id) {
  try {
    const row = db.prepare('SELECT * FROM stakeholders WHERE id = ?').get(id);
    return Promise.resolve(row || null);
  } catch (e) {
    return Promise.resolve(null);
  }
}

/**
 * Upsert a Stakeholder by canonical_ref. Updates in place if present, else inserts.
 * Updates updated_at on every call.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} canonical_ref
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
async function upsertStakeholder(db, canonical_ref, fields) {
  try {
    if (!canonical_ref) {
      throw new TypeError('canonical_ref is required for upsertStakeholder');
    }
    const existing = db.prepare('SELECT * FROM stakeholders WHERE canonical_ref = ?').get(canonical_ref);
    const now = new Date().toISOString();
    if (existing) {
      const type = fields.type || existing.type;
      validateStakeholderType(type);
      const name = fields.name || existing.name;
      const notes = fields.notes !== undefined ? fields.notes : existing.notes;
      const metadata = fields.metadata !== undefined
        ? (typeof fields.metadata === 'string' ? fields.metadata : JSON.stringify(fields.metadata))
        : existing.metadata;
      db.prepare(
        'UPDATE stakeholders SET type = ?, name = ?, notes = ?, metadata = ?, updated_at = ? WHERE id = ?'
      ).run(type, name, notes, metadata, now, existing.id);
      return Promise.resolve({ ...existing, type, name, notes, metadata, updated_at: now });
    }
    return createStakeholder(db, { ...fields, canonical_ref });
  } catch (e) {
    if (e instanceof TypeError) throw e;
    return Promise.resolve(null);
  }
}

/**
 * Find stakeholders connected to a claim artifact via INFORMS edges.
 * Walks both directions (stakeholder INFORMS claim, claim INFORMS stakeholder).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} claim_artifact_id
 * @returns {Promise<Array<object>>}
 */
async function findStakeholdersByClaim(db, claim_artifact_id) {
  try {
    const rows = db.prepare(
      `SELECT s.* FROM stakeholders s
       WHERE s.id IN (
         SELECT source FROM edges WHERE target = ? AND type = 'INFORMS'
         UNION
         SELECT target FROM edges WHERE source = ? AND type = 'INFORMS'
       )
       LIMIT 20`
    ).all(claim_artifact_id, claim_artifact_id);
    return Promise.resolve(rows || []);
  } catch (e) {
    return Promise.resolve([]);
  }
}

// --- Helpers ---

/**
 * Get artifact ID from file path relative to room dir.
 * @param {string} filePath - Absolute path to .md file
 * @param {string} roomDir - Absolute path to room directory
 * @returns {string} e.g. "problem-definition/market-trends"
 */
function getArtifactId(filePath, roomDir) {
  const rel = path.relative(path.resolve(roomDir), path.resolve(filePath));
  return rel.replace(/\.md$/, '').replace(/\\/g, '/');
}

/**
 * Extract title from first # heading in file content.
 * @param {string} content - File content
 * @param {string} filePath - Fallback basename
 * @returns {string}
 */
function extractTitle(content, filePath) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

/**
 * Extract a frontmatter field value.
 * @param {string} content - File content
 * @param {string} field - Field name
 * @returns {string}
 */
function extractFrontmatter(content, field) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return '';
  const line = fmMatch[1].split('\n').find(l => l.startsWith(field + ':'));
  if (!line) return '';
  return line.slice(field.length + 1).trim().replace(/^["']|["']$/g, '');
}

/**
 * Compute MD5 content hash (first 8 hex chars).
 * @param {string} content
 * @returns {string}
 */
function computeHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

// --- Contradiction detection terms ---
const CONTRADICT_TERMS = ['however', 'contradicts', 'unlike', 'disagrees', 'conflicts', 'contrary', 'opposes'];

// --- Core Functions ---

/**
 * Open (or create) a SQLite database at {roomDir}/.mindrian/room.db.
 * Enables WAL mode and foreign keys. Initializes schema.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{db: import('node:sqlite').DatabaseSync, conn: import('node:sqlite').DatabaseSync}>}
 */
async function openGraph(roomDir) {
  const resolved = path.resolve(roomDir);
  const dbDir = path.join(resolved, '.mindrian');
  const dbPath = path.join(dbDir, 'room.db');

  // Ensure directories exist
  fs.mkdirSync(dbDir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  initSchema(db);

  // conn === db in SQLite (single object handles both)
  return Promise.resolve({ db, conn: db });
}

/**
 * Close SQLite database.
 * @param {import('node:sqlite').DatabaseSync} db - node:sqlite DatabaseSync instance
 */
async function closeGraph(db) {
  try {
    db.close();
  } catch (e) {
    // Handle already-closed or invalid db gracefully
  }
  return Promise.resolve();
}

/**
 * Index a single .md artifact into the graph.
 * Creates Artifact node, Section node, BELONGS_TO edge.
 * Scans for [[wikilinks]] to create INFORMS edges.
 * Scans for contradiction terms near wikilinks to create CONTRADICTS edges.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} filePath - Absolute path to .md file
 * @returns {Promise<{id: string, section: string, title: string, contentHash: string}>}
 */
/**
 * Internal: run the INSERT body of indexArtifact WITHOUT opening a transaction.
 * The caller is responsible for transaction semantics. Used by:
 *   - indexArtifact() -- wraps this in BEGIN/COMMIT/ROLLBACK
 *   - rebuildGraph() -- calls this inside its own outer BEGIN/COMMIT so the
 *     whole rebuild is atomic (no nested transactions, which SQLite forbids
 *     without SAVEPOINT).
 * @param {import('node:sqlite').DatabaseSync} conn
 * @param {string} roomDir
 * @param {string} filePath
 * @returns {{id: string, section: string, title: string, contentHash: string}}
 */
function _indexArtifactBody(conn, roomDir, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const id = getArtifactId(filePath, roomDir);
  const section = id.split('/')[0];
  const title = extractTitle(content, filePath);
  const methodology = extractFrontmatter(content, 'methodology');
  const created = extractFrontmatter(content, 'date');
  const contentHash = computeHash(content);
  const enables = extractFrontmatter(content, 'enables');
  const invalidates = extractFrontmatter(content, 'invalidates');
  const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
  const artifactProps = JSON.stringify({ title, section, methodology, created, content_hash: contentHash });
  const sectionLabel = section.replace(/-/g, ' ').toUpperCase();
  const sectionProps = JSON.stringify({ name: section, label: sectionLabel });

  // Upsert Artifact node
  conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, properties = excluded.properties'
  ).run(id, 'Artifact', artifactProps);

  // Upsert Section node
  conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties'
  ).run(section, 'Section', sectionProps);

  // Upsert BELONGS_TO edge
  conn.prepare(
    'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  ).run(id, section, 'BELONGS_TO');

  // Scan for [[wikilinks]] to create INFORMS edges
  for (const link of wikilinks) {
    const target = link.replace(/\[\[|\]\]/g, '').toLowerCase().replace(/\s/g, '-');

    const linkIdx = content.indexOf(link);
    const contextStart = Math.max(0, linkIdx - 200);
    const contextEnd = Math.min(content.length, linkIdx + 200);
    const nearbyText = content.slice(contextStart, contextEnd).toLowerCase();

    const isContradiction = CONTRADICT_TERMS.some(term => nearbyText.includes(term));

    const targetArtifacts = conn.prepare(
      "SELECT id FROM nodes WHERE type = 'Artifact' AND json_extract(properties, '$.section') = ?"
    ).all(target);

    for (const row of targetArtifacts) {
      const targetId = row.id;
      if (targetId === id) continue;

      if (isContradiction) {
        const contradictProps = JSON.stringify({ confidence: 'medium' });
        conn.prepare(
          'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
        ).run(id, targetId, 'CONTRADICTS', contradictProps);
      }

      conn.prepare(
        'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
      ).run(id, targetId, 'INFORMS');
    }
  }

  if (enables) {
    const targetRows = conn.prepare("SELECT id FROM nodes WHERE id = ? AND type = 'Artifact'").all(enables);
    for (const row of targetRows) {
      conn.prepare(
        'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
      ).run(id, row.id, 'ENABLES');
    }
  }

  if (invalidates) {
    const targetRows = conn.prepare("SELECT id FROM nodes WHERE id = ? AND type = 'Artifact'").all(invalidates);
    for (const row of targetRows) {
      conn.prepare(
        'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
      ).run(id, row.id, 'INVALIDATES');
    }
  }

  return { id, section, title, contentHash };
}

async function indexArtifact(conn, roomDir, filePath) {
  // --- Transaction: all INSERTs or none (Plan 87-06 / CASCADE-04) ---
  // node:sqlite DatabaseSync does NOT expose a transaction(fn) higher-order
  // helper (that is a better-sqlite3 API). We use explicit BEGIN/COMMIT with
  // ROLLBACK on any throw. On successful completion, SQLite commits the
  // block; on any error, we roll back the partial writes and re-throw so
  // the caller sees the original error.
  //
  // Why this matters (CASCADE-04): a pre-patch throw between two INSERTs
  // could leave dangling nodes without their edges, or vice versa. The
  // BEGIN/COMMIT wrapper converts the whole indexArtifact body into a
  // single atomic unit. The post-condition is either "all writes survive"
  // or "no writes survive" -- there is no middle state.
  //
  // Pure computation (file read, hash, wikilink scan) runs inside the txn
  // but is idempotent and side-effect free. Moving it outside would require
  // duplicating it in _indexArtifactBody and the rebuildGraph call site;
  // keeping it inside keeps indexArtifact a thin BEGIN/COMMIT shell.
  conn.prepare('BEGIN').run();
  let result;
  try {
    result = _indexArtifactBody(conn, roomDir, filePath);
    conn.prepare('COMMIT').run();
  } catch (err) {
    // ROLLBACK undoes every INSERT issued since BEGIN. We swallow any error
    // from ROLLBACK itself (rare: can happen if the connection is already
    // aborted) and always re-throw the ORIGINAL error so the caller sees
    // the failure reason, not a ROLLBACK noise error.
    try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
    throw err;
  }

  return Promise.resolve(result);
}

/**
 * Rebuild the entire graph from all room artifacts.
 * Clears existing data, walks all sections, indexes every .md file.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} roomDir - Absolute path to room directory
 * @returns {Promise<{success: boolean, artifacts: number, sections: number}>}
 */
async function rebuildGraph(conn, roomDir) {
  const resolved = path.resolve(roomDir);

  // Wrap entire rebuild in a transaction for atomicity.
  // If anything throws mid-rebuild, the DB rolls back to pre-rebuild state.
  //
  // NOTE (Plan 87-06): use explicit BEGIN/COMMIT/ROLLBACK because
  // node:sqlite DatabaseSync does NOT expose a transaction(fn) higher-order
  // helper (that is a better-sqlite3 API). Calling the inner
  // `_indexArtifactBody` (not `indexArtifact`) avoids a nested BEGIN that
  // SQLite would reject ("cannot start a transaction within a transaction"
  // without SAVEPOINT).
  const discovery = discoverSections(resolved);
  const sectionNames = discovery.all;
  let artifactCount = 0;

  conn.prepare('BEGIN').run();
  try {
    // Clear all existing data (edges first for FK compliance)
    conn.exec('DELETE FROM edges; DELETE FROM nodes;');

    for (const sectionName of sectionNames) {
      const sectionDir = path.join(resolved, sectionName);
      let files;
      try {
        files = fs.readdirSync(sectionDir).filter(f =>
          f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md'
        );
      } catch (e) {
        continue; // skip this section
      }

      for (const file of files) {
        const filePath = path.join(sectionDir, file);
        _indexArtifactBody(conn, resolved, filePath); // inside outer BEGIN, no nested txn
        artifactCount++;
      }
    }
    conn.prepare('COMMIT').run();
  } catch (err) {
    try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
    throw err;
  }

  return Promise.resolve({ success: true, artifacts: artifactCount, sections: sectionNames.length });
}

/**
 * Execute a SQL query and return all result rows.
 * Gracefully returns empty array on error.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} sql - SQL query string
 * @returns {Promise<Array<object>>}
 */
async function queryGraph(conn, sql) {
  try {
    const stmt = conn.prepare(sql);
    return Promise.resolve(stmt.all());
  } catch (e) {
    return Promise.resolve([]);
  }
}

/**
 * Get graph statistics: node counts, edge counts, totals.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @returns {Promise<{nodes: object, edges: object, total: {nodes: number, edges: number}}>}
 */
async function graphStats(conn) {
  // Count nodes by type
  // Count ALL node types dynamically (not hardcoded)
  const nodeCounts = {};
  const nodeRows = conn.prepare('SELECT type, COUNT(*) AS cnt FROM nodes GROUP BY type').all();
  for (const row of nodeRows) {
    nodeCounts[row.type] = row.cnt;
  }

  // Count edges by type
  const edges = {};
  for (const edgeType of EDGE_TYPES) { edges[edgeType] = 0; }
  const edgeRows = conn.prepare('SELECT type, COUNT(*) AS cnt FROM edges GROUP BY type').all();
  for (const row of edgeRows) {
    if (row.type in edges) {
      edges[row.type] = row.cnt;
    }
  }

  const totalNodes = Object.values(nodeCounts).reduce((sum, n) => sum + n, 0);
  const totalEdges = Object.values(edges).reduce((sum, n) => sum + n, 0);

  return Promise.resolve({
    nodes: nodeCounts,
    edges,
    total: { nodes: totalNodes, edges: totalEdges },
  });
}

/**
 * Tier 2 Pinecone semantic layer stub.
 * Embeds an artifact for semantic search when Pinecone is configured.
 * Gracefully degrades when Pinecone env vars are not set.
 *
 * Contract: embedArtifact(roomDir, filePath) -> { success: boolean, reason?: string, embeddingId?: string }
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} filePath - Absolute path to .md artifact file
 * @returns {Promise<{success: boolean, reason?: string, embeddingId?: string}>}
 */
async function embedArtifact(roomDir, filePath) {
  // Read the artifact content (validates the file exists)
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return { success: false, reason: `Artifact not found: ${filePath}` };
  }

  const apiKey = process.env.PINECONE_API_KEY;
  const index = process.env.PINECONE_INDEX;

  if (!apiKey || !index) {
    return {
      success: false,
      reason: 'Pinecone Tier 2 not configured - set PINECONE_API_KEY and PINECONE_INDEX to enable semantic search',
    };
  }

  // Pinecone env vars are set but integration not yet wired
  return {
    success: false,
    reason: 'Pinecone Tier 2 integration not yet implemented - stub ready for future wiring',
  };
}

// --- Design-by-Analogy Edge Creation (DBA-08) ---

/**
 * Create an ANALOGOUS_TO edge between two artifacts.
 * Records functional analogy with distance, fitness, and transfer mapping.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} sourceId - Source artifact ID
 * @param {string} targetId - Target artifact ID
 * @param {object} props - Edge properties
 * @param {string} [props.analogy_distance='near'] - near|far|cross-domain
 * @param {number} [props.structural_fitness=0.0] - 0-1 structural fitness score
 * @param {string} [props.source_domain=''] - Domain of the source analogy
 * @param {string} [props.transfer_map='{}'] - JSON string mapping source to target elements
 * @param {string} [props.discovery_method='hsi'] - hsi|brain|llm|external|user
 * @returns {Promise<boolean>}
 */
async function createAnalogyEdge(conn, sourceId, targetId, props = {}) {
  const edgeProps = JSON.stringify({
    analogy_distance: props.analogy_distance || 'near',
    structural_fitness: props.structural_fitness || 0.0,
    source_domain: props.source_domain || '',
    transfer_map: props.transfer_map || '{}',
    discovery_method: props.discovery_method || 'hsi',
  });

  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(sourceId, targetId, 'ANALOGOUS_TO', edgeProps);
  return Promise.resolve(true);
}

/**
 * Create a STRUCTURALLY_ISOMORPHIC edge between two sections.
 * Records identical relational topology between room sections.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} sectionA - Source section name
 * @param {string} sectionB - Target section name
 * @param {object} props - Edge properties
 * @param {number} [props.isomorphism_score=0.0] - 0-1 isomorphism score
 * @param {string} [props.mapped_elements='{}'] - JSON string of element mappings
 * @param {string} [props.source=''] - Source of the isomorphism detection
 * @returns {Promise<boolean>}
 */
async function createIsomorphismEdge(conn, sectionA, sectionB, props = {}) {
  const edgeProps = JSON.stringify({
    isomorphism_score: props.isomorphism_score || 0.0,
    mapped_elements: props.mapped_elements || '{}',
    source: props.source || '',
  });

  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(sectionA, sectionB, 'STRUCTURALLY_ISOMORPHIC', edgeProps);
  return Promise.resolve(true);
}

/**
 * Create a RESOLVES_VIA edge linking a contradiction to its resolution.
 * Closes the loop: contradiction -> analogy/TRIZ -> resolution.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} sourceId - Artifact ID (the contradicting artifact)
 * @param {string} targetId - Artifact ID (the resolution artifact)
 * @param {object} props - Edge properties
 * @param {string} [props.resolution_type='direct'] - analogy|triz_principle|direct
 * @param {string} [props.triz_principle=''] - TRIZ principle number/name if applicable
 * @param {string} [props.analogy_source=''] - Source analogy reference if applicable
 * @param {number} [props.confidence=0.0] - 0-1 confidence in resolution
 * @returns {Promise<boolean>}
 */
async function createResolutionEdge(conn, sourceId, targetId, props = {}) {
  const edgeProps = JSON.stringify({
    resolution_type: props.resolution_type || 'direct',
    triz_principle: props.triz_principle || '',
    analogy_source: props.analogy_source || '',
    confidence: props.confidence || 0.0,
  });

  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(sourceId, targetId, 'RESOLVES_VIA', edgeProps);
  return Promise.resolve(true);
}

// --- Causal Extraction CRUD (Phase 53) ---

/**
 * Create or update a CausalClaim node in SQLite.
 * Writes all 12 properties as JSON. Truncates cause/effect to 200 chars,
 * mechanism to 300 chars to prevent oversized nodes.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {object} claim - CausalClaim properties
 * @param {string} claim.id - Unique claim ID
 * @param {string} claim.cause - Cause statement (truncated to 200 chars)
 * @param {string} claim.mechanism - Mechanism explanation (truncated to 300 chars)
 * @param {string} claim.effect - Effect statement (truncated to 200 chars)
 * @param {number} [claim.confidence=0.5] - Confidence score (0-1)
 * @param {string} [claim.evidence='[]'] - JSON array of evidence references
 * @param {string} [claim.source_artifact=''] - Source artifact ID
 * @param {string} [claim.domain='general'] - Domain classification
 * @param {string} [claim.falsifiable_prediction=''] - Testable prediction
 * @param {number} [claim.novelty_score=0.0] - Novelty score (0-1)
 * @param {string} [claim.extraction_method='inferred'] - observed|asserted|inferred
 * @param {string} [claim.created=''] - ISO date string
 * @returns {Promise<boolean>}
 */
async function createCausalClaim(conn, claim) {
  const cause = (claim.cause || '').slice(0, 200);
  const mechanism = (claim.mechanism || '').slice(0, 300);
  const effect = (claim.effect || '').slice(0, 200);
  const confidence = typeof claim.confidence === 'number' ? claim.confidence : 0.5;
  const evidence = Array.isArray(claim.evidence) ? JSON.stringify(claim.evidence) : (claim.evidence || '[]');
  const sourceArtifact = claim.source_artifact || '';
  const domain = claim.domain || 'general';
  const prediction = claim.falsifiable_prediction || '';
  const novelty = typeof claim.novelty_score === 'number' ? claim.novelty_score : 0.0;
  const method = claim.extraction_method || 'inferred';
  const created = claim.created || '';

  const props = JSON.stringify({
    cause, mechanism, effect, confidence, evidence, source_artifact: sourceArtifact,
    domain, falsifiable_prediction: prediction, novelty_score: novelty,
    extraction_method: method, created,
  });

  conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, properties = excluded.properties'
  ).run(claim.id, 'CausalClaim', props);
  return Promise.resolve(true);
}

/**
 * Create an EXTRACTED_FROM edge linking a CausalClaim to its source Artifact.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} claimId - CausalClaim node ID
 * @param {string} artifactId - Artifact node ID
 * @returns {Promise<boolean>}
 */
async function createExtractedFromEdge(conn, claimId, artifactId) {
  conn.prepare(
    'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  ).run(claimId, artifactId, 'EXTRACTED_FROM');
  return Promise.resolve(true);
}

// --- Causal Graph Engine (Phase 54) ---

/**
 * Create a CASCADES_TO edge between two CausalClaim nodes.
 * Idempotent via ON CONFLICT. Records cascade type and severity.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} fromClaimId - Source CausalClaim node ID
 * @param {string} toClaimId - Target CausalClaim node ID
 * @param {object} [opts] - Edge properties
 * @param {string} [opts.cascade_type='invalidation'] - invalidation|weakening|dependency
 * @param {string} [opts.severity='medium'] - high|medium|low
 * @param {number} [opts.path_length=1] - Hop distance
 * @returns {Promise<boolean>}
 */
async function createCascadesToEdge(conn, fromClaimId, toClaimId, opts = {}) {
  const edgeProps = JSON.stringify({
    cascade_type: opts.cascade_type || 'invalidation',
    severity: opts.severity || 'medium',
    path_length: typeof opts.path_length === 'number' ? opts.path_length : 1,
  });

  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(fromClaimId, toClaimId, 'CASCADES_TO', edgeProps);
  return Promise.resolve(true);
}

/**
 * Export all CausalClaim nodes and CASCADES_TO edges as JSON.
 * Writes .lazygraph-causal-export.json to roomDir for Python engine consumption.
 * Handles empty graphs gracefully (writes JSON with empty arrays).
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{metadata: object, nodes: Array, edges: Array}>}
 */
async function exportCausalGraph(roomDir) {
  const resolved = path.resolve(roomDir);
  const { db, conn } = await openGraph(resolved);
  try {
    // Query all CausalClaim nodes
    let nodes = [];
    try {
      nodes = conn.prepare(
        "SELECT id, json_extract(properties, '$.cause') AS cause, json_extract(properties, '$.mechanism') AS mechanism, json_extract(properties, '$.effect') AS effect, json_extract(properties, '$.confidence') AS confidence, json_extract(properties, '$.domain') AS domain, json_extract(properties, '$.source_artifact') AS source_artifact FROM nodes WHERE type = 'CausalClaim'"
      ).all();
    } catch (e) {
      // table may be empty or schema different
    }

    // Query all CASCADES_TO edges
    let edges = [];
    try {
      edges = conn.prepare(
        "SELECT source, target, json_extract(properties, '$.cascade_type') AS cascade_type, json_extract(properties, '$.severity') AS severity FROM edges WHERE type = 'CASCADES_TO'"
      ).all();
    } catch (e) {
      // no CASCADES_TO edges
    }

    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        node_count: nodes.length,
        edge_count: edges.length,
      },
      nodes,
      edges,
    };

    const exportPath = path.join(resolved, '.lazygraph-causal-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return exportData;
  } finally {
    await closeGraph(db);
  }
}

// --- TRIZ Contradiction Enrichment (DBA-09) ---

/**
 * Enrich an existing CONTRADICTS edge with TRIZ parameter classification.
 * Looks up triz-matrix.json to suggest inventive principles for the contradiction.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} artifactA - Source artifact ID
 * @param {string} artifactB - Target artifact ID
 * @param {string} improvingParam - TRIZ parameter being improved (one of 39)
 * @param {string} worseningParam - TRIZ parameter being worsened (one of 39)
 * @returns {Promise<{success: boolean, principles: number[], reason?: string}>}
 */
async function enrichContradictionWithTRIZ(conn, artifactA, artifactB, improvingParam, worseningParam) {
  // Load TRIZ matrix
  const matrixPath = path.join(__dirname, '..', '..', 'references', 'methodology', 'triz-matrix.json');
  if (!fs.existsSync(matrixPath)) {
    return { success: false, principles: [], reason: 'triz-matrix.json not found' };
  }

  let matrix;
  try {
    matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'));
  } catch (e) {
    return { success: false, principles: [], reason: 'Failed to parse triz-matrix.json' };
  }

  // Look up principles
  const improvingEntry = matrix[improvingParam];
  if (!improvingEntry) {
    return { success: false, principles: [], reason: `Unknown improving parameter: ${improvingParam}` };
  }

  const principles = improvingEntry[worseningParam];
  if (!principles || !Array.isArray(principles) || principles.length === 0) {
    return { success: false, principles: [], reason: `No principles found for ${improvingParam} vs ${worseningParam}` };
  }

  const principlesStr = principles.join(',');

  // Create a RESOLVES_VIA edge capturing the TRIZ resolution direction
  const edgeProps = JSON.stringify({
    resolution_type: 'triz_principle',
    triz_principle: principlesStr,
    analogy_source: `${improvingParam} vs ${worseningParam}`,
    confidence: 0.7,
  });

  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(artifactA, artifactB, 'RESOLVES_VIA', edgeProps);

  return { success: true, principles };
}

// --- Whitespace Zone CRUD (Phase 61) ---

/**
 * Create or update a WhitespaceZone node in SQLite.
 * Writes all properties as JSON. Idempotent.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {object} zone - WhitespaceZone properties
 * @param {string} zone.id - Unique zone ID
 * @param {string} zone.brain_framework - Brain framework name this gap relates to
 * @param {number} [zone.density_score=0.0] - Embedding space density score
 * @param {number} [zone.knn_density=0.0] - KNN density from SemNovel algorithm
 * @param {string} [zone.nearest_frameworks='[]'] - JSON array of nearest framework names
 * @param {string} [zone.hypothesis=''] - Generated hypothesis about what should fill this gap
 * @param {number} [zone.strategic_rank=0.0] - Strategic importance ranking
 * @param {string} [zone.problem_type=''] - Problem type classification
 * @param {string} [zone.exploration_status='detected'] - detected|exploring|resolved|dismissed
 * @param {string} [zone.created=''] - ISO date string
 * @returns {Promise<boolean>}
 */
async function addWhitespaceZone(conn, zone) {
  const props = JSON.stringify({
    brain_framework: zone.brain_framework || '',
    density_score: typeof zone.density_score === 'number' ? zone.density_score : 0.0,
    knn_density: typeof zone.knn_density === 'number' ? zone.knn_density : 0.0,
    nearest_frameworks: Array.isArray(zone.nearest_frameworks) ? JSON.stringify(zone.nearest_frameworks) : (zone.nearest_frameworks || '[]'),
    hypothesis: (zone.hypothesis || '').slice(0, 500),
    strategic_rank: typeof zone.strategic_rank === 'number' ? zone.strategic_rank : 0.0,
    problem_type: zone.problem_type || '',
    exploration_status: zone.exploration_status || 'detected',
    created: zone.created || '',
  });

  conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET type = excluded.type, properties = excluded.properties'
  ).run(zone.id, 'WhitespaceZone', props);
  return Promise.resolve(true);
}

/**
 * Create a WHITESPACE_DETECTED edge from a WhitespaceZone to a nearby Artifact.
 * Records embedding distance. Idempotent.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} zoneId - WhitespaceZone node ID
 * @param {string} artifactId - Artifact node ID
 * @param {number} [distance=0.0] - Embedding distance between zone centroid and artifact
 * @returns {Promise<boolean>}
 */
async function linkWhitespaceToArtifact(conn, zoneId, artifactId, distance = 0.0) {
  const edgeProps = JSON.stringify({ distance });
  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(zoneId, artifactId, 'WHITESPACE_DETECTED', edgeProps);
  return Promise.resolve(true);
}

/**
 * Create a WHITESPACE_NEAR edge from a WhitespaceZone to a Section.
 * Records relevance score. Idempotent.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} zoneId - WhitespaceZone node ID
 * @param {string} sectionName - Section node name
 * @param {number} [relevance=0.0] - Relevance score (0-1)
 * @returns {Promise<boolean>}
 */
async function linkWhitespaceToSection(conn, zoneId, sectionName, relevance = 0.0) {
  const edgeProps = JSON.stringify({ relevance });
  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(zoneId, sectionName, 'WHITESPACE_NEAR', edgeProps);
  return Promise.resolve(true);
}

/**
 * Link a WhitespaceZone to an Artifact via DISCOVERY_CYCLE_SOURCE edge.
 * Records which discovery method (hsi, rs, analogy) found this zone.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} zoneId - WhitespaceZone ID
 * @param {string} artifactId - Source Artifact ID
 * @param {string} discoveryMethod - 'hsi' | 'rs' | 'analogy'
 * @param {string} [cycleTimestamp] - ISO timestamp of discovery cycle run
 * @returns {Promise<boolean>}
 */
async function linkDiscoveryCycleSource(conn, zoneId, artifactId, discoveryMethod, cycleTimestamp = '') {
  const ts = cycleTimestamp || new Date().toISOString();
  const edgeProps = JSON.stringify({ discovery_method: discoveryMethod, cycle_timestamp: ts });
  conn.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(zoneId, artifactId, 'DISCOVERY_CYCLE_SOURCE', edgeProps);
  return Promise.resolve(true);
}

// --- Phase 89-07 Wave 1: generic typed-edge upsert primitive ---
//
// upsertEdge is the single chokepoint by which agentic surfaces (Phase 89-07
// ReverseSalientAgent, Phase 116 tension hook, Phase 117 auto-explore, Phase
// 118 MVA, Phase 120 breakthrough scan) emit typed cascade edges. It validates
// the edge type against EDGE_TYPES and performs the same UPSERT pattern used
// by every other edge writer in this module.
//
// Shape: upsertEdge(conn, { type, source, target, properties }) -> { ok, reason? }
//   - conn:   node:sqlite DatabaseSync instance (or any object with .prepare).
//   - type:   one of EDGE_TYPES (string).
//   - source: source node id (string).
//   - target: target node id (string).
//   - properties: optional object; serialized to JSON.
//
// Synchronous (no Promise wrapping); the underlying prepare/run is sync per
// node:sqlite contract. Per-call shape mirrors the rest of this module.
//
// Canon Part 4: every choice is graph data; this primitive lets every agent
// emit typed edges without bypassing EDGE_TYPES validation. Canon Part 7:
// reuse-before-build; sibling agents reuse this instead of inlining SQL.
function upsertEdge(conn, edge) {
  if (!edge || typeof edge !== 'object') {
    return { ok: false, reason: 'invalid_edge_object' };
  }
  const { type, source, target } = edge;
  if (typeof type !== 'string' || !EDGE_TYPES.includes(type)) {
    return { ok: false, reason: 'invalid_edge_type', detail: String(type).slice(0, 40) };
  }
  if (typeof source !== 'string' || source.length === 0) {
    return { ok: false, reason: 'invalid_source_id' };
  }
  if (typeof target !== 'string' || target.length === 0) {
    return { ok: false, reason: 'invalid_target_id' };
  }
  const props = edge.properties && typeof edge.properties === 'object' ? edge.properties : {};
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  try {
    conn.prepare(
      'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
    ).run(source, target, type, propsJson);
  } catch (e) {
    return { ok: false, reason: 'edge_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, type, source, target };
}

// --- Exports ---

module.exports = {
  EDGE_TYPES,
  upsertEdge,
  openGraph,
  closeGraph,
  initSchema,
  indexArtifact,
  rebuildGraph,
  queryGraph,
  graphStats,
  embedArtifact,
  // Design-by-Analogy (DBA-08, DBA-09)
  createAnalogyEdge,
  createIsomorphismEdge,
  createResolutionEdge,
  enrichContradictionWithTRIZ,
  // Causal Extraction (Phase 53)
  createCausalClaim,
  createExtractedFromEdge,
  // Causal Graph Engine (Phase 54)
  createCascadesToEdge,
  exportCausalGraph,
  // Whitespace Zone Layer (Phase 61)
  addWhitespaceZone,
  linkWhitespaceToArtifact,
  linkWhitespaceToSection,
  // Discovery Cycle (Phase 64)
  linkDiscoveryCycleSource,
  // Stakeholder node type (Phase 84-05, SCOPE-NB-03 / SCOPE-NB-04)
  STAKEHOLDER_TYPES,
  createStakeholder,
  getStakeholder,
  upsertStakeholder,
  findStakeholdersByClaim,
};
