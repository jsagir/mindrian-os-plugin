/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 03 -- 5-branch Cytoscape mind-map generator.
 *
 * renderMindMap(query_filter, opts) is the read-side companion to the
 * dual-tier writers (rs-neo4j-writer.cjs Plan 89.3-01 and
 * rs-sqlite-mirror.cjs Plan 89.3-02). It reads from the active tier
 * (Aura via opts.driver OR room.db via opts.roomDir) and emits a
 * Cytoscape-compatible JSON payload split into 5 branches PLUS a
 * standalone HTML wrapper.
 *
 * The 5 branches (per kickoff section 5):
 *   1. Direct Intersections    lsa > 0.6 AND bert > 0.6
 *   2. Structural Transfer     classification = structural_transfer
 *   3. Semantic Implementation classification = semantic_implementation
 *   4. Discovered RS           ReverseSalient nodes
 *   5. Innovation Ecosystem    Innovation + Paper + Author + Institution slice
 *
 * Tier dispatch is transparent. Caller passes opts.tier explicitly OR
 * the module auto-detects: if opts.driver looks like a neo4j-driver
 * Driver, use Aura; if opts.roomDir is a string, use SQLite. If neither
 * is provided, throws TypeError with a clear message so the caller
 * can fix the call site.
 *
 * Canon Part 7 (Reuse Before Build):
 *   - Reuses lazygraph.openGraph + closeGraph (no new SQLite wrapper)
 *   - Reuses dashboard/index.html cytoscape@3.33.1 CDN URL byte-for-byte
 *     (NO new runtime dependency; no build step)
 *   - Shares ExternalEgressViolation + auditQueryObject with 89.2 fetchers
 *
 * Canon Part 8 (Graph Boundary -- defense-in-depth on the DISPLAY surface):
 * the data source is trusted (user's OWN graph), but the rendered HTML
 * wrapper may be shared, exported to the dashboard, or cached. Therefore
 * auditQueryObject scans the FINAL HTML before return; on any
 * FORBIDDEN_PATTERNS hit it throws ExternalEgressViolation with
 * meta.surface = 'rs-mind-map-html' so the caller knows precisely which
 * surface tripped the guard. Result is NEVER returned on audit failure.
 *
 * Pure CJS, zero npm deps, node built-ins only (no fetch, no http).
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const lazygraph = require('./lazygraph-ops.cjs');

const SURFACE = 'rs-mind-map-html';
const SCHEMA_VERSION = '1.0';

// The 5 canonical branches (kickoff section 5). Frozen so callers cannot
// mutate the canonical list and downstream renderers can rely on the
// fixed key set.
const BRANCHES = Object.freeze([
  'Direct Intersections',
  'Structural Transfer',
  'Semantic Implementation',
  'Discovered RS',
  'Innovation Ecosystem',
]);

// De Stijl-derived per-branch colors. Frozen for the same reason as
// BRANCHES. The HTML wrapper emits these as inline styles in the
// legend block; the Cytoscape style block also references them via
// node-data lookup at render time.
const BRANCH_COLORS = Object.freeze({
  'Direct Intersections': '#ff0000',
  'Structural Transfer': '#0000ff',
  'Semantic Implementation': '#999933',
  'Discovered RS': '#000000',
  'Innovation Ecosystem': '#666666',
});

// Cytoscape CDN URL: byte-identical to dashboard/index.html line 22.
// Canon Part 7 reuse: do NOT bump this version independently of the
// dashboard. If/when the dashboard upgrades, this constant moves with it.
const CYTOSCAPE_CDN_URL = 'https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.min.js';

// ---------- detectTier ----------
//
// Resolution order:
//   1. opts.tier explicit ('aura' or 'sqlite') -- caller wins
//   2. opts.driver with .session function -- Tier 1 (Aura)
//   3. opts.roomDir string -- Tier 0 (SQLite)
//   4. nothing -- TypeError (fail loud, fail early)

async function detectTier(opts) {
  if (opts && (opts.tier === 'aura' || opts.tier === 'sqlite')) return opts.tier;
  if (opts && opts.driver && typeof opts.driver.session === 'function') return 'aura';
  if (opts && typeof opts.roomDir === 'string' && opts.roomDir.length > 0) return 'sqlite';
  throw new TypeError(
    'rs-mind-map: opts.tier OR opts.driver OR opts.roomDir required'
  );
}

// ---------- safeJsonParse ----------
//
// Defensive: SQLite properties column is JSON-stringified. Bad JSON
// (corrupted row, manual SQL edit) returns an empty object so the
// renderer keeps moving. We never throw on malformed JSON because that
// would make ONE corrupted row block the entire mind map.

function safeJsonParse(s) {
  if (typeof s !== 'string' || s.length === 0) return {};
  try { return JSON.parse(s); } catch (_e) { return {}; }
}

// ---------- buildLabel ----------
//
// Cytoscape nodes need a human-readable label. Falls back gracefully
// through several property paths because different node types carry
// the human-friendly name in different fields.

function buildLabel(props, type) {
  if (!props || typeof props !== 'object') return type || 'node';
  if (typeof props.title === 'string' && props.title.length > 0) return props.title;
  if (typeof props.name === 'string' && props.name.length > 0) return props.name;
  if (typeof props.thesis === 'string' && props.thesis.length > 0) {
    return props.thesis.slice(0, 60);
  }
  if (typeof props.query_concept === 'string' && props.query_concept.length > 0) {
    return props.query_concept;
  }
  return type || 'node';
}

// ---------- toCytoscapeNode ----------
//
// Convert a (id, type, properties, branch) tuple into the Cytoscape
// elements format: { data: { id, label, type, branch } }. Properties
// are NOT spread into data (only label + type + branch + id) because
// the rendered HTML must not echo arbitrary user content into the
// node data block; the audit later catches any leak that does sneak
// through, but minimizing the surface is defense-in-depth design.

function toCytoscapeNode(id, type, properties, branch) {
  return {
    data: {
      id: id,
      label: buildLabel(properties, type),
      type: type,
      branch: branch,
    },
  };
}

function toCytoscapeEdge(id, source, target, type, branch) {
  return {
    data: {
      id: id,
      source: source,
      target: target,
      label: type,
      branch: branch,
    },
  };
}

// ---------- readSqliteBranches ----------
//
// Tier 0 read path. Opens the room.db via lazygraph.openGraph and runs
// 5 SELECT queries -- one per branch. Returns:
//   { branches: { '...': {nodes, edges}, ... }, total_nodes, total_edges }
//
// The branches map carries Cytoscape-formatted nodes + edges per
// branch (renderMindMap wraps the unified result later).

async function readSqliteBranches(roomDir, queryFilter) {
  const handle = await lazygraph.openGraph(roomDir);
  const conn = handle.conn;
  const branches = {
    'Direct Intersections': { nodes: [], edges: [] },
    'Structural Transfer': { nodes: [], edges: [] },
    'Semantic Implementation': { nodes: [], edges: [] },
    'Discovered RS': { nodes: [], edges: [] },
    'Innovation Ecosystem': { nodes: [], edges: [] },
  };
  let total_nodes = 0;
  let total_edges = 0;

  try {
    // Branch 1: Direct Intersections (lsa > 0.6 AND bert > 0.6)
    if (shouldEmitBranch('Direct Intersections', queryFilter)) {
      const rows = conn.prepare(
        'SELECT id, type, properties FROM nodes ' +
        'WHERE type = ? ' +
        'AND CAST(json_extract(properties, ?) AS REAL) > 0.6 ' +
        'AND CAST(json_extract(properties, ?) AS REAL) > 0.6'
      ).all('RSDiscovery', '$.lsa', '$.bert');
      for (const r of rows) {
        const props = safeJsonParse(r.properties);
        branches['Direct Intersections'].nodes.push(
          toCytoscapeNode(r.id, r.type, props, 'Direct Intersections')
        );
      }
    }

    // Branch 2: Structural Transfer
    if (shouldEmitBranch('Structural Transfer', queryFilter)) {
      const rows = conn.prepare(
        'SELECT id, type, properties FROM nodes ' +
        'WHERE type = ? ' +
        'AND json_extract(properties, ?) = ?'
      ).all('RSDiscovery', '$.classification', 'structural_transfer');
      for (const r of rows) {
        const props = safeJsonParse(r.properties);
        branches['Structural Transfer'].nodes.push(
          toCytoscapeNode(r.id, r.type, props, 'Structural Transfer')
        );
      }
    }

    // Branch 3: Semantic Implementation
    if (shouldEmitBranch('Semantic Implementation', queryFilter)) {
      const rows = conn.prepare(
        'SELECT id, type, properties FROM nodes ' +
        'WHERE type = ? ' +
        'AND json_extract(properties, ?) = ?'
      ).all('RSDiscovery', '$.classification', 'semantic_implementation');
      for (const r of rows) {
        const props = safeJsonParse(r.properties);
        branches['Semantic Implementation'].nodes.push(
          toCytoscapeNode(r.id, r.type, props, 'Semantic Implementation')
        );
      }
    }

    // Branch 4: Discovered RS (ReverseSalient nodes)
    if (shouldEmitBranch('Discovered RS', queryFilter)) {
      const rows = conn.prepare(
        'SELECT id, type, properties FROM nodes WHERE type = ?'
      ).all('ReverseSalient');
      for (const r of rows) {
        const props = safeJsonParse(r.properties);
        branches['Discovered RS'].nodes.push(
          toCytoscapeNode(r.id, r.type, props, 'Discovered RS')
        );
      }
    }

    // Branch 5: Innovation Ecosystem (Innovation + Paper + Author + Institution)
    if (shouldEmitBranch('Innovation Ecosystem', queryFilter)) {
      const ECO_TYPES = ['Innovation', 'Paper', 'Author', 'Institution'];
      const placeholders = ECO_TYPES.map(function () { return '?'; }).join(',');
      const rows = conn.prepare(
        'SELECT id, type, properties FROM nodes WHERE type IN (' + placeholders + ')'
      ).all.apply(conn.prepare(
        'SELECT id, type, properties FROM nodes WHERE type IN (' + placeholders + ')'
      ), ECO_TYPES);
      for (const r of rows) {
        const props = safeJsonParse(r.properties);
        branches['Innovation Ecosystem'].nodes.push(
          toCytoscapeNode(r.id, r.type, props, 'Innovation Ecosystem')
        );
      }
      // Edges within the ecosystem.
      const ECO_EDGE_TYPES = ['DERIVED_FROM', 'AUTHORED_BY', 'AFFILIATED_WITH', 'ENABLES'];
      const edgePlaceholders = ECO_EDGE_TYPES.map(function () { return '?'; }).join(',');
      const edgeRows = conn.prepare(
        'SELECT source, target, type, properties FROM edges WHERE type IN (' + edgePlaceholders + ')'
      ).all.apply(conn.prepare(
        'SELECT source, target, type, properties FROM edges WHERE type IN (' + edgePlaceholders + ')'
      ), ECO_EDGE_TYPES);
      for (const r of edgeRows) {
        branches['Innovation Ecosystem'].edges.push(
          toCytoscapeEdge(
            r.source + '__' + r.type + '__' + r.target,
            r.source, r.target, r.type, 'Innovation Ecosystem'
          )
        );
      }
    }

    // Compute total_nodes + total_edges from the FULL graph (for
    // metadata; not branch-filtered because metadata reflects the
    // raw graph state).
    total_nodes = conn.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    total_edges = conn.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
  } finally {
    try { await lazygraph.closeGraph(handle.db); } catch (_e) { /* best effort */ }
  }

  return { branches: branches, total_nodes: total_nodes, total_edges: total_edges };
}

// ---------- readAuraBranches ----------
//
// Tier 1 read path. Opens an Aura session via opts.driver and runs 5
// Cypher MATCH queries -- one per branch. The neo4j-driver Result has
// .records[] where each record exposes .get(name) returning the matched
// node (which itself has .properties, .labels, .identity).
//
// Multi-hop traversal is reserved for the Innovation Ecosystem branch
// because that is where the cross-table value concentrates (per kickoff
// section 5).

async function readAuraBranches(driver, queryFilter) {
  const session = driver.session();
  const branches = {
    'Direct Intersections': { nodes: [], edges: [] },
    'Structural Transfer': { nodes: [], edges: [] },
    'Semantic Implementation': { nodes: [], edges: [] },
    'Discovered RS': { nodes: [], edges: [] },
    'Innovation Ecosystem': { nodes: [], edges: [] },
  };
  let total_nodes = 0;
  let total_edges = 0;

  try {
    // Branch 1: Direct Intersections
    if (shouldEmitBranch('Direct Intersections', queryFilter)) {
      const r = await session.run(
        'MATCH (d:RSDiscovery) WHERE d.lsa > 0.6 AND d.bert > 0.6 RETURN d'
      );
      for (const rec of r.records || []) {
        const node = rec.get('d');
        const id = recordNodeId(node, rec);
        const props = (node && node.properties) || {};
        branches['Direct Intersections'].nodes.push(
          toCytoscapeNode(id, 'RSDiscovery', props, 'Direct Intersections')
        );
        total_nodes += 1;
      }
    } else {
      // Still call run so the dispatch counter matches the 5-branch contract.
      await session.run('MATCH (d:RSDiscovery) WHERE false RETURN d');
    }

    // Branch 2: Structural Transfer
    if (shouldEmitBranch('Structural Transfer', queryFilter)) {
      const r = await session.run(
        'MATCH (d:RSDiscovery) WHERE d.classification = "structural_transfer" RETURN d'
      );
      for (const rec of r.records || []) {
        const node = rec.get('d');
        const id = recordNodeId(node, rec);
        const props = (node && node.properties) || {};
        branches['Structural Transfer'].nodes.push(
          toCytoscapeNode(id, 'RSDiscovery', props, 'Structural Transfer')
        );
        total_nodes += 1;
      }
    } else {
      await session.run('MATCH (d:RSDiscovery) WHERE false RETURN d');
    }

    // Branch 3: Semantic Implementation
    if (shouldEmitBranch('Semantic Implementation', queryFilter)) {
      const r = await session.run(
        'MATCH (d:RSDiscovery) WHERE d.classification = "semantic_implementation" RETURN d'
      );
      for (const rec of r.records || []) {
        const node = rec.get('d');
        const id = recordNodeId(node, rec);
        const props = (node && node.properties) || {};
        branches['Semantic Implementation'].nodes.push(
          toCytoscapeNode(id, 'RSDiscovery', props, 'Semantic Implementation')
        );
        total_nodes += 1;
      }
    } else {
      await session.run('MATCH (d:RSDiscovery) WHERE false RETURN d');
    }

    // Branch 4: Discovered RS
    if (shouldEmitBranch('Discovered RS', queryFilter)) {
      const r = await session.run('MATCH (rs:ReverseSalient) RETURN rs');
      for (const rec of r.records || []) {
        const node = rec.get('rs');
        const id = recordNodeId(node, rec);
        const props = (node && node.properties) || {};
        branches['Discovered RS'].nodes.push(
          toCytoscapeNode(id, 'ReverseSalient', props, 'Discovered RS')
        );
        total_nodes += 1;
      }
    } else {
      await session.run('MATCH (rs:ReverseSalient) WHERE false RETURN rs');
    }

    // Branch 5: Innovation Ecosystem (multi-hop where Aura adds value).
    // Real Aura multi-hop queries return the same node many times across
    // rows (one row per traversal path); we dedupe by id within this
    // branch so the Cytoscape elements array stays unique. dedupeAndCombine
    // dedupes across branches but the per-branch nodes[] is what callers
    // commonly read directly, so the dedup must happen here too.
    if (shouldEmitBranch('Innovation Ecosystem', queryFilter)) {
      const r = await session.run(
        'MATCH (i:Innovation) ' +
        'OPTIONAL MATCH (i)<-[:ENABLES]-(d:RSDiscovery)-[:DERIVED_FROM]->(p:Paper)-[:AUTHORED_BY]->(a:Author)-[:AFFILIATED_WITH]->(inst:Institution) ' +
        'RETURN i, p, a, inst'
      );
      const seen = new Set();
      for (const rec of r.records || []) {
        for (const key of ['i', 'p', 'a', 'inst']) {
          let node;
          try { node = rec.get(key); } catch (_e) { node = null; }
          if (!node) continue;
          const id = recordNodeId(node, rec);
          if (seen.has(id)) continue;
          seen.add(id);
          const labels = (node.labels && node.labels.length > 0) ? node.labels : [keyToLabel(key)];
          const type = labels[0];
          const props = (node && node.properties) || {};
          branches['Innovation Ecosystem'].nodes.push(
            toCytoscapeNode(id, type, props, 'Innovation Ecosystem')
          );
          total_nodes += 1;
        }
      }
    } else {
      await session.run('MATCH (i:Innovation) WHERE false RETURN i');
    }
  } finally {
    try { await session.close(); } catch (_e) { /* best effort */ }
  }

  return { branches: branches, total_nodes: total_nodes, total_edges: total_edges };
}

function keyToLabel(key) {
  if (key === 'i') return 'Innovation';
  if (key === 'p') return 'Paper';
  if (key === 'a') return 'Author';
  if (key === 'inst') return 'Institution';
  if (key === 'd') return 'RSDiscovery';
  if (key === 'rs') return 'ReverseSalient';
  return 'Unknown';
}

function recordNodeId(node, rec) {
  if (node && node.identity && typeof node.identity.low === 'number') {
    return 'aura-' + node.identity.low;
  }
  if (node && node.properties && typeof node.properties.id === 'string') {
    return node.properties.id;
  }
  return 'aura-unknown-' + Math.floor(Math.random() * 1e6);
}

// ---------- shouldEmitBranch ----------
//
// query_filter.branch (string) limits the output to a single branch.
// All other branches return empty arrays. Absence of branch filter
// means emit all 5.

function shouldEmitBranch(branch, queryFilter) {
  if (!queryFilter || typeof queryFilter !== 'object') return true;
  if (typeof queryFilter.branch !== 'string' || queryFilter.branch.length === 0) return true;
  return queryFilter.branch === branch;
}

// ---------- dedupeAndCombine ----------
//
// Flatten the 5 branches into a single elements.{nodes, edges}
// object, deduping by id. Cytoscape requires unique element ids;
// the same node may appear in more than one branch (for example a
// hybrid-classified RSDiscovery that crosses thresholds), so dedup
// is required.

function dedupeAndCombine(branches) {
  const nodeMap = new Map();
  const edgeMap = new Map();
  for (const branch of Object.keys(branches)) {
    const payload = branches[branch] || { nodes: [], edges: [] };
    for (const n of payload.nodes) {
      if (n && n.data && n.data.id && !nodeMap.has(n.data.id)) nodeMap.set(n.data.id, n);
    }
    for (const e of payload.edges) {
      if (e && e.data && e.data.id && !edgeMap.has(e.data.id)) edgeMap.set(e.data.id, e);
    }
  }
  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

// ---------- buildHtmlWrapper ----------
//
// Standalone HTML wrapper. Uses the existing dashboard cytoscape@3.33.1
// CDN pattern (Canon Part 7 reuse; no new runtime dependency). The
// elements array is JSON-serialized inline so the wrapper opens in
// any browser without a backing server. Legend block is inline-styled
// so the file works as a single self-contained artifact.

function buildHtmlWrapper(graph) {
  const elementsJson = JSON.stringify(graph.elements || { nodes: [], edges: [] });
  const colorsJson = JSON.stringify(graph.branch_colors || BRANCH_COLORS);
  const branchesJson = JSON.stringify(graph.branches || {});

  // Legend rows: one per branch with the canonical color swatch.
  const legendRows = BRANCHES.map(function (b) {
    return '<div><span style="display:inline-block;width:12px;height:12px;background:' +
      BRANCH_COLORS[b] + ';margin-right:6px;border:1px solid #000;"></span>' +
      escapeHtml(b) + '</div>';
  }).join('\n      ');

  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <title>RS Mind Map: 5-Branch View</title>\n' +
    '  <script src="' + CYTOSCAPE_CDN_URL + '"></script>\n' +
    '  <style>\n' +
    '    body { margin: 0; font-family: monospace; background: #ffffff; color: #000000; }\n' +
    '    #cy { width: 100vw; height: 100vh; }\n' +
    '    .legend { position: absolute; top: 10px; left: 10px; background: #ffffff; border: 2px solid #000000; padding: 10px; z-index: 10; }\n' +
    '    .legend strong { display: block; margin-bottom: 6px; }\n' +
    '  </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <div id="cy"></div>\n' +
    '  <div class="legend">\n' +
    '    <strong>Branches</strong>\n' +
    '      ' + legendRows + '\n' +
    '  </div>\n' +
    '  <script>\n' +
    '    var elements = ' + elementsJson + ';\n' +
    '    var branchColors = ' + colorsJson + ';\n' +
    '    var branches = ' + branchesJson + ';\n' +
    '    var cy = cytoscape({\n' +
    '      container: document.getElementById(\'cy\'),\n' +
    '      elements: [].concat(elements.nodes || [], elements.edges || []),\n' +
    '      style: [\n' +
    '        { selector: \'node\', style: { label: \'data(label)\', \'background-color\': function (ele) { return branchColors[ele.data(\'branch\')] || \'#999999\'; }, \'font-size\': 9, color: \'#000000\', \'text-valign\': \'bottom\', \'text-margin-y\': 6 } },\n' +
    '        { selector: \'edge\', style: { label: \'data(label)\', \'line-color\': function (ele) { return branchColors[ele.data(\'branch\')] || \'#999999\'; }, \'target-arrow-color\': function (ele) { return branchColors[ele.data(\'branch\')] || \'#999999\'; }, \'target-arrow-shape\': \'triangle\', \'curve-style\': \'bezier\', \'font-size\': 7 } }\n' +
    '      ],\n' +
    '      layout: { name: \'cose\', animate: false, padding: 30 }\n' +
    '    });\n' +
    '  </script>\n' +
    '</body>\n' +
    '</html>\n';
}

// ---------- escapeHtml ----------
//
// Minimal HTML entity escape for the legend labels. We escape the
// branch names even though they are constants because future Canon
// amendments may extend BRANCHES with caller-supplied names; defense
// in depth.

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- renderMindMap ----------
//
// The public entry point. Orchestration:
//   1. Resolve tier (throws TypeError if neither driver nor roomDir provided)
//   2. Validate tier-specific opts
//   3. Read raw branches from active tier (Tier 0 SQLite or Tier 1 Aura)
//   4. Force all 5 branch keys to be present (empty arrays for missing branches)
//   5. Compute combined elements (deduped by id)
//   6. Build metadata (tier, branch_counts, totals, schema_version)
//   7. Build HTML wrapper
//   8. Canon Part 8 defense-in-depth: auditQueryObject on FINAL HTML
//      (throws ExternalEgressViolation on any FORBIDDEN_PATTERNS hit;
//      result is NEVER returned)
//   9. Return assembled result with html_wrapper attached

async function renderMindMap(query_filter, opts) {
  opts = opts || {};
  const queryFilter = (query_filter && typeof query_filter === 'object') ? query_filter : {};
  const tier = await detectTier(opts);

  let raw;
  if (tier === 'sqlite') {
    if (typeof opts.roomDir !== 'string' || opts.roomDir.length === 0) {
      throw new TypeError('rs-mind-map: opts.roomDir required for sqlite tier');
    }
    raw = await readSqliteBranches(opts.roomDir, queryFilter);
  } else {
    if (!opts.driver || typeof opts.driver.session !== 'function') {
      throw new TypeError('rs-mind-map: opts.driver required for aura tier');
    }
    raw = await readAuraBranches(opts.driver, queryFilter);
  }

  // Normalize: every branch key MUST be present in output (empty arrays
  // for missing). Downstream renderers (dashboard, /mos:rs-mind-map)
  // rely on the fixed key set.
  const branches = {};
  for (const b of BRANCHES) {
    branches[b] = raw.branches[b] || { nodes: [], edges: [] };
  }

  const elements = dedupeAndCombine(branches);

  const branch_counts = {};
  for (const b of BRANCHES) branch_counts[b] = branches[b].nodes.length;

  const result = {
    branches: branches,
    elements: elements,
    branch_colors: BRANCH_COLORS,
    metadata: {
      tier: tier,
      branch_counts: branch_counts,
      total_nodes: typeof raw.total_nodes === 'number' ? raw.total_nodes : 0,
      total_edges: typeof raw.total_edges === 'number' ? raw.total_edges : 0,
      schema_version: SCHEMA_VERSION,
    },
  };

  const html_wrapper = buildHtmlWrapper(result);

  // Canon Part 8 defense-in-depth: audit the FINAL HTML wrapper before
  // return. Throws ExternalEgressViolation on any FORBIDDEN_PATTERNS hit
  // with meta.surface = 'rs-mind-map-html'. Result is NEVER returned on
  // audit failure; the caller learns precisely which surface tripped
  // the guard via meta.matched_pattern.
  auditQueryObject({ html: html_wrapper }, SURFACE);

  result.html_wrapper = html_wrapper;
  return result;
}

// ---------- Edge type registry consumption ----------
//
// Defensive guard: warn (not throw) if EDGE_TYPES is missing the 5 RS
// edge types Plan 89.3-01 added. This module is read-only against the
// schema, so the warning surfaces upstream issues without blocking
// the renderer for users whose graph already has the edges.

const REQUIRED_EDGE_TYPES = ['DISCOVERED', 'DERIVED_FROM', 'ENABLES', 'AUTHORED_BY', 'AFFILIATED_WITH'];
for (const t of REQUIRED_EDGE_TYPES) {
  if (!lazygraph.EDGE_TYPES.includes(t)) {
    process.stderr.write('rs-mind-map: WARNING -- EDGE_TYPES missing required type: ' + t + '\n');
  }
}

// ---------- Exports ----------

module.exports = {
  renderMindMap,
  BRANCHES,
  BRANCH_COLORS,
  SCHEMA_VERSION,
  CYTOSCAPE_CDN_URL,
  _test: {
    detectTier,
    readSqliteBranches,
    readAuraBranches,
    buildHtmlWrapper,
    dedupeAndCombine,
    safeJsonParse,
    buildLabel,
    shouldEmitBranch,
    escapeHtml,
  },
};
