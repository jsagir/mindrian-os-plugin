/**
 * MindrianOS Plugin -- LazyGraph Operations
 * SQLite-backed per-project queryable knowledge graph via node:sqlite DatabaseSync.
 * Graph stored in room/.mindrian/room.db (WAL mode for concurrent reads).
 *
 * Exports: openGraph, closeGraph, initSchema, indexArtifact,
 *          rebuildGraph, queryGraph, graphStats, embedArtifact,
 *          + 12 edge-creator functions + EDGE_TYPES constant
 *          + the Phase 236 (GRAPHDB-01) indexer ownership allowlist:
 *            INDEXER_OWNED_NODE_TYPES / INDEXER_OWNED_EDGE_TYPES, the readable
 *            DATA contract scoping rebuildGraph's destructive DELETE to exactly
 *            what the indexer can regenerate. scripts/build-ecosystem-graph.cjs
 *            IMPORTS these rather than declaring its own copy.
 *
 * All functions remain async for backward compatibility with callers
 * that use await. Awaiting a synchronous return resolves immediately.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { discoverSections, isIndexableArtifactFile } = require('./section-registry.cjs');
const { insertNode } = require('./node-insert.cjs');

// --- Schema ---

/** All relationship (edge) types in the LazyGraph */
const EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO', 'REASONING_INFORMS', 'HSI_CONNECTION', 'REVERSE_SALIENT', 'ANALOGOUS_TO', 'STRUCTURALLY_ISOMORPHIC', 'RESOLVES_VIA', 'CAUSES', 'ROOT_CAUSE_OF', 'CASCADES_TO', 'EXTRACTED_FROM', 'WHITESPACE_DETECTED', 'WHITESPACE_NEAR', 'DISCOVERY_CYCLE_SOURCE', 'DISCOVERED', 'DERIVED_FROM', 'AUTHORED_BY', 'AFFILIATED_WITH'];

// Phase 236 (GRAPHDB-01): THE INDEXER OWNERSHIP ALLOWLIST.
//
// RCA: .planning/debug/graph-rebuild-truncates-memory-journal.md
//
// WHY THIS EXISTS. rebuildGraph used to run an unconditional
// `DELETE FROM edges; DELETE FROM nodes;`. The nodes/edges tables hold TWO
// populations with opposite lifecycles and NO discriminator column:
//
//   DERIVED, regenerable      -- Artifact / Section nodes and BELONGS_TO edges,
//                                written by _indexArtifactBody from files on disk.
//   ORIGINAL, IRREPLACEABLE   -- memory_event (the append-only audit journal),
//                                human-confirmed truth-claim and decision nodes,
//                                and opportunity nodes carrying the D-17
//                                append-only stage_history[].
//
// The reindex that follows the DELETE restores ONLY the derived subset, so every
// original row was permanently gone the moment the transaction committed. This is
// NOT a crash-safety problem: the BEGIN/COMMIT/ROLLBACK wrap below already works
// (proven by live crash injection in 236-RESEARCH.md Evidence A). The loss
// happened on the HAPPY path, atomically, every single time.
//
// WHY THE IRREPLACEABLE TYPES ARE EXCLUDED BY CONSTRUCTION. They exist nowhere
// else. There is no markdown file, no secondary store, and no upstream export to
// re-derive them from, and the schema carries no soft-delete or tombstone column
// to recover from (RCA CLAIM-11). Once deleted they are gone for good, so the
// only safe contract is an allowlist of what the indexer can REGENERATE.
//
// THESE TWO CONSTANTS ARE THE EXACT SET _indexArtifactBody WRITES, and nothing
// wider. It writes precisely three type literals: insertNode(..., 'Artifact', ...)
// and insertNode(..., 'Section', ...), plus a BELONGS_TO edge. The four cascade
// edge types (CONTRADICTS / INFORMS / ENABLES / INVALIDATES) are DISABLED here as
// of Phase 169 D-169-08 and navigation.writeEdge is now their sole writer, so the
// indexer can no longer restore them and therefore MUST NOT delete them. Do not
// widen these to EDGE_TYPES (the legal vocabulary) or to node-insert.cjs's
// header list (which names CausalClaim / WhitespaceZone, written by
// createCausalClaim / addWhitespaceZone, which rebuildGraph never calls).
// Widening either constant reintroduces the data loss at a narrower scope.
//
// LEGACY-SCHEMA FOREIGN-KEY NOTE. Phase 169 D-169-11 removed the hard FK from
// edges(source/target) to nodes(id), but under an if-not-exists guard, so it
// applies to NEW dbs only; a pre-169 room.db keeps its prior schema WITH the FK,
// and openRoomDb sets PRAGMA foreign_keys = ON. On such a db a now-SCOPED
// DELETE FROM nodes can be REJECTED where the old delete-everything statement was
// not, because a surviving non-indexer edge may still reference an Artifact node
// being removed. Deleting edges BEFORE nodes is the mitigation, and the existing
// ROLLBACK makes any residual rejection loud and atomic rather than partial.

