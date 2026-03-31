#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- Room Snapshot Generator
 * Reads a room directory, builds a data model (name, stage, sections,
 * articles, stats, graph), and writes a timestamped snapshot folder
 * with index.html and manifest.json.
 *
 * Usage: node scripts/generate-snapshot.cjs [ROOM_PATH]
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');

// -- Constants --

const SKIP_DIRS = new Set(['.lazygraph', 'meetings', 'team', 'exports']);
const SKIP_FILES = new Set([
  'ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md',
  'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md'
]);

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
  'funding-strategy': '#3A7B5E',
  'personas': '#7B4A8B',
  'literature': '#C8A43C',
  'clinical-pathway': '#2A6B5E'
};

const DEFAULT_COLOR = '#D4CFC7';

// -- Helpers --

/**
 * Parse YAML-like frontmatter delimited by --- lines.
 * Returns an object of key:value pairs.
 */
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

/**
 * Extract title from first # heading, or fall back to filename.
 */
function extractTitle(content, filePath) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : path.basename(filePath, '.md');
}

/**
 * Format current date/time as YYYY-MM-DD-HHmm for folder naming.
 */
function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Convert kebab-case directory name to Title Case label.
 */
function toLabel(dirName) {
  return dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// -- Core Functions --

/**
 * Scan a room directory and return a data model object.
 */
function scanRoom(roomDir) {
  const timestamp = formatTimestamp();

  // 1. Read STATE.md for name/stage/subtitle
  let name = path.basename(roomDir);
  let stage = 'Discovery';
  let subtitle = '';

  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    const stateContent = fs.readFileSync(stateFile, 'utf-8');
    const fm = parseFrontmatter(stateContent);

    // Name: venture_name > room_name > name > H1 > dirname
    if (fm.venture_name) name = fm.venture_name;
    else if (fm.room_name) name = fm.room_name;
    else if (fm.name) name = fm.name;
    else {
      // Fallback: first H1 heading
      const h1 = stateContent.match(/^# (.+)$/m);
      if (h1) name = h1[1].trim();
    }

    // Stage
    if (fm.venture_stage) stage = fm.venture_stage;
    else if (fm.stage) stage = fm.stage;

    // Subtitle
    if (fm.subtitle) subtitle = fm.subtitle;
    else if (fm.description) subtitle = fm.description;
  }

  // 2. Discover sections (subdirectories)
  const sections = [];
  let totalArticles = 0;
  let gapCount = 0;
  let grantCount = 0;

  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_) {
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    if (dirName.startsWith('.') || SKIP_DIRS.has(dirName)) continue;

    const sectionDir = path.join(roomDir, dirName);
    const articles = [];

    try {
      const files = fs.readdirSync(sectionDir);
      for (const f of files) {
        if (!f.endsWith('.md') || SKIP_FILES.has(f)) continue;
        let title = f.replace(/\.md$/, '');
        try {
          const content = fs.readFileSync(path.join(sectionDir, f), 'utf-8');
          title = extractTitle(content, f);
        } catch (_) { /* use filename fallback */ }
        articles.push({ filename: f, title });
      }
    } catch (_) { /* skip unreadable dirs */ }

    const articleCount = articles.length;
    totalArticles += articleCount;
    const isEmpty = articleCount === 0;
    if (isEmpty) gapCount++;

    // Count grant-related articles
    if (dirName === 'funding-strategy' || dirName === 'opportunity-bank') {
      grantCount += articleCount;
    }

    sections.push({
      id: dirName,
      label: toLabel(dirName),
      color: SECTION_COLORS[dirName] || DEFAULT_COLOR,
      articleCount,
      articles,
      isEmpty
    });
  }

  // 3. Read graph.json
  let graphNodes = [];
  let graphEdges = [];
  let enriched = false;

  const graphFile = path.join(roomDir, 'graph.json');
  if (fs.existsSync(graphFile)) {
    try {
      const graphData = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));

      // Check for enriched flag in metadata
      if (graphData.metadata && graphData.metadata.enriched === true) {
        enriched = true;
      }

      // Support both flat and elements-wrapped formats
      if (graphData.elements) {
        graphNodes = graphData.elements.nodes || [];
        graphEdges = graphData.elements.edges || [];
      } else {
        graphNodes = graphData.nodes || [];
        graphEdges = graphData.edges || [];
      }
    } catch (_) {
      // Malformed graph.json -- use empty defaults
    }
  }

  // 4. Build and return data model
  return {
    name,
    stage,
    subtitle,
    sections,
    stats: {
      sectionCount: sections.length,
      articleCount: totalArticles,
      connectionCount: graphEdges.length,
      gapCount,
      grantCount
    },
    graph: {
      nodes: graphNodes,
      edges: graphEdges,
      enriched
    },
    exportDate: new Date().toISOString(),
    timestamp
  };
}

