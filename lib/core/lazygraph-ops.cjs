/**
 * MindrianOS Plugin — LazyGraph Operations
 * Wraps KuzuDB for per-project queryable knowledge graph.
 * Graph stored in room/.lazygraph/ (embedded, file-based).
 *
 * Exports: openGraph, closeGraph, initSchema, indexArtifact,
 *          rebuildGraph, queryGraph, graphStats
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kuzu = require('kuzu');
const { discoverSections } = require('./section-registry.cjs');

// --- Schema ---

/** All relationship (edge) types in the LazyGraph */
const EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO'];

/**
 * Create all node and relationship tables idempotently.
 * @param {object} conn - KuzuDB Connection
 */
async function initSchema(conn) {
  // Node tables
  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Artifact(
      id STRING PRIMARY KEY,
      title STRING,
      section STRING,
      methodology STRING,
      created STRING,
      content_hash STRING
    )
  `);

  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Section(
      name STRING PRIMARY KEY,
      label STRING
    )
  `);

  // Relationship tables
  await conn.query(`CREATE REL TABLE IF NOT EXISTS INFORMS(FROM Artifact TO Artifact)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONTRADICTS(FROM Artifact TO Artifact, confidence STRING)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONVERGES(FROM Artifact TO Artifact, term STRING)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS ENABLES(FROM Artifact TO Artifact)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS INVALIDATES(FROM Artifact TO Artifact)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS BELONGS_TO(FROM Artifact TO Section)`);
}

// --- Helpers ---

/**
 * Escape single quotes for Cypher string literals.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

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
 * Open (or create) a KuzuDB database at {roomDir}/.lazygraph.
 * KuzuDB creates the database file automatically. Initializes schema.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{db: object, conn: object}>}
 */
async function openGraph(roomDir) {
  const resolved = path.resolve(roomDir);
  const lazygraphPath = path.join(resolved, '.lazygraph');

  // Ensure room directory exists
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  const db = new kuzu.Database(lazygraphPath);
  const conn = new kuzu.Connection(db);

  await initSchema(conn);

  return { db, conn };
}

/**
 * Close KuzuDB database.
 * @param {object} db - KuzuDB Database instance
 */
async function closeGraph(db) {
  db.close();
}

/**
 * Index a single .md artifact into the graph.
 * Creates Artifact node, Section node, BELONGS_TO edge.
 * Scans for [[wikilinks]] to create INFORMS edges.
 * Scans for contradiction terms near wikilinks to create CONTRADICTS edges.
 * @param {object} conn - KuzuDB Connection
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} filePath - Absolute path to .md file
 * @returns {Promise<{id: string, section: string, title: string, contentHash: string}>}
 */
async function indexArtifact(conn, roomDir, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const id = getArtifactId(filePath, roomDir);
  const section = id.split('/')[0];
  const title = extractTitle(content, filePath);
  const methodology = extractFrontmatter(content, 'methodology');
  const created = extractFrontmatter(content, 'date');
  const contentHash = computeHash(content);

  // Upsert Artifact node
  await conn.query(
    `MERGE (a:Artifact {id: '${esc(id)}'})
     ON CREATE SET a.title = '${esc(title)}', a.section = '${esc(section)}',
                   a.methodology = '${esc(methodology)}', a.created = '${esc(created)}',
                   a.content_hash = '${esc(contentHash)}'
     ON MATCH SET a.title = '${esc(title)}', a.section = '${esc(section)}',
                  a.methodology = '${esc(methodology)}', a.created = '${esc(created)}',
                  a.content_hash = '${esc(contentHash)}'`
  );

  // Upsert Section node
  const sectionLabel = section.replace(/-/g, ' ').toUpperCase();
  await conn.query(
    `MERGE (s:Section {name: '${esc(section)}'})
     ON CREATE SET s.label = '${esc(sectionLabel)}'`
  );

  // Upsert BELONGS_TO edge
  await conn.query(
    `MATCH (a:Artifact {id: '${esc(id)}'}), (s:Section {name: '${esc(section)}'})
     MERGE (a)-[:BELONGS_TO]->(s)`
  );

  // Scan for [[wikilinks]] to create INFORMS edges
  const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
  for (const link of wikilinks) {
    const target = link.replace(/\[\[|\]\]/g, '').toLowerCase().replace(/\s/g, '-');

    // Find the paragraph/sentence containing this wikilink for context
    const linkIdx = content.indexOf(link);
    const contextStart = Math.max(0, linkIdx - 200);
    const contextEnd = Math.min(content.length, linkIdx + 200);
    const nearbyText = content.slice(contextStart, contextEnd).toLowerCase();

    // Check if nearby text contains contradiction terms
    const isContradiction = CONTRADICT_TERMS.some(term => nearbyText.includes(term));

    // Create INFORMS edges to all artifacts in the target section
    const targetArtifacts = await queryGraph(conn,
      `MATCH (t:Artifact) WHERE t.section = '${esc(target)}' RETURN t.id`
    );

    for (const row of targetArtifacts) {
      const targetId = row['t.id'];
      if (targetId === id) continue; // skip self-reference

      if (isContradiction) {
        // Create CONTRADICTS edge instead of / in addition to INFORMS
        await conn.query(
          `MATCH (a:Artifact {id: '${esc(id)}'}), (t:Artifact {id: '${esc(targetId)}'})
           MERGE (a)-[:CONTRADICTS {confidence: 'medium'}]->(t)`
        );
      }

      // Always create INFORMS edge for wikilinks
      await conn.query(
        `MATCH (a:Artifact {id: '${esc(id)}'}), (t:Artifact {id: '${esc(targetId)}'})
         MERGE (a)-[:INFORMS]->(t)`
      );
    }
  }

  // Check for explicit enables:/invalidates: in frontmatter
  const enables = extractFrontmatter(content, 'enables');
  if (enables) {
    const targetArtifacts = await queryGraph(conn,
      `MATCH (t:Artifact) WHERE t.id = '${esc(enables)}' RETURN t.id`
    );
    for (const row of targetArtifacts) {
      await conn.query(
        `MATCH (a:Artifact {id: '${esc(id)}'}), (t:Artifact {id: '${esc(row['t.id'])}'})
         MERGE (a)-[:ENABLES]->(t)`
      );
    }
  }

  const invalidates = extractFrontmatter(content, 'invalidates');
  if (invalidates) {
    const targetArtifacts = await queryGraph(conn,
      `MATCH (t:Artifact) WHERE t.id = '${esc(invalidates)}' RETURN t.id`
    );
    for (const row of targetArtifacts) {
      await conn.query(
        `MATCH (a:Artifact {id: '${esc(id)}'}), (t:Artifact {id: '${esc(row['t.id'])}'})
         MERGE (a)-[:INVALIDATES]->(t)`
      );
    }
  }

  return { id, section, title, contentHash };
}