/** Node types the artifact indexer OWNS: it writes them and can fully regenerate them. */
const INDEXER_OWNED_NODE_TYPES = Object.freeze(['Artifact', 'Section']);

/** Edge types the artifact indexer OWNS: it writes them and can fully regenerate them. */
const INDEXER_OWNED_EDGE_TYPES = Object.freeze(['BELONGS_TO']);

/**
 * Phase 236 (GRAPHDB-01): THE ownership-scoped wipe. One implementation, two
 * call sites (rebuildGraph below, and scripts/build-ecosystem-graph.cjs), so the
 * two destructive reindex paths over room.db can never drift apart.
 *
 * It lives HERE rather than in the calling script for two reasons. First,
 * ownership is a property of the write path that CREATES the rows, so the delete
 * belongs beside the constants that define it. Second, Canon Part 9: this module
 * is one of the few substrate-adjacent modules allow-listed by
 * scripts/check-substrate.cjs to issue raw graph SQL, and adding a second raw-SQL
 * wipe site in scripts/ would either trip that guard or require widening the
 * chokepoint exemption allowlist, which is a governance change this fix does not
 * need to make.
 *
 * Ordering is load-bearing: edges are deleted BEFORE nodes so a legacy
 * pre-Phase-169 room.db that still carries the hard edges -> nodes FK cannot
 * reject the node delete. See the rationale block above.
 *
 * DERIVED-EDGE SCOPING, and why it is by ENDPOINT and not by type alone. Callers
 * that regenerate MORE edge types than the indexer does (the ecosystem builder
 * writes INFORMS / CONTRADICTS / CONVERGES on top of BELONGS_TO) pass those types
 * in `extraDerivedEdgeTypes`. Those are NOT deleted by type alone, because
 * navigation.writeEdge has been the sole writer of INFORMS and CONTRADICTS since
 * Phase 169 D-169-08 and writes them between NON-artifact nodes too (claims,
 * memory events, decisions). A type-only predicate looks correctly scoped and
 * still destroys derivation-authored cascade edges no caller can rebuild: the
 * same defect class, one level down. The edges table has no provenance column to
 * discriminate on, so ENDPOINT OWNERSHIP is the discriminator: a derived edge is
 * removed only when BOTH endpoints are ids currently carrying an indexer-owned
 * node type. Because edges go before nodes, those rows still exist here.
 *
 * Every statement is parameterized; the constants are never interpolated into
 * SQL text, so they stay the single source of truth.
 *
 * @param {import('node:sqlite').DatabaseSync} conn - an OPEN handle. The CALLER
 *   owns the transaction: both call sites wrap this in BEGIN/COMMIT/ROLLBACK.
 * @param {string[]} [extraDerivedEdgeTypes] - caller-regenerable edge types
 *   beyond INDEXER_OWNED_EDGE_TYPES, deleted only between indexer-owned endpoints.
 * @returns {void}
 */
