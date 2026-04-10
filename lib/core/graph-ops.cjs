/**
 * MindrianOS Plugin -- Graph Operations
 * Wraps existing Bash scripts via execSync AND lazygraph-ops.cjs for SQLite.
 * build-graph: Bash script wrapper (JSON export for dashboard).
 * index/rebuild/query/stats: SQLite via lazygraph-ops.cjs (per-project graph).
 *
 * All lazygraph functions use open-use-close pattern to avoid DB locking.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const lazygraph = require('./lazygraph-ops.cjs');
const { acquireLock, releaseLock } = require('./write-lock.cjs');

// Promise-chain write queue: serializes all SQLite writes.
// Read operations bypass this queue (SQLite WAL allows concurrent reads).
let writeQueue = Promise.resolve();

function enqueueWrite(roomDir, fn) {
  const op = writeQueue.then(async () => {
    acquireLock(roomDir);
    try {
      return await fn();
    } finally {
      releaseLock(roomDir);
    }
  });
  writeQueue = op.catch(() => {}); // prevent unhandled rejection from blocking queue
  return op;
}

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run build-graph script against a room directory.
 * @param {string} roomDir - Path to room directory
 * @param {string} [outputPath] - Output path for graph JSON (defaults to ./dashboard/graph.json)
 * @returns {{ success: boolean, outputPath: string }} Result object
 */
function buildGraph(roomDir, outputPath) {
  const resolved = path.resolve(roomDir);
  const resolvedOutput = outputPath || './dashboard/graph.json';
  const scriptPath = path.join(SCRIPTS_DIR, 'build-graph');
  try {
    execSync(`bash "${scriptPath}" "${resolved}" "${resolvedOutput}"`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, outputPath: resolvedOutput };
  } catch (e) {
    throw new Error(`build-graph failed: ${e.message}`);
  }
}

/**
 * Index a single artifact into the per-project SQLite graph.
 * Opens graph, indexes artifact, closes graph (open-use-close pattern).
 * @param {string} roomDir - Path to room directory
 * @param {string} filePath - Path to .md file to index
 * @returns {Promise<{ success: boolean, id: string, section: string, title: string }>}
 */
async function indexArtifact(roomDir, filePath) {
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      const result = await lazygraph.indexArtifact(conn, roomDir, filePath);
      return { success: true, id: result.id, section: result.section, title: result.title };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

/**
 * Rebuild the entire per-project SQLite graph from all room artifacts.
 * Opens graph, clears and re-indexes everything, closes graph.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ success: boolean, artifacts: number, sections: number }>}
 */
async function rebuildGraph(roomDir) {
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      const result = await lazygraph.rebuildGraph(conn, roomDir);
      return { success: true, artifacts: result.artifacts, sections: result.sections };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

/**
 * Execute a SQL query against the per-project SQLite graph.
 * Opens graph, runs query, closes graph.
 * @param {string} roomDir - Path to room directory
 * @param {string} sql - SQL query string
 * @returns {Promise<{ success: boolean, rows: Array<object>, count: number }>}
 */
async function queryGraph(roomDir, sql) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    const rows = await lazygraph.queryGraph(conn, sql);
    return { success: true, rows, count: rows.length };
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Get graph statistics from the per-project SQLite graph.
 * Opens graph, gets stats, closes graph.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ nodes: object, edges: object, total: { nodes: number, edges: number } }>}
 */
async function graphStats(roomDir) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    return await lazygraph.graphStats(conn);
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Build graph.json from SQLite as primary source.
 * Falls back to file-scanning buildGraph if SQLite fails.
 * NOTE: This function calls the build-graph-from-sqlite.cjs script.
 * Falls back to buildGraph on failure.
 * @param {string} roomDir - Path to room directory
 * @param {string} [outputPath] - Output path for graph JSON
 * @returns {{ success: boolean, outputPath: string, source: string }}
 */