/**
 * Rebuild the entire graph from all room artifacts.
 * Clears existing data, walks all sections, indexes every .md file.
 * @param {object} conn - KuzuDB Connection
 * @param {string} roomDir - Absolute path to room directory
 * @returns {Promise<{success: boolean, artifacts: number, sections: number}>}
 */
async function rebuildGraph(conn, roomDir) {
  const resolved = path.resolve(roomDir);

  // Clear all existing data
  await conn.query('MATCH (n) DETACH DELETE n');

  // Discover sections
  const discovery = discoverSections(resolved);
  const sectionNames = discovery.all;
  let artifactCount = 0;

  for (const sectionName of sectionNames) {
    const sectionDir = path.join(resolved, sectionName);
    let files;
    try {
      files = fs.readdirSync(sectionDir).filter(f =>
        f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md'
      );
    } catch (e) {
      continue;
    }

    for (const file of files) {
      await indexArtifact(conn, resolved, path.join(sectionDir, file));
      artifactCount++;
    }
  }

  return { success: true, artifacts: artifactCount, sections: sectionNames.length };
}

/**
 * Execute a Cypher query and return all result rows.
 * @param {object} conn - KuzuDB Connection
 * @param {string} cypher - Cypher query string
 * @returns {Promise<Array<object>>}
 */
async function queryGraph(conn, cypher) {
  const result = await conn.query(cypher);
  const rows = await result.getAll();
  return rows;
}

/**
 * Get graph statistics: node counts, edge counts, totals.
 * @param {object} conn - KuzuDB Connection
 * @returns {Promise<{nodes: object, edges: object, total: {nodes: number, edges: number}}>}
 */
async function graphStats(conn) {
  // Count nodes
  const artifactRows = await queryGraph(conn, 'MATCH (a:Artifact) RETURN count(*) AS cnt');
  const sectionRows = await queryGraph(conn, 'MATCH (s:Section) RETURN count(*) AS cnt');
  const artifactCount = artifactRows[0]?.cnt || 0;
  const sectionCount = sectionRows[0]?.cnt || 0;

  // Count edges per type
  const edges = {};
  for (const edgeType of EDGE_TYPES) {
    let query;
    if (edgeType === 'BELONGS_TO') {
      query = `MATCH (a:Artifact)-[:${edgeType}]->(s:Section) RETURN count(*) AS cnt`;
    } else {
      query = `MATCH (a:Artifact)-[:${edgeType}]->(b:Artifact) RETURN count(*) AS cnt`;
    }
    const rows = await queryGraph(conn, query);
    edges[edgeType] = rows[0]?.cnt || 0;
  }

  const totalEdges = Object.values(edges).reduce((sum, n) => sum + n, 0);

  return {
    nodes: { Artifact: artifactCount, Section: sectionCount },
    edges,
    total: { nodes: artifactCount + sectionCount, edges: totalEdges },
  };
}

module.exports = {
  openGraph,
  closeGraph,
  initSchema,
  indexArtifact,
  rebuildGraph,
  queryGraph,
  graphStats,
};
