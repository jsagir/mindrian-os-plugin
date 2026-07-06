#!/usr/bin/env node
'use strict';

/*
 * csv-idea-graph.cjs -- build a standalone De Stijl knowledge-graph HTML from the
 * JHU tech-transfer CSVs, visualizing cross-domain diagnostic <-> therapeutic
 * idea relationships (lens3) plus an optional inventor-bridge layer (lens1).
 *
 * Ad-hoc script in the import-jhu-tech-csv.cjs precedent (quick-task follow-up).
 * The parseCsvLine / parseCsv helpers below are COPIED VERBATIM (with attribution)
 * from scripts/import-jhu-tech-csv.cjs -- same minimal RFC4180 splitter, zero deps.
 *
 * What it produces (all under evals/eureka/ by default):
 *   1. jhtv-idea-graph.json  -- the graph data in the dashboard template schema
 *      (meta + elements.{nodes,edges} + intelligence.summary).
 *   2. jhtv-idea-graph.html  -- the standalone dashboard, produced by REPLICATING
 *      scripts/generate-standalone's inline-injection against dashboard/index.html
 *      (same loadGraph markers, same replacement) but in CJS (no python), so no
 *      remaining fetch('graph.json') call and the title reads
 *      "JHTV Cross-Domain Idea Graph".
 *
 * Graph design (conforms to the getGraphExport spine schema the renderer styles):
 *   Nodes -- every technology appearing in a lens3 pair (union of diagnostic_case
 *     + therapeutic_case). Diagnostic-side and therapeutic-side colored distinctly
 *     (the two sets are disjoint in this data). Base 'node' selector sizes each by
 *     data.degree, so hub techs read larger. Optional lens1 inventor nodes sit on
 *     the 'intelligence' layer.
 *   Edges -- ONE edge per lens3 row (the literal edge list), typed CONVERGES
 *     (class 'converges' = the renderer's "shares themes with" styled type, the
 *     closest existing vocabulary), carrying shared_problem in edge.label + gloss.
 *   Citation (navigator mandate) -- every node and edge carries, in the field the
 *     template actually renders (node detail 'Summary' = data.summary; edge tap
 *     tooltip = data.gloss), a source citation naming the CSV filename + the row
 *     identifier / c_number.
 *
 * Canon Part 8: pure LOCAL read + local file write. Zero network. Nothing here
 * touches room.db or any ~/MindrianRooms path (read-only CSV inputs only).
 *
 * NO em-dashes anywhere in this file or its output (CLAUDE.md HARD RULE). The
 * template's own runtime title-builder inserts an em-dash only when meta.roomName
 * is present, so we deliberately OMIT meta.roomName and inject a static
 * hyphen-free title instead; a final sweep also downgrades the template head's
 * own pre-existing em-dashes to hyphens.
 *
 * Usage:
 *   node scripts/csv-idea-graph.cjs [csvDir] [outJson] [outHtml] [templatePath]
 * Defaults:
 *   csvDir       = /mnt/c/Users/jsagi/Downloads/jhu-tech
 *   outJson      = evals/eureka/jhtv-idea-graph.json
 *   outHtml      = evals/eureka/jhtv-idea-graph.html
 *   templatePath = dashboard/index.html
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// parseCsvLine / parseCsv -- COPIED VERBATIM from scripts/import-jhu-tech-csv.cjs
// (attribution per the ad-hoc-script precedent). Minimal RFC4180 field splitter,
// handles quoted fields with embedded commas / newlines and escaped "" quotes.
// ---------------------------------------------------------------------------
function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

function parseCsv(text) {
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const lines = clean.split(/\r\n|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = [];
  let i = 1;
  while (i < lines.length) {
    let raw = lines[i];
    let parsed = parseCsvLine(raw);
    let guard = 0;
    while (parsed.length < header.length && i + 1 < lines.length && guard < 20) {
      i += 1;
      raw += '\n' + lines[i];
      parsed = parseCsvLine(raw);
      guard += 1;
    }
    const row = {};
    for (let c = 0; c < header.length; c += 1) row[header[c]] = parsed[c] !== undefined ? parsed[c] : '';
    rows.push(row);
    i += 1;
  }
  return { header, rows };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readCsv(p) {
  return parseCsv(fs.readFileSync(p, 'utf-8')).rows;
}

// Long-dash matcher built from escapes so no em-dash byte appears in this source
// (U+2014 em-dash, U+2013 en-dash). Used to downgrade both to a hyphen.
const LONG_DASH = new RegExp('[\\u2014\\u2013]', 'g');

function clean(s) {
  // Collapse whitespace and downgrade em-dash / en-dash to a hyphen so no CSV
  // description can smuggle an em-dash into the output (CLAUDE.md HARD RULE).
  return (s || '').replace(LONG_DASH, '-').replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  const t = clean(s);
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '') + '...';
}

// De Stijl palette (from dashboard/index.html SECTION_COLORS).
const COLOR = {
  diagnostic: '#1E3A6E', // deep blue
  therapeutic: '#A63D2F', // De Stijl red
  inventor: '#6B4E8B', // amethyst (distinct from both tech colors)
};

// ---------------------------------------------------------------------------
// Build the graph from the CSVs
// ---------------------------------------------------------------------------
function buildGraph(csvDir) {
  const lens3Path = path.join(csvDir, 'lens3_crossdomain_pairs.csv');
  const enginePath = path.join(csvDir, 'jhu_technologies_engine.csv');
  const lens1Path = path.join(csvDir, 'lens1_inventor_clusters.csv');

  const lens3 = readCsv(lens3Path);
  const engineRows = readCsv(enginePath);
  const lens1 = fs.existsSync(lens1Path) ? readCsv(lens1Path) : [];

  // Engine enrichment map: c_number -> row.
  const engine = {};
  for (const r of engineRows) {
    const c = clean(r.c_number);
    if (c) engine[c] = r;
  }

  // numeric tech_id -> c_number (derived from lens3 itself; complete for all nodes).
  const idToC = {};

  // Node accumulator keyed by c_number.
  const nodeMap = new Map();
  // Track which lens3 row-numbers (1-based data rows) reference each tech, per side.
  const nodeRows = new Map(); // c_number -> { side, rows: Set }

  function ensureTechNode(cNumber, side, engineTitle) {
    if (!nodeMap.has(cNumber)) {
      const eng = engine[cNumber] || {};
      const title = clean(engineTitle) || clean(eng.title) || '';
      nodeMap.set(cNumber, {
        cNumber: cNumber,
        side: side,
        title: title,
        domain: clean(eng.domain),
        field: clean(eng.field),
        status: clean(eng.status),
        description: clean(eng.description),
      });
      nodeRows.set(cNumber, { side: side, rows: new Set() });
    }
  }

  // ---- Edges: one per lens3 row (the literal edge list) ----
  const edges = [];
  const problemCount = {}; // shared_problem -> pair count

  lens3.forEach((r, idx) => {
    const rowNum = idx + 1; // 1-based data row (header excluded)
    const diagC = clean(r.diagnostic_case);
    const therC = clean(r.therapeutic_case);
    const problem = clean(r.shared_problem) || 'unspecified';
    const diagId = clean(r.diag_tech_id);
    const therId = clean(r.ther_tech_id);
    if (diagId) idToC[diagId] = diagC;
    if (therId) idToC[therId] = therC;

    if (!diagC || !therC) return; // skip malformed rows (should not occur)

    ensureTechNode(diagC, 'diagnostic', r.diagnostic_title);
    ensureTechNode(therC, 'therapeutic', r.therapeutic_title);
    nodeRows.get(diagC).rows.add(rowNum);
    nodeRows.get(therC).rows.add(rowNum);

    problemCount[problem] = (problemCount[problem] || 0) + 1;

    // Citation lives in the gloss (the field the renderer shows on edge tap/hover).
    const gloss = "shares the problem '" + problem + "' with [lens3_crossdomain_pairs.csv row "
      + rowNum + ']';

    edges.push({
      data: {
        id: 'e-lens3-' + rowNum,
        source: diagC,
        target: therC,
        type: 'CONVERGES',
        label: problem,
        shared_problem: problem,
        gloss: gloss,
        citation: 'lens3_crossdomain_pairs.csv row ' + rowNum,
      },
      classes: 'converges',
    });
  });

  // ---- Optional lens1 inventor-bridge layer (intelligence layer) ----
  // Include only inventors whose cluster touches >=2 techs that are already in the
  // lens3 graph -- these are the inventors who BRIDGE the cross-domain pairs. Every
  // inventor edge connects two nodes that both exist (no orphans).
  const inventorNodes = [];
  const inventorEdges = [];
  let inventorIdx = 0;
  for (const r of lens1) {
    const inventor = clean(r.inventor);
    if (!inventor) continue;
    const techIds = clean(r.tech_ids).split('|').map((x) => x.trim()).filter(Boolean);
    const matched = [];
    const seen = new Set();
    for (const tid of techIds) {
      const c = idToC[tid];
      if (c && nodeMap.has(c) && !seen.has(c)) { seen.add(c); matched.push(c); }
    }
    if (matched.length < 2) continue;

    inventorIdx += 1;
    const invId = 'inv-' + inventorIdx;
    const domSpanned = clean(r.domains_spanned);
    const coherence = clean(r.coherence);
    const disclosures = clean(r.disclosures);
    const invSummary = '[cite] lens1_inventor_clusters.csv inventor "' + inventor + '". '
      + 'Bridges ' + matched.length + ' cross-domain technologies here; '
      + disclosures + ' total disclosures, ' + domSpanned + ' domains spanned ('
      + coherence + ' coherence).';
    inventorNodes.push({
      data: {
        id: invId,
        label: inventor,
        color: COLOR.inventor,
        degree: matched.length,
        layer: 'intelligence',
        section: 'inventor-bridge',
        summary: invSummary,
        citation: 'lens1_inventor_clusters.csv inventor ' + inventor,
      },
      classes: 'inventor',
    });
    matched.forEach((c, k) => {
      inventorEdges.push({
        data: {
          id: invId + '-' + k,
          source: invId,
          target: c,
          type: 'CO_INVENTED',
          label: inventor,
          gloss: 'is a bridging inventor of [lens1_inventor_clusters.csv "' + inventor + '"]',
          citation: 'lens1_inventor_clusters.csv inventor ' + inventor,
        },
        classes: 'references',
      });
    });
  }

  // ---- Degree per tech node (lens3 edges + inventor edges) ----
  const degree = {};
  function bump(id) { degree[id] = (degree[id] || 0) + 1; }
  edges.forEach((e) => { bump(e.data.source); bump(e.data.target); });
  inventorEdges.forEach((e) => { bump(e.data.target); }); // inventor->tech, credit the tech

  // ---- Materialize tech nodes ----
  const techNodes = [];
  for (const [cNumber, n] of nodeMap.entries()) {
    const rowsList = Array.from(nodeRows.get(cNumber).rows).sort((a, b) => a - b);
    const rowsStr = rowsList.slice(0, 12).join(', ') + (rowsList.length > 12 ? ', ...' : '');
    const label = cNumber + ' ' + truncate(n.title, 38);
    const citation = 'lens3_crossdomain_pairs.csv (' + n.side + '-side, rows: ' + rowsStr
      + '); jhu_technologies_engine.csv ' + cNumber;
    const descSnippet = n.description ? (' -- ' + truncate(n.description, 220)) : '';
    const summary = '[cite] ' + citation + '. Domain: ' + (n.domain || 'n/a')
      + '; Field: ' + (n.field || 'n/a') + '.' + descSnippet;
    techNodes.push({
      data: {
        id: cNumber,
        label: label,
        color: n.side === 'diagnostic' ? COLOR.diagnostic : COLOR.therapeutic,
        degree: degree[cNumber] || 0,
        layer: 'content',
        section: n.side,
        methodology: n.field || '',
        summary: summary,
        cnumber: cNumber,
        title: n.title,
        domain: n.domain,
        pair_count: rowsList.length,
        citation: citation,
      },
      classes: 'tech ' + n.side,
    });
  }

  const nodes = techNodes.concat(inventorNodes);
  const allEdges = edges.concat(inventorEdges);

  return {
    nodes: nodes,
    edges: allEdges,
    stats: {
      techNodes: techNodes.length,
      inventorNodes: inventorNodes.length,
      lens3Edges: edges.length,
      inventorEdges: inventorEdges.length,
      diagnostic: techNodes.filter((n) => n.data.section === 'diagnostic').length,
      therapeutic: techNodes.filter((n) => n.data.section === 'therapeutic').length,
      problemCount: problemCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Inject inline graph JSON into the dashboard template (replicates
// scripts/generate-standalone's python heredoc, in CJS, hyphen-only title).
// ---------------------------------------------------------------------------
function injectStandalone(templatePath, graphJsonText) {
  const template = fs.readFileSync(templatePath, 'utf-8');

  const startMarker = 'function loadGraph() {';
  const endMarker = '    }\n\n    // '; // loadGraph closes with '    }' then blank + next comment
  const startIdx = template.indexOf(startMarker);
  const endIdx = startIdx === -1 ? -1 : template.indexOf(endMarker, startIdx);

  const newFunc = 'function loadGraph() {\n      var data = ' + graphJsonText
    + ';\n      initGraph(data);\n    }';

  let result;
  if (startIdx === -1 || endIdx === -1) {
    // Fallback: regex (same shape as the python fallback).
    const oldPattern = /function loadGraph\(\)[\s\S]*?\n    \}/;
    result = template.replace(oldPattern, newFunc);
    if (result === template) {
      throw new Error('loadGraph() replacement failed -- template structure changed.');
    }
  } else {
    result = template.slice(0, startIdx) + newFunc + template.slice(endIdx + '    }'.length);
  }

  if (result === template) {
    throw new Error('loadGraph() replacement produced no change.');
  }

  // Static, em-dash-free title + header (we deliberately do NOT set meta.roomName,
  // so the template's runtime title-builder, which would insert an em-dash, never
  // fires; these static strings are the only title source).
  const TITLE = 'JHTV Cross-Domain Idea Graph';
  result = result.replace('<title>MindrianOS Data Room</title>', '<title>' + TITLE + '</title>');
  result = result.replace(
    '<span class="header-title" id="header-title">Mindrian Data Room</span>',
    '<span class="header-title" id="header-title">' + TITLE + '</span>'
  );

  // Export metadata (mirrors generate-standalone).
  const exportMeta = '\n'
    + '  <meta name="generator" content="MindrianOS -- AI Innovation Co-Founder">\n'
    + '  <meta name="description" content="JHU tech-transfer cross-domain idea graph generated by MindrianOS.">\n'
    + '  <meta name="creator" content="MindrianOS by Jonathan Sagir">';
  result = result.replace('</head>', exportMeta + '\n</head>');

  // Disable the Refresh button (no server behind a standalone export).
  result = result.replace(
    'id="btn-refresh">Refresh</button>',
    'id="btn-refresh" disabled style="opacity:0.3;cursor:default" title="Standalone export -- refresh not available">Exported</button>'
  );

  // Generalize the empty-state trigger. The template keys the "Your Data Room is
  // empty" overlay on the count of 'artifact'-classed nodes, because a room's
  // meaningful content is its artifacts. This idea graph's meaningful content is
  // its technology nodes (degree-sized ellipses, not room artifacts), so we widen
  // the trigger to "zero nodes total" -- otherwise the overlay would float over a
  // fully rendered 481-node graph. Surgical post-process, same class of edit as the
  // refresh-button disable above (generate-standalone precedent).
  result = result.replace(
    'if (artifactNodes.length === 0) {',
    'if (data.elements.nodes.length === 0) {'
  );

  // Final sweep: downgrade the template head's pre-existing em-dashes (and any
  // en-dashes) to hyphens. The inline JSON is already em-dash-free (clean()
  // sanitizes every text field), so this only touches template-owned chrome.
  result = result.replace(LONG_DASH, '-');

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(argv) {
  const repoRoot = path.resolve(__dirname, '..');
  const csvDir = argv[0] || '/mnt/c/Users/jsagi/Downloads/jhu-tech';
  const outJson = path.resolve(argv[1] || path.join(repoRoot, 'evals', 'eureka', 'jhtv-idea-graph.json'));
  const outHtml = path.resolve(argv[2] || path.join(repoRoot, 'evals', 'eureka', 'jhtv-idea-graph.html'));
  const templatePath = path.resolve(argv[3] || path.join(repoRoot, 'dashboard', 'index.html'));

  const { nodes, edges, stats } = buildGraph(csvDir);

  // Top-10 shared_problem clusters by pair count.
  const top = Object.entries(stats.problemCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ shared_problem: k, pairs: v }));

  const graph = {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'MindrianOS csv-idea-graph (JHTV cross-domain)',
      source: 'lens3_crossdomain_pairs.csv + jhu_technologies_engine.csv + lens1_inventor_clusters.csv',
      // NOTE: roomName deliberately omitted (see injectStandalone / em-dash rule).
    },
    elements: { nodes: nodes, edges: edges },
    intelligence: {
      summary: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        diagnostic_techs: stats.diagnostic,
        therapeutic_techs: stats.therapeutic,
        inventor_bridges: stats.inventorNodes,
        distinct_shared_problems: Object.keys(stats.problemCount).length,
      },
      top_shared_problems: top,
    },
  };

  const graphJsonText = JSON.stringify(graph, null, 2);

  // --- Orphan check: every edge endpoint must be a real node id ---
  const nodeIds = new Set(nodes.map((n) => n.data.id));
  const orphans = [];
  for (const e of edges) {
    if (!nodeIds.has(e.data.source)) orphans.push({ edge: e.data.id, missing: e.data.source });
    if (!nodeIds.has(e.data.target)) orphans.push({ edge: e.data.id, missing: e.data.target });
  }

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, graphJsonText, 'utf-8');

  const html = injectStandalone(templatePath, graphJsonText);
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outHtml, html, 'utf-8');

  // --- Open-ability checks on the emitted HTML ---
  const hasInline = html.indexOf('var data = {') !== -1;
  const hasFetch = html.indexOf("fetch('graph.json") !== -1;

  const report = {
    outputs: { json: outJson, html: outHtml },
    counts: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      tech_nodes: stats.techNodes,
      diagnostic_techs: stats.diagnostic,
      therapeutic_techs: stats.therapeutic,
      inventor_nodes: stats.inventorNodes,
      lens3_edges: stats.lens3Edges,
      inventor_edges: stats.inventorEdges,
      distinct_shared_problems: Object.keys(stats.problemCount).length,
    },
    top_shared_problems: top,
    sanity: {
      orphan_edges: orphans.length,
      orphan_sample: orphans.slice(0, 5),
      html_bytes: Buffer.byteLength(html, 'utf-8'),
      html_has_inline_json: hasInline,
      html_still_has_fetch: hasFetch,
    },
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main(process.argv.slice(2));
