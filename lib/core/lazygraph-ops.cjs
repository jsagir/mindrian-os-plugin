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
const EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO', 'REASONING_INFORMS', 'HSI_CONNECTION', 'REVERSE_SALIENT', 'ANALOGOUS_TO', 'STRUCTURALLY_ISOMORPHIC', 'RESOLVES_VIA'];

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
  await conn.query(`CREATE REL TABLE IF NOT EXISTS REASONING_INFORMS(FROM Section TO Section, provides STRING)`);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS HSI_CONNECTION(
    FROM Artifact TO Artifact,
    hsi_score DOUBLE DEFAULT 0.0,
    lsa_sim DOUBLE DEFAULT 0.0,
    semantic_sim DOUBLE DEFAULT 0.0,
    surprise_type STRING DEFAULT '',
    breakthrough_potential DOUBLE DEFAULT 0.0,
    tier STRING DEFAULT 'tier1'
  )`);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS REVERSE_SALIENT(
    FROM Section TO Section,
    differential_score DOUBLE DEFAULT 0.0,
    innovation_type STRING DEFAULT '',
    source_artifact STRING DEFAULT '',
    target_artifact STRING DEFAULT '',
    innovation_thesis STRING DEFAULT ''
  )`);

  // Design-by-Analogy edge types (DBA-08)
  await conn.query(`CREATE REL TABLE IF NOT EXISTS ANALOGOUS_TO(
    FROM Artifact TO Artifact,
    analogy_distance STRING DEFAULT 'near',
    structural_fitness DOUBLE DEFAULT 0.0,
    source_domain STRING DEFAULT '',
    transfer_map STRING DEFAULT '{}',
    discovery_method STRING DEFAULT 'hsi'
  )`);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS STRUCTURALLY_ISOMORPHIC(
    FROM Section TO Section,
    isomorphism_score DOUBLE DEFAULT 0.0,
    mapped_elements STRING DEFAULT '{}',
    source STRING DEFAULT ''
  )`);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS RESOLVES_VIA(
    FROM Artifact TO Artifact,
    resolution_type STRING DEFAULT 'direct',
    triz_principle STRING DEFAULT '',
    analogy_source STRING DEFAULT '',
    confidence DOUBLE DEFAULT 0.0
  )`);
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
    } else if (edgeType === 'REASONING_INFORMS' || edgeType === 'REVERSE_SALIENT' || edgeType === 'STRUCTURALLY_ISOMORPHIC') {
      query = `MATCH (s1:Section)-[:${edgeType}]->(s2:Section) RETURN count(*) AS cnt`;
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
      reason: 'Pinecone Tier 2 not configured — set PINECONE_API_KEY and PINECONE_INDEX to enable semantic search',
    };
  }

  // Pinecone env vars are set but integration not yet wired
  return {
    success: false,
    reason: 'Pinecone Tier 2 integration not yet implemented — stub ready for future wiring',
  };
}

// --- Design-by-Analogy Edge Creation (DBA-08) ---

/**
 * Create an ANALOGOUS_TO edge between two artifacts.
 * Records functional analogy with distance, fitness, and transfer mapping.
 * @param {object} conn - KuzuDB Connection
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
  const distance = esc(props.analogy_distance || 'near');
  const fitness = props.structural_fitness || 0.0;
  const domain = esc(props.source_domain || '');
  const transferMap = esc(props.transfer_map || '{}');
  const method = esc(props.discovery_method || 'hsi');

  await conn.query(
    `MATCH (a:Artifact {id: '${esc(sourceId)}'}), (b:Artifact {id: '${esc(targetId)}'})
     MERGE (a)-[r:ANALOGOUS_TO]->(b)
     ON CREATE SET r.analogy_distance = '${distance}',
                   r.structural_fitness = ${fitness},
                   r.source_domain = '${domain}',
                   r.transfer_map = '${transferMap}',
                   r.discovery_method = '${method}'
     ON MATCH SET r.analogy_distance = '${distance}',
                  r.structural_fitness = ${fitness},
                  r.source_domain = '${domain}',
                  r.transfer_map = '${transferMap}',
                  r.discovery_method = '${method}'`
  );
  return true;
}

/**
 * Create a STRUCTURALLY_ISOMORPHIC edge between two sections.
 * Records identical relational topology between room sections.
 * @param {object} conn - KuzuDB Connection
 * @param {string} sectionA - Source section name
 * @param {string} sectionB - Target section name
 * @param {object} props - Edge properties
 * @param {number} [props.isomorphism_score=0.0] - 0-1 isomorphism score
 * @param {string} [props.mapped_elements='{}'] - JSON string of element mappings
 * @param {string} [props.source=''] - Source of the isomorphism detection
 * @returns {Promise<boolean>}
 */
