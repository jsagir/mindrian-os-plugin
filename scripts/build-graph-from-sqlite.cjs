#!/usr/bin/env node
/**
 * MindrianOS Plugin -- SQLite-sourced Cytoscape JSON Graph Builder
 * Queries SQLite (room.db) as primary graph source and outputs
 * Cytoscape JSON matching the build-graph script output structure.
 *
 * Usage: node build-graph-from-sqlite.cjs <roomDir> [outputPath]
 *   roomDir    - Absolute path to room directory
 *   outputPath - Where to write graph.json (default: {roomDir}/.presentation/graph.json)
 *
 * Graceful degradation: exits 0 silently if .mindrian/room.db does not exist.
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
    process.stderr.write('build-graph-from-sqlite: no roomDir provided\n');
    process.exit(0);
  }

  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');

  // Graceful degradation: no .mindrian/room.db means no SQLite data
  if (!fs.existsSync(dbPath)) {
    process.exit(0);
  }

  let lgOps;
  try {
    lgOps = require(path.resolve(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));
  } catch (e) {
    process.stderr.write('build-graph-from-sqlite: could not load lazygraph-ops: ' + e.message + '\n');
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
    const sectionRows = conn.prepare(
      "SELECT id AS name, json_extract(properties, '$.label') AS label FROM nodes WHERE type = 'Section'"
    ).all();
    for (const row of sectionRows) {
      const name = row.name;
      const label = row.label || (name || '').replace(/-/g, ' ').toUpperCase();
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
    const artifactRows = conn.prepare(
      "SELECT id, json_extract(properties, '$.title') AS title, json_extract(properties, '$.section') AS section, json_extract(properties, '$.methodology') AS methodology, json_extract(properties, '$.created') AS created FROM nodes WHERE type = 'Artifact'"
    ).all();
    for (const row of artifactRows) {
      const id = row.id;
      const section = row.section || '';
      const spectral = spectralProfiles[id] || {};

      nodes.push({
        data: {
          id: id,
          label: row.title || '',
          section: section,
          color: getColor(section),
          methodology: row.methodology || '',
          created: row.created || '',
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

    // -- Query Meeting nodes (if any exist) --
    try {
      const meetingRows = conn.prepare(
        "SELECT id, json_extract(properties, '$.name') AS name, json_extract(properties, '$.date') AS date FROM nodes WHERE type = 'Meeting'"
      ).all();
      for (const row of meetingRows) {
        nodes.push({
          data: {
            id: row.id,
            label: row.name || '',
            meeting_date: row.date || '',
            color: '#D4A843',
            layer: 'content',
          },
          classes: 'meeting',
        });
      }
    } catch (_) {
      // Meeting nodes may not exist -- skip silently
    }

    // -- Query Speaker nodes (if any exist) --
    try {
      const speakerRows = conn.prepare(
        "SELECT id, json_extract(properties, '$.name') AS name, json_extract(properties, '$.role') AS role FROM nodes WHERE type = 'Speaker'"
      ).all();
      for (const row of speakerRows) {
        nodes.push({
          data: {
            id: row.id,
            label: row.name || '',
            role: row.role || '',
            color: '#1E3A6E',
            layer: 'content',
          },
          classes: 'speaker',
        });
      }
    } catch (_) {
      // Speaker nodes may not exist -- skip silently
    }

    // -- Query Assumption nodes (if any exist) --
    try {
      const assumptionRows = conn.prepare(
        "SELECT id, json_extract(properties, '$.claim') AS claim, json_extract(properties, '$.status') AS status FROM nodes WHERE type = 'Assumption'"
      ).all();
      for (const row of assumptionRows) {
        nodes.push({
          data: {
            id: row.id,
            label: row.claim || '',
            status: row.status || '',
            color: '#C8A43C',
            layer: 'intelligence',
          },
          classes: 'assumption',
        });
      }
    } catch (_) {
      // Assumption nodes may not exist -- skip silently
    }

    // -- Query ALL edges --
    const edgeRows = conn.prepare(
      "SELECT source AS src, type AS relType, target AS tgt FROM edges"
    ).all();

    // -- Query typed edge properties for Constellation view --
    // HSI_CONNECTION properties (FABRIC-04)
    const hsiEdgeProps = {};
    try {
      const hsiRows = conn.prepare(
        "SELECT source AS src, target AS tgt, properties FROM edges WHERE type = 'HSI_CONNECTION'"
      ).all();
      for (const r of hsiRows) {
        const props = JSON.parse(r.properties || '{}');
        const key = `${r.src}-HSI_CONNECTION-${r.tgt}`;
        hsiEdgeProps[key] = {
          hsi_score: props.hsi_score || 0,
          lsa_sim: props.lsa_sim || 0,
          semantic_sim: props.semantic_sim || 0,
          surprise_type: props.surprise_type || '',
          breakthrough_potential: props.breakthrough_potential || 0,
          tier: props.tier || '',
        };
      }
    } catch (_) {}

    // REVERSE_SALIENT properties (FABRIC-05)
    const rsEdgeProps = {};
    try {
      const rsRows = conn.prepare(
        "SELECT source AS src, target AS tgt, properties FROM edges WHERE type = 'REVERSE_SALIENT'"
      ).all();
      for (const r of rsRows) {
        const props = JSON.parse(r.properties || '{}');
        const key = `${r.src}-REVERSE_SALIENT-${r.tgt}`;
        rsEdgeProps[key] = {
          differential_score: props.differential_score || 0,
          innovation_type: props.innovation_type || '',
          innovation_thesis: props.innovation_thesis || '',
          source_artifact: props.source_artifact || '',
          target_artifact: props.target_artifact || '',
        };
      }
    } catch (_) {}

    // ANALOGOUS_TO properties (FABRIC-06)
    const analogyEdgeProps = {};
    try {
      const analogyRows = conn.prepare(
        "SELECT source AS src, target AS tgt, properties FROM edges WHERE type = 'ANALOGOUS_TO'"
      ).all();
      for (const r of analogyRows) {
        const props = JSON.parse(r.properties || '{}');
        const key = `${r.src}-ANALOGOUS_TO-${r.tgt}`;
        analogyEdgeProps[key] = {
          analogy_distance: props.analogy_distance || 'near',
          structural_fitness: props.structural_fitness || 0,
          source_domain: props.source_domain || '',
          transfer_map: props.transfer_map || '{}',
          discovery_method: props.discovery_method || '',
        };
      }
    } catch (_) {}

    // STRUCTURALLY_ISOMORPHIC properties
    const isoEdgeProps = {};
    try {
      const isoRows = conn.prepare(
        "SELECT source AS src, target AS tgt, properties FROM edges WHERE type = 'STRUCTURALLY_ISOMORPHIC'"
      ).all();
      for (const r of isoRows) {
        const props = JSON.parse(r.properties || '{}');
        const key = `${r.src}-STRUCTURALLY_ISOMORPHIC-${r.tgt}`;
        isoEdgeProps[key] = {
          isomorphism_score: props.isomorphism_score || 0,
          mapped_elements: props.mapped_elements || '{}',
          source: props.source || '',
        };
      }
    } catch (_) {}

    // RESOLVES_VIA properties
    const resolveEdgeProps = {};
    try {
      const resolveRows = conn.prepare(
        "SELECT source AS src, target AS tgt, properties FROM edges WHERE type = 'RESOLVES_VIA'"
      ).all();
      for (const r of resolveRows) {
        const props = JSON.parse(r.properties || '{}');
        const key = `${r.src}-RESOLVES_VIA-${r.tgt}`;
        resolveEdgeProps[key] = {
          resolution_type: props.resolution_type || 'direct',
          triz_principle: props.triz_principle || '',
          analogy_source: props.analogy_source || '',
          confidence: props.confidence || 0,
        };
      }
    } catch (_) {}

    const seenEdges = new Set();

    for (const row of edgeRows) {
      const src = row.src;
      const tgt = row.tgt;
      const relType = row.relType;
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
        generator: 'MindrianOS build-graph-from-sqlite',
        source: 'sqlite',
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
    process.stderr.write(`build-graph-from-sqlite: ${nodes.length} nodes, ${edges.length} edges -> ${outputPath}\n`);

  } catch (err) {
    process.stderr.write('build-graph-from-sqlite: ' + err.message + '\n');
    process.exit(0); // Never fail the hook chain
  } finally {
    if (db) {
      try { await lgOps.closeGraph(db); } catch (_) {}
    }
  }
})();