function clearIndexerOwnedRows(conn, extraDerivedEdgeTypes) {
  const ph = (arr) => arr.map(() => '?').join(',');

  // 1. The structural indexer-owned edges.
  conn.prepare(
    'DELETE FROM edges WHERE type IN (' + ph(INDEXER_OWNED_EDGE_TYPES) + ')'
  ).run(...INDEXER_OWNED_EDGE_TYPES);

  // 2. Caller-supplied derived edges, scoped by type AND by BOTH endpoints being
  //    indexer-owned node ids. Already-owned types are filtered out so step 1
  //    stays the only place BELONGS_TO is removed.
  const derived = Array.isArray(extraDerivedEdgeTypes)
    ? extraDerivedEdgeTypes.filter((t) => INDEXER_OWNED_EDGE_TYPES.indexOf(t) === -1)
    : [];
  if (derived.length > 0) {
    conn.prepare(
      'DELETE FROM edges WHERE type IN (' + ph(derived) + ') '
      + 'AND source IN (SELECT id FROM nodes WHERE type IN (' + ph(INDEXER_OWNED_NODE_TYPES) + ')) '
      + 'AND target IN (SELECT id FROM nodes WHERE type IN (' + ph(INDEXER_OWNED_NODE_TYPES) + '))'
    ).run(...derived, ...INDEXER_OWNED_NODE_TYPES, ...INDEXER_OWNED_NODE_TYPES);
  }

  // 3. The indexer-owned nodes. Edges first, above.
  conn.prepare(
    'DELETE FROM nodes WHERE type IN (' + ph(INDEXER_OWNED_NODE_TYPES) + ')'
  ).run(...INDEXER_OWNED_NODE_TYPES);
}

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
    -- Phase 169 D-169-11: the edges table no longer hard-FKs source/target to
    -- nodes(id). The room-lineage NESTED_WITHIN edge (source room:<child>, target
    -- room:<parent>) and the rollup it powers reference ROOM node ids that are not
    -- always materialized as nodes(id) rows in the same db (a child room node
    -- lives in the child's db, not the parent's). The canonical writers
    -- (findings-wirer.wireAccept, graph-derivation.runDerivation) still write the
    -- proposed truth-claim NODE before the cascade edge, so cascade edges keep
    -- their node provenance; but a hard FK that REJECTS a lineage / derived edge
    -- whose endpoint node lives in another room db (or is healed later) breaks the
    -- D-169-11 fractal joint. The PRIMARY KEY (source, target, type) still enforces
    -- edge uniqueness. The IF-NOT-EXISTS clause makes this apply to NEW dbs only;
    -- existing dbs keep their prior schema (no destructive migration).
    CREATE TABLE IF NOT EXISTS edges (
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      PRIMARY KEY (source, target, type)
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
    -- rs_discoveries: contract bridge between the RS SQLite mirror (writer) and
    -- the RS NL/SQL readers. rs-sqlite-mirror.cjs writes RSDiscovery records
    -- into the nodes table with the payload in a JSON properties bag
    -- (keys: classification, breakthrough_score, dominant_dimension, thesis,
    -- bridge_concept, diff, lsa, bert, ..., created_at, room_id, domain). The
    -- readers (rs-nl-to-query.cjs SQL templates and scripts/rs-thesis-command.cjs)
    -- query  SELECT * FROM rs_discoveries WHERE room_slug = ?  and
    -- SELECT id, thesis, rs_type, breakthrough_score, room_slug, created_at
    -- FROM rs_discoveries WHERE id = ?  -- there was no such table, so queryGraph
    -- swallowed the "no such table" error as []. This VIEW closes that gap: it
    -- json_extract's the payload keys into the columns the queries expect and
    -- renames the writer's room_id JSON key to the reader's room_slug column
    -- and classification to rs_type. node:sqlite's bundled SQLite ships the
    -- JSON1 extension so json_extract works. NOTE: room_id is mapped to
    -- room_slug verbatim -- if ctx.room_id passed by the RS engine is ever
    -- not a room slug, that is a separate data-lineage fix in
    -- rs-discovery-engine.cjs / rs-sqlite-mirror.cjs; this view only aligns the
    -- column NAMES the queries already use. CREATE VIEW IF NOT EXISTS makes it
    -- idempotent -- existing room.db files pick it up on the next openGraph.
    CREATE VIEW IF NOT EXISTS rs_discoveries AS
    SELECT
      id,
      json_extract(properties, '$.thesis')             AS thesis,
      json_extract(properties, '$.classification')     AS rs_type,
      json_extract(properties, '$.breakthrough_score') AS breakthrough_score,
      json_extract(properties, '$.room_id')            AS room_slug,
      json_extract(properties, '$.created_at')         AS created_at,
      json_extract(properties, '$.bridge_concept')     AS bridge_concept,
      json_extract(properties, '$.dominant_dimension') AS dominant_dimension,
      json_extract(properties, '$.diff')               AS diff,
      json_extract(properties, '$.lsa')                AS lsa,
      json_extract(properties, '$.bert')               AS bert,
      json_extract(properties, '$.domain')             AS domain,
      properties                                       AS properties_json
    FROM nodes
    WHERE type = 'RSDiscovery';
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
  // Phase 169 GDH-04: strip the non-.md artifact extensions too (.docx/.html/.htm)
  // so a flat-root .docx artifact gets a clean id, not one carrying the extension.
  return rel.replace(/\.(md|docx|html|htm)$/i, '').replace(/\\/g, '/');
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
/**
 * Phase 169 GDH-04: read the artifact text. .md stays the plain readFileSync
 * path; .docx/.html route through doc-text-extractor.extractDocText so the
 * non-.md reach lands in the index path. extractDocText opens the source for
 * READ only (D-169-03 non-destructive). A missing extractor / empty extraction
 * degrades to '' so a non-text artifact still mints its node (content_hash over
 * the empty string is stable and harmless). No em-dashes.
 * @param {string} filePath
 * @returns {string}
 */
function _readArtifactContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx' || ext === '.html' || ext === '.htm') {
    try {
      const { extractDocText } = require('./doc-text-extractor.cjs');
      return extractDocText(filePath) || '';
    } catch (_e) {
      return '';
    }
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function _indexArtifactBody(conn, roomDir, filePath) {
  const content = _readArtifactContent(filePath);
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

  // Upsert Artifact node (HARD-02: shared NOT-NULL-safe helper, D-02 + D-02a).
  // R17-02: epistemic_type 'observation' -- system-bookkeeping node, records
  // that an artifact file was indexed, not a truth-claim about the venture.
  insertNode(conn, id, 'Artifact', artifactProps, { epistemic_type: 'observation' });

  // Upsert Section node (HARD-02: shared NOT-NULL-safe helper, D-02 + D-02a).
  // R17-02: epistemic_type 'observation' (same system-bookkeeping bucket).
  insertNode(conn, section, 'Section', sectionProps, { epistemic_type: 'observation' });

  // Upsert BELONGS_TO edge (the structural section-membership edge -- NOT a
  // cascade type; it STAYS. Only the four cascade writes below are disabled.)
  conn.prepare(
    'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  ).run(id, section, 'BELONGS_TO');

  // Phase 169 D-169-08 (MEDIUM-4): the legacy raw-SQL cascade is DISABLED.
  // The wikilink-driven CONTRADICTS + INFORMS writes, plus the frontmatter
  // ENABLES + INVALIDATES writes, used to land cascade edges DIRECTLY via raw
  // INSERT INTO edges -- bypassing the Part 9 navigation.writeEdge chokepoint and
  // auto-confirming them. Derivation (graph-derivation.cjs runDerivation, which
  // critiques each candidate via fable-mode and lands a PROPOSED truth-claim node
  // plus a typed edge through navigation.writeEdge) is now the SOLE writer of the
  // CONTRADICTS / INFORMS / ENABLES / INVALIDATES cascade types. The wikilinks /
  // enables / invalidates frontmatter values are still READ above (the content
  // hash + node props carry them), but no cascade edge is written here. BELONGS_TO
  // (the structural edge) is preserved above; the cascade edges are no longer
  // raw-SQL written.
  void wikilinks;
  void enables;
  void invalidates;
  void CONTRADICT_TERMS;

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
// Phase 169 GDH-03/04 (D-169-07): the artifact-extension filter used by BOTH
// the section walk and the ROOT-FILES pass. Accepts .md/.docx/.html/.htm while
// excluding the identity files STATE.md / ROOM.md (and any dot-prefixed file).
// The predicate now lives in section-registry.cjs as the SINGLE SOURCE OF TRUTH
// (quick fix 260705-qi8: shared by discoverSections' nested-qualification pass
// so the two walks can never drift). Aliased here to keep the internal name and
// all existing call sites (section walk, ROOT-FILES pass) unchanged.
const _isIndexableArtifactFile = isIndexableArtifactFile;

// Phase 169 GDH-03 (D-169-02 / D-169-11): detect the direct sub-rooms of roomDir
// -- the immediate child directories that each carry a `.room-root` FILE sentinel
// (the heal-command isContainerDir precedent at scripts/heal-command.cjs:909-921).
// Returns absolute paths. A sub-room is a full room with its OWN room.db; the
// rebuild recurses into each (and into ITS sub-rooms) at arbitrary depth.
function _detectSubRooms(roomDir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const childDir = path.join(roomDir, entry.name);
    if (fs.existsSync(path.join(childDir, '.room-root'))) {
      out.push(path.resolve(childDir));
    }
  }
  return out;
}

/**
 * Rebuild the entire graph from all room artifacts.
 * Clears existing data, walks all sections, indexes every artifact file.
 *
 * Phase 169 GDH-03/04 + D-169-07 + D-169-11 extensions:
 *   - ROOT-FILES pass: top-level .md/.docx/.html artifacts that sit in the room
 *     ROOT (a flat room) are indexed alongside the section walk.
 *   - non-.md reach: .docx/.html artifacts route through extractDocText (via
 *     _indexArtifactBody / _readArtifactContent).
 *   - TRANSITIVE sub-room recursion: a room with sub-rooms rebuilds each sub-room
 *     into ITS OWN room.db, and recurses into a sub-room's own sub-rooms at
 *     arbitrary depth (a sub-sub-room is rebuilt into its own db, never a parent
 *     conn). Cycle-guarded by a visited-set of resolved absolute paths.
 *
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} roomDir - Absolute path to room directory
 * @param {Set<string>} [_visited] - internal cycle-guard (resolved abs paths)
 * @returns {Promise<{success: boolean, artifacts: number, sections: number, subRooms: number}>}
 */
async function rebuildGraph(conn, roomDir, _visited) {
  const resolved = path.resolve(roomDir);

  // Cycle guard for the transitive sub-room recursion (T-169-20): a visited-set
  // of resolved absolute paths so a cyclic / symlinked .room-root graph cannot
  // spin. The TOP-level call seeds the set with its own resolved path.
  const visited = (_visited instanceof Set) ? _visited : new Set();
  if (visited.has(resolved)) {
    return Promise.resolve({ success: true, artifacts: 0, sections: 0, subRooms: 0 });
  }
  visited.add(resolved);

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
    // Clear existing INDEXER-OWNED data (edges first for FK compliance).
    // Phase 236 (GRAPHDB-01): the ONE ownership-scoped wipe, shared with
    // scripts/build-ecosystem-graph.cjs. rebuildGraph passes no extra derived
    // edge types because it regenerates nothing beyond BELONGS_TO.
    clearIndexerOwnedRows(conn);

    for (const sectionName of sectionNames) {
      const sectionDir = path.join(resolved, sectionName);
      let files;
      try {
        files = fs.readdirSync(sectionDir).filter(_isIndexableArtifactFile);
      } catch (e) {
        continue; // skip this section
      }

      for (const file of files) {
        const filePath = path.join(sectionDir, file);
        _indexArtifactBody(conn, resolved, filePath); // inside outer BEGIN, no nested txn
        artifactCount++;
      }

      // Nested-artifact walk (CLAUDE.md decision #16, v1.9.7; quick fix
      // 260705-qi8): under the Obsidian-nested convention every artifact sits in
      // its own subfolder (section/name/name.md), so the flat readdir above never
      // sees it. Descend EXACTLY ONE level: for each immediate child directory of
      // the section, index its indexable files. Skip any child carrying a
      // .room-root sentinel -- recursing into a sub-room here would double-index
      // its artifacts into the PARENT db, violating the Phase 169 D-169-02 /
      // D-169-11 per-sub-room-db isolation (sub-rooms rebuild into their own
      // room.db in the recursion block below). One level only; no unbounded walk.
      let childDirs;
      try {
        childDirs = fs.readdirSync(sectionDir, { withFileTypes: true })
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name);
      } catch (e) {
        childDirs = [];
      }
      for (const childName of childDirs) {
        const childDir = path.join(sectionDir, childName);
        if (fs.existsSync(path.join(childDir, '.room-root'))) continue; // sub-room: its own db
        let nestedFiles;
        try {
          nestedFiles = fs.readdirSync(childDir).filter(_isIndexableArtifactFile);
        } catch (e) {
          continue; // skip unreadable child dirs
        }
        for (const file of nestedFiles) {
          const filePath = path.join(childDir, file);
          _indexArtifactBody(conn, resolved, filePath); // inside outer BEGIN, no nested txn
          artifactCount++;
        }
      }
    }

    // Phase 169 D-169-07 ROOT-FILES pass: index top-level .md/.docx/.html
    // artifacts that sit in the room ROOT (a flat room whose artifacts are not in
    // section subfolders -- e.g. the b2 sub-room: 39 artifacts in the root). This
    // is a general fix for any flat room, not a fixture hack.
    let rootFiles;
    try {
      rootFiles = fs.readdirSync(resolved, { withFileTypes: true })
        .filter(e => e.isFile() && _isIndexableArtifactFile(e.name))
        .map(e => e.name);
    } catch (_e) {
      rootFiles = [];
    }
    for (const file of rootFiles) {
      const filePath = path.join(resolved, file);
      _indexArtifactBody(conn, resolved, filePath);
      artifactCount++;
    }

    // Phase 244 (TRIG-01, T-244-09): reconcile the derived eureka_fts lexical
    // index against the nodes table, now that the full reindex above has
    // finished regenerating every Artifact/Section row.
    //
    // WHY THIS RUNS HERE, AFTER THE REINDEX, NOT IMMEDIATELY AFTER
    // clearIndexerOwnedRows. clearIndexerOwnedRows deletes EVERY
    // indexer-owned node on EVERY rebuild (not only the ones whose files were
    // actually removed from disk); the section walk + ROOT-FILES pass above
    // then RESTORES all of them with the same deterministic, path-derived
    // ids (getArtifactId). A reconcile placed between the wipe and the
    // reindex would therefore see a window where NO Artifact/Section node
    // exists yet and would treat every one of their eureka_fts rows as
    // orphaned, wiping the lexical index on every single rebuild rather than
    // only the rows for content that is genuinely gone. Running the DELETE
    // here, after `nodes` has been fully repopulated, is what lets it
    // discriminate a truly deleted artifact (never reinserted, so still
    // absent from `nodes`) from one that was merely wiped-and-regenerated in
    // this same transaction (already reinserted by the time this runs).
    //
    // WHY THIS IS A SEPARATE STATEMENT, NOT FOLDED INTO
    // clearIndexerOwnedRows. eureka_fts (the fts5 virtual table owned by
    // lib/core/eureka/tri-modal-index.cjs) is NOT covered by that wipe --
    // proven live (244-RESEARCH.md Q2): after a scoped clearIndexerOwnedRows
    // wipe of Artifact/Section nodes, eureka_fts KEEPS their rows and a MATCH
    // still returns them, meaning a content-tier trigger could fire on
    // content that no longer exists and point at a dead node_id.
    // clearIndexerOwnedRows's own doc contract (:87-125 above) is an
    // allowlist of what the indexer can REGENERATE over the nodes/edges
    // tables specifically; eureka_fts is neither table, so it does not
    // belong in that allowlist -- it belongs beside the call.
    //
    // THE HAZARD IS RESURRECTION, NOT LOSS: unlike the nodes/edges rows
    // clearIndexerOwnedRows deletes, eureka_fts holds no original data (it is
    // 100% derived from nodes + on-disk artifact bodies), so destroying
    // stale rows here is always safe to do freely.
    //
    // DO NOT widen INDEXER_OWNED_NODE_TYPES or INDEXER_OWNED_EDGE_TYPES to
    // cover this instead. Quoting the header at :66-69 above: "Widening
    // either constant reintroduces the data loss at a narrower scope." Those
    // two constants are typed vocabularies for the nodes/edges tables' OWN
    // irreplaceable-vs-derived split; eureka_fts is a different table with a
    // different safety property (fully derived, freely destroyable).
    //
    // Riding THIS SAME BEGIN is what makes the reconcile atomic for free: if
    // the rebuild throws AFTER this DELETE but before the COMMIT below, the
    // ROLLBACK at the catch block restores BOTH the nodes table and these
    // FTS rows together, because they are the same transaction.
    //
    // Guarded by BOTH ensureFtsAvailable() (the process-wide FTS5 capability
    // probe -- some node:sqlite builds lack the extension) and
    // tableExists(conn, 'eureka_fts') (this db may simply never have built
    // the index at all -- the DEFAULT state of every live room today, per
    // 244-RESEARCH.md Pitfall 2). The whole guarded block is its own
    // try/catch that swallows and continues (T-244-10): a reconcile fault
    // must never abort a rebuild that is otherwise succeeding.
    //
    // Both guards now live INSIDE tri.reconcileFtsOrphans, which is the ONE
    // canonical copy of the prune SQL (Phase 244, RCA
    // eureka-fts-orphan-rows-block-release-gate). This block previously carried
    // its own verbatim duplicate, with a twin in
    // scripts/build-ecosystem-graph.cjs and a comment on each warning that both
    // must be kept in sync. That hazard is retired: when the build path needed
    // the same prune, the SQL was extracted rather than copied a third time, and
    // both former copies now delegate here.
    //
    // The try/catch stays on THIS side deliberately. reconcileFtsOrphans does
    // not swallow (on the build path a swallowed fault would be a "successful"
    // build that silently did not reconcile), so the swallow is the caller's
    // choice, made here for the reason T-244-10 states: a reconcile fault must
    // never abort an otherwise-succeeding rebuild.
    (function reconcileFtsIndexInline() {
      try {
        // Lazy require inside this scoped function (the
        // navigation-engine.cjs:510 cross-layer idiom): avoids a
        // module-load-time require of the eureka subsystem for every caller
        // of lazygraph-ops.cjs, most of which never touch eureka_fts.
        // eslint-disable-next-line global-require
        const tri = require('./eureka/tri-modal-index.cjs');
        // No-op when FTS5 is not compiled in on this build, and when eureka_fts
        // was never built on this db (Pitfall 2, the default state of every live
        // room). Both checks are the helper's own self-guards.
        tri.reconcileFtsOrphans(conn);
      } catch (_e) {
        // Swallow and continue (T-244-10): a reconcile fault must never
        // abort an otherwise-succeeding rebuild.
      }
    })();

    conn.prepare('COMMIT').run();
  } catch (err) {
    try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
    throw err;
  }

  // Phase 169 D-169-02 / D-169-11 TRANSITIVE sub-room recursion. AFTER the
  // parent's own sections + root are committed, detect direct sub-rooms and
  // rebuild EACH into ITS OWN room.db, recursing into the sub-room's own
  // sub-rooms at arbitrary depth. Per-sub-room db (Part 8 room isolation): never
  // index a sub-room into the parent conn. room-db is lazy-required to avoid the
  // room-db.cjs <-> lazygraph-ops.cjs circular require at module-load time.
  let subRoomCount = 0;
  const subRooms = _detectSubRooms(resolved);
  if (subRooms.length > 0) {
    let openRoomDb, closeRoomDb;
    try {
      ({ openRoomDb, closeRoomDb } = require('./room-db.cjs'));
    } catch (_e) {
      openRoomDb = null;
    }
    if (typeof openRoomDb === 'function') {
      for (const subRoom of subRooms) {
        if (visited.has(subRoom)) continue;
        let subConn = null;
        try {
          subConn = openRoomDb(subRoom);
          const r = await rebuildGraph(subConn, subRoom, visited);
          subRoomCount += 1 + (r && typeof r.subRooms === 'number' ? r.subRooms : 0);
        } catch (_e) {
          // a sub-room rebuild fault must not abort the parent rebuild.
        } finally {
          if (subConn && typeof closeRoomDb === 'function') {
            try { closeRoomDb(subConn); } catch (_ce) { /* ignore */ }
          }
        }
      }
    }
  }

  return Promise.resolve({
    success: true,
    artifacts: artifactCount,
    sections: sectionNames.length,
    subRooms: subRoomCount,
  });
}

