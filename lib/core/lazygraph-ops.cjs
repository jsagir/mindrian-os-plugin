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
const EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES', 'BELONGS_TO', 'REASONING_INFORMS', 'SEGMENT_OF', 'SPOKE_IN', 'CONSULTED_ON', 'HAS_ASSUMPTION', 'ASSUMPTION_IMPACTS'];

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

  // Phase 27: Meeting, Speaker, Assumption node tables
  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Meeting(
      id STRING PRIMARY KEY,
      name STRING,
      date STRING,
      source STRING,
      speakers_count INT64,
      decisions_count INT64,
      action_items_count INT64
    )
  `);

  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Speaker(
      id STRING PRIMARY KEY,
      name STRING,
      role STRING,
      role_type STRING,
      profile_path STRING
    )
  `);

  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Assumption(
      id STRING PRIMARY KEY,
      claim STRING,
      status STRING,
      source_artifact STRING,
      created STRING
    )
  `);

  // Phase 27: New edge tables
  await conn.query(`CREATE REL TABLE IF NOT EXISTS SEGMENT_OF(FROM Artifact TO Meeting, segment_type STRING, confidence DOUBLE DEFAULT 0.5)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS SPOKE_IN(FROM Speaker TO Meeting)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONSULTED_ON(FROM Speaker TO Section, meeting_count INT64 DEFAULT 1)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_ASSUMPTION(FROM Artifact TO Assumption)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS ASSUMPTION_IMPACTS(FROM Assumption TO Section)`);
}

/**
 * Migrate schema: add new columns to existing tables (idempotent).
 * KuzuDB 0.11.x cannot ALTER REL tables -- only node tables.
 * @param {object} conn - KuzuDB Connection
 */
async function migrateSchema(conn) {
  const alters = [
    "ALTER TABLE Artifact ADD artifact_id STRING DEFAULT ''",
    "ALTER TABLE Artifact ADD pipeline STRING DEFAULT ''",
    "ALTER TABLE Artifact ADD pipeline_stage INT64 DEFAULT 0",
  ];
  for (const sql of alters) {
    try { await conn.query(sql); } catch (_) { /* column already exists */ }
  }
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
  await migrateSchema(conn);

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

  // Phase 27: Extract assumptions from frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    // Find assumptions block and extract claims
    const assumptionLines = fmBlock.split('\n');
    let inAssumptions = false;
    let currentClaim = '';
    let currentStatus = 'unvalidated';
    let currentImpacts = [];
    const assumptions = [];

    for (const line of assumptionLines) {
      if (/^assumptions:\s*$/.test(line)) {
        inAssumptions = true;
        continue;
      }
      if (inAssumptions) {
        // New top-level key ends assumptions block
        if (/^\S/.test(line) && !line.startsWith(' ') && !line.startsWith('\t')) {
          // Save pending assumption
          if (currentClaim) {
            assumptions.push({ claim: currentClaim, status: currentStatus, impacts: currentImpacts });
          }
          inAssumptions = false;
          continue;
        }
        const claimMatch = line.match(/^\s+-\s+claim:\s*["']?(.+?)["']?\s*$/);
        if (claimMatch) {
          // Save previous assumption if exists
          if (currentClaim) {
            assumptions.push({ claim: currentClaim, status: currentStatus, impacts: currentImpacts });
          }
          currentClaim = claimMatch[1];
          currentStatus = 'unvalidated';
          currentImpacts = [];
          continue;
        }
        const statusMatch = line.match(/^\s+status:\s*(.+)$/);
        if (statusMatch) {
          currentStatus = statusMatch[1].trim();
          continue;
        }
        const impactsMatch = line.match(/^\s+impacts:\s*\[(.+)\]$/);
        if (impactsMatch) {
          currentImpacts = impactsMatch[1].split(',').map(s => s.trim());
          continue;
        }
      }
    }
    // Save last assumption
    if (inAssumptions && currentClaim) {
      assumptions.push({ claim: currentClaim, status: currentStatus, impacts: currentImpacts });
    }

    // Create Assumption nodes and edges
    for (const assumption of assumptions) {
      const assumptionId = crypto.createHash('sha256')
        .update(assumption.claim.toLowerCase().trim())
        .digest('hex')
        .slice(0, 12);

      // MERGE Assumption node
      await conn.query(
        `MERGE (asn:Assumption {id: '${esc(assumptionId)}'})
         ON CREATE SET asn.claim = '${esc(assumption.claim)}', asn.status = '${esc(assumption.status)}',
                       asn.source_artifact = '${esc(id)}', asn.created = '${esc(created)}'
         ON MATCH SET asn.claim = '${esc(assumption.claim)}', asn.status = '${esc(assumption.status)}'`
      );

      // MERGE HAS_ASSUMPTION edge
      await conn.query(
        `MATCH (a:Artifact {id: '${esc(id)}'}), (asn:Assumption {id: '${esc(assumptionId)}'})
         MERGE (a)-[:HAS_ASSUMPTION]->(asn)`
      );

      // MERGE ASSUMPTION_IMPACTS edges for each impacted section
      for (const impact of assumption.impacts) {
        const impactSection = impact.trim();
        // Ensure section node exists
        const impactLabel = impactSection.replace(/-/g, ' ').toUpperCase();
        await conn.query(
          `MERGE (s:Section {name: '${esc(impactSection)}'})
           ON CREATE SET s.label = '${esc(impactLabel)}'`
        );
        await conn.query(
          `MATCH (asn:Assumption {id: '${esc(assumptionId)}'}), (s:Section {name: '${esc(impactSection)}'})
           MERGE (asn)-[:ASSUMPTION_IMPACTS]->(s)`
        );
      }
    }
  }

  return { id, section, title, contentHash };
}

/**
 * Index a meeting directory into the graph.
 * Reads metadata.yaml, creates Meeting node.
 * @param {object} conn - KuzuDB Connection
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} meetingDir - Absolute path to meeting directory
 * @returns {Promise<{id: string, name: string, date: string}>}
 */
async function indexMeeting(conn, roomDir, meetingDir) {
  const metaPath = path.join(meetingDir, 'metadata.yaml');
  const content = fs.readFileSync(metaPath, 'utf-8');

  // Simple YAML key: value extraction
  const extractYaml = (key) => {
    const line = content.split('\n').find(l => l.match(new RegExp(`^${key}:\\s`)));
    if (!line) return '';
    return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
  };

  const name = extractYaml('meeting_name');
  const date = extractYaml('meeting_date');
  const source = extractYaml('source');
  const id = 'meeting/' + path.basename(meetingDir);

  await conn.query(
    `MERGE (m:Meeting {id: '${esc(id)}'})
     ON CREATE SET m.name = '${esc(name)}', m.date = '${esc(date)}', m.source = '${esc(source)}',
                   m.speakers_count = 0, m.decisions_count = 0, m.action_items_count = 0
     ON MATCH SET m.name = '${esc(name)}', m.date = '${esc(date)}', m.source = '${esc(source)}'`
  );

  return { id, name, date };
}

/**
 * Index a speaker into the graph and create SPOKE_IN edge to meeting.
 * @param {object} conn - KuzuDB Connection
 * @param {string} meetingId - Meeting node ID (e.g. 'meeting/2026-03-15-investor-call')
 * @param {object} speaker - Speaker object {name, role, role_type?, profile_path?}
 * @returns {Promise<{id: string, name: string}>}
 */
async function indexSpeaker(conn, meetingId, speaker) {
  const id = 'speaker/' + speaker.name.toLowerCase().replace(/\s+/g, '-');
  const role = speaker.role || '';
  const roleType = speaker.role_type || '';
  const profilePath = speaker.profile_path || '';

  await conn.query(
    `MERGE (s:Speaker {id: '${esc(id)}'})
     ON CREATE SET s.name = '${esc(speaker.name)}', s.role = '${esc(role)}',
                   s.role_type = '${esc(roleType)}', s.profile_path = '${esc(profilePath)}'
     ON MATCH SET s.name = '${esc(speaker.name)}', s.role = '${esc(role)}',
                  s.role_type = '${esc(roleType)}', s.profile_path = '${esc(profilePath)}'`
  );

  // SPOKE_IN edge
  await conn.query(
    `MATCH (s:Speaker {id: '${esc(id)}'}), (m:Meeting {id: '${esc(meetingId)}'})
     MERGE (s)-[:SPOKE_IN]->(m)`
  );

  return { id, name: speaker.name };
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
  const meetingRows = await queryGraph(conn, 'MATCH (m:Meeting) RETURN count(*) AS cnt');
  const speakerRows = await queryGraph(conn, 'MATCH (s:Speaker) RETURN count(*) AS cnt');
  const assumptionRows = await queryGraph(conn, 'MATCH (a:Assumption) RETURN count(*) AS cnt');
  const artifactCount = artifactRows[0]?.cnt || 0;
  const sectionCount = sectionRows[0]?.cnt || 0;
  const meetingCount = meetingRows[0]?.cnt || 0;
  const speakerCount = speakerRows[0]?.cnt || 0;
  const assumptionCount = assumptionRows[0]?.cnt || 0;

  // Edge type -> query pattern mapping
  const edgeQueryMap = {
    'INFORMS': '(a:Artifact)-[:INFORMS]->(b:Artifact)',
    'CONTRADICTS': '(a:Artifact)-[:CONTRADICTS]->(b:Artifact)',
    'CONVERGES': '(a:Artifact)-[:CONVERGES]->(b:Artifact)',
    'ENABLES': '(a:Artifact)-[:ENABLES]->(b:Artifact)',
    'INVALIDATES': '(a:Artifact)-[:INVALIDATES]->(b:Artifact)',
    'BELONGS_TO': '(a:Artifact)-[:BELONGS_TO]->(s:Section)',
    'REASONING_INFORMS': '(s1:Section)-[:REASONING_INFORMS]->(s2:Section)',
    'SEGMENT_OF': '(a:Artifact)-[:SEGMENT_OF]->(m:Meeting)',
    'SPOKE_IN': '(s:Speaker)-[:SPOKE_IN]->(m:Meeting)',
    'CONSULTED_ON': '(s:Speaker)-[:CONSULTED_ON]->(sec:Section)',
    'HAS_ASSUMPTION': '(a:Artifact)-[:HAS_ASSUMPTION]->(asn:Assumption)',
    'ASSUMPTION_IMPACTS': '(asn:Assumption)-[:ASSUMPTION_IMPACTS]->(s:Section)',
  };

  // Count edges per type
  const edges = {};
  for (const edgeType of EDGE_TYPES) {
    const pattern = edgeQueryMap[edgeType] || `()-[:${edgeType}]->()`;
    const query = `MATCH ${pattern} RETURN count(*) AS cnt`;
    const rows = await queryGraph(conn, query);
    edges[edgeType] = rows[0]?.cnt || 0;
  }

  const totalEdges = Object.values(edges).reduce((sum, n) => sum + n, 0);
  const totalNodes = artifactCount + sectionCount + meetingCount + speakerCount + assumptionCount;

  return {
    nodes: { Artifact: artifactCount, Section: sectionCount, Meeting: meetingCount, Speaker: speakerCount, Assumption: assumptionCount },
    edges,
    total: { nodes: totalNodes, edges: totalEdges },
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

module.exports = {
  openGraph,
  closeGraph,
  initSchema,
  migrateSchema,
  indexArtifact,
  indexMeeting,
  indexSpeaker,
  rebuildGraph,
  queryGraph,
  graphStats,
  embedArtifact,
  EDGE_TYPES,
};
