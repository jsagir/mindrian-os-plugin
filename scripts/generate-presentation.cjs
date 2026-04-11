#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Plugin -- Presentation Generator
 * Reads a room/ directory, collects sections, artifacts, intelligence,
 * graph data, MINTO, opportunities, assets, and team, then injects
 * ROOM_DATA JSON into each of 6 HTML template files to produce a
 * self-contained presentation suite.
 *
 * Usage: node scripts/generate-presentation.cjs ROOM_DIR [--theme dark|light] [--output DIR] [--help]
 *
 * Output: 6 HTML files in ROOM_DIR/exports/presentation/ (or --output dir):
 *   index.html     -- Dashboard with stats, view cards, video, assets, opportunities
 *   wiki.html      -- Wikipedia-style 3-panel browser
 *   deck.html      -- Fullscreen slides from MINTO.md
 *   insights.html  -- Stats, timelines, quadrants
 *   diagrams.html  -- Graphviz SVG architecture flows
 *   graph.html     -- Canvas-based force graph with detail panel
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// -- Constants --

const SCRIPT_DIR = __dirname;
const PLUGIN_ROOT = path.join(SCRIPT_DIR, '..');
const TEMPLATES_DIR = path.join(PLUGIN_ROOT, 'templates', 'presentation');

const TEMPLATE_FILES = [
  { name: 'dashboard.html', output: 'index.html', needsGraph: true },
  { name: 'wiki.html', output: 'wiki.html', needsGraph: false },
  { name: 'deck.html', output: 'deck.html', needsGraph: false },
  { name: 'insights.html', output: 'insights.html', needsGraph: false },
  { name: 'diagrams.html', output: 'diagrams.html', needsGraph: false },
  { name: 'graph.html', output: 'graph.html', needsGraph: true },
];

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

const SKIP_DIRS = new Set(['.lazygraph', '.mindrian', 'meetings', 'team', 'exports', '.git']);
const SKIP_FILES = new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', 'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md']);

// -- Helpers --

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
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeExec(cmd, timeoutMs) {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    process.stderr.write('Warning: command failed: ' + cmd + '\n');
    return null;
  }
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (_) {
    return null;
  }
}

function safeReadDir(dirPath, opts) {
  try {
    return fs.readdirSync(dirPath, opts || {});
  } catch (_) {
    return [];
  }
}

// Recursively find all .md files in a directory tree
function findMdFiles(dirPath, skipFiles) {
  const results = [];
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); }
        else if (entry.isFile() && entry.name.endsWith('.md') && !(skipFiles || new Set()).has(entry.name)) {
          results.push(full);
        }
      }
    } catch (_) {}
  }
  walk(dirPath);
  return results;
}

// -- Parse args --

function parseArgs(argv) {
  const args = { roomDir: null, theme: 'dark', output: null, help: false };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; }
    else if (a === '--theme' && argv[i + 1]) { args.theme = argv[++i]; }
    else if (a === '--output' && argv[i + 1]) { args.output = argv[++i]; }
    else if (!a.startsWith('-')) { positional.push(a); }
  }

  args.roomDir = positional[0] || null;
  return args;
}

// -- Data collection --

function collectSections(roomDir) {
  const sections = [];
  let totalArtifacts = 0;

  const entries = safeReadDir(roomDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (dirName.startsWith('.') || SKIP_DIRS.has(dirName)) continue;

    const sectionDir = path.join(roomDir, dirName);
    const mdFilePaths = findMdFiles(sectionDir, SKIP_FILES);
    const mdFiles = mdFilePaths.map(p => path.basename(p));

    const entryCount = mdFilePaths.length;
    totalArtifacts += entryCount;

    let summary = '';
    if (entryCount > 0) {
      const firstContent = safeRead(mdFilePaths[0]);
      if (firstContent) summary = extractTitle(firstContent, mdFiles[0]);
    }

    const color = SECTION_COLORS[dirName] || '#D4CFC7';
    const label = dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    sections.push({
      id: dirName,
      label,
      color,
      entryCount,
      summary,
    });
  }

  return { sections, totalArtifacts };
}

