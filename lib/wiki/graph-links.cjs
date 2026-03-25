'use strict';
/**
 * graph-links.cjs — KuzuDB integration for the wiki
 *
 * Queries LazyGraph edges and converts them into navigational
 * hyperlinks, backlinks, "See also" sections, and full graph data
 * for Cytoscape.js visualization.
 *
 * Exports: getPageLinks, getBacklinks, getSeeAlso, getGraphData
 */

const path = require('path');

// Edge type display configuration
// BELONGS_TO and REASONING_INFORMS are structural — skip for navigation
const EDGE_DISPLAY = {
  INFORMS:      { symbol: '\u2192', color: '#1E3A6E', cssClass: 'link-informs',      label: 'Informs' },
  CONTRADICTS:  { symbol: '\u2297', color: '#A63D2F', cssClass: 'link-contradicts',  label: 'Contradicts' },
  CONVERGES:    { symbol: '\u2295', color: '#C8A43C', cssClass: 'link-converges',    label: 'Converges' },
  ENABLES:      { symbol: '\u25B6', color: '#2D6B4A', cssClass: 'link-enables',      label: 'Enables' },
  INVALIDATES:  { symbol: '\u2298', color: '#B5602A', cssClass: 'link-invalidates',  label: 'Invalidates' }
};

const NAV_EDGE_TYPES = Object.keys(EDGE_DISPLAY);

/**
 * Safely require lazygraph-ops. Returns null if not available.
 */
function getLazyGraphOps() {
  try {
    return require('../core/lazygraph-ops.cjs');
  } catch (e) {
    return null;
  }
}

/**
 * Check if a .lazygraph database exists for the room.
 * @param {string} roomDir
 * @returns {boolean}
 */
function hasLazyGraph(roomDir) {
  const fs = require('fs');
  const lgPath = path.join(path.resolve(roomDir), '.lazygraph');
  return fs.existsSync(lgPath);
}

/**
 * Get all outgoing navigational edges from an artifact.
 *
 * @param {string} roomDir - Path to room/ directory
 * @param {string} artifactId - e.g. "problem-definition/market-trends"
 * @returns {Promise<Array<{type, targetId, targetTitle, symbol, color, cssClass, label}>>}
 */
async function getPageLinks(roomDir, artifactId) {
  if (!hasLazyGraph(roomDir)) return [];

  const ops = getLazyGraphOps();
  if (!ops) return [];

  let db, conn;
  try {
    ({ db, conn } = await ops.openGraph(roomDir));

    const rows = await ops.queryGraph(conn,
      `MATCH (a:Artifact {id: '${esc(artifactId)}'})-[r]->(b:Artifact) ` +
      `RETURN type(r) AS rel, b.id AS target, b.title AS title`
    );

    const links = [];
    for (const row of rows) {
      const edgeType = row.rel;
      const display = EDGE_DISPLAY[edgeType];
      if (!display) continue; // Skip BELONGS_TO, REASONING_INFORMS, etc.

      links.push({
        type: edgeType,
        targetId: row.target,
        targetTitle: row.title || row.target,
        symbol: display.symbol,
        color: display.color,
        cssClass: display.cssClass,
        label: display.label
      });
    }

    return links;
  } catch (e) {
    process.stderr.write(`[wiki] graph-links getPageLinks error: ${e.message}\n`);
    return [];
  } finally {
    if (db) try { await ops.closeGraph(db); } catch (_) { /* ignore */ }
  }
}

/**
 * Get all incoming edges TO an artifact (backlinks — "What links here").
 *
 * @param {string} roomDir - Path to room/ directory
 * @param {string} artifactId - e.g. "problem-definition/market-trends"
 * @returns {Promise<Array<{type, sourceId, sourceTitle, symbol, color}>>}
 */
async function getBacklinks(roomDir, artifactId) {
  if (!hasLazyGraph(roomDir)) return [];

  const ops = getLazyGraphOps();
  if (!ops) return [];

  let db, conn;
  try {
    ({ db, conn } = await ops.openGraph(roomDir));

    const rows = await ops.queryGraph(conn,
      `MATCH (a:Artifact)-[r]->(b:Artifact {id: '${esc(artifactId)}'}) ` +
      `RETURN type(r) AS rel, a.id AS source, a.title AS title`
    );

    const backlinks = [];
    for (const row of rows) {
      const edgeType = row.rel;
      const display = EDGE_DISPLAY[edgeType];
      if (!display) continue;

      backlinks.push({
        type: edgeType,
        sourceId: row.source,
        sourceTitle: row.title || row.source,
        symbol: display.symbol,
        color: display.color
      });
    }

    return backlinks;
  } catch (e) {
    process.stderr.write(`[wiki] graph-links getBacklinks error: ${e.message}\n`);
    return [];
  } finally {
    if (db) try { await ops.closeGraph(db); } catch (_) { /* ignore */ }
  }
}

