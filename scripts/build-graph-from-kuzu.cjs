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

    // -- Load spectral profiles from .hsi-results.json if available --
    let spectralProfiles = {};
    const hsiResultsPath = path.join(path.resolve(roomDir), '.hsi-results.json');
    try {
      if (fs.existsSync(hsiResultsPath)) {
        const hsiData = JSON.parse(fs.readFileSync(hsiResultsPath, 'utf-8'));
        // Index by artifact id for quick lookup
        if (Array.isArray(hsiData.profiles)) {
          for (const p of hsiData.profiles) {
            if (p.id) spectralProfiles[p.id] = p;
          }
        } else if (typeof hsiData === 'object') {
          // May be keyed directly by artifact id
          for (const [key, val] of Object.entries(hsiData)) {
            if (val && typeof val === 'object') spectralProfiles[key] = val;
          }
        }
      }
    } catch (_) {
      // No spectral data available -- continue without
    }

    // -- Query Artifact nodes --
    const artifactRows = await lgOps.queryGraph(conn,
      "MATCH (a:Artifact) RETURN a.id AS id, a.title AS title, a.section AS section, a.methodology AS methodology, a.created AS created"
    );
    for (const row of artifactRows) {
      const id = row.id || row['a.id'];
      const section = row.section || row['a.section'] || '';
      const spectral = spectralProfiles[id] || {};

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
          // Spectral OM-HMM profile (FABRIC-03)
          spectral_gap: spectral.spectral_gap || 0,
          spectral_gap_avg: spectral.spectral_gap_avg || spectral.spectral_gap || 0,
          dominant_mode: spectral.dominant_mode || '',
          mode_entropy: spectral.mode_entropy || 0,
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

    // -- Query ALL edges with properties per type --
    // Generic edge query (catches all types)
    const edgeRows = await lgOps.queryGraph(conn,
      "MATCH (a)-[r]->(b) RETURN coalesce(a.id, a.name) AS src, label(r) AS relType, coalesce(b.id, b.name) AS tgt"
    );

    // Also try Section-keyed edges (name instead of id)
    let sectionEdgeRows = [];
    try {
      sectionEdgeRows = await lgOps.queryGraph(conn,
        "MATCH (a)-[r]->(b) WHERE a.name IS NOT NULL OR b.name IS NOT NULL RETURN coalesce(a.id, a.name) AS src, label(r) AS relType, coalesce(b.id, b.name) AS tgt"
      );
    } catch (_) {
      // Fall through -- edgeRows already captures most edges
    }

    // -- Query typed edge properties for Constellation view --
    // HSI_CONNECTION properties (FABRIC-04)
    const hsiEdgeProps = {};
    try {
      const hsiRows = await lgOps.queryGraph(conn,
        "MATCH (a:Artifact)-[r:HSI_CONNECTION]->(b:Artifact) RETURN a.id AS src, b.id AS tgt, r.hsi_score AS hsi_score, r.lsa_sim AS lsa_sim, r.semantic_sim AS semantic_sim, r.surprise_type AS surprise_type, r.breakthrough_potential AS breakthrough_potential, r.tier AS tier"
      );
      for (const r of hsiRows) {
        const key = `${r.src || r['a.id']}-HSI_CONNECTION-${r.tgt || r['b.id']}`;
        hsiEdgeProps[key] = {
          hsi_score: r.hsi_score || r['r.hsi_score'] || 0,
          lsa_sim: r.lsa_sim || r['r.lsa_sim'] || 0,
          semantic_sim: r.semantic_sim || r['r.semantic_sim'] || 0,
          surprise_type: r.surprise_type || r['r.surprise_type'] || '',
          breakthrough_potential: r.breakthrough_potential || r['r.breakthrough_potential'] || 0,
          tier: r.tier || r['r.tier'] || '',
        };
      }
    } catch (_) {}

    // REVERSE_SALIENT properties (FABRIC-05)
    const rsEdgeProps = {};
    try {
      const rsRows = await lgOps.queryGraph(conn,
        "MATCH (a:Section)-[r:REVERSE_SALIENT]->(b:Section) RETURN a.name AS src, b.name AS tgt, r.differential_score AS diff, r.innovation_type AS itype, r.innovation_thesis AS thesis, r.source_artifact AS src_art, r.target_artifact AS tgt_art"
      );
      for (const r of rsRows) {
        const key = `${r.src || r['a.name']}-REVERSE_SALIENT-${r.tgt || r['b.name']}`;
        rsEdgeProps[key] = {
          differential_score: r.diff || r['r.differential_score'] || 0,
          innovation_type: r.itype || r['r.innovation_type'] || '',
          innovation_thesis: r.thesis || r['r.innovation_thesis'] || '',
          source_artifact: r.src_art || r['r.source_artifact'] || '',
          target_artifact: r.tgt_art || r['r.target_artifact'] || '',
        };
      }
    } catch (_) {}

    // ANALOGOUS_TO properties (FABRIC-06)
    const analogyEdgeProps = {};
    try {
      const analogyRows = await lgOps.queryGraph(conn,
        "MATCH (a:Artifact)-[r:ANALOGOUS_TO]->(b:Artifact) RETURN a.id AS src, b.id AS tgt, r.analogy_distance AS dist, r.structural_fitness AS fit, r.source_domain AS domain, r.transfer_map AS tmap, r.discovery_method AS method"
      );
      for (const r of analogyRows) {
        const key = `${r.src || r['a.id']}-ANALOGOUS_TO-${r.tgt || r['b.id']}`;
        analogyEdgeProps[key] = {
          analogy_distance: r.dist || r['r.analogy_distance'] || 'near',
          structural_fitness: r.fit || r['r.structural_fitness'] || 0,
          source_domain: r.domain || r['r.source_domain'] || '',
          transfer_map: r.tmap || r['r.transfer_map'] || '{}',
          discovery_method: r.method || r['r.discovery_method'] || '',
        };
      }
    } catch (_) {}

    // STRUCTURALLY_ISOMORPHIC properties
    const isoEdgeProps = {};
    try {
      const isoRows = await lgOps.queryGraph(conn,
        "MATCH (a:Section)-[r:STRUCTURALLY_ISOMORPHIC]->(b:Section) RETURN a.name AS src, b.name AS tgt, r.isomorphism_score AS score, r.mapped_elements AS mapped, r.source AS source"
      );
      for (const r of isoRows) {
        const key = `${r.src || r['a.name']}-STRUCTURALLY_ISOMORPHIC-${r.tgt || r['b.name']}`;
        isoEdgeProps[key] = {
          isomorphism_score: r.score || r['r.isomorphism_score'] || 0,
          mapped_elements: r.mapped || r['r.mapped_elements'] || '{}',
          source: r.source || r['r.source'] || '',
        };
      }
    } catch (_) {}

    // RESOLVES_VIA properties
    const resolveEdgeProps = {};
    try {
      const resolveRows = await lgOps.queryGraph(conn,
        "MATCH (a:Artifact)-[r:RESOLVES_VIA]->(b:Artifact) RETURN a.id AS src, b.id AS tgt, r.resolution_type AS rtype, r.triz_principle AS triz, r.analogy_source AS asrc, r.confidence AS conf"
      );
      for (const r of resolveRows) {
        const key = `${r.src || r['a.id']}-RESOLVES_VIA-${r.tgt || r['b.id']}`;
        resolveEdgeProps[key] = {
          resolution_type: r.rtype || r['r.resolution_type'] || 'direct',
          triz_principle: r.triz || r['r.triz_principle'] || '',
          analogy_source: r.asrc || r['r.analogy_source'] || '',
          confidence: r.conf || r['r.confidence'] || 0,
        };
      }
    } catch (_) {}

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

      // Merge type-specific properties
      const edgeData = {
        id: `e${edgeIdx}`,
        source: src,
        target: tgt,
        type: relType,
        label: relType.toLowerCase().replace(/_/g, ' '),
      };

      // Attach typed properties for Constellation rendering
      const propsKey = edgeKey;
      if (relType === 'HSI_CONNECTION' && hsiEdgeProps[propsKey]) {
        Object.assign(edgeData, hsiEdgeProps[propsKey]);
      } else if (relType === 'REVERSE_SALIENT' && rsEdgeProps[propsKey]) {
        Object.assign(edgeData, rsEdgeProps[propsKey]);
      } else if (relType === 'ANALOGOUS_TO' && analogyEdgeProps[propsKey]) {
        Object.assign(edgeData, analogyEdgeProps[propsKey]);
      } else if (relType === 'STRUCTURALLY_ISOMORPHIC' && isoEdgeProps[propsKey]) {
        Object.assign(edgeData, isoEdgeProps[propsKey]);
      } else if (relType === 'RESOLVES_VIA' && resolveEdgeProps[propsKey]) {
        Object.assign(edgeData, resolveEdgeProps[propsKey]);
      }

      edges.push({
        data: edgeData,
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