function collectMinto(roomDir) {
  const mintoPath = path.join(roomDir, 'MINTO.md');
  const content = safeRead(mintoPath);
  if (!content) return null;

  const fm = parseFrontmatter(content);
  const governingThought = fm.governing_thought || '';

  // Parse H2 sections as pyramid levels
  const levels = [];
  const h2Regex = /^## (.+)$/gm;
  let m;
  while ((m = h2Regex.exec(content)) !== null) {
    levels.push(m[1].trim());
  }

  return { governing_thought: governingThought, levels };
}

function collectOpportunities(roomDir) {
  const oppDir = path.join(roomDir, 'opportunity-bank');
  const files = safeReadDir(oppDir).filter(f => f.endsWith('.md') && f !== 'ROOM.md');
  const opportunities = [];

  for (const f of files) {
    const content = safeRead(path.join(oppDir, f));
    if (!content) continue;
    const fm = parseFrontmatter(content);
    const title = extractTitle(content, f);
    opportunities.push({
      title,
      type: fm.type || 'opportunity',
      status: fm.status || 'identified',
      amount: fm.amount || '',
      deadline: fm.deadline || '',
    });
  }
  return opportunities;
}

function collectAssets(roomDir) {
  const manifestPath = path.join(roomDir, 'ASSET_MANIFEST.md');
  const content = safeRead(manifestPath);
  if (!content) return [];

  // Parse markdown table rows: | path | type | section | ...
  const assets = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 3 && cells[0] !== 'Path' && cells[0] !== 'path') {
      assets.push({
        path: cells[0],
        type: cells[1] || 'file',
        section: cells[2] || '',
      });
    }
  }
  return assets;
}

function collectTeam(roomDir) {
  const membersDir = path.join(roomDir, 'team', 'members');
  const dirs = safeReadDir(membersDir, { withFileTypes: true })
    .filter(d => d.isDirectory());
  const team = [];

  for (const d of dirs) {
    const profilePath = path.join(membersDir, d.name, 'PROFILE.md');
    const content = safeRead(profilePath);
    if (!content) continue;
    const fm = parseFrontmatter(content);
    const name = fm.name || extractTitle(content, profilePath);
    team.push({
      id: d.name,
      name,
      role: fm.role || '',
      organization: fm.organization || '',
    });
  }
  return team;
}

function collectStats(roomDir, totalArtifacts, sectionCount) {
  let meetingCount = 0;
  const meetingsDir = path.join(roomDir, 'meetings');
  const meetingEntries = safeReadDir(meetingsDir, { withFileTypes: true });
  meetingCount = meetingEntries.filter(d => d.isDirectory()).length;

  let speakerCount = 0;
  const membersDir = path.join(roomDir, 'team', 'members');
  const memberEntries = safeReadDir(membersDir, { withFileTypes: true });
  speakerCount = memberEntries.filter(d => d.isDirectory()).length;

  return {
    artifacts: totalArtifacts,
    meetings: meetingCount,
    speakers: speakerCount,
    sections: sectionCount,
    edges: 0,
  };
}

function collectGraph(roomDir) {
  let graph = { elements: { nodes: [], edges: [] } };

  const graphScript = path.join(SCRIPT_DIR, 'build-graph');
  const tempGraphPath = path.join(roomDir, '.tmp-pres-graph.json');

  if (fs.existsSync(graphScript)) {
    safeExec('bash "' + graphScript + '" "' + roomDir + '" "' + tempGraphPath + '"', 10000);
    if (fs.existsSync(tempGraphPath)) {
      try {
        graph = JSON.parse(fs.readFileSync(tempGraphPath, 'utf-8'));
      } catch (_) { /* ignore */ }
      try { fs.unlinkSync(tempGraphPath); } catch (_) {}
    }
  }

  return graph;
}

