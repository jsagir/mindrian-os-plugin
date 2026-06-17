#!/usr/bin/env node
/**
 * MindrianOS Plugin -- dashboard graph.json writer (Phase 162-02 / R4).
 *
 * Phase 162-02 repoint: this writer now sources its graph.json from the SINGLE
 * navigation spine, navigation.getGraphExport(roomDir), instead of running its
 * own node-builder over room.db. This collapses the Desktop/Cowork dashboard
 * (Cytoscape) onto the SAME single spine the CLI canvas-graph uses (W1), so the
 * two surfaces share one node-identity space and dangling/orphan edges are
 * structurally impossible (Canon Part 7 reuse; Canon Part 9 single authority).
 *
 * The Canon Part 8 whitelist rides along automatically because the payload IS the
 * getGraphExport payload (id/label/type/knowledge_type/color/degree/review_status
 * on nodes; source/target/type/label/gloss on edges) -- this writer adds NO new
 * fields to the elements, so it introduces zero new boundary surface.
 *
 * Usage: node build-graph-from-sqlite.cjs <roomDir> [outputPath]
 *   roomDir    - Absolute path to room directory
 *   outputPath - Where to write graph.json (default: {roomDir}/.presentation/graph.json)
 *
 * Graceful degradation: getGraphExport returns cold-start anchors when room.db is
 * absent, so a brand-new room still renders the section scaffold rather than a
 * blank canvas. All errors exit 0 with a stderr message (never fails the hook
 * chain).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

'use strict';

const fs = require('fs');
const path = require('path');

(async () => {
  const roomDir = process.argv[2];
  const outputPath = process.argv[3] || (roomDir ? path.join(roomDir, '.presentation', 'graph.json') : null);

  if (!roomDir) {
    process.stderr.write('build-graph-from-sqlite: no roomDir provided\n');
    process.exit(0);
  }

  let navigation;
  try {
    navigation = require(path.resolve(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
  } catch (e) {
    process.stderr.write('build-graph-from-sqlite: could not load navigation: ' + e.message + '\n');
    process.exit(0);
  }

  try {
    // THE single spine read. getGraphExport sources BOTH nodes and edges from
    // room.db in ONE identity space (or emits cold-start section anchors when
    // room.db is absent / empty). The dashboard consumes elements.{nodes,edges}.
    const exported = await navigation.getGraphExport(roomDir);

    const nodes = (exported && exported.elements && Array.isArray(exported.elements.nodes))
      ? exported.elements.nodes : [];
    const edges = (exported && exported.elements && Array.isArray(exported.elements.edges))
      ? exported.elements.edges : [];

    // Preserve the historical dashboard graph.json shape: meta + elements +
    // intelligence.summary. The elements ARE the spine payload, verbatim.
    const output = {
      meta: {
        generatedAt: new Date().toISOString(),
        roomDir: roomDir,
        generator: 'MindrianOS build-graph-from-sqlite (spine-sourced)',
        source: 'getGraphExport',
        cold_start: !!(exported && exported.cold_start),
        room_slug: exported && exported.room_slug ? exported.room_slug : path.basename(path.resolve(roomDir)),
      },
      elements: {
        nodes: nodes,
        edges: edges,
      },
      intelligence: {
        summary: {
          total_nodes: nodes.length,
          total_edges: edges.length,
        },
      },
    };

    // Ensure output directory exists.
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    process.stderr.write(nodes.length + ' nodes, ' + edges.length + ' edges -> ' + outputPath + '\n');
  } catch (err) {
    process.stderr.write('build-graph-from-sqlite: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(0); // Never fail the hook chain.
  }
})();
