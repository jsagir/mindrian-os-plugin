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

// -- De Stijl Branded Template --

/**
 * Mondrian logo SVG -- 5-rectangle grid mark + wordmark.
 * Header variant (height 40) includes wordmark.
 * Footer variant (height 24) includes wordmark at smaller size.
 */
function logoSvg(height) {
  const scale = height / 48;
  const w = Math.round(240 * scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" width="${w}" height="${height}">
  <rect x="0" y="0" width="20" height="48" fill="#1E3A6E"/>
  <rect x="22" y="0" width="12" height="22" fill="#A63D2F"/>
  <rect x="22" y="24" width="12" height="24" fill="#C8A43C"/>
  <rect x="36" y="0" width="8" height="48" fill="#F5F0E8"/>
  <rect x="46" y="0" width="4" height="32" fill="#2D6B4A"/>
  <text x="60" y="35" font-size="32" fill="#F5F0E8"
        font-family="'Bebas Neue', sans-serif"
        font-weight="400" letter-spacing="0.04em">MINDRIAN</text>
</svg>`;
}

/**
 * 5-color accent bar (red, blue, yellow, green, teal).
 */
function accentBar() {
  return `<div class="accent-bar">
  <span style="background:#A63D2F"></span>
  <span style="background:#1E3A6E"></span>
  <span style="background:#C8A43C"></span>
  <span style="background:#2D6B4A"></span>
  <span style="background:#2A6B5E"></span>
</div>`;
}

/**
 * Render a section card with De Stijl styling.
 */
function renderSectionCard(section) {
  const borderColor = section.color || DEFAULT_COLOR;
  const articleLabel = section.articleCount === 1 ? '1 article' : `${section.articleCount} articles`;

  if (section.isEmpty) {
    return `<div class="card card-gap" style="border-left:3px dashed ${borderColor}">
  <span class="tag">${escapeHtml(section.label)}</span>
  <p class="card-empty">No articles yet</p>
</div>`;
  }

  const articleList = section.articles.map(a =>
    `<li>${escapeHtml(a.title)}</li>`
  ).join('\n        ');

  return `<div class="card" style="border-left:3px solid ${borderColor}">
  <span class="tag">${escapeHtml(section.label)}</span>
  <p class="card-count">${articleLabel}</p>
  <ul class="card-articles">
        ${articleList}
  </ul>
</div>`;
}

/**
 * Render the full branded HTML page.
 */
function renderBrandedHtml(model) {
  const exportDate = new Date(model.exportDate);
  const dateStr = exportDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = exportDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  const sectionCards = model.sections.map(renderSectionCard).join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.name)} -- Snapshot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* -- De Stijl Design Tokens -- */
    :root {
      /* Backgrounds */
      --ds-bg: #1a1a1a;
      --ds-surface: #2d2d2d;
      --ds-elevated: #3a3a3a;
      /* Text */
      --ds-cream: #f5f1e8;
      --ds-muted: #a8a39f;
      /* Borders */
      --ds-border: #404040;
      /* Section colors (fill) */
      --ds-red: #A63D2F;
      --ds-blue: #1E3A6E;
      --ds-yellow: #C8A43C;
      --ds-green: #2D6B4A;
      --ds-sienna: #B5602A;
      --ds-gray: #5C5A56;
      --ds-amethyst: #6B4E8B;
      --ds-teal: #2A6B5E;
      /* Section colors (text) */
      --ds-red-text: #C95A4A;
      --ds-blue-text: #4A7BC8;
      --ds-yellow-text: #C8A43C;
      --ds-green-text: #4A9B72;
      --ds-sienna-text: #D4804A;
      --ds-gray-text: #8A8780;
      --ds-amethyst-text: #9B7EB5;
      --ds-teal-text: #4A9B8E;
      /* Shadows */
      --ds-shadow-flat: 0 0 0 1px var(--ds-border);
      --ds-shadow-lifted: 4px 4px 0 #0a0a0f;
      /* Motion */
      --ds-transition: 150ms ease;
      --ds-transition-slow: 200ms ease-out;
      /* Typography */
      --ds-font-display: 'Bebas Neue', sans-serif;
      --ds-font-body: 'Inter', system-ui, sans-serif;
      --ds-font-mono: 'JetBrains Mono', monospace;
    }

    /* -- Reset + Base -- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; }
    body {
      font-family: var(--ds-font-body);
      background: var(--ds-bg);
      color: var(--ds-cream);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* -- Zero border-radius everywhere -- */
    * { border-radius: 0 !important; }

    /* -- Header -- */
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--ds-bg);
      border-bottom: 1px solid var(--ds-border);
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-title {
      font-family: var(--ds-font-display);
      font-size: 24px;
      font-weight: 400;
      letter-spacing: 0.03em;
      color: var(--ds-cream);
    }
    .header-subtitle {
      font-size: 12px;
      color: var(--ds-muted);
      margin-left: 4px;
    }
    .stage-badge {
      font-family: var(--ds-font-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--ds-yellow-text);
      border: 1px solid var(--ds-yellow);
      padding: 4px 12px;
    }
    .header-date {
      font-family: var(--ds-font-mono);
      font-size: 12px;
      color: var(--ds-muted);
    }

    /* -- Accent Bar -- */
    .accent-bar {
      display: flex;
      height: 4px;
      width: 100%;
    }
    .accent-bar span {
      flex: 1;
    }

    /* -- Layout -- */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 32px;
    }
    .section {
      padding: 48px 0;
      border-top: 1px solid var(--ds-border);
    }
    .section:first-child { border-top: none; }
    .section-alt { background: var(--ds-surface); }

    /* -- Stats Bar -- */
    .stats-bar {
      display: flex;
      justify-content: center;
      gap: 48px;
      padding: 24px 32px;
      background: var(--ds-surface);
      border-bottom: 1px solid var(--ds-border);
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      font-family: var(--ds-font-mono);
      font-size: 28px;
      font-weight: 600;
      color: var(--ds-cream);
    }
    .stat-label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--ds-muted);
      margin-top: 4px;
    }

    /* -- Section Headers -- */
    .section-header {
      font-family: var(--ds-font-display);
      font-size: 32px;
      font-weight: 400;
      letter-spacing: 0.04em;
      color: var(--ds-cream);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .section-header::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 28px;
      background: var(--ds-blue);
    }

    /* -- Cards Grid -- */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--ds-surface);
      border: 1px solid var(--ds-border);
      padding: 20px;
      transition: border-color var(--ds-transition), box-shadow var(--ds-transition);
    }
    .card:hover {
      filter: brightness(1.25);
      box-shadow: var(--ds-shadow-lifted);
    }
    .card-gap {
      opacity: 0.5;
    }
    .card-gap:hover {
      opacity: 0.7;
    }

    /* -- Tags -- */
    .tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--ds-muted);
      margin-bottom: 8px;
    }

    /* -- Card content -- */
    .card-count {
      font-family: var(--ds-font-mono);
      font-size: 13px;
      color: var(--ds-cream);
      margin-bottom: 8px;
    }
    .card-empty {
      font-size: 13px;
      color: var(--ds-muted);
      font-style: normal;
    }
    .card-articles {
      list-style: none;
      padding: 0;
    }
    .card-articles li {
      font-size: 13px;
      color: var(--ds-muted);
      padding: 2px 0;
      border-bottom: 1px solid var(--ds-border);
    }
    .card-articles li:last-child {
      border-bottom: none;
    }

    /* -- Footer -- */
    .footer {
      border-top: 1px solid var(--ds-border);
      padding: 24px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .footer-brand {
      font-size: 12px;
      color: var(--ds-muted);
      letter-spacing: 0.04em;
    }
    .footer-meta {
      font-family: var(--ds-font-mono);
      font-size: 11px;
      color: var(--ds-muted);
    }

    /* -- Responsive -- */
    @media (max-width: 768px) {
      .header { padding: 0 16px; }
      .container { padding: 0 16px; }
      .stats-bar { gap: 24px; padding: 16px; flex-wrap: wrap; }
      .stat-value { font-size: 22px; }
      .section { padding: 32px 0; }
      .card-grid { grid-template-columns: 1fr; }
      .footer { flex-direction: column; gap: 12px; text-align: center; }
    }
    @media (max-width: 480px) {
      .header-title { font-size: 18px; }
      .stage-badge { display: none; }
      .stats-bar { gap: 16px; }
    }

    /* -- No italic anywhere -- */
    em, i { font-style: normal; font-weight: 600; }

    /* -- Reduced motion -- */
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-left">
      ${logoSvg(40)}
      <span class="header-title">${escapeHtml(model.name)}</span>
      ${model.subtitle ? `<span class="header-subtitle">${escapeHtml(model.subtitle)}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:16px;">
      <span class="stage-badge">${escapeHtml(model.stage)}</span>
      <span class="header-date">${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span>
    </div>
  </header>

  <!-- Accent Bar -->
  ${accentBar()}

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat">
      <div class="stat-value">${model.stats.sectionCount}</div>
      <div class="stat-label">Sections</div>
    </div>
    <div class="stat">
      <div class="stat-value">${model.stats.articleCount}</div>
      <div class="stat-label">Articles</div>
    </div>
    <div class="stat">
      <div class="stat-value">${model.stats.connectionCount}</div>
      <div class="stat-label">Connections</div>
    </div>
    <div class="stat">
      <div class="stat-value">${model.stats.gapCount}</div>
      <div class="stat-label">Gaps</div>
    </div>
    ${model.stats.grantCount > 0 ? `<div class="stat">
      <div class="stat-value">${model.stats.grantCount}</div>
      <div class="stat-label">Grants</div>
    </div>` : ''}
  </div>

  <!-- Room Sections -->
  <div class="section">
    <div class="container">
      <h2 class="section-header">ROOM SECTIONS</h2>
      <div class="card-grid">
        ${sectionCards}
      </div>
    </div>
  </div>

  <!-- Footer Accent Bar -->
  ${accentBar()}

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-left">
      ${logoSvg(24)}
      <span class="footer-brand">Built with MindrianOS</span>
    </div>
    <span class="footer-meta">${escapeHtml(dateStr)} | ${model.stats.sectionCount}s, ${model.graph.edges.length}e</span>
  </footer>

</body>
</html>`;
}

/**
 * Write snapshot folder with index.html and manifest.json.
 */
function writeSnapshot(roomDir, model) {
  const exportsDir = path.join(roomDir, 'exports');
  const snapshotDir = path.join(exportsDir, model.timestamp);

  // Create snapshot folder
  fs.mkdirSync(snapshotDir, { recursive: true });

  // -- Write index.html (De Stijl branded template) --
  const html = renderBrandedHtml(model);

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