function collectGraphData(roomDir, graph) {
  const roomDbPath = path.join(roomDir, '.mindrian', 'room.db');
  if (!fs.existsSync(lazygraphDir)) return { available: false };

  // Reuse the same KuzuDB sync query pattern from generate-export.cjs
  const queryScript = [
    "const lgOps = require('" + path.join(SCRIPT_DIR, '..', 'lib', 'core', 'lazygraph-ops.cjs').replace(/\\/g, '\\\\') + "');",
    "(async () => {",
    "  let db;",
    "  try {",
    "    const { db: d, conn } = await lgOps.openGraph('" + roomDir.replace(/\\/g, '\\\\') + "');",
    "    db = d;",
    "    const edges = await lgOps.queryGraph(conn, \"MATCH (a)-[r]->(b) RETURN label(r) AS relType, coalesce(a.id, a.name) AS src, coalesce(b.id, b.name) AS tgt\");",
    "    const stats = await lgOps.graphStats(conn);",
    "    await lgOps.closeGraph(db);",
    "    console.log(JSON.stringify({ edges, stats }));",
    "  } catch (err) {",
    "    if (db) try { await lgOps.closeGraph(db); } catch (_) {}",
    "    console.log(JSON.stringify({ error: err.message }));",
    "  }",
    "})();",
  ].join('\n');

  const tmpScript = path.join(roomDir, '.tmp-pres-sqlite.js');
  try {
    fs.writeFileSync(tmpScript, queryScript, 'utf-8');
    const output = safeExec('node "' + tmpScript + '"', 10000);
    fs.unlinkSync(tmpScript);

    if (!output) return { available: false };
    const data = JSON.parse(output.trim());
    if (data.error) return { available: false };

    // Merge SQLite edges into graph
    const existingEdgeIds = new Set(
      (graph.elements.edges || []).map(e => e.data.source + '-' + e.data.target + '-' + e.data.type)
    );
    let edgeIdx = (graph.elements.edges || []).length;
    for (const edge of (data.edges || [])) {
      const edgeKey = edge.src + '-' + edge.tgt + '-' + edge.relType;
      if (!existingEdgeIds.has(edgeKey)) {
        graph.elements.edges.push({
          data: {
            id: 'lg-e' + (edgeIdx++),
            source: edge.src,
            target: edge.tgt,
            type: edge.relType,
            label: edge.relType.toLowerCase(),
            source_type: 'lazygraph',
          },
          classes: edge.relType.toLowerCase(),
        });
      }
    }

    const edgeCounts = {};
    for (const edge of (data.edges || [])) {
      edgeCounts[edge.relType] = (edgeCounts[edge.relType] || 0) + 1;
    }

    return {
      available: true,
      artifacts: (data.stats && data.stats.nodes && data.stats.nodes.artifacts) || 0,
      sections: (data.stats && data.stats.nodes && data.stats.nodes.sections) || 0,
      edges: edgeCounts,
    };
  } catch (err) {
    try { fs.unlinkSync(tmpScript); } catch (_) {}
    return { available: false };
  }
}

// -- Template processing --

function readInlineJS(relPath) {
  const fullPath = path.join(PLUGIN_ROOT, relPath);
  return safeRead(fullPath) || '// ' + relPath + ' not found';
}

function processTemplate(templateContent, roomData, canvasGraphJS, detailPanelJS, chatContextJS, generativeToolsJS, chatPanelJS) {
  let html = templateContent;

  // Inject ROOM_DATA JSON
  html = html.replace(
    /\/\*ROOM_DATA_PLACEHOLDER\*\/\{[^;]*\}/,
    '/*ROOM_DATA_PLACEHOLDER*/' + JSON.stringify(roomData)
  );

  // Inject canvas-graph.js
  html = html.replace('/*CANVAS_GRAPH_JS*/', canvasGraphJS);

  // Inject graph-detail-panel.js
  html = html.replace('/*GRAPH_DETAIL_PANEL_JS*/', detailPanelJS);

  // Inject chat-context.js, generative-tools.js, and chat-panel.js
  if (chatContextJS) html = html.replace('/*CHAT_CONTEXT_JS*/', chatContextJS);
  if (generativeToolsJS) html = html.replace('/*GENERATIVE_TOOLS_JS*/', generativeToolsJS);
  if (chatPanelJS) html = html.replace('/*CHAT_PANEL_JS*/', chatPanelJS);

  // Simple template variables
  html = html.replace(/\{\{ROOM_NAME\}\}/g, escapeHtml(roomData.roomName));
  html = html.replace(/\{\{THEME\}\}/g, roomData.theme || 'dark');
  html = html.replace(/\{\{GENERATED_DATE\}\}/g, roomData.generatedDate);

  return html;
}