function buildGraphFromKuzu(roomDir, outputPath) {
  const resolved = path.resolve(roomDir);
  const resolvedOutput = outputPath || path.join(resolved, '.presentation', 'graph.json');
  const scriptPath = path.join(SCRIPTS_DIR, 'build-graph-from-sqlite.cjs');

  try {
    execSync(`node "${scriptPath}" "${resolved}" "${resolvedOutput}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Check if file was actually created (script exits 0 even on graceful degradation)
    const fs = require('fs');
    if (fs.existsSync(resolvedOutput)) {
      return { success: true, outputPath: resolvedOutput, source: 'sqlite' };
    }
  } catch (_e) {
    // Fall through to file-scanning fallback
  }

  // Fallback to existing file-scanning build-graph
  try {
    const result = buildGraph(roomDir, resolvedOutput);
    return { success: true, outputPath: resolvedOutput, source: 'fallback-filescan' };
  } catch (_e2) {
    return { success: false, outputPath: resolvedOutput, source: 'none' };
  }
}

/**
 * Persist a decision edge (INVALIDATES/CONFIRMS/DEFERRED) to LazyGraph SQLite.
 * Uses enqueueWrite for serialized access + open-use-close pattern.
 *
 * @param {string} roomDir - Path to room directory
 * @param {string} sourceArtifactId - Source artifact ID
 * @param {string} targetArtifactId - Target artifact ID
 * @param {'INVALIDATES'|'CONFIRMS'|'DEFERRED'} edgeType - Edge type from recordDecision
 * @param {Object} [properties={}] - Edge properties (reason, timestamp)
 * @returns {Promise<{ success: boolean, edgeType: string }>}
 */
async function persistDecisionEdge(roomDir, sourceArtifactId, targetArtifactId, edgeType, properties = {}) {
  const escLocal = s => String(s || '').replace(/'/g, "\\'");

  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      if (edgeType === 'INVALIDATES') {
        await conn.query(
          `MATCH (s:Artifact {id: '${escLocal(sourceArtifactId)}'}), (t:Artifact {id: '${escLocal(targetArtifactId)}'})
           MERGE (s)-[:INVALIDATES]->(t)`
        );
      } else if (edgeType === 'CONFIRMS') {
        await lazygraph.createConfirmsEdge(conn, sourceArtifactId, targetArtifactId, properties.reason || '', properties.timestamp || '');
      } else if (edgeType === 'DEFERRED') {
        await lazygraph.createDeferredEdge(conn, sourceArtifactId, targetArtifactId, properties.timestamp || '');
      }
      return { success: true, edgeType };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

/**
 * Index an opportunity into the per-project KuzuDB graph.
 * Creates Opportunity node, ADDRESSES edges to domain artifacts, IN_DOMAIN edge to section.
 * Uses enqueueWrite for serialized KuzuDB access (open-use-close pattern).
 *
 * @param {string} roomDir - Path to room directory
 * @param {object} opportunity - Opportunity object with problem_hash, domain, etc.
 * @returns {Promise<{success: boolean, problem_hash: string}>}
 */
async function indexOpportunity(roomDir, opportunity) {
  return enqueueWrite(roomDir, async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    try {
      // Create opportunity node (MERGE = idempotent)
      await lazygraph.createOpportunityNode(conn, opportunity);

      // ADDRESSES edge: link to artifacts in the opportunity's domain section
      if (opportunity.domain) {
        const domainEsc = String(opportunity.domain || '').replace(/'/g, "\\'");
        const rows = await lazygraph.queryGraph(conn,
          `MATCH (a:Artifact {section: '${domainEsc}'}) RETURN a.id AS id LIMIT 5`
        );
        for (const row of rows) {
          const aid = row.id || row['a.id'] || row[0];
          if (aid) await lazygraph.createAddressesEdge(conn, opportunity.problem_hash, aid);
        }
      }

      // IN_DOMAIN edge: link to section node
      if (opportunity.domain) {
        await lazygraph.createInDomainEdge(conn, opportunity.problem_hash, opportunity.domain);
      }

      return { success: true, problem_hash: opportunity.problem_hash };
    } finally {
      await lazygraph.closeGraph(db);
    }
  });
}

module.exports = { buildGraph, buildGraphFromKuzu, indexArtifact, rebuildGraph, queryGraph, graphStats, enqueueWrite, persistDecisionEdge, indexOpportunity };