/**
 * Write snapshot folder with index.html and manifest.json.
 */
function writeSnapshot(roomDir, model) {
  const exportsDir = path.join(roomDir, 'exports');
  const snapshotDir = path.join(exportsDir, model.timestamp);

  // Create snapshot folder
  fs.mkdirSync(snapshotDir, { recursive: true });

  // -- Write index.html (minimal skeleton -- Plan 02 replaces with branded template) --
  const sectionListHtml = model.sections.map(s =>
    `      <li><strong>${s.label}</strong> - ${s.articleCount} article${s.articleCount !== 1 ? 's' : ''}${s.isEmpty ? ' (empty)' : ''}</li>`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.name)} - Snapshot</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { margin-bottom: 0.25rem; }
    .stage { color: #666; margin-bottom: 1.5rem; }
    .stats { background: #f5f5f5; padding: 1rem; margin: 1rem 0; }
    ul { padding-left: 1.5rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(model.name)}</h1>
  <p class="stage">Stage: ${escapeHtml(model.stage)}</p>
  ${model.subtitle ? `<p>${escapeHtml(model.subtitle)}</p>` : ''}
  <div class="stats">
    <p><strong>Sections:</strong> ${model.stats.sectionCount} |
       <strong>Articles:</strong> ${model.stats.articleCount} |
       <strong>Connections:</strong> ${model.stats.connectionCount} |
       <strong>Gaps:</strong> ${model.stats.gapCount}</p>
  </div>
  <h2>Sections</h2>
  <ul>
${sectionListHtml}
  </ul>
  <!-- Branded template: see 40-02-PLAN.md -->
</body>
</html>`;

  fs.writeFileSync(path.join(snapshotDir, 'index.html'), html, 'utf-8');

  // -- Write/update manifest.json --
  const snapshotEntry = {
    timestamp: model.timestamp,
    date: model.exportDate,
    roomName: model.name,
    stage: model.stage,
    stats: model.stats,
    enriched: model.graph.enriched,
    files: ['index.html']
  };

  const manifestPath = path.join(exportsDir, 'manifest.json');
  let manifest;

  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!Array.isArray(manifest.snapshots)) {
        manifest.snapshots = [];
      }
    } catch (_) {
      manifest = { version: 1, snapshots: [] };
    }
  } else {
    manifest = { version: 1, snapshots: [] };
  }

  manifest.snapshots.push(snapshotEntry);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // Also write a copy of manifest.json inside the snapshot folder
  const localManifest = { version: 1, snapshots: [snapshotEntry] };
  fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(localManifest, null, 2), 'utf-8');

  return snapshotDir;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -- Main --

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/generate-snapshot.cjs [ROOM_PATH]');
    console.log('');
    console.log('  ROOM_PATH   Path to room directory (default: ./room)');
    console.log('');
    console.log('Produces a timestamped snapshot folder in ROOM_PATH/exports/');
    console.log('containing index.html and manifest.json.');
    process.exit(0);
  }

  const roomDir = path.resolve(args[0] || './room');

  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    process.stderr.write(`Error: Room directory not found: ${roomDir}\n`);
    process.exit(1);
  }

  console.log(`Scanning room: ${roomDir}`);

  const model = scanRoom(roomDir);
  const snapshotDir = writeSnapshot(roomDir, model);

  console.log(`Snapshot written to ${snapshotDir}`);
  console.log(`  Room: ${model.name}`);
  console.log(`  Stage: ${model.stage}`);
  console.log(`  Sections: ${model.stats.sectionCount}`);
  console.log(`  Articles: ${model.stats.articleCount}`);
  console.log(`  Connections: ${model.stats.connectionCount}`);
  console.log(`  Gaps: ${model.stats.gapCount}`);
  if (model.stats.grantCount > 0) {
    console.log(`  Grants/Opportunities: ${model.stats.grantCount}`);
  }
  console.log(`  Graph enriched: ${model.graph.enriched}`);
}

main();