function copyAssets(roomDir, outputDir, assets) {
  if (assets.length === 0) return;
  const assetsOut = path.join(outputDir, 'assets');
  if (!fs.existsSync(assetsOut)) {
    fs.mkdirSync(assetsOut, { recursive: true });
  }

  for (const asset of assets) {
    const srcPath = path.join(roomDir, asset.path);
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(assetsOut, path.basename(asset.path));
    try {
      fs.copyFileSync(srcPath, destPath);
    } catch (_) { /* skip missing assets */ }
  }
}

// -- Main --

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node scripts/generate-presentation.cjs ROOM_DIR [--theme dark|light] [--output DIR]');
    console.log('');
    console.log('  ROOM_DIR    Path to room directory');
    console.log('  --theme     Color theme: dark (default) or light');
    console.log('  --output    Output directory (default: ROOM_DIR/exports/presentation/)');
    console.log('');
    console.log('Generates 6 HTML files:');
    console.log('  index.html     Dashboard with stats, cards, video, assets');
    console.log('  wiki.html      Wikipedia-style 3-panel browser');
    console.log('  deck.html      Fullscreen slides from MINTO.md');
    console.log('  insights.html  Stats, timelines, quadrants');
    console.log('  diagrams.html  Graphviz SVG architecture flows');
    console.log('  graph.html     Canvas force graph with detail panel');
    process.exit(0);
  }

  if (!args.roomDir) {
    process.stderr.write('Error: ROOM_DIR required. Run with --help for usage.\n');
    process.exit(1);
  }

  const roomDir = path.resolve(args.roomDir);
  if (!fs.existsSync(roomDir)) {
    process.stderr.write('Error: Room directory not found: ' + roomDir + '\n');
    process.exit(1);
  }

  const outputDir = args.output
    ? path.resolve(args.output)
    : path.join(roomDir, 'exports', 'presentation');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // -- 1. Read STATE.md --
  let ventureName = path.basename(roomDir);
  let stage = 'Discovery';
  let videoUrl = '';

  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    const stateContent = fs.readFileSync(stateFile, 'utf-8');
    const fm = parseFrontmatter(stateContent);
    if (fm.venture_name) ventureName = fm.venture_name;
    else if (fm.room_name) ventureName = fm.room_name;
    else if (fm.name) ventureName = fm.name;
    if (fm.venture_stage) stage = fm.venture_stage;
    else if (fm.stage) stage = fm.stage;
    if (fm.video_url) videoUrl = fm.video_url;
  }

  // Fallback: extract from H1
  if (ventureName === path.basename(roomDir)) {
    const stateContent = safeRead(stateFile);
    if (stateContent) {
      const h1 = stateContent.match(/^# (.+)$/m);
      if (h1) ventureName = h1[1].trim();
    }
  }

  // -- 2. Collect all data --
  const { sections, totalArtifacts } = collectSections(roomDir);
  const minto = collectMinto(roomDir);
  const opportunities = collectOpportunities(roomDir);
  const assets = collectAssets(roomDir);
  const team = collectTeam(roomDir);
  const graph = collectGraph(roomDir);
  const graphData = collectGraphData(roomDir, graph);
  const stats = collectStats(roomDir, totalArtifacts, sections.length);
  const whitespace = collectWhitespace(roomDir);
  const topicForest = collectTopicForest(roomDir);

  // Update edge count from graph data
  stats.edges = (graph.elements.edges || []).length;

  // -- 3. Build ROOM_DATA --
  const ROOM_DATA = {
    roomName: ventureName,
    stage,
    generatedDate: formatDate(),
    theme: args.theme,
    sections,
    intelligence: { gaps: [], convergence: [], contradictions: [] },
    graph,
    stats,
    graphData,
    minto,
    opportunities,
    assets,
    team,
    videoUrl,
    whitespace,
    topicForest,
    sectionColors: SECTION_COLORS,
    state: { name: ventureName, stage },
    currentView: 'graph',
  };

  // -- 4. Run analyze-room for intelligence --
  const analyzeScript = path.join(SCRIPT_DIR, 'analyze-room');
  if (fs.existsSync(analyzeScript)) {
    const output = safeExec('bash "' + analyzeScript + '" "' + roomDir + '"', 5000);
    if (output) {
      ROOM_DATA.intelligence = parseIntelligence(output);
    }
  }

  // -- 5. Read inline JS for graph templates --
  // Injection order: canvas-graph -> detail-panel -> chat-context -> generative-tools -> chat-panel
  const canvasGraphJS = readInlineJS('lib/graph/canvas-graph.js');
  const detailPanelJS = readInlineJS('lib/graph/graph-detail-panel.js');
  const chatContextJS = readInlineJS('lib/chat/chat-context.js');
  const generativeToolsJS = readInlineJS('lib/chat/generative-tools.js');
  const chatPanelJS = readInlineJS('lib/chat/chat-panel.js');

  // -- 6. Process each template --
  let generated = 0;
  let skipped = 0;

  for (const tpl of TEMPLATE_FILES) {
    const templatePath = path.join(TEMPLATES_DIR, tpl.name);
    const templateContent = safeRead(templatePath);

    if (!templateContent) {
      process.stderr.write('Warning: Template not found, skipping: ' + tpl.name + '\n');
      skipped++;
      continue;
    }

    const html = processTemplate(templateContent, ROOM_DATA, canvasGraphJS, detailPanelJS, chatContextJS, generativeToolsJS, chatPanelJS);
    const outputPath = path.join(outputDir, tpl.output);
    fs.writeFileSync(outputPath, html, 'utf-8');
    generated++;
  }

  // -- 7. Copy room assets to output --
  copyAssets(roomDir, outputDir, assets);

  // -- 8. Summary --
  console.log('Presentation generated: ' + generated + ' views in ' + outputDir);
  if (skipped > 0) {
    console.log('  Skipped: ' + skipped + ' templates (not yet created)');
  }
  console.log('  Room: ' + ventureName + ' (' + stage + ')');
  console.log('  Sections: ' + sections.length);
  console.log('  Artifacts: ' + totalArtifacts);
  console.log('  Graph: ' + (graph.elements.nodes || []).length + ' nodes, ' + (graph.elements.edges || []).length + ' edges');
  if (graphData.available) {
    console.log('  LazyGraph: ' + JSON.stringify(graphData.edges));
  }
  if (whitespace) {
    console.log('  Whitespace: ' + (whitespace.points || []).length + ' points, ' + (whitespace.zones || []).length + ' zones');
  }
  if (topicForest) {
    console.log('  TopicForest: loaded');
  }
}

