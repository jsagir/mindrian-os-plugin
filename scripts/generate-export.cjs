#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Plugin -- Data Room Export Generator
 * Reads a room/ directory, collects sections, artifacts, intelligence,
 * graph data, and optional KuzuDB edges, then injects everything into
 * the export-template.html to produce a self-contained HTML file.
 *
 * Usage: node scripts/generate-export.cjs [ROOM_DIR] [OUTPUT_PATH]
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──

const SCRIPT_DIR = __dirname;
const TEMPLATE_PATH = path.join(SCRIPT_DIR, '..', 'dashboard', 'export-template.html');

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
  'personas': '#7B4A8B'
};

const LIGHT_TEXT_SECTIONS = new Set([
  'problem-definition', 'solution-design', 'business-model',
  'team-execution', 'legal-ip', 'financial-model', 'personas'
]);

const SKIP_DIRS = new Set(['.lazygraph', 'meetings', 'team', 'exports']);
const SKIP_FILES = new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', 'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md']);

// ── Helpers ──

function parseFrontmatter(content) {
  const fm = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

function extractTitle(content, filePath) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

function formatDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function safeExec(cmd, timeoutMs) {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    process.stderr.write(`Warning: command failed: ${cmd}\n${err.message}\n`);
    return null;
  }
}

// ── Main ──

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/generate-export.cjs [ROOM_DIR] [OUTPUT_PATH]');
    console.log('  ROOM_DIR    Path to room directory (default: ./room)');
    console.log('  OUTPUT_PATH Path for output HTML (default: room/exports/YYYY-MM-DD-{name}.html)');
    process.exit(0);
  }

  const roomDir = path.resolve(args[0] || './room');
  if (!fs.existsSync(roomDir)) {
    process.stderr.write(`Error: Room directory not found: ${roomDir}\n`);
    process.exit(1);
  }

  // ── 1. Read STATE.md ──
  let ventureName = path.basename(roomDir);
  let stage = 'Discovery';

  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    const stateContent = fs.readFileSync(stateFile, 'utf-8');
    const fm = parseFrontmatter(stateContent);
    if (fm.venture_name) ventureName = fm.venture_name;
    else if (fm.room_name) ventureName = fm.room_name;
    else if (fm.name) ventureName = fm.name;
    if (fm.venture_stage) stage = fm.venture_stage;
    else if (fm.stage) stage = fm.stage;
  }

  // Fallback: try extracting from first H1 heading
  if (ventureName === path.basename(roomDir)) {
    try {
      const stateContent = fs.readFileSync(stateFile, 'utf-8');
      const h1 = stateContent.match(/^# (.+)$/m);
      if (h1) ventureName = h1[1].trim();
    } catch (_) { /* ignore */ }
  }

  // ── 2. Discover sections ──
  const sections = [];
  const contentBlocks = [];
  let totalArtifacts = 0;
  let emptySections = 0;

  const entries = fs.readdirSync(roomDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (dirName.startsWith('.') || SKIP_DIRS.has(dirName)) continue;

    const sectionDir = path.join(roomDir, dirName);
    const mdFiles = [];

    try {
      const files = fs.readdirSync(sectionDir);
      for (const f of files) {
        if (!f.endsWith('.md') || SKIP_FILES.has(f)) continue;
        mdFiles.push(f);
      }
    } catch (_) { continue; }

    const entryCount = mdFiles.length;
    totalArtifacts += entryCount;
    if (entryCount === 0) emptySections++;

    // Get summary: first artifact title, or ROOM.md purpose
    let summary = '';
    if (entryCount > 0) {
      try {
        const firstContent = fs.readFileSync(path.join(sectionDir, mdFiles[0]), 'utf-8');
        summary = extractTitle(firstContent, mdFiles[0]);
      } catch (_) { /* ignore */ }
    } else {
      const roomMd = path.join(sectionDir, 'ROOM.md');
      if (fs.existsSync(roomMd)) {
        try {
          const roomContent = fs.readFileSync(roomMd, 'utf-8');
          const fm = parseFrontmatter(roomContent);
          summary = fm.purpose || '';
        } catch (_) { /* ignore */ }
      }
    }

    const color = SECTION_COLORS[dirName] || '#D4CFC7';
    const lightText = LIGHT_TEXT_SECTIONS.has(dirName);
    const label = dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Grid class hint based on section index
    const idx = sections.length;
    let gridClass = `cell-${idx}`;

    sections.push({
      id: dirName,
      label,
      color,
      lightText,
      entryCount,
      summary,
      gridClass
    });

    // ── 3. Read markdown content for embedding ──
    if (entryCount > 0) {
      const contentParts = [];
      for (const f of mdFiles) {
        try {
          const fileContent = fs.readFileSync(path.join(sectionDir, f), 'utf-8');
          contentParts.push(fileContent);
        } catch (_) { /* ignore */ }
      }
      contentBlocks.push({
        sectionId: dirName,
        content: contentParts.join('\n\n---\n\n')
      });
    }
  }

  // ── 4. Run analyze-room for intelligence ──
  let intelligence = { gaps: [], convergence: [], contradictions: [] };
  const analyzeScript = path.join(SCRIPT_DIR, 'analyze-room');
  if (fs.existsSync(analyzeScript)) {
    const output = safeExec(`bash "${analyzeScript}" "${roomDir}"`, 5000);
    if (output) {
      intelligence = parseIntelligence(output);
    }
  }

  // ── 5. Run build-graph for graph data ──
  let graph = { elements: { nodes: [], edges: [] } };
  const graphScript = path.join(SCRIPT_DIR, 'build-graph');
  const tempGraphPath = path.join(roomDir, '.tmp-export-graph.json');
  if (fs.existsSync(graphScript)) {
    safeExec(`bash "${graphScript}" "${roomDir}" "${tempGraphPath}"`, 10000);
    if (fs.existsSync(tempGraphPath)) {
      try {
        graph = JSON.parse(fs.readFileSync(tempGraphPath, 'utf-8'));
      } catch (_) { /* ignore */ }
      // Clean up temp file
      try { fs.unlinkSync(tempGraphPath); } catch (_) { /* ignore */ }
    }
  }

  // ── 6. Query LazyGraph (KuzuDB) for richer relationship data ──
  let kuzuData = { available: false };
  const lazygraphDir = path.join(roomDir, '.lazygraph');
  if (fs.existsSync(lazygraphDir)) {
    kuzuData = queryLazyGraph(roomDir, graph);
  }

  // ── 7. Compute stats ──
  let meetingCount = 0;
  const meetingsDir = path.join(roomDir, 'meetings');
  if (fs.existsSync(meetingsDir)) {
    try {
      meetingCount = fs.readdirSync(meetingsDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).length;
    } catch (_) { /* ignore */ }
  }

  let speakerCount = 0;
  const membersDir = path.join(roomDir, 'team', 'members');
  if (fs.existsSync(membersDir)) {
    try {
      speakerCount = fs.readdirSync(membersDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).length;
    } catch (_) { /* ignore */ }
  }

  const stats = {
    artifacts: totalArtifacts,
    meetings: meetingCount,
    speakers: speakerCount,
    sections: sections.length,
    empty: emptySections
  };

  // ── 8. Build ROOM_DATA ──
  const ROOM_DATA = {
    roomName: ventureName,
    stage,
    generatedDate: formatDate(),
    updates: [],
    sections,
    intelligence,
    graph,
    stats,
    kuzu: kuzuData
  };

  // ── 9. Read template ──
  if (!fs.existsSync(TEMPLATE_PATH)) {
    process.stderr.write(`Error: Template not found: ${TEMPLATE_PATH}\n`);
    process.exit(1);
  }
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // ── 10. Inject data ──

  // Replace ROOM_DATA_PLACEHOLDER with actual JSON
  const roomDataJson = JSON.stringify(ROOM_DATA);
  html = html.replace(
    /\/\*ROOM_DATA_PLACEHOLDER\*\/\{[^;]*\}/,
    `/*ROOM_DATA_PLACEHOLDER*/${roomDataJson}`
  );

  // Replace CONTENT_SCRIPTS_PLACEHOLDER with markdown script tags
  const contentScripts = contentBlocks.map(block => {
    // Escape closing script tags in content
    const safeContent = block.content.replace(/<\/script>/gi, '<\\/script>');
    return `<script id="content-${block.sectionId}" type="text/markdown">${safeContent}</script>`;
  }).join('\n');
  html = html.replace('<!-- CONTENT_SCRIPTS_PLACEHOLDER -->', contentScripts);

  // Replace title tag with room name
  html = html.replace(/<title>MindrianOS Data Room<\/title>/, `<title>${escapeHtml(ventureName)} - MindrianOS Data Room</title>`);

  // Replace footer date
  html = html.replace(
    /Generated by MindrianOS[^<]*/,
    `Generated by MindrianOS \u00b7 PWS Methodology \u00b7 ${formatDate()}`
  );

  // ── 11. Write output ──
  const slug = ventureName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const defaultOutput = path.join(roomDir, 'exports', `${formatDate()}-${slug}.html`);
  const outputPath = path.resolve(args[1] || defaultOutput);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Export generated: ${outputPath}`);
  console.log(`  Sections: ${sections.length} (${emptySections} empty)`);
  console.log(`  Artifacts: ${totalArtifacts}`);
  console.log(`  Intelligence: ${intelligence.gaps.length} gaps, ${intelligence.convergence.length} convergence, ${intelligence.contradictions.length} contradictions`);
  if (kuzuData.available) {
    console.log(`  LazyGraph: ${JSON.stringify(kuzuData.edges)} edges`);
  }
}

// ── Intelligence parser ──

function parseIntelligence(output) {
  const gaps = [];
  const convergence = [];
  const contradictions = [];

  for (const line of output.split('\n')) {
    if (line.startsWith('GAP:')) {
      // GAP:STRUCTURAL:section:CONFIDENCE:message
      const parts = line.split(':');
      if (parts.length >= 5) {
        gaps.push({
          section: parts[2],
          message: parts.slice(4).join(':'),
          severity: parts[3]
        });
      }
    } else if (line.startsWith('CONVERGE:')) {
      // CONVERGE:term:count:confidence:message
      const parts = line.split(':');
      if (parts.length >= 5) {
        convergence.push(parts[1]);
      }
    } else if (line.startsWith('CONTRADICT:')) {
      // CONTRADICT:section_a:section_b:confidence:message
      const parts = line.split(':');
      if (parts.length >= 5) {
        contradictions.push({
          sections: `${parts[1]} vs ${parts[2]}`,
          message: parts.slice(4).join(':'),
          severity: parts[3]
        });
      }
    }
  }

  return { gaps, convergence, contradictions };
}

// ── LazyGraph (KuzuDB) query ──

function queryLazyGraph(roomDir, graph) {
  let kuzuData = { available: false };
  let db, conn;

  try {
    const lazygraphOps = require(path.join(SCRIPT_DIR, '..', 'lib', 'core', 'lazygraph-ops.cjs'));
    const { openGraph, closeGraph, queryGraph, graphStats } = lazygraphOps;

    // Use synchronous wrapper since this script is sync-style
    // KuzuDB ops are async, so we use a self-invoking async wrapper
    const result = execKuzuSync(roomDir, lazygraphOps);
    if (result) {
      kuzuData = result.kuzuData;

      // Merge KuzuDB edges into graph
      if (result.edges && result.edges.length > 0) {
        const existingEdgeIds = new Set(
          (graph.elements.edges || []).map(e => `${e.data.source}-${e.data.target}-${e.data.type}`)
        );

        let edgeIdx = (graph.elements.edges || []).length;
        for (const edge of result.edges) {
          const edgeKey = `${edge.src}-${edge.tgt}-${edge.relType}`;
          if (!existingEdgeIds.has(edgeKey)) {
            graph.elements.edges.push({
              data: {
                id: `kuzu-e${edgeIdx++}`,
                source: edge.src,
                target: edge.tgt,
                type: edge.relType,
                label: edge.relType.toLowerCase(),
                source_type: 'lazygraph'
              },
              classes: edge.relType.toLowerCase()
            });
          }
        }
      }
    }
  } catch (err) {
    process.stderr.write(`Warning: LazyGraph query failed: ${err.message}\n`);
    kuzuData = { available: false };
  }

  return kuzuData;
}

function execKuzuSync(roomDir, lazygraphOps) {
  // Write a small Node script that queries KuzuDB and outputs JSON
  const queryScript = `
    const lgOps = require('${path.join(SCRIPT_DIR, '..', 'lib', 'core', 'lazygraph-ops.cjs').replace(/\\/g, '\\\\')}');
    (async () => {
      let db;
      try {
        const { db: d, conn } = await lgOps.openGraph('${roomDir.replace(/\\/g, '\\\\')}');
        db = d;
        const edges = await lgOps.queryGraph(conn, "MATCH (a)-[r]->(b) RETURN type(r) AS relType, a.id AS src, b.id AS tgt, a.title AS srcTitle, b.title AS tgtTitle");
        const stats = await lgOps.graphStats(conn);
        await lgOps.closeGraph(db);
        console.log(JSON.stringify({ edges, stats }));
      } catch (err) {
        if (db) try { await lgOps.closeGraph(db); } catch (_) {}
        console.log(JSON.stringify({ error: err.message }));
      }
    })();
  `;

  const tmpScript = path.join(roomDir, '.tmp-kuzu-query.js');
  try {
    fs.writeFileSync(tmpScript, queryScript, 'utf-8');
    const output = safeExec(`node "${tmpScript}"`, 10000);
    fs.unlinkSync(tmpScript);

    if (!output) return null;

    const data = JSON.parse(output.trim());
    if (data.error) {
      process.stderr.write(`Warning: LazyGraph error: ${data.error}\n`);
      return null;
    }

    // Build edge type counts
    const edgeCounts = {};
    for (const edge of (data.edges || [])) {
      edgeCounts[edge.relType] = (edgeCounts[edge.relType] || 0) + 1;
    }

    return {
      edges: data.edges || [],
      kuzuData: {
        available: true,
        artifacts: data.stats?.nodes?.artifacts || 0,
        sections: data.stats?.nodes?.sections || 0,
        edges: edgeCounts
      }
    };
  } catch (err) {
    try { fs.unlinkSync(tmpScript); } catch (_) {}
    process.stderr.write(`Warning: KuzuDB sync query failed: ${err.message}\n`);
    return null;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

main();
