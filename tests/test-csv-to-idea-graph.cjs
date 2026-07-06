#!/usr/bin/env node
'use strict';

/*
 * test-csv-to-idea-graph.cjs -- hermetic test for scripts/csv-to-idea-graph.cjs.
 *
 * Writes a tiny SYNTHETIC pairs CSV (3 rows) + nodes CSV (2 rows) to a temp dir,
 * runs the generic tool, and asserts the graph JSON shape, citations, injected-HTML
 * inline JSON (no fetch), zero em-dashes, and zero orphan edges. NO real dataset is
 * used anywhere in this test -- purely synthetic fixture data.
 *
 * Run: node tests/test-csv-to-idea-graph.cjs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(REPO_ROOT, 'scripts', 'csv-to-idea-graph.cjs');

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS: ' + msg); }
  else { failed += 1; console.error('  FAIL: ' + msg); }
}

// Long-dash detector built from escapes (never a literal em-dash byte in source).
const LONG_DASH = new RegExp('[\\u2014\\u2013]');

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-idea-graph-test-'));

  // --- Synthetic fixture: a 3-row edge list over 4 nodes across 2 labels ---
  // Node roles: alpha,beta are sources; gamma,delta are targets. Labels: "growth"
  // appears 2x, "risk" appears 1x. One node title carries an em-dash to prove the
  // sanitizer downgrades it. One field is quoted with an embedded comma (RFC4180).
  const pairsCsv = [
    'source,target,topic',
    'alpha,gamma,growth',
    'beta,gamma,growth',
    'alpha,delta,risk',
  ].join('\n') + '\n';

  const nodesCsv = [
    'id,name,notes',
    'alpha,"Alpha, the first",primary node with an — em-dash inside',
    'gamma,Gamma Node,"second, quoted note"',
  ].join('\n') + '\n';

  const pairsPath = path.join(tmp, 'pairs.csv');
  const nodesPath = path.join(tmp, 'nodes.csv');
  const outHtml = path.join(tmp, 'graph.html');
  const outJson = path.join(tmp, 'graph.json');
  fs.writeFileSync(pairsPath, pairsCsv, 'utf-8');
  fs.writeFileSync(nodesPath, nodesCsv, 'utf-8');

  const stdout = execFileSync('node', [
    TOOL,
    '--pairs', pairsPath,
    '--nodes', nodesPath,
    '--source-col', 'source',
    '--target-col', 'target',
    '--edge-label-col', 'topic',
    '--node-id-col', 'id',
    '--node-title-col', 'name',
    '--node-desc-col', 'notes',
    '--out', outHtml,
    '--json-out', outJson,
    '--title', 'Synthetic Test Graph',
  ], { encoding: 'utf-8' });

  const report = JSON.parse(stdout);

  // --- Graph JSON exists and parses ---
  ok(fs.existsSync(outJson), 'graph.json written');
  ok(fs.existsSync(outHtml), 'graph.html written');
  const graph = JSON.parse(fs.readFileSync(outJson, 'utf-8'));

  // --- Node/edge counts ---
  // 4 content nodes (alpha, beta, gamma, delta). Labels: growth=2 edges, risk=1 edge.
  // With TIER2_MIN_EDGES=5, both labels are tier-1 -> long tail -> 1 'sec-other'
  // section node. So content=4, section=1, total nodes=5.
  const contentNodes = graph.elements.nodes.filter((n) => n.data.layer === 'content');
  const sectionNodes = graph.elements.nodes.filter((n) => n.data.layer === 'structure');
  ok(contentNodes.length === 4, 'exactly 4 content nodes (got ' + contentNodes.length + ')');
  ok(sectionNodes.length === 1, 'exactly 1 section node (long-tail catch-all) (got ' + sectionNodes.length + ')');

  // 3 raw edges -> 3 distinct source|target pairs -> 3 CONVERGES edges. Plus one
  // BELONGS_TO per content node = 4. Total edges = 7.
  const convEdges = graph.elements.edges.filter((e) => e.data.type === 'CONVERGES');
  const belongsEdges = graph.elements.edges.filter((e) => e.data.type === 'BELONGS_TO');
  ok(convEdges.length === 3, 'exactly 3 CONVERGES edges (got ' + convEdges.length + ')');
  ok(belongsEdges.length === 4, 'exactly 4 BELONGS_TO edges (got ' + belongsEdges.length + ')');
  ok(report.counts.source_nodes === 2, '2 source-role nodes (got ' + report.counts.source_nodes + ')');
  ok(report.counts.target_nodes === 2, '2 target-role nodes (got ' + report.counts.target_nodes + ')');

  // --- Citations present on every node and edge ---
  const allNodesCited = graph.elements.nodes.every((n) => typeof n.data.citation === 'string' && n.data.citation.indexOf('pairs.csv') !== -1);
  ok(allNodesCited, 'every node carries a source-CSV citation');
  const allEdgesCited = graph.elements.edges.every((e) => typeof e.data.citation === 'string' && e.data.citation.length > 0);
  ok(allEdgesCited, 'every edge carries a citation');
  const convHaveRows = convEdges.every((e) => /rows\s+\d/.test(e.data.citation));
  ok(convHaveRows, 'CONVERGES edges cite specific CSV row numbers');

  // --- Enrichment applied (title with embedded comma survives RFC4180 parse) ---
  const alpha = contentNodes.find((n) => n.data.id === 'alpha');
  ok(alpha && alpha.data.title === 'Alpha, the first', 'quoted title with embedded comma parsed (got "' + (alpha && alpha.data.title) + '")');

  // --- Orphan edges: zero ---
  ok(report.sanity.orphan_edges === 0, 'zero orphan edges');

  // --- HTML: inline JSON present, no fetch('graph.json'), zero em-dashes ---
  const html = fs.readFileSync(outHtml, 'utf-8');
  ok(html.indexOf('var data = {') !== -1, 'HTML contains inline var data = { ... }');
  ok(report.sanity.html_has_inline_json === true, 'report confirms inline JSON');
  ok(html.indexOf("fetch('graph.json") === -1, "HTML has zero fetch('graph.json') calls");
  ok(report.sanity.html_still_has_fetch === false, 'report confirms no graph.json fetch');
  ok(!LONG_DASH.test(html), 'HTML has zero em-dashes / en-dashes (sanitizer downgraded the fixture em-dash)');
  ok(!LONG_DASH.test(JSON.stringify(graph)), 'graph JSON has zero em-dashes / en-dashes');

  // --- No leakage of any real dataset identifiers into the output ---
  const forbidden = /jhu|jhtv|lens3|oliver|mnt\/c/i;
  ok(!forbidden.test(html), 'HTML has zero real-dataset identifiers');
  ok(!forbidden.test(JSON.stringify(graph)), 'graph JSON has zero real-dataset identifiers');

  // --- cleanup ---
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main();