// -- Whitespace + TopicForest data collection --

function collectWhitespace(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');

  // Try to read whitespace-results.json
  const resultsPath = path.join(mindrianDir, 'whitespace-results.json');
  const resultsContent = safeRead(resultsPath);
  if (!resultsContent) return null;

  let results;
  try {
    results = JSON.parse(resultsContent);
  } catch (_) {
    return null;
  }

  // Get UMAP 2D points - check for pre-computed or cached
  let umap2d = results.umap_2d || null;

  // If no umap_2d in results, check for cached viz projection
  if (!umap2d) {
    const cachedPath = path.join(mindrianDir, 'umap-2d-viz.json');
    const cachedContent = safeRead(cachedPath);
    if (cachedContent) {
      try {
        const cached = JSON.parse(cachedContent);
        // Check staleness - compare timestamps
        const cachedStat = fs.statSync(cachedPath);
        const resultsStat = fs.statSync(resultsPath);
        if (cachedStat.mtimeMs >= resultsStat.mtimeMs) {
          umap2d = cached.points || cached;
        }
      } catch (_) {}
    }
  }

  // If still no 2D points, try to compute via Python (PCA fallback)
  if (!umap2d) {
    const embeddingsPath = path.join(mindrianDir, 'whitespace-embeddings.json');
    if (fs.existsSync(embeddingsPath)) {
      umap2d = computeUmap2D(embeddingsPath, mindrianDir);
    }
  }

  // Extract zones
  const zones = results.zones || [];

  // Extract KDE contours (pre-computed or null)
  const kdeContours = results.kde_contours || null;

  return {
    points: umap2d || [],
    zones: zones,
    kdeContours: kdeContours,
  };
}