/**
 * Execute a SQL query and return all result rows.
 * Gracefully returns empty array on error.
 * @param {import('node:sqlite').DatabaseSync} conn - node:sqlite DatabaseSync instance
 * @param {string} sql - SQL query string
 * @param {Array<*>|Object} [params] - bound parameters; array for anonymous (?) placeholders, object for named ($x)
 * @returns {Promise<Array<object>>}
 */
async function queryGraph(conn, sql, params) {
  try {
    const stmt = conn.prepare(sql);
    if (params == null) {
      return Promise.resolve(stmt.all());
    }
    if (Array.isArray(params)) {
      return Promise.resolve(params.length ? stmt.all(...params) : stmt.all());
    }
    return Promise.resolve(stmt.all(params));
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

  // HARD-02: shared NOT-NULL-safe helper (D-02 + D-02a).
  // R17-02: epistemic_type 'derived_fact' per Task 4 Decision 4 (CausalClaim
  // reached via lazygraph maps to derived_fact).
  insertNode(conn, claim.id, 'CausalClaim', props, { epistemic_type: 'derived_fact' });
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

  // HARD-02: shared NOT-NULL-safe helper (D-02 + D-02a).
  // R17-02: epistemic_type 'derived_fact' -- a WhitespaceZone is a computed
  // analytical output (density/strategic-rank scoring over the graph), not a
  // human truth-claim; not in Task 4's named table, judgment call applying
  // the same "algorithmically-computed output" class as CausalClaim.
  insertNode(conn, zone.id, 'WhitespaceZone', props, { epistemic_type: 'derived_fact' });
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
  // Phase 236 (GRAPHDB-01): the indexer ownership allowlist, exported so other
  // modules and tests read the contract as DATA instead of re-deriving it.
  INDEXER_OWNED_NODE_TYPES,
  INDEXER_OWNED_EDGE_TYPES,
  clearIndexerOwnedRows,
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