/**
 * Get "See also" links — CONVERGES and ENABLES edges grouped by theme.
 *
 * @param {string} roomDir - Path to room/ directory
 * @param {string} artifactId - e.g. "problem-definition/market-trends"
 * @returns {Promise<Array<{targetId, targetTitle, reason}>>}
 */
async function getSeeAlso(roomDir, artifactId) {
  if (!hasLazyGraph(roomDir)) return [];

  const ops = getLazyGraphOps();
  if (!ops) return [];

  let db, conn;
  try {
    ({ db, conn } = await ops.openGraph(roomDir));

    // CONVERGES edges (with optional theme from r.term)
    const convergesRows = await ops.queryGraph(conn,
      `MATCH (a:Artifact {id: '${esc(artifactId)}'})-[r:CONVERGES]->(b:Artifact) ` +
      `RETURN b.id AS target, b.title AS title, r.term AS theme`
    );

    // ENABLES edges
    const enablesRows = await ops.queryGraph(conn,
      `MATCH (a:Artifact {id: '${esc(artifactId)}'})-[r:ENABLES]->(b:Artifact) ` +
      `RETURN b.id AS target, b.title AS title`
    );

    const seeAlso = [];
    const seen = new Set();

    for (const row of convergesRows) {
      if (seen.has(row.target)) continue;
      seen.add(row.target);
      seeAlso.push({
        targetId: row.target,
        targetTitle: row.title || row.target,
        reason: row.theme ? `Converges on: ${row.theme}` : 'Converging topic'
      });
    }

    for (const row of enablesRows) {
      if (seen.has(row.target)) continue;
      seen.add(row.target);
      seeAlso.push({
        targetId: row.target,
        targetTitle: row.title || row.target,
        reason: 'Enables'
      });
    }

    return seeAlso;
  } catch (e) {
    process.stderr.write(`[wiki] graph-links getSeeAlso error: ${e.message}\n`);
    return [];
  } finally {
    if (db) try { await ops.closeGraph(db); } catch (_) { /* ignore */ }
  }
}

/**
 * Get all artifacts and edges for Cytoscape.js graph visualization.
 *
 * @param {string} roomDir - Path to room/ directory
 * @returns {Promise<{nodes: Array<{id, title, section}>, edges: Array<{source, target, type}>}>}
 */
async function getGraphData(roomDir) {
  if (!hasLazyGraph(roomDir)) return { nodes: [], edges: [] };

  const ops = getLazyGraphOps();
  if (!ops) return { nodes: [], edges: [] };

  let db, conn;
  try {
    ({ db, conn } = await ops.openGraph(roomDir));

    // All artifact nodes
    const nodeRows = await ops.queryGraph(conn,
      `MATCH (a:Artifact) RETURN a.id AS id, a.title AS title, a.section AS section`
    );

    const nodes = nodeRows.map(row => ({
      id: row.id,
      title: row.title || row.id,
      section: row.section || ''
    }));

    // All navigational edges (skip BELONGS_TO, REASONING_INFORMS)
    const edges = [];
    for (const edgeType of NAV_EDGE_TYPES) {
      const edgeRows = await ops.queryGraph(conn,
        `MATCH (a:Artifact)-[:${edgeType}]->(b:Artifact) ` +
        `RETURN a.id AS source, b.id AS target`
      );
      for (const row of edgeRows) {
        edges.push({
          source: row.source,
          target: row.target,
          type: edgeType
        });
      }
    }

    return { nodes, edges };
  } catch (e) {
    process.stderr.write(`[wiki] graph-links getGraphData error: ${e.message}\n`);
    return { nodes: [], edges: [] };
  } finally {
    if (db) try { await ops.closeGraph(db); } catch (_) { /* ignore */ }
  }
}

/**
 * Escape single quotes for Cypher string literals.
 */
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

module.exports = {
  getPageLinks,
  getBacklinks,
  getSeeAlso,
  getGraphData,
  EDGE_DISPLAY,
  NAV_EDGE_TYPES
};