function computeUmap2D(embeddingsPath, mindrianDir) {
  // Try UMAP first, fall back to PCA
  const outputPath = path.join(mindrianDir, 'umap-2d-viz.json');

  const pyScript = [
    'import json, sys, os',
    'emb_path = sys.argv[1]',
    'out_path = sys.argv[2]',
    'with open(emb_path) as f: data = json.load(f)',
    'points = data if isinstance(data, list) else data.get("embeddings", [])',
    'if not points: sys.exit(0)',
    'import numpy as np',
    'ids = [p.get("id","") for p in points]',
    'types = [p.get("type","room") for p in points]',
    'labels = [p.get("label","") for p in points]',
    'sections = [p.get("section","") for p in points]',
    'vecs = np.array([p["embedding"] for p in points])',
    'try:',
    '    from umap import UMAP',
    '    reducer = UMAP(n_components=2, random_state=42, n_neighbors=min(15, len(vecs)-1))',
    '    coords = reducer.fit_transform(vecs)',
    'except ImportError:',
    '    from sklearn.decomposition import PCA',
    '    reducer = PCA(n_components=2)',
    '    coords = reducer.fit_transform(vecs)',
    'result = []',
    'for i in range(len(ids)):',
    '    result.append({"id": ids[i], "x": float(coords[i][0]), "y": float(coords[i][1]), "type": types[i], "label": labels[i], "section": sections[i]})',
    'with open(out_path, "w") as f: json.dump({"points": result}, f)',
  ].join('\n');

  const tmpPy = path.join(mindrianDir, '.tmp-umap-2d.py');
  try {
    fs.writeFileSync(tmpPy, pyScript, 'utf-8');
    safeExec('python3 "' + tmpPy + '" "' + embeddingsPath + '" "' + outputPath + '"', 30000);
    fs.unlinkSync(tmpPy);

    const output = safeRead(outputPath);
    if (output) {
      const parsed = JSON.parse(output);
      return parsed.points || [];
    }
  } catch (_) {
    try { fs.unlinkSync(tmpPy); } catch (_e) {}
  }

  return null;
}

function collectTopicForest(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');

  // Try labeled version first, then plain
  const labeledPath = path.join(mindrianDir, 'topic-forest-labeled.json');
  const plainPath = path.join(mindrianDir, 'topic-forest.json');

  const content = safeRead(labeledPath) || safeRead(plainPath);
  if (!content) return null;

  try {
    const data = JSON.parse(content);
    return data.tree || data;
  } catch (_) {
    return null;
  }
}

// -- Intelligence parser (from generate-export.cjs) --

function parseIntelligence(output) {
  const gaps = [];
  const convergence = [];
  const contradictions = [];

  for (const line of output.split('\n')) {
    if (line.startsWith('GAP:')) {
      const parts = line.split(':');
      if (parts.length >= 5) {
        gaps.push({ section: parts[2], message: parts.slice(4).join(':'), severity: parts[3] });
      }
    } else if (line.startsWith('CONVERGE:')) {
      const parts = line.split(':');
      if (parts.length >= 5) convergence.push(parts[1]);
    } else if (line.startsWith('CONTRADICT:')) {
      const parts = line.split(':');
      if (parts.length >= 5) {
        contradictions.push({ sections: parts[1] + ' vs ' + parts[2], message: parts.slice(4).join(':'), severity: parts[3] });
      }
    }
  }

  return { gaps, convergence, contradictions };
}

main();
