#!/usr/bin/env node
'use strict';

/*
 * csv-to-idea-graph.cjs -- a generic capability in the MindrianOS export family:
 * turn any CSV relationship dataset into a standalone, self-contained De Stijl
 * navigable idea-graph (one HTML file, inline JSON, zero network).
 *
 * INPUT (fully generic, column names are CLI-driven, no dataset is baked in):
 *   --pairs <csv>   REQUIRED. The edge list: one row per relationship. Each row
 *                   names a source node and a target node (by the columns you map
 *                   below) and, optionally, an edge-label column whose value both
 *                   labels the edge AND becomes a clustering "Section" district.
 *   --nodes <csv>   OPTIONAL. Node enrichment: id -> title/description, so nodes
 *                   carry human-readable titles and summaries beyond their raw id.
 *
 * COLUMN MAPPING (defaults in brackets; override any of them):
 *   --source-col     [source]        column in --pairs holding the source node id
 *   --target-col     [target]        column in --pairs holding the target node id
 *   --edge-label-col [<none>]        column in --pairs whose value labels each edge
 *                                    and drives Section-district clustering. Omit
 *                                    to get a flat (district-free) graph.
 *   --node-id-col    [id]            column in --nodes holding the node id (join key)
 *   --node-title-col [title]         column in --nodes holding the node title
 *   --node-desc-col  [description]   column in --nodes holding the node description
 *
 * OUTPUT:
 *   --out <html>      [idea-graph.html]  standalone HTML (inline JSON, opens offline)
 *   --json-out <json> [idea-graph.json]  the graph data (dashboard template schema)
 *   --title <str>     ["CSV Idea Graph"] header + document title
 *   --template <path> [dashboard/index.html]  the De Stijl dashboard template
 *
 * WHAT IT PRODUCES (the generic capability preserved from the export family):
 *   1. RFC4180 CSV parsing (quoted fields, embedded commas/newlines, "" escapes).
 *   2. De Stijl Section-clustering: when an edge-label column is given, each distinct
 *      label becomes a Section node (a "district"); every content node emits exactly
 *      one invisible BELONGS_TO cluster-edge to its PRIMARY district, and the shared
 *      dashboard template's cose layout packs each district into its own region.
 *      Districts are tiered by edge count (TIER3_MIN_EDGES / TIER2_MIN_EDGES); the
 *      rare long tail collapses into one grey 'sec-other' super-node hidden on boot.
 *   3. Layer toggles: structure (Section districts) + content (nodes). The injected
 *      boot state runs applyPreset('room') and hides the long tail, both recoverable
 *      via the template's existing Content toggle.
 *   4. Template injection: the same inline-JSON injection mechanism as
 *      scripts/generate-standalone -- loadGraph() is rewritten to carry the graph
 *      inline (no fetch), the title/header/meta are set, and the Refresh button,
 *      empty-state trigger, and cluster-edge hover are surgically patched on the
 *      OUTPUT copy only (the shared template on disk is never modified).
 *   5. Provenance: every node summary and every edge gloss carries a source-CSV +
 *      row citation, so any element traces back to its originating CSV row.
 *
 * Canon Part 8: pure LOCAL read + local file write. Zero network. Reads only the
 * CSV inputs and the template; writes only the two output paths you name.
 *
 * NO em-dashes anywhere in this file or its output (CLAUDE.md HARD RULE). clean()
 * downgrades em/en dashes to hyphens on every text field, and a final sweep
 * downgrades the template head's own pre-existing long dashes.
 *
 * Usage:
 *   node scripts/csv-to-idea-graph.cjs --pairs edges.csv \
 *     --source-col from --target-col to --edge-label-col topic \
 *     --nodes nodes.csv --node-id-col id --node-title-col name \
 *     --node-desc-col desc --out graph.html --json-out graph.json
 *   node scripts/csv-to-idea-graph.cjs --help
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Tunable knobs -- district promotion cutoffs (NOT hard-coded magic in the body).
// ---------------------------------------------------------------------------
const TIER3_MIN_EDGES = 10; // >= this many edges -> full "primary" district
const TIER2_MIN_EDGES = 5;  // >= this and < TIER3 -> "minor" district; below -> long tail

// ---------------------------------------------------------------------------
// parseCsvLine / parseCsv -- minimal RFC4180 field splitter, zero deps. Handles
// quoted fields with embedded commas / newlines and escaped "" quotes.
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

function readCsv(p) {
  return parseCsv(fs.readFileSync(p, 'utf-8')).rows;
}

// ---------------------------------------------------------------------------
// Text hygiene
// ---------------------------------------------------------------------------
// Long-dash matcher built from escapes so no em-dash byte appears in this source
// (U+2014 em-dash, U+2013 en-dash). Used to downgrade both to a hyphen.
const LONG_DASH = new RegExp('[\\u2014\\u2013]', 'g');
// Curly single quotes (U+2019 right, U+2018 left) -> straight apostrophe.
const CURLY_APOS = new RegExp('[\\u2019\\u2018]', 'g');

function clean(s) {
  // Collapse whitespace and downgrade em-dash / en-dash to a hyphen so no CSV
  // field can smuggle an em-dash into the output (CLAUDE.md HARD RULE).
  return (s || '').replace(LONG_DASH, '-').replace(/\s+/g, ' ').trim();
}

function truncate(s, n) {
  const t = clean(s);
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '') + '...';
}

// Generic label normalization BEFORE counting: unify curly/straight apostrophes and
// case-fold so trivial spelling variants of the same label do not split a district.
// No dataset-specific aliases -- purely mechanical.
function normLabel(s) {
  const t = clean(s).replace(CURLY_APOS, "'").toLowerCase();
  return t || 'unspecified';
}

function slugify(s) {
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

// De Stijl palette.
const COLOR = {
  source: '#1E3A6E', // deep blue (source-role nodes)
  target: '#A63D2F', // De Stijl red (target-role nodes)
  mixed: '#6B4E8B',  // amethyst (nodes that appear as both source and target)
  minor: '#5C5A56',  // muted grey border for tier-2 minor districts
  other: '#3A3A3A',  // dark grey for the long-tail catch-all
};

// Distinct saturated De Stijl-family hues for tier-3 primary districts -- a
// deterministic palette cycle by rank so the biggest districts spread across hues,
// giving the map a memorable colored geography at zero interaction cost.
const DISTRICT_PALETTE = [
  '#A63D2F', // red
  '#1E3A6E', // blue
  '#C8A43C', // gold
  '#2D6B4A', // green
  '#6B4E8B', // amethyst
  '#B5651D', // ochre
  '#3D6B7A', // teal
  '#8B3A5A', // plum
];

// ---------------------------------------------------------------------------
// Build the graph from the CSVs
// ---------------------------------------------------------------------------
function buildGraph(opts) {
  const pairsRows = readCsv(opts.pairs);
  const pairsCite = path.basename(opts.pairs);
  const nodesCite = opts.nodes ? path.basename(opts.nodes) : '';
  const useLabels = !!opts.edgeLabelCol;

  // Node enrichment map: node id -> { title, description } from the optional --nodes CSV.
  const enrich = {};
  if (opts.nodes) {
    const nodeRows = readCsv(opts.nodes);
    for (const r of nodeRows) {
      const id = clean(r[opts.nodeIdCol]);
      if (id) {
        enrich[id] = {
          title: clean(r[opts.nodeTitleCol]),
          description: clean(r[opts.nodeDescCol]),
        };
      }
    }
  }

  // ---- Pass 1: scan the edge list ----
  const labelCount = {};       // normalized label -> edge (row) count
  const nodeInfo = new Map();  // id -> { roles:Set, title, labels:Map(label->count), rows:Set }
  const pairMap = new Map();   // 'source|target' -> { source, target, labels:Set, rows:[] }

  function ensureNode(id, role) {
    if (!nodeInfo.has(id)) {
      nodeInfo.set(id, { roles: new Set(), title: '', labels: new Map(), rows: new Set() });
    }
    const info = nodeInfo.get(id);
    info.roles.add(role);
    return info;
  }

  pairsRows.forEach((r, idx) => {
    const rowNum = idx + 1; // 1-based data row (header excluded)
    const src = clean(r[opts.sourceCol]);
    const tgt = clean(r[opts.targetCol]);
    if (!src || !tgt) return; // skip malformed rows
    const label = useLabels ? normLabel(r[opts.edgeLabelCol]) : '';

    if (useLabels) labelCount[label] = (labelCount[label] || 0) + 1;

    const sInfo = ensureNode(src, 'source');
    const tInfo = ensureNode(tgt, 'target');
    if (useLabels) {
      sInfo.labels.set(label, (sInfo.labels.get(label) || 0) + 1);
      tInfo.labels.set(label, (tInfo.labels.get(label) || 0) + 1);
    }
    sInfo.rows.add(rowNum);
    tInfo.rows.add(rowNum);

    const key = src + '|' + tgt;
    if (!pairMap.has(key)) pairMap.set(key, { source: src, target: tgt, labels: new Set(), rows: [] });
    const pm = pairMap.get(key);
    if (label) pm.labels.add(label);
    pm.rows.push(rowNum);
  });

  // ---- District tiering (only meaningful when an edge-label column was given) ----
  function tierOf(label) {
    const n = labelCount[label] || 0;
    if (n >= TIER3_MIN_EDGES) return 3;
    if (n >= TIER2_MIN_EDGES) return 2;
    return 1;
  }

  const promoted = useLabels
    ? Object.keys(labelCount).filter((l) => tierOf(l) >= 2)
    : [];
  promoted.sort((a, b) => (labelCount[b] - labelCount[a]) || (a < b ? -1 : 1));
  const tier1Labels = useLabels ? Object.keys(labelCount).filter((l) => tierOf(l) === 1) : [];

  const sectionIdOf = {};
  promoted.forEach((l) => { sectionIdOf[l] = 'sec-' + slugify(l); });
  const OTHER_ID = 'sec-other';

  // ---- Per-node PRIMARY district (tier-first, deterministic) ----
  function primaryFor(id) {
    const labels = Array.from(nodeInfo.get(id).labels.entries()); // [label, count]
    if (labels.length === 0) return { label: '', tier: 1 };
    let maxTier = 1;
    labels.forEach(([l]) => { const t = tierOf(l); if (t > maxTier) maxTier = t; });
    const inTier = labels.filter(([l]) => tierOf(l) === maxTier);
    inTier.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];                                       // most appearances
      if (labelCount[b[0]] !== labelCount[a[0]]) return labelCount[b[0]] - labelCount[a[0]]; // global weight
      return a[0] < b[0] ? -1 : 1;                                                // name
    });
    return { label: inTier[0][0], tier: maxTier };
  }

  const primaryOf = {}; // id -> { label, tier, sectionId, longtail }
  for (const id of nodeInfo.keys()) {
    if (!useLabels) { primaryOf[id] = { label: '', tier: 1, sectionId: null, longtail: false }; continue; }
    const pr = primaryFor(id);
    const longtail = pr.tier === 1;
    primaryOf[id] = {
      label: pr.label,
      tier: pr.tier,
      sectionId: longtail ? OTHER_ID : sectionIdOf[pr.label],
      longtail: longtail,
    };
  }

  // ---- Section nodes + BELONGS_TO cluster edges (structure layer) ----
  const sectionNodes = [];
  const belongsEdges = [];
  if (useLabels) {
    let paletteIdx = 0;
    promoted.forEach((l) => {
      const tier = tierOf(l);
      const count = labelCount[l];
      const color = tier === 3 ? DISTRICT_PALETTE[(paletteIdx++) % DISTRICT_PALETTE.length] : COLOR.minor;
      const members = Object.keys(primaryOf).filter((id) => primaryOf[id].sectionId === sectionIdOf[l]).length;
      const summary = '[cite] ' + pairsCite + ': district for the edge label "' + l
        + '" (tier ' + tier + ', ' + count + ' edges; ' + members
        + ' nodes anchored here). District weight = edge count.';
      sectionNodes.push({
        data: {
          id: sectionIdOf[l],
          label: l + ' - ' + count,
          color: color,
          degree: 0,
          layer: 'structure',
          tier: tier,
          edge_count: count,
          member_count: members,
          summary: summary,
          citation: pairsCite + ' edge label "' + l + '"',
        },
        classes: 'section-group',
      });
    });

    // Long-tail catch-all super-node (hidden on boot via the injected longtail hide).
    const longtailNodeCount = Object.keys(primaryOf).filter((id) => primaryOf[id].longtail).length;
    sectionNodes.push({
      data: {
        id: OTHER_ID,
        label: 'other labels - ' + tier1Labels.length + ' rare labels',
        color: COLOR.other,
        degree: 0,
        layer: 'structure',
        tier: 1,
        edge_count: tier1Labels.reduce((s, l) => s + labelCount[l], 0),
        member_count: longtailNodeCount,
        summary: '[cite] ' + pairsCite + ': catch-all for ' + tier1Labels.length
          + ' rare edge labels (each < ' + TIER2_MIN_EDGES + ' edges). '
          + longtailNodeCount + ' nodes land here only because EVERY label they touch is rare. '
          + 'Hidden by default; toggle Content off/on or follow a district bridge to browse.',
        citation: pairsCite + ' (tier-1 long tail)',
      },
      classes: 'section-group longtail',
    });

    // One BELONGS_TO cluster edge per node -> its primary Section (invisible lever).
    for (const id of nodeInfo.keys()) {
      const pr = primaryOf[id];
      const rowsList = Array.from(nodeInfo.get(id).rows).sort((a, b) => a - b);
      const rowsStr = rowsList.slice(0, 8).join(', ') + (rowsList.length > 8 ? ', ...' : '');
      belongsEdges.push({
        data: {
          id: 'belongs-' + slugify(id),
          source: id,
          target: pr.sectionId,
          type: 'BELONGS_TO',
          label: '',
          gloss: "primary label: '" + pr.label + "' (tier " + pr.tier
            + ') [' + pairsCite + ' rows ' + rowsStr + ']',
          citation: pairsCite + ' rows ' + rowsStr,
        },
        classes: 'cluster-edge' + (pr.longtail ? ' longtail' : ''),
      });
    }
  }

  // ---- Dedup relationship edges (converges) ----
  const pairEdges = [];
  const degree = {};
  function bump(id) { degree[id] = (degree[id] || 0) + 1; }
  for (const pm of pairMap.values()) {
    bump(pm.source);
    bump(pm.target);
    const homeA = primaryOf[pm.source] ? primaryOf[pm.source].sectionId : null;
    const homeB = primaryOf[pm.target] ? primaryOf[pm.target].sectionId : null;
    const scope = (useLabels && homeA && homeB) ? (homeA === homeB ? 'intra' : 'cross') : 'flat';
    const labelList = Array.from(pm.labels);
    const labelStr = labelList.slice(0, 4).join('; ') + (labelList.length > 4 ? ('; +' + (labelList.length - 4) + ' more') : '');
    const rowStr = pm.rows.slice(0, 6).join(', ') + (pm.rows.length > 6 ? (', +' + (pm.rows.length - 6) + ' more') : '');
    const gloss = labelList.length
      ? ("shares the label(s) '" + labelStr + "' [" + pairsCite + ' rows ' + rowStr + ']')
      : ('linked [' + pairsCite + ' rows ' + rowStr + ']');
    pairEdges.push({
      data: {
        id: 'e-pair-' + slugify(pm.source) + '-' + slugify(pm.target),
        source: pm.source,
        target: pm.target,
        type: 'CONVERGES',
        label: labelList.length ? (labelList[0] + (labelList.length > 1 ? (' +' + (labelList.length - 1)) : '')) : '',
        edge_labels: labelList,
        edge_scope: scope,
        gloss: gloss,
        citation: pairsCite + ' rows ' + pm.rows.join(', '),
      },
      classes: 'converges',
    });
  }

  // ---- Materialize content nodes ----
  const contentNodes = [];
  for (const [id, info] of nodeInfo.entries()) {
    const en = enrich[id] || {};
    const pr = primaryOf[id];
    const rowsList = Array.from(info.rows).sort((a, b) => a - b);
    const rowsStr = rowsList.slice(0, 12).join(', ') + (rowsList.length > 12 ? ', ...' : '');
    const roles = Array.from(info.roles);
    const role = roles.length > 1 ? 'mixed' : roles[0];
    const title = en.title || info.title || '';
    const label = title ? (id + ' ' + truncate(title, 38)) : id;
    const description = en.description || '';
    const allLabels = Array.from(info.labels.keys());
    const labelsStr = allLabels.map((l) => ((pr && l === pr.label) ? l + ' (primary)' : l)).join('; ');
    let citation = pairsCite + ' (' + role + '-role, rows: ' + rowsStr + ')';
    if (nodesCite && en.title !== undefined) citation += '; ' + nodesCite + ' ' + id;
    const descSnippet = description ? (' -- ' + truncate(description, 200)) : '';
    const districtStr = (useLabels && pr && pr.label)
      ? ('Primary district: ' + pr.label + ' (tier ' + pr.tier + '). All labels: ' + (labelsStr || 'n/a') + '. ')
      : '';
    const summary = '[cite] ' + citation + '. ' + districtStr + 'Role: ' + role + '.' + descSnippet;
    const color = role === 'mixed' ? COLOR.mixed : (role === 'source' ? COLOR.source : COLOR.target);
    contentNodes.push({
      data: {
        id: id,
        label: label,
        color: color,
        degree: degree[id] || 0,
        layer: 'content',
        section: role,
        methodology: '',
        summary: summary,
        title: title,
        primary_label: (pr && pr.label) || '',
        primary_tier: (pr && pr.tier) || 1,
        labels: allLabels,
        edge_count: rowsList.length,
        citation: citation,
      },
      classes: 'node ' + role + ((pr && pr.longtail) ? ' longtail' : ''),
    });
  }

  const nodes = contentNodes.concat(sectionNodes);
  const allEdges = pairEdges.concat(belongsEdges);

  // ---- Default-visible estimate (what the boot state leaves on screen) ----
  const visibleSections = promoted.length; // OTHER is hidden (longtail)
  const visibleNodeCount = contentNodes.filter((n) => n.classes.indexOf('longtail') === -1).length;
  const visiblePairEdges = pairEdges.filter((e) => {
    if (!useLabels) return true;
    return primaryOf[e.data.source] && primaryOf[e.data.target]
      && !primaryOf[e.data.source].longtail && !primaryOf[e.data.target].longtail;
  }).length;

  return {
    nodes: nodes,
    edges: allEdges,
    stats: {
      contentNodes: contentNodes.length,
      sectionNodes: sectionNodes.length,
      pairEdges: pairEdges.length,
      belongsEdges: belongsEdges.length,
      sourceNodes: contentNodes.filter((n) => n.data.section === 'source').length,
      targetNodes: contentNodes.filter((n) => n.data.section === 'target').length,
      mixedNodes: contentNodes.filter((n) => n.data.section === 'mixed').length,
      labelCount: labelCount,
      distinctLabels: Object.keys(labelCount).length,
      promotedDistricts: promoted.length,
      tier3: promoted.filter((l) => tierOf(l) === 3).length,
      tier2: promoted.filter((l) => tierOf(l) === 2).length,
      tier1: tier1Labels.length,
      longtailNodes: Object.keys(primaryOf).filter((id) => primaryOf[id].longtail).length,
      intraEdges: pairEdges.filter((e) => e.data.edge_scope === 'intra').length,
      crossEdges: pairEdges.filter((e) => e.data.edge_scope === 'cross').length,
      defaultVisibleNodes: visibleSections + visibleNodeCount,
      defaultVisibleSections: visibleSections,
      defaultVisibleNodesContent: visibleNodeCount,
      defaultVisibleEdges: visiblePairEdges,
    },
  };
}

// ---------------------------------------------------------------------------
// Inject inline graph JSON into the dashboard template (replicates
// scripts/generate-standalone's mechanism, in CJS, hyphen-only title). bootTail is
// appended after initGraph(data) inside loadGraph (the boot-state lever).
// ---------------------------------------------------------------------------
function injectStandalone(templatePath, graphJsonText, title, bootTail) {
  const template = fs.readFileSync(templatePath, 'utf-8');

  const startMarker = 'function loadGraph() {';
  const endMarker = '    }\n\n    // '; // loadGraph closes with '    }' then blank + next comment
  const startIdx = template.indexOf(startMarker);
  const endIdx = startIdx === -1 ? -1 : template.indexOf(endMarker, startIdx);

  const tail = bootTail ? ('\n      ' + bootTail) : '';
  const newFunc = 'function loadGraph() {\n      var data = ' + graphJsonText
    + ';\n      initGraph(data);' + tail + '\n    }';

  let result;
  if (startIdx === -1 || endIdx === -1) {
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

  // Static, em-dash-free title + header.
  result = result.replace('<title>MindrianOS Data Room</title>', '<title>' + title + '</title>');
  result = result.replace(
    '<span class="header-title" id="header-title">Mindrian Data Room</span>',
    '<span class="header-title" id="header-title">' + title + '</span>'
  );

  // Export metadata (mirrors generate-standalone).
  const exportMeta = '\n'
    + '  <meta name="generator" content="MindrianOS -- AI Innovation Co-Founder">\n'
    + '  <meta name="description" content="Idea graph generated from CSV relationship data by MindrianOS.">\n'
    + '  <meta name="creator" content="MindrianOS by Jonathan Sagir">';
  result = result.replace('</head>', exportMeta + '\n</head>');

  // Disable the Refresh button (no server behind a standalone export).
  result = result.replace(
    'id="btn-refresh">Refresh</button>',
    'id="btn-refresh" disabled style="opacity:0.3;cursor:default" title="Standalone export -- refresh not available">Exported</button>'
  );

  // Widen the empty-state trigger to "zero nodes total" (the template keys it on
  // 'artifact'-classed nodes, which an idea graph does not use).
  result = result.replace(
    'if (artifactNodes.length === 0) {',
    'if (data.elements.nodes.length === 0) {'
  );

  // Surgical hover fix (OUTPUT copy only): exclude .cluster-edge from the hover
  // width-set so the invisible BELONGS_TO district spokes stay at width 0.
  result = result.replace(
    "node.connectedEdges().style({ 'opacity': 1, 'width': 3 });",
    "node.connectedEdges().not('.cluster-edge').style({ 'opacity': 1, 'width': 3 });"
  );

  // Final sweep: downgrade the template head's pre-existing long dashes to hyphens.
  result = result.replace(LONG_DASH, '-');

  return result;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
const HELP = [
  'csv-to-idea-graph.cjs -- CSV relationship data -> standalone De Stijl idea-graph.',
  '',
  'Required:',
  '  --pairs <csv>          edge list (one row per relationship)',
  '',
  'Column mapping (defaults in brackets):',
  '  --source-col <name>    [source]       source node id column in --pairs',
  '  --target-col <name>    [target]       target node id column in --pairs',
  '  --edge-label-col <name>[<none>]       edge-label column (drives districts)',
  '  --nodes <csv>          [<none>]       optional node-enrichment CSV',
  '  --node-id-col <name>   [id]           join-key column in --nodes',
  '  --node-title-col <name>[title]        title column in --nodes',
  '  --node-desc-col <name> [description]  description column in --nodes',
  '',
  'Output:',
  '  --out <html>           [idea-graph.html]',
  '  --json-out <json>      [idea-graph.json]',
  '  --title <str>          ["CSV Idea Graph"]',
  '  --template <path>      [dashboard/index.html]',
  '  --help                 show this help',
  '',
  'Example:',
  '  node scripts/csv-to-idea-graph.cjs --pairs edges.csv \\',
  '    --source-col from --target-col to --edge-label-col topic \\',
  '    --out graph.html --json-out graph.json',
].join('\n');

function parseArgs(argv) {
  const opts = {
    pairs: null,
    nodes: null,
    sourceCol: 'source',
    targetCol: 'target',
    edgeLabelCol: '',
    nodeIdCol: 'id',
    nodeTitleCol: 'title',
    nodeDescCol: 'description',
    out: 'idea-graph.html',
    jsonOut: 'idea-graph.json',
    title: 'CSV Idea Graph',
    template: null,
    help: false,
  };
  const map = {
    '--pairs': 'pairs',
    '--nodes': 'nodes',
    '--source-col': 'sourceCol',
    '--target-col': 'targetCol',
    '--edge-label-col': 'edgeLabelCol',
    '--node-id-col': 'nodeIdCol',
    '--node-title-col': 'nodeTitleCol',
    '--node-desc-col': 'nodeDescCol',
    '--out': 'out',
    '--json-out': 'jsonOut',
    '--title': 'title',
    '--template': 'template',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { opts.help = true; continue; }
    if (Object.prototype.hasOwnProperty.call(map, a)) {
      i += 1;
      if (i >= argv.length) throw new Error('missing value for ' + a);
      opts[map[a]] = argv[i];
    } else {
      throw new Error('unknown argument: ' + a);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) { process.stdout.write(HELP + '\n'); return; }
  if (!opts.pairs) { process.stderr.write('ERROR: --pairs <csv> is required.\n\n' + HELP + '\n'); process.exit(2); }

  const repoRoot = path.resolve(__dirname, '..');
  const templatePath = path.resolve(opts.template || path.join(repoRoot, 'dashboard', 'index.html'));
  const outJson = path.resolve(opts.jsonOut);
  const outHtml = path.resolve(opts.out);

  const { nodes, edges, stats } = buildGraph(opts);

  // Top edge-label districts by count (empty when no edge-label column was given).
  const top = Object.entries(stats.labelCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ label: k, edges: v }));

  const graph = {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'MindrianOS csv-to-idea-graph',
      source: path.basename(opts.pairs) + (opts.nodes ? (' + ' + path.basename(opts.nodes)) : ''),
      design: 'CSV relationship data -> De Stijl navigable idea-graph'
        + (opts.edgeLabelCol ? ' (edge-label Section districts + BELONGS_TO cluster lever)' : ' (flat)'),
    },
    elements: { nodes: nodes, edges: edges },
    intelligence: {
      summary: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        content_nodes: stats.contentNodes,
        section_nodes: stats.sectionNodes,
        source_nodes: stats.sourceNodes,
        target_nodes: stats.targetNodes,
        mixed_nodes: stats.mixedNodes,
        distinct_labels: stats.distinctLabels,
        promoted_districts: stats.promotedDistricts,
        tier3_primary_districts: stats.tier3,
        tier2_minor_districts: stats.tier2,
        tier1_longtail_labels: stats.tier1,
        longtail_nodes: stats.longtailNodes,
        dedup_edges: stats.pairEdges,
        intra_district_edges: stats.intraEdges,
        cross_district_edges: stats.crossEdges,
        default_visible_nodes: stats.defaultVisibleNodes,
        default_visible_edges: stats.defaultVisibleEdges,
      },
      top_labels: top,
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

  // Boot: district skeleton + nodes; long tail hidden on boot when districts exist.
  const bootTail = stats.sectionNodes > 0
    ? "applyPreset('room'); cy.nodes('.longtail').hide();"
    : "applyPreset('room');";
  const html = injectStandalone(templatePath, graphJsonText, opts.title, bootTail);
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outHtml, html, 'utf-8');

  const hasInline = html.indexOf('var data = {') !== -1;
  const hasFetch = html.indexOf("fetch('graph.json") !== -1;

  const report = {
    design: opts.edgeLabelCol ? 'District Map' : 'Flat idea-graph',
    inputs: { pairs: opts.pairs, nodes: opts.nodes || null },
    outputs: { json: outJson, html: outHtml },
    counts: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      content_nodes: stats.contentNodes,
      section_nodes: stats.sectionNodes,
      source_nodes: stats.sourceNodes,
      target_nodes: stats.targetNodes,
      mixed_nodes: stats.mixedNodes,
      pair_edges: stats.pairEdges,
      belongs_to_edges: stats.belongsEdges,
    },
    districts: {
      distinct_labels: stats.distinctLabels,
      tier3_primary: stats.tier3,
      tier2_minor: stats.tier2,
      tier1_longtail_labels: stats.tier1,
      total_section_nodes: stats.sectionNodes,
      longtail_nodes: stats.longtailNodes,
    },
    edge_scope: { intra: stats.intraEdges, cross: stats.crossEdges },
    default_view: {
      visible_nodes: stats.defaultVisibleNodes,
      visible_sections: stats.defaultVisibleSections,
      visible_content_nodes: stats.defaultVisibleNodesContent,
      visible_edges: stats.defaultVisibleEdges,
    },
    top_labels: top,
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
