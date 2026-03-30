#!/usr/bin/env node
/**
 * MindrianOS Plugin -- KuzuDB-sourced Cytoscape JSON Graph Builder
 * Queries KuzuDB (.lazygraph) as primary graph source and outputs
 * Cytoscape JSON matching the build-graph script output structure.
 *
 * Usage: node build-graph-from-kuzu.cjs <roomDir> [outputPath]
 *   roomDir    - Absolute path to room directory
 *   outputPath - Where to write graph.json (default: {roomDir}/.presentation/graph.json)
 *
 * Graceful degradation: exits 0 silently if .lazygraph/ does not exist.
 * Never fails the hook chain -- all errors exit 0 with stderr message.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Section colors matching build-graph script (De Stijl palette)
const SECTION_COLORS = {
  'problem-definition': '#A63D2F',
  'market-analysis': '#C8A43C',
  'solution-design': '#5C5A56',
  'business-model': '#2D6B4A',
  'competitive-analysis': '#B5602A',
  'team-execution': '#1E3A6E',
  'legal-ip': '#6B4E8B',
  'financial-model': '#2A6B5E',
  'opportunity-bank': '#C87137',
  'funding': '#3A7B5E',
  'personas': '#7B4A8B',
};

const DEFAULT_COLOR = '#5C5A56';

function getColor(section) {
  return SECTION_COLORS[section] || DEFAULT_COLOR;
}

(async () => {
  const roomDir = process.argv[2];
  const outputPath = process.argv[3] || (roomDir ? path.join(roomDir, '.presentation', 'graph.json') : null);

  if (!roomDir) {
    process.stderr.write('build-graph-from-kuzu: no roomDir provided\n');
    process.exit(0);
  }

  const lazygraphPath = path.join(path.resolve(roomDir), '.lazygraph');

  // Graceful degradation: no .lazygraph means no KuzuDB data
  if (!fs.existsSync(lazygraphPath)) {
    process.exit(0);
  }

  let lgOps;
  try {
    lgOps = require(path.resolve(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));
  } catch (e) {
    process.stderr.write('build-graph-from-kuzu: could not load lazygraph-ops: ' + e.message + '\n');
    process.exit(0);
  }

  let db, conn;
  try {
    const graph = await lgOps.openGraph(roomDir);
    db = graph.db;
    conn = graph.conn;

    const nodes = [];
    const edges = [];
    let edgeIdx = 0;

    // -- Query Section nodes --
    const sectionRows = await lgOps.queryGraph(conn,
      "MATCH (s:Section) RETURN s.name AS name, s.label AS label"
    );
    for (const row of sectionRows) {
      const name = row.name || row['s.name'];
      const label = row.label || row['s.label'] || (name || '').replace(/-/g, ' ').toUpperCase();
      nodes.push({
        data: {
          id: name,
          label: label,
          color: getColor(name),
          layer: 'structure',
        },
        classes: 'section-group',
      });
    }

    // -- Query Artifact nodes --
    const artifactRows = await lgOps.queryGraph(conn,
      "MATCH (a:Artifact) RETURN a.id AS id, a.title AS title, a.section AS section, a.methodology AS methodology, a.created AS created"
    );
    for (const row of artifactRows) {
      const id = row.id || row['a.id'];
      const section = row.section || row['a.section'] || '';
      nodes.push({
        data: {
          id: id,
          label: row.title || row['a.title'] || '',
          section: section,
          color: getColor(section),
          methodology: row.methodology || row['a.methodology'] || '',
          created: row.created || row['a.created'] || '',
          layer: 'content',
          parent: section,
        },
        classes: 'artifact',
      });
    }

    // -- Query Meeting nodes (if table exists) --
    try {
      const meetingRows = await lgOps.queryGraph(conn,
        "MATCH (m:Meeting) RETURN m.id AS id, m.name AS name, m.date AS date"
      );
      for (const row of meetingRows) {
        const id = row.id || row['m.id'];
        nodes.push({
          data: {
            id: id,
            label: row.name || row['m.name'] || '',
            meeting_date: row.date || row['m.date'] || '',
            color: '#D4A843',
            layer: 'content',
          },
          classes: 'meeting',
        });
      }
    } catch (_) {
      // Meeting table may not exist -- skip silently
    }

    // -- Query Speaker nodes (if table exists) --
    try {
      const speakerRows = await lgOps.queryGraph(conn,
        "MATCH (s:Speaker) RETURN s.id AS id, s.name AS name, s.role AS role"
      );
      for (const row of speakerRows) {
        const id = row.id || row['s.id'];
        nodes.push({
          data: {
            id: id,
            label: row.name || row['s.name'] || '',
            role: row.role || row['s.role'] || '',
            color: '#1E3A6E',
            layer: 'content',
          },
          classes: 'speaker',
        });
      }
    } catch (_) {
      // Speaker table may not exist -- skip silently
    }

    // -- Query Assumption nodes (if table exists) --
    try {
      const assumptionRows = await lgOps.queryGraph(conn,
        "MATCH (a:Assumption) RETURN a.id AS id, a.claim AS claim, a.status AS status"
      );
      for (const row of assumptionRows) {
        const id = row.id || row['a.id'];
        nodes.push({
          data: {
            id: id,
            label: row.claim || row['a.claim'] || '',
            status: row.status || row['a.status'] || '',
            color: '#C8A43C',
            layer: 'intelligence',
          },
          classes: 'assumption',
        });
      }
    } catch (_) {
      // Assumption table may not exist -- skip silently
    }

    // -- Query ALL edges --
    const edgeRows = await lgOps.queryGraph(conn,
      "MATCH (a)-[r]->(b) RETURN a.id AS src, type(r) AS relType, b.id AS tgt"
    );

    // Also try Section-keyed edges (name instead of id)
    let sectionEdgeRows = [];
    try {
      sectionEdgeRows = await lgOps.queryGraph(conn,
        "MATCH (a)-[r]->(b) WHERE a.name IS NOT NULL OR b.name IS NOT NULL RETURN coalesce(a.id, a.name) AS src, type(r) AS relType, coalesce(b.id, b.name) AS tgt"
      );
    } catch (_) {
      // Fall through -- edgeRows already captures most edges
    }

    const seenEdges = new Set();
    const allEdgeRows = [...edgeRows, ...sectionEdgeRows];

    for (const row of allEdgeRows) {
      const src = row.src || row['src'];
      const tgt = row.tgt || row['tgt'];
      const relType = row.relType || row['relType'];
      if (!src || !tgt || !relType) continue;

      const edgeKey = `${src}-${relType}-${tgt}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      edges.push({
        data: {
          id: `e${edgeIdx}`,
          source: src,
          target: tgt,
          type: relType,
          label: relType.toLowerCase().replace(/_/g, ' '),
        },
        classes: relType.toLowerCase().replace(/_/g, '-'),
      });
      edgeIdx++;
    }

    // -- Build output JSON --
    const output = {
      meta: {
        generatedAt: new Date().toISOString(),
        roomDir: roomDir,
        generator: 'MindrianOS build-graph-from-kuzu',
        source: 'kuzudb',
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

    // Ensure output directory exists
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    process.stderr.write(`build-graph-from-kuzu: ${nodes.length} nodes, ${edges.length} edges -> ${outputPath}\n`);

  } catch (err) {
    process.stderr.write('build-graph-from-kuzu: ' + err.message + '\n');
    process.exit(0); // Never fail the hook chain
  } finally {
    if (db) {
      try { await lgOps.closeGraph(db); } catch (_) {}
    }
  }
})();