async function createIsomorphismEdge(conn, sectionA, sectionB, props = {}) {
  const score = props.isomorphism_score || 0.0;
  const mapped = esc(props.mapped_elements || '{}');
  const source = esc(props.source || '');

  await conn.query(
    `MATCH (a:Section {name: '${esc(sectionA)}'}), (b:Section {name: '${esc(sectionB)}'})
     MERGE (a)-[r:STRUCTURALLY_ISOMORPHIC]->(b)
     ON CREATE SET r.isomorphism_score = ${score},
                   r.mapped_elements = '${mapped}',
                   r.source = '${source}'
     ON MATCH SET r.isomorphism_score = ${score},
                  r.mapped_elements = '${mapped}',
                  r.source = '${source}'`
  );
  return true;
}

/**
 * Create a RESOLVES_VIA edge linking a contradiction to its resolution.
 * Closes the loop: contradiction -> analogy/TRIZ -> resolution.
 * @param {object} conn - KuzuDB Connection
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
  const resType = esc(props.resolution_type || 'direct');
  const principle = esc(props.triz_principle || '');
  const analogySrc = esc(props.analogy_source || '');
  const confidence = props.confidence || 0.0;

  await conn.query(
    `MATCH (a:Artifact {id: '${esc(sourceId)}'}), (b:Artifact {id: '${esc(targetId)}'})
     MERGE (a)-[r:RESOLVES_VIA]->(b)
     ON CREATE SET r.resolution_type = '${resType}',
                   r.triz_principle = '${principle}',
                   r.analogy_source = '${analogySrc}',
                   r.confidence = ${confidence}
     ON MATCH SET r.resolution_type = '${resType}',
                  r.triz_principle = '${principle}',
                  r.analogy_source = '${analogySrc}',
                  r.confidence = ${confidence}`
  );
  return true;
}

// --- TRIZ Contradiction Enrichment (DBA-09) ---

/**
 * Enrich an existing CONTRADICTS edge with TRIZ parameter classification.
 * Looks up triz-matrix.json to suggest inventive principles for the contradiction.
 * @param {object} conn - KuzuDB Connection
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

  // Update the CONTRADICTS edge with TRIZ properties
  // KuzuDB does not support ALTER TABLE ADD COLUMN on REL tables in 0.11.3,
  // so we store TRIZ data as a separate RESOLVES_VIA edge with resolution_type='triz_principle'
  // and also try to set properties if the edge schema supports it.
  // For forward compatibility, create a RESOLVES_VIA edge capturing the TRIZ resolution direction.
  await conn.query(
    `MATCH (a:Artifact {id: '${esc(artifactA)}'}), (b:Artifact {id: '${esc(artifactB)}'})
     MERGE (a)-[r:RESOLVES_VIA]->(b)
     ON CREATE SET r.resolution_type = 'triz_principle',
                   r.triz_principle = '${esc(principlesStr)}',
                   r.analogy_source = '${esc(improvingParam)} vs ${esc(worseningParam)}',
                   r.confidence = 0.7
     ON MATCH SET r.resolution_type = 'triz_principle',
                  r.triz_principle = '${esc(principlesStr)}',
                  r.analogy_source = '${esc(improvingParam)} vs ${esc(worseningParam)}',
                  r.confidence = 0.7`
  );

  return { success: true, principles };
}

// --- Graph Stats edge type routing update ---

module.exports = {
  EDGE_TYPES,
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
};
