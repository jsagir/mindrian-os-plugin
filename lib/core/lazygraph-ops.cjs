/**
 * MindrianOS Plugin -- LazyGraph Operations
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
const EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO', 'REASONING_INFORMS', 'HSI_CONNECTION', 'REVERSE_SALIENT', 'ANALOGOUS_TO', 'STRUCTURALLY_ISOMORPHIC', 'RESOLVES_VIA', 'CAUSES', 'ROOT_CAUSE_OF', 'CASCADES_TO', 'EXTRACTED_FROM', 'WHITESPACE_DETECTED', 'WHITESPACE_NEAR'];

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

  // Causal schema edge types (Phase 52)
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CAUSES(
    FROM Artifact TO Artifact,
    mechanism STRING DEFAULT '',
    confidence DOUBLE DEFAULT 0.0,
    framework STRING DEFAULT '',
    direction STRING DEFAULT 'forward'
  )`);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS ROOT_CAUSE_OF(
    FROM Artifact TO Artifact,
    chain_length INT64 DEFAULT 1,
    intermediate_causes STRING DEFAULT '[]',
    confidence DOUBLE DEFAULT 0.0,
    discovery_source STRING DEFAULT 'manual'
  )`);

  // --- Causal Reasoning Layer v1.7.0 (SCHEMA-01 through SCHEMA-04) ---
  // CausalClaim nodes represent extracted cause-effect assertions from room artifacts.
  // CASCADES_TO tracks assumption failure propagation. EXTRACTED_FROM links back to source.
  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS CausalClaim(
      id STRING PRIMARY KEY,
      cause STRING,
      mechanism STRING,
      effect STRING,
      confidence DOUBLE DEFAULT 0.5,
      evidence STRING DEFAULT '[]',
      source_artifact STRING DEFAULT '',
      domain STRING DEFAULT 'general',
      falsifiable_prediction STRING DEFAULT '',
      novelty_score DOUBLE DEFAULT 0.0,
      extraction_method STRING DEFAULT 'inferred',
      created STRING DEFAULT ''
    )
  `);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS CASCADES_TO(
    FROM CausalClaim TO CausalClaim,
    cascade_type STRING DEFAULT 'invalidation',
    severity STRING DEFAULT 'medium',
    path_length INT64 DEFAULT 1
  )`);

  // Link causal claims back to source artifacts
  await conn.query(`CREATE REL TABLE IF NOT EXISTS EXTRACTED_FROM(
    FROM CausalClaim TO Artifact
  )`);

  // --- Whitespace Zone Layer (Phase 61) ---
  // WhitespaceZone nodes represent detected gaps in the room's knowledge space.
  // density_score measures how sparse the embedding region is (lower = more novel territory).
  // exploration_status tracks whether the gap has been investigated.
  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS WhitespaceZone(
      id STRING PRIMARY KEY,
      brain_framework STRING,
      density_score DOUBLE DEFAULT 0.0,
      knn_density DOUBLE DEFAULT 0.0,
      nearest_frameworks STRING DEFAULT '[]',
      hypothesis STRING DEFAULT '',
      strategic_rank DOUBLE DEFAULT 0.0,
      problem_type STRING DEFAULT '',
      exploration_status STRING DEFAULT 'detected',
      created STRING DEFAULT ''
    )
  `);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS WHITESPACE_DETECTED(
    FROM WhitespaceZone TO Artifact,
    distance DOUBLE DEFAULT 0.0
  )`);

  await conn.query(`CREATE REL TABLE IF NOT EXISTS WHITESPACE_NEAR(
    FROM WhitespaceZone TO Section,
    relevance DOUBLE DEFAULT 0.0
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

  // Count CausalClaim nodes (v1.7.0)
  let causalCount = 0;
  try {
    const causalRows = await queryGraph(conn, 'MATCH (c:CausalClaim) RETURN count(*) AS cnt');
    causalCount = causalRows[0]?.cnt || 0;
  } catch (e) { /* table may not exist yet in older .lazygraph databases */ }

  // Count WhitespaceZone nodes (Phase 61)
  let whitespaceCount = 0;
  try {
    const wsRows = await queryGraph(conn, 'MATCH (w:WhitespaceZone) RETURN count(*) AS cnt');
    whitespaceCount = wsRows[0]?.cnt || 0;
  } catch (e) { /* table may not exist yet in older .lazygraph databases */ }

  // Count edges per type
  // Edge type -> source/target node types for correct query routing
  const CAUSAL_EDGE_ROUTES = {
    'CASCADES_TO': 'CausalClaim_CausalClaim',
    'EXTRACTED_FROM': 'CausalClaim_Artifact',
  };
  const WHITESPACE_EDGE_ROUTES = {
    'WHITESPACE_DETECTED': 'WhitespaceZone_Artifact',
    'WHITESPACE_NEAR': 'WhitespaceZone_Section',
  };
  const edges = {};
  for (const edgeType of EDGE_TYPES) {
    let query;
    if (edgeType === 'BELONGS_TO') {
      query = `MATCH (a:Artifact)-[:${edgeType}]->(s:Section) RETURN count(*) AS cnt`;
    } else if (edgeType === 'REASONING_INFORMS' || edgeType === 'REVERSE_SALIENT' || edgeType === 'STRUCTURALLY_ISOMORPHIC') {
      query = `MATCH (s1:Section)-[:${edgeType}]->(s2:Section) RETURN count(*) AS cnt`;
    } else if (CAUSAL_EDGE_ROUTES[edgeType] === 'CausalClaim_CausalClaim') {
      query = `MATCH (a:CausalClaim)-[:${edgeType}]->(b:CausalClaim) RETURN count(*) AS cnt`;
    } else if (CAUSAL_EDGE_ROUTES[edgeType] === 'CausalClaim_Artifact') {
      query = `MATCH (a:CausalClaim)-[:${edgeType}]->(b:Artifact) RETURN count(*) AS cnt`;
    } else if (WHITESPACE_EDGE_ROUTES[edgeType] === 'WhitespaceZone_Artifact') {
      query = `MATCH (w:WhitespaceZone)-[:${edgeType}]->(a:Artifact) RETURN count(*) AS cnt`;
    } else if (WHITESPACE_EDGE_ROUTES[edgeType] === 'WhitespaceZone_Section') {
      query = `MATCH (w:WhitespaceZone)-[:${edgeType}]->(s:Section) RETURN count(*) AS cnt`;
    } else {
      query = `MATCH (a:Artifact)-[:${edgeType}]->(b:Artifact) RETURN count(*) AS cnt`;
    }
    try {
      const rows = await queryGraph(conn, query);
      edges[edgeType] = rows[0]?.cnt || 0;
    } catch (e) {
      edges[edgeType] = 0; // table may not exist in older databases
    }
  }

  const totalEdges = Object.values(edges).reduce((sum, n) => sum + n, 0);

  return {
    nodes: { Artifact: artifactCount, Section: sectionCount, CausalClaim: causalCount, WhitespaceZone: whitespaceCount },
    edges,
    total: { nodes: artifactCount + sectionCount + causalCount + whitespaceCount, edges: totalEdges },
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

// --- Causal Extraction CRUD (Phase 53) ---

/**
 * Create or update a CausalClaim node in KuzuDB.
 * Writes all 12 properties via MERGE (upsert). Truncates cause/effect to 200 chars,
 * mechanism to 300 chars to prevent oversized nodes.
 * @param {object} conn - KuzuDB Connection
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
  const id = esc(claim.id);
  const cause = esc((claim.cause || '').slice(0, 200));
  const mechanism = esc((claim.mechanism || '').slice(0, 300));
  const effect = esc((claim.effect || '').slice(0, 200));
  const confidence = typeof claim.confidence === 'number' ? claim.confidence : 0.5;
  const evidence = esc(Array.isArray(claim.evidence) ? JSON.stringify(claim.evidence) : (claim.evidence || '[]'));
  const sourceArtifact = esc(claim.source_artifact || '');
  const domain = esc(claim.domain || 'general');
  const prediction = esc(claim.falsifiable_prediction || '');
  const novelty = typeof claim.novelty_score === 'number' ? claim.novelty_score : 0.0;
  const method = esc(claim.extraction_method || 'inferred');
  const created = esc(claim.created || '');

  await conn.query(
    `MERGE (c:CausalClaim {id: '${id}'})
     ON CREATE SET c.cause = '${cause}',
                   c.mechanism = '${mechanism}',
                   c.effect = '${effect}',
                   c.confidence = ${confidence},
                   c.evidence = '${evidence}',
                   c.source_artifact = '${sourceArtifact}',
                   c.domain = '${domain}',
                   c.falsifiable_prediction = '${prediction}',
                   c.novelty_score = ${novelty},
                   c.extraction_method = '${method}',
                   c.created = '${created}'
     ON MATCH SET c.cause = '${cause}',
                  c.mechanism = '${mechanism}',
                  c.effect = '${effect}',
                  c.confidence = ${confidence},
                  c.evidence = '${evidence}',
                  c.source_artifact = '${sourceArtifact}',
                  c.domain = '${domain}',
                  c.falsifiable_prediction = '${prediction}',
                  c.novelty_score = ${novelty},
                  c.extraction_method = '${method}',
                  c.created = '${created}'`
  );
  return true;
}

/**
 * Create an EXTRACTED_FROM edge linking a CausalClaim to its source Artifact.
 * @param {object} conn - KuzuDB Connection
 * @param {string} claimId - CausalClaim node ID
 * @param {string} artifactId - Artifact node ID
 * @returns {Promise<boolean>}
 */
async function createExtractedFromEdge(conn, claimId, artifactId) {
  await conn.query(
    `MATCH (c:CausalClaim {id: '${esc(claimId)}'}), (a:Artifact {id: '${esc(artifactId)}'})
     MERGE (c)-[:EXTRACTED_FROM]->(a)`
  );
  return true;
}

// --- Causal Graph Engine (Phase 54) ---

/**
 * Create a CASCADES_TO edge between two CausalClaim nodes.
 * Idempotent via MERGE. Records cascade type and severity.
 * @param {object} conn - KuzuDB Connection
 * @param {string} fromClaimId - Source CausalClaim node ID
 * @param {string} toClaimId - Target CausalClaim node ID
 * @param {object} [opts] - Edge properties
 * @param {string} [opts.cascade_type='invalidation'] - invalidation|weakening|dependency
 * @param {string} [opts.severity='medium'] - high|medium|low
 * @param {number} [opts.path_length=1] - Hop distance
 * @returns {Promise<boolean>}
 */
async function createCascadesToEdge(conn, fromClaimId, toClaimId, opts = {}) {
  const cascadeType = esc(opts.cascade_type || 'invalidation');
  const severity = esc(opts.severity || 'medium');
  const pathLength = typeof opts.path_length === 'number' ? opts.path_length : 1;

  await conn.query(
    `MATCH (a:CausalClaim {id: '${esc(fromClaimId)}'}), (b:CausalClaim {id: '${esc(toClaimId)}'})
     MERGE (a)-[r:CASCADES_TO]->(b)
     ON CREATE SET r.cascade_type = '${cascadeType}',
                   r.severity = '${severity}',
                   r.path_length = ${pathLength}
     ON MATCH SET r.cascade_type = '${cascadeType}',
                  r.severity = '${severity}',
                  r.path_length = ${pathLength}`
  );
  return true;
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
      nodes = await queryGraph(conn,
        `MATCH (c:CausalClaim) RETURN c.id, c.cause, c.mechanism, c.effect, c.confidence, c.domain, c.source_artifact`
      );
    } catch (e) {
      // CausalClaim table may not exist in older databases
    }

    // Query all CASCADES_TO edges
    let edges = [];
    try {
      edges = await queryGraph(conn,
        `MATCH (a:CausalClaim)-[r:CASCADES_TO]->(b:CausalClaim) RETURN a.id AS source, b.id AS target, r.cascade_type, r.severity`
      );
    } catch (e) {
      // CASCADES_TO table may not exist
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

// --- Whitespace Zone CRUD (Phase 61) ---

/**
 * Create or update a WhitespaceZone node in KuzuDB.
 * Writes all properties via MERGE (upsert). Idempotent.
 * @param {object} conn - KuzuDB Connection
 * @param {object} zone - WhitespaceZone properties
 * @param {string} zone.id - Unique zone ID (e.g. ws-framework-slug-hash)
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
  const id = esc(zone.id);
  const brainFramework = esc(zone.brain_framework || '');
  const densityScore = typeof zone.density_score === 'number' ? zone.density_score : 0.0;
  const knnDensity = typeof zone.knn_density === 'number' ? zone.knn_density : 0.0;
  const nearestFrameworks = esc(Array.isArray(zone.nearest_frameworks) ? JSON.stringify(zone.nearest_frameworks) : (zone.nearest_frameworks || '[]'));
  const hypothesis = esc((zone.hypothesis || '').slice(0, 500));
  const strategicRank = typeof zone.strategic_rank === 'number' ? zone.strategic_rank : 0.0;
  const problemType = esc(zone.problem_type || '');
  const explorationStatus = esc(zone.exploration_status || 'detected');
  const created = esc(zone.created || '');

  await conn.query(
    `MERGE (w:WhitespaceZone {id: '${id}'})
     ON CREATE SET w.brain_framework = '${brainFramework}',
                   w.density_score = ${densityScore},
                   w.knn_density = ${knnDensity},
                   w.nearest_frameworks = '${nearestFrameworks}',
                   w.hypothesis = '${hypothesis}',
                   w.strategic_rank = ${strategicRank},
                   w.problem_type = '${problemType}',
                   w.exploration_status = '${explorationStatus}',
                   w.created = '${created}'
     ON MATCH SET w.brain_framework = '${brainFramework}',
                  w.density_score = ${densityScore},
                  w.knn_density = ${knnDensity},
                  w.nearest_frameworks = '${nearestFrameworks}',
                  w.hypothesis = '${hypothesis}',
                  w.strategic_rank = ${strategicRank},
                  w.problem_type = '${problemType}',
                  w.exploration_status = '${explorationStatus}',
                  w.created = '${created}'`
  );
  return true;
}

/**
 * Create a WHITESPACE_DETECTED edge from a WhitespaceZone to a nearby Artifact.
 * Records embedding distance. Idempotent via MERGE.
 * @param {object} conn - KuzuDB Connection
 * @param {string} zoneId - WhitespaceZone node ID
 * @param {string} artifactId - Artifact node ID
 * @param {number} [distance=0.0] - Embedding distance between zone centroid and artifact
 * @returns {Promise<boolean>}
 */
async function linkWhitespaceToArtifact(conn, zoneId, artifactId, distance = 0.0) {
  await conn.query(
    `MATCH (w:WhitespaceZone {id: '${esc(zoneId)}'}), (a:Artifact {id: '${esc(artifactId)}'})
     MERGE (w)-[r:WHITESPACE_DETECTED]->(a)
     ON CREATE SET r.distance = ${distance}
     ON MATCH SET r.distance = ${distance}`
  );
  return true;
}

/**
 * Create a WHITESPACE_NEAR edge from a WhitespaceZone to a Section.
 * Records relevance score. Idempotent via MERGE.
 * @param {object} conn - KuzuDB Connection
 * @param {string} zoneId - WhitespaceZone node ID
 * @param {string} sectionName - Section node name
 * @param {number} [relevance=0.0] - Relevance score (0-1)
 * @returns {Promise<boolean>}
 */
async function linkWhitespaceToSection(conn, zoneId, sectionName, relevance = 0.0) {
  await conn.query(
    `MATCH (w:WhitespaceZone {id: '${esc(zoneId)}'}), (s:Section {name: '${esc(sectionName)}'})
     MERGE (w)-[r:WHITESPACE_NEAR]->(s)
     ON CREATE SET r.relevance = ${relevance}
     ON MATCH SET r.relevance = ${relevance}`
  );
  return true;
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
};
