#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- SnapshotHub Generator (Phase 51)
 *
 * Freezes a Room into a self-contained folder of 7 co-located HTML views
 * with shared CSS/JS, manifest.json, version history, and MindrianOS signature.
 *
 * Usage: node scripts/generate-snapshot.cjs [ROOM_PATH] [--offline] [--open]
 *
 * Output: room/exports/{YYYY-MM-DD-HHmm}/
 *   index.html          Overview (dashboard)
 *   library.html         Entry browser (wiki)
 *   narrative.html       Deck slides
 *   synthesis.html       Insights + stats
 *   blueprint.html       Diagrams (Mermaid)
 *   constellation.html   Knowledge graph (Cytoscape)
 *   chat.html            Fabric chat (BYOAPI)
 *   shared.css           Shared De Stijl styles
 *   shared.js            Shared navigation + utilities
 *   manifest.json        Room metrics + snapshot metadata
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 *
 * Requirements: SNAP-01, SNAP-02, SNAP-03, SNAP-04
 *               POLISH-01, POLISH-02, POLISH-03, POLISH-04
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// -- Constants --

const SKIP_DIRS = new Set(['.lazygraph', '.sparks', '.snapshots', 'meetings', 'team', 'exports', 'assets', 'personas']);
const SKIP_FILES = new Set([
  'ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', 'JTBD.md',
  'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md',
  'action-items.md', 'assumptions.json', 'ASSET_MANIFEST.md'
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

const THREAD_TYPES = [
  'INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES',
  'BELONGS_TO', 'REASONING_INFORMS', 'HSI_CONNECTION',
  'REVERSE_SALIENT', 'ANALOGOUS_TO', 'STRUCTURALLY_ISOMORPHIC', 'RESOLVES_VIA'
];

const CDN_URLS = {
  cytoscape: 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js',
  flexsearch: 'https://cdn.jsdelivr.net/npm/flexsearch@0.7.43/dist/flexsearch.bundle.min.js',
  mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js',
  chartjs: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  marked: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
};

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

function extractBody(content) {
  // Remove frontmatter and first heading, return body text
  let body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  body = body.replace(/^# .+\n?/, '');
  return body.trim();
}

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function toLabel(dirName) {
  return dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) { return isoStr; }
}

function formatTime(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (_) { return ''; }
}

// -- Core: Scan Room --

function scanRoom(roomDir) {
  const timestamp = formatTimestamp();

  // 1. Read STATE.md
  let name = path.basename(roomDir);
  let stage = 'Discovery';
  let subtitle = '';
  let roomType = 'general';

  const stateFile = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(stateFile)) {
    const stateContent = fs.readFileSync(stateFile, 'utf-8');
    const fm = parseFrontmatter(stateContent);

    if (fm.venture_name) name = fm.venture_name;
    else if (fm.room_name) name = fm.room_name;
    else if (fm.name) name = fm.name;
    else {
      const h1 = stateContent.match(/^# (.+)$/m);
      if (h1) name = h1[1].trim();
    }
    if (fm.venture_stage) stage = fm.venture_stage;
    else if (fm.stage) stage = fm.stage;
    if (fm.subtitle) subtitle = fm.subtitle;
    else if (fm.description) subtitle = fm.description;
    if (fm.room_type) roomType = fm.room_type;
    else if (fm.type) roomType = fm.type;
  }

  // 2. Detect room type from sections if not explicit
  if (roomType === 'general') {
    roomType = detectRoomType(roomDir);
  }

  // 3. Discover sections
  const sections = [];
  let totalEntries = 0;
  let gapCount = 0;

  let dirEntries;
  try {
    dirEntries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_) { dirEntries = []; }

  for (const entry of dirEntries) {
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
        let body = '';
        let fm = {};
        try {
          const content = fs.readFileSync(path.join(sectionDir, f), 'utf-8');
          title = extractTitle(content, f);
          body = extractBody(content);
          fm = parseFrontmatter(content);
        } catch (_) { /* use filename fallback */ }
        articles.push({ filename: f, title, body, frontmatter: fm, section: dirName });
      }
    } catch (_) { /* skip unreadable dirs */ }

    const articleCount = articles.length;
    totalEntries += articleCount;
    const isEmpty = articleCount === 0;
    if (isEmpty) gapCount++;

    // Read section MINTO.md for thesis
    let thesis = '';
    const mintoFile = path.join(sectionDir, 'MINTO.md');
    if (fs.existsSync(mintoFile)) {
      try {
        const mintoContent = fs.readFileSync(mintoFile, 'utf-8');
        const mintoFm = parseFrontmatter(mintoContent);
        thesis = mintoFm.governing_thought || mintoFm.thesis || '';
        if (!thesis) {
          const h1 = mintoContent.match(/^# (.+)$/m);
          if (h1) thesis = h1[1].trim();
        }
      } catch (_) {}
    }

    sections.push({
      id: dirName,
      label: toLabel(dirName),
      color: SECTION_COLORS[dirName] || DEFAULT_COLOR,
      articleCount,
      articles,
      isEmpty,
      thesis
    });
  }

  // 4. Read graph.json
  let graphNodes = [];
  let graphEdges = [];
  let enriched = false;

  const graphFile = path.join(roomDir, 'graph.json');
  if (fs.existsSync(graphFile)) {
    try {
      const graphData = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
      if (graphData.metadata && graphData.metadata.enriched === true) enriched = true;
      if (graphData.elements) {
        graphNodes = graphData.elements.nodes || [];
        graphEdges = graphData.elements.edges || [];
      } else {
        graphNodes = graphData.nodes || [];
        graphEdges = graphData.edges || [];
      }
    } catch (_) {}
  }

  // 5. Count thread types
  const threadCounts = {};
  let surpriseCount = 0;
  let bottleneckCount = 0;
  for (const edge of graphEdges) {
    const type = (edge.data && edge.data.type) || (edge.data && edge.data.label) || 'UNKNOWN';
    threadCounts[type] = (threadCounts[type] || 0) + 1;
    if (type === 'HSI_CONNECTION') surpriseCount++;
    if (type === 'REVERSE_SALIENT') bottleneckCount++;
  }

  // 6. Count signals from intelligence file
  let signalCount = 0;
  const intelFile = path.join(roomDir, 'ROOM-INTELLIGENCE.md');
  if (fs.existsSync(intelFile)) {
    try {
      const content = fs.readFileSync(intelFile, 'utf-8');
      const signalMatches = content.match(/^##?\s/gm);
      signalCount = signalMatches ? signalMatches.length : 0;
    } catch (_) {}
  }

  // 7. Count lenses (personas)
  let lensCount = 0;
  const personaDir = path.join(roomDir, 'personas');
  if (fs.existsSync(personaDir)) {
    try {
      const files = fs.readdirSync(personaDir).filter(f => f.endsWith('.md'));
      lensCount = files.length;
    } catch (_) {}
  }

  // 8. Count conversations
  let conversationCount = 0;
  const meetingsDir = path.join(roomDir, 'meetings');
  if (fs.existsSync(meetingsDir)) {
    try {
      const dirs = fs.readdirSync(meetingsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      conversationCount = dirs.length;
    } catch (_) {}
  }

  // 9. Spectral summary from STATE.md or .lazygraph
  let meanOmhmm = 0;
  let meanSpectralGap = 0;
  // Try reading from state
  if (fs.existsSync(stateFile)) {
    try {
      const stateContent = fs.readFileSync(stateFile, 'utf-8');
      const omhmmMatch = stateContent.match(/om_hmm[:\s]+([0-9.]+)/i);
      const gapMatch = stateContent.match(/spectral_gap[:\s]+([0-9.]+)/i);
      if (omhmmMatch) meanOmhmm = parseFloat(omhmmMatch[1]);
      if (gapMatch) meanSpectralGap = parseFloat(gapMatch[1]);
    } catch (_) {}
  }

  // 10. Section completeness
  const sectionCompleteness = {};
  for (const sec of sections) {
    // A section with 3+ entries is considered 100% for snapshot purposes
    // 0 entries = 0%, 1 = 33%, 2 = 66%, 3+ = 100%
    const pct = sec.articleCount >= 3 ? 100 : Math.round((sec.articleCount / 3) * 100);
    sectionCompleteness[sec.id] = pct;
  }

  // 11. Read version history from .snapshots/
  const versionHistory = readVersionHistory(roomDir);

  return {
    name,
    stage,
    subtitle,
    roomType,
    sections,
    stats: {
      entry_count: totalEntries,
      thread_count: graphEdges.length,
      surprise_count: surpriseCount,
      bottleneck_count: bottleneckCount,
      signal_count: signalCount,
      lens_count: lensCount,
      conversation_count: conversationCount,
      gap_count: gapCount,
      section_count: sections.length
    },
    graph: { nodes: graphNodes, edges: graphEdges, enriched },
    threadCounts,
    spectral: { mean_omhmm: meanOmhmm, mean_spectral_gap: meanSpectralGap },
    sectionCompleteness,
    versionHistory,
    exportDate: new Date().toISOString(),
    timestamp
  };
}

function detectRoomType(roomDir) {
  let dirEntries;
  try { dirEntries = fs.readdirSync(roomDir); } catch (_) { return 'general'; }
  const names = new Set(dirEntries.map(n => n.toLowerCase()));
  if (names.has('clinical-pathway') || names.has('literature') || names.has('methodology')) return 'research';
  if (names.has('components') || names.has('pages') || names.has('user-flows')) return 'website';
  if (names.has('problem-definition') || names.has('business-model') || names.has('market-analysis')) return 'venture';
  return 'general';
}

function readVersionHistory(roomDir) {
  const snapshotsDir = path.join(roomDir, '.snapshots');
  const history = [];
  if (!fs.existsSync(snapshotsDir)) return history;

  try {
    const files = fs.readdirSync(snapshotsDir)
      .filter(f => f.startsWith('STATE-') && f.endsWith('.md'))
      .sort()
      .reverse();

    for (const f of files.slice(0, 20)) { // max 20 entries
      try {
        const content = fs.readFileSync(path.join(snapshotsDir, f), 'utf-8');
        const fm = parseFrontmatter(content);
        history.push({
          file: f,
          date: fm.date || fm.snapshot_date || f.replace('STATE-', '').replace('.md', ''),
          entries: parseInt(fm.entry_count || fm.entries || '0', 10),
          threads: parseInt(fm.thread_count || fm.threads || '0', 10),
          stage: fm.stage || fm.venture_stage || ''
        });
      } catch (_) {}
    }
  } catch (_) {}

  return history;
}

// -- Template Rendering --

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

function accentBar() {
  return `<div class="accent-bar">
  <span class="accent-bar-red"></span>
  <span class="accent-bar-blue"></span>
  <span class="accent-bar-yellow"></span>
  <span class="accent-bar-cream"></span>
  <span class="accent-bar-black"></span>
</div>`;
}

function signatureFooter(model) {
  const dateStr = formatDate(model.exportDate);
  const s = model.stats;
  const summary = `${s.section_count}s ${s.entry_count}e ${s.thread_count}t`;
  return `<!-- Mondrian Bar -->
<div class="mondrian-bar">
  <span style="background:#A63D2F"></span>
  <span style="background:#1E3A6E"></span>
  <span style="background:#C8A43C"></span>
  <span style="background:#F5F0E8"></span>
  <span style="background:#1a1a1a"></span>
</div>
<!-- Signature Footer -->
<footer class="signature-footer">
  <div class="signature-footer-left">
    ${logoSvg(24)}
    <span class="signature-footer-brand">Built with <a href="https://mindrian.ai" target="_blank" rel="noopener">MindrianOS</a></span>
  </div>
  <span class="signature-footer-meta">${escapeHtml(dateStr)} | ${summary}</span>
</footer>`;
}

function headerNav(activeView) {
  const views = [
    { id: 'index', label: 'Overview', file: 'index.html' },
    { id: 'library', label: 'Library', file: 'library.html' },
    { id: 'narrative', label: 'Narrative', file: 'narrative.html' },
    { id: 'synthesis', label: 'Synthesis', file: 'synthesis.html' },
    { id: 'blueprint', label: 'Blueprint', file: 'blueprint.html' },
    { id: 'constellation', label: 'Constellation', file: 'constellation.html' },
    { id: 'chat', label: 'Chat', file: 'chat.html' }
  ];
  return views.map(v =>
    `<a href="${v.file}" class="${v.id === activeView ? 'active' : ''}">${v.label}</a>`
  ).join('\n      ');
}

function pageHead(title, model, extraCdns) {
  const cdns = extraCdns || [];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="MindrianOS SnapshotHub">
  <meta name="description" content="${escapeHtml(model.name)} - ${escapeHtml(title)} - Generated by MindrianOS">
  <title>${escapeHtml(model.name)} - ${escapeHtml(title)} - MindrianOS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  ${cdns.map(url => `<script src="${url}"></script>`).join('\n  ')}`;
}

function pageHeader(model, activeView) {
  return `<header class="snap-header">
    <div class="snap-header-left">
      ${logoSvg(32)}
      <span class="snap-header-title">${escapeHtml(model.name)}</span>
    </div>
    <nav class="snap-header-nav">
      ${headerNav(activeView)}
    </nav>
  </header>
  ${accentBar()}`;
}

function versionSidebar(model) {
  if (!model.versionHistory || model.versionHistory.length === 0) return '';
  const entries = model.versionHistory.map(v => `
    <div class="version-entry">
      <div class="version-date">${escapeHtml(v.date)}</div>
      <div class="version-metric">${v.entries} entries, ${v.threads} threads${v.stage ? ' | ' + escapeHtml(v.stage) : ''}</div>
    </div>`).join('');

  return `<button class="version-sidebar-toggle" onclick="document.getElementById('versionSidebar').classList.toggle('open');this.textContent=this.textContent==='History'?'Close':'History'" aria-label="Toggle version history">History</button>
<aside id="versionSidebar" class="version-sidebar">
  <h3 style="font-family:var(--ds-font-display);font-size:1.25rem;letter-spacing:0.04em;margin-bottom:12px;">VERSION HISTORY</h3>
  ${entries}
</aside>`;
}

// -- View Renderers --

function renderOverview(model) {
  const s = model.stats;
  const sectionCards = model.sections.map(sec => {
    const borderColor = sec.color || DEFAULT_COLOR;
    const countLabel = sec.articleCount === 1 ? '1 entry' : `${sec.articleCount} entries`;
    if (sec.isEmpty) {
      return `<div class="card" style="border-left:3px dashed ${borderColor};opacity:0.5">
        <span class="tag">${escapeHtml(sec.label)}</span>
        <p style="font-size:0.8125rem;color:var(--ds-muted)">No entries yet</p>
      </div>`;
    }
    const articleList = sec.articles.slice(0, 5).map(a =>
      `<li style="font-size:0.8125rem;color:var(--ds-muted);padding:2px 0;border-bottom:1px solid var(--ds-border)">${escapeHtml(a.title)}</li>`
    ).join('');
    return `<div class="card" style="border-left:3px solid ${borderColor}">
      <span class="tag">${escapeHtml(sec.label)}</span>
      <p style="font-family:var(--ds-font-mono);font-size:0.8125rem;color:var(--ds-cream);margin-bottom:6px">${countLabel}</p>
      ${sec.thesis ? `<p style="font-size:0.8125rem;color:var(--ds-yellow-text);margin-bottom:6px">${escapeHtml(sec.thesis)}</p>` : ''}
      <ul style="list-style:none;padding:0">${articleList}</ul>
    </div>`;
  }).join('\n    ');

  return `${pageHead('Overview', model)}
</head>
<body>
  ${pageHeader(model, 'index')}
  ${versionSidebar(model)}

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat"><div class="stat-value">${s.entry_count}</div><div class="stat-label">Entries</div></div>
    <div class="stat"><div class="stat-value">${s.thread_count}</div><div class="stat-label">Threads</div></div>
    <div class="stat"><div class="stat-value">${s.surprise_count}</div><div class="stat-label">Surprises</div></div>
    <div class="stat"><div class="stat-value">${s.bottleneck_count}</div><div class="stat-label">Bottlenecks</div></div>
    <div class="stat"><div class="stat-value">${s.signal_count}</div><div class="stat-label">Signals</div></div>
    <div class="stat"><div class="stat-value">${s.conversation_count}</div><div class="stat-label">Conversations</div></div>
  </div>

  <!-- Section Cards -->
  <div class="section">
    <div class="container">
      <h2 class="section-header">ROOM SECTIONS</h2>
      <div class="card-grid">
        ${sectionCards}
      </div>
    </div>
  </div>

  ${signatureFooter(model)}
  <script src="shared.js"></script>
</body>
</html>`;
}

function renderLibrary(model) {
  // Collect all entries with section info
  const allEntries = [];
  for (const sec of model.sections) {
    for (const art of sec.articles) {
      allEntries.push({ ...art, sectionLabel: sec.label, sectionColor: sec.color });
    }
  }

  const sidebarItems = model.sections.filter(s => !s.isEmpty).map(sec =>
    `<div class="lib-section-group">
      <div style="font-family:var(--ds-font-mono);font-size:0.6875rem;letter-spacing:0.1em;text-transform:uppercase;color:${sec.color};margin-bottom:4px;cursor:pointer" onclick="filterSection('${sec.id}')">${escapeHtml(sec.label)}</div>
      ${sec.articles.map(a => `<a href="#entry-${sec.id}-${a.filename.replace('.md','')}" class="lib-entry-link" style="display:block;font-size:0.8125rem;color:var(--ds-muted);padding:2px 0 2px 8px;text-decoration:none;border-left:2px solid transparent" onmouseover="this.style.borderLeftColor='${sec.color}';this.style.color='var(--ds-cream)'" onmouseout="this.style.borderLeftColor='transparent';this.style.color='var(--ds-muted)'">${escapeHtml(a.title)}</a>`).join('\n      ')}
    </div>`
  ).join('\n    ');

  const entryCards = allEntries.map(e => {
    const bodyPreview = (e.body || '').slice(0, 400).replace(/\n/g, ' ');
    return `<article id="entry-${e.section}-${e.filename.replace('.md','')}" class="lib-entry" data-section="${e.section}">
      <span class="tag" style="color:${e.sectionColor}">${escapeHtml(e.sectionLabel)}</span>
      <h3 style="margin-bottom:6px">${escapeHtml(e.title)}</h3>
      <p style="font-size:0.8125rem;color:var(--ds-muted);line-height:1.5">${escapeHtml(bodyPreview)}${bodyPreview.length >= 400 ? '...' : ''}</p>
    </article>`;
  }).join('\n    ');

  return `${pageHead('Library', model, [CDN_URLS.flexsearch])}
  <style>
    .lib-layout { display:flex; min-height:calc(100vh - 68px); }
    .lib-sidebar { width:240px; padding:16px; border-right:1px solid var(--ds-border); overflow-y:auto; flex-shrink:0; background:var(--ds-surface); }
    .lib-main { flex:1; padding:24px; overflow-y:auto; }
    .lib-search { width:100%; padding:8px 12px; background:var(--ds-bg); border:1px solid var(--ds-border); color:var(--ds-cream); font-family:var(--ds-font-body); font-size:0.875rem; margin-bottom:16px; }
    .lib-entry { padding:16px; border:1px solid var(--ds-border); margin-bottom:12px; background:var(--ds-surface); }
    .lib-section-group { margin-bottom:12px; }
    @media (max-width:767px) {
      .lib-sidebar { display:none; }
      .lib-layout { flex-direction:column; }
    }
  </style>
</head>
<body>
  ${pageHeader(model, 'library')}
  <div class="lib-layout">
    <aside class="lib-sidebar">
      <input type="search" class="lib-search" placeholder="Search entries..." id="libSearch" oninput="searchEntries(this.value)">
      ${sidebarItems}
    </aside>
    <main class="lib-main">
      ${entryCards}
    </main>
  </div>
  ${signatureFooter(model)}
  <script src="shared.js"></script>
  <script>
    function filterSection(sectionId) {
      document.querySelectorAll('.lib-entry').forEach(el => {
        el.style.display = (sectionId === 'all' || el.dataset.section === sectionId) ? '' : 'none';
      });
    }
    function searchEntries(query) {
      const q = query.toLowerCase();
      document.querySelectorAll('.lib-entry').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

function renderNarrative(model) {
  // Build slides from sections with thesis + top entries
  const slides = [];
  // Title slide
  slides.push(`<div class="slide slide-title">
    <div style="text-align:center">
      ${logoSvg(48)}
      <h1 style="font-size:3rem;margin-top:24px">${escapeHtml(model.name)}</h1>
      ${model.subtitle ? `<p style="font-size:1.125rem;color:var(--ds-muted);margin-top:12px">${escapeHtml(model.subtitle)}</p>` : ''}
      <p style="font-family:var(--ds-font-mono);font-size:0.875rem;color:var(--ds-yellow-text);margin-top:24px">${escapeHtml(model.stage)}</p>
    </div>
  </div>`);

  // Section slides
  for (const sec of model.sections) {
    if (sec.isEmpty) continue;
    let content = `<span class="tag" style="color:${sec.color}">${escapeHtml(sec.label)}</span>`;
    if (sec.thesis) {
      content += `<h2 style="margin:16px 0">${escapeHtml(sec.thesis)}</h2>`;
    }
    content += `<ul style="list-style:none;padding:0">`;
    for (const a of sec.articles.slice(0, 3)) {
      const preview = (a.body || '').slice(0, 200).replace(/\n/g, ' ');
      content += `<li style="padding:12px 0;border-bottom:1px solid var(--ds-border)">
        <h3>${escapeHtml(a.title)}</h3>
        <p style="font-size:0.8125rem;color:var(--ds-muted);margin-top:4px">${escapeHtml(preview)}</p>
      </li>`;
    }
    content += `</ul>`;
    slides.push(`<div class="slide">${content}</div>`);
  }

  const slideHtml = slides.map((s, i) =>
    `<div class="slide-container" data-slide="${i}" style="display:${i === 0 ? 'flex' : 'none'}">${s}</div>`
  ).join('\n  ');

  return `${pageHead('Narrative', model)}
  <style>
    .deck-container { width:100%; height:calc(100vh - 68px); display:flex; align-items:center; justify-content:center; position:relative; background:var(--ds-bg); }
    .slide-container { width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding:48px; }
    .slide { max-width:800px; width:100%; }
    .slide-title { display:flex; align-items:center; justify-content:center; }
    .deck-nav { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); display:flex; gap:12px; z-index:10; }
    .deck-nav button { background:var(--ds-surface); border:1px solid var(--ds-border); color:var(--ds-cream); padding:8px 16px; font-family:var(--ds-font-mono); font-size:0.75rem; cursor:pointer; }
    .deck-nav button:hover { border-color:var(--ds-blue); }
    .deck-counter { font-family:var(--ds-font-mono); font-size:0.75rem; color:var(--ds-muted); display:flex; align-items:center; }
    @media (max-width:767px) { .slide-container { padding:24px; } }
  </style>
</head>
<body>
  ${pageHeader(model, 'narrative')}
  <div class="deck-container">
    ${slideHtml}
  </div>
  <div class="deck-nav">
    <button onclick="navigateSlide(-1)">Prev</button>
    <span class="deck-counter" id="slideCounter">1 / ${slides.length}</span>
    <button onclick="navigateSlide(1)">Next</button>
  </div>
  ${signatureFooter(model)}
  <script src="shared.js"></script>
  <script>
    let currentSlide = 0;
    const totalSlides = ${slides.length};
    function navigateSlide(dir) {
      const slides = document.querySelectorAll('.slide-container');
      slides[currentSlide].style.display = 'none';
      currentSlide = Math.max(0, Math.min(totalSlides - 1, currentSlide + dir));
      slides[currentSlide].style.display = 'flex';
      document.getElementById('slideCounter').textContent = (currentSlide + 1) + ' / ' + totalSlides;
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === ' ') navigateSlide(1);
      if (e.key === 'ArrowLeft') navigateSlide(-1);
    });
  </script>
</body>
</html>`;
}

function renderSynthesis(model) {
  const s = model.stats;

  // Section completeness bars
  const completeBars = model.sections.map(sec => {
    const pct = model.sectionCompleteness[sec.id] || 0;
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px">
        <span style="color:var(--ds-cream)">${escapeHtml(sec.label)}</span>
        <span style="color:var(--ds-muted);font-family:var(--ds-font-mono)">${pct}%</span>
      </div>
      <div style="height:6px;background:var(--ds-bg);width:100%">
        <div style="height:100%;width:${pct}%;background:${sec.color};transition:width 0.3s"></div>
      </div>
    </div>`;
  }).join('');

  // Thread type breakdown
  const threadBreakdown = Object.entries(model.threadCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) =>
      `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--ds-border)">
        <span style="font-size:0.8125rem;color:var(--ds-cream)">${escapeHtml(type)}</span>
        <span style="font-family:var(--ds-font-mono);font-size:0.8125rem;color:var(--ds-muted)">${count}</span>
      </div>`
    ).join('');

  return `${pageHead('Synthesis', model, [CDN_URLS.chartjs])}
</head>
<body>
  ${pageHeader(model, 'synthesis')}

  <!-- Stats Counters -->
  <div class="stats-bar">
    <div class="stat"><div class="stat-value">${s.entry_count}</div><div class="stat-label">Entries</div></div>
    <div class="stat"><div class="stat-value">${s.thread_count}</div><div class="stat-label">Threads</div></div>
    <div class="stat"><div class="stat-value">${s.surprise_count}</div><div class="stat-label">Surprises</div></div>
    <div class="stat"><div class="stat-value">${s.bottleneck_count}</div><div class="stat-label">Bottlenecks</div></div>
    <div class="stat"><div class="stat-value">${s.lens_count}</div><div class="stat-label">Lenses</div></div>
  </div>

  <div class="section">
    <div class="container">
      <div style="display:grid;grid-template-columns:1fr;gap:24px">

        <!-- Section Completeness -->
        <div class="card" style="padding:24px">
          <h2 class="section-header">SECTION COMPLETENESS</h2>
          ${completeBars}
        </div>

        <!-- Thread Breakdown -->
        <div class="card" style="padding:24px">
          <h2 class="section-header">THREAD BREAKDOWN</h2>
          ${threadBreakdown || '<p style="color:var(--ds-muted)">No threads detected yet.</p>'}
        </div>

        <!-- Spectral Summary -->
        <div class="card" style="padding:24px">
          <h2 class="section-header">SPECTRAL SUMMARY</h2>
          <div style="display:flex;gap:48px;margin-top:12px">
            <div>
              <div style="font-family:var(--ds-font-mono);font-size:1.5rem;color:var(--ds-cream)">${model.spectral.mean_omhmm.toFixed(2)}</div>
              <div style="font-size:0.625rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--ds-muted)">Mean OM-HMM</div>
            </div>
            <div>
              <div style="font-family:var(--ds-font-mono);font-size:1.5rem;color:var(--ds-cream)">${model.spectral.mean_spectral_gap.toFixed(2)}</div>
              <div style="font-size:0.625rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--ds-muted)">Mean Spectral Gap</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  ${signatureFooter(model)}
  <script src="shared.js"></script>
</body>
</html>`;
}

function renderBlueprint(model) {
  // Generate Mermaid diagram from graph edges
  let mermaidDef = 'graph LR\n';
  const nodeIds = new Set();

  for (const sec of model.sections) {
    const nodeId = sec.id.replace(/-/g, '_');
    nodeIds.add(nodeId);
    mermaidDef += `  ${nodeId}["${sec.label}"]\n`;
  }

  // Add edges from graph data
  const addedEdges = new Set();
  for (const edge of model.graph.edges) {
    const d = edge.data || {};
    let src = (d.source || '').replace(/-/g, '_');
    let tgt = (d.target || '').replace(/-/g, '_');
    if (!src || !tgt) continue;
    const edgeKey = `${src}-${tgt}`;
    if (addedEdges.has(edgeKey)) continue;
    addedEdges.add(edgeKey);
    const label = d.type || d.label || '';
    mermaidDef += `  ${src} -->|${label}| ${tgt}\n`;
  }

  // If no edges, create section-only connections
  if (model.graph.edges.length === 0 && model.sections.length > 1) {
    for (let i = 0; i < model.sections.length - 1; i++) {
      const a = model.sections[i].id.replace(/-/g, '_');
      const b = model.sections[i + 1].id.replace(/-/g, '_');
      mermaidDef += `  ${a} --> ${b}\n`;
    }
  }

  return `${pageHead('Blueprint', model, [CDN_URLS.mermaid])}
  <style>
    .blueprint-container { padding:48px 24px; display:flex; justify-content:center; min-height:calc(100vh - 200px); }
    .mermaid { max-width:100%; overflow-x:auto; }
    @media (max-width:767px) { .blueprint-container { padding:24px 12px; } }
  </style>
</head>
<body>
  ${pageHeader(model, 'blueprint')}

  <div class="section">
    <div class="container">
      <h2 class="section-header">ROOM ARCHITECTURE</h2>
    </div>
  </div>

  <div class="blueprint-container">
    <pre class="mermaid">
${mermaidDef}
    </pre>
  </div>

  ${signatureFooter(model)}
  <script src="shared.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1E3A6E',
        primaryTextColor: '#f5f1e8',
        primaryBorderColor: '#404040',
        lineColor: '#C8A43C',
        secondaryColor: '#2d2d2d',
        tertiaryColor: '#3a3a3a',
        background: '#1a1a1a',
        mainBkg: '#2d2d2d',
        nodeBorder: '#404040',
        clusterBkg: '#2d2d2d',
        titleColor: '#f5f1e8',
        edgeLabelBackground: '#2d2d2d'
      }
    });
  </script>
</body>
</html>`;
}

function renderConstellation(model) {
  // Prepare Cytoscape elements
  const cyElements = JSON.stringify({
    nodes: model.graph.nodes.length > 0
      ? model.graph.nodes
      : model.sections.map(s => ({
          data: { id: s.id, label: s.label, type: 'section', color: s.color }
        })),
    edges: model.graph.edges
  });

  const threadColors = {
    'INFORMS': '#4A7BC8',
    'CONTRADICTS': '#C95A4A',
    'CONVERGES': '#C8A43C',
    'ENABLES': '#4A9B72',
    'INVALIDATES': '#D4804A',
    'BELONGS_TO': '#5C5A56',
    'REASONING_INFORMS': '#9B7EB5',
    'HSI_CONNECTION': '#4A9B8E',
    'REVERSE_SALIENT': '#A63D2F',
    'ANALOGOUS_TO': '#C87137',
    'STRUCTURALLY_ISOMORPHIC': '#6B4E8B',
    'RESOLVES_VIA': '#2D6B4A'
  };

  return `${pageHead('Constellation', model, [CDN_URLS.cytoscape])}
  <style>
    .cy-container { width:100%; height:calc(100vh - 132px); background:var(--ds-bg); }
    .cy-sidebar { position:fixed; top:68px; left:0; width:200px; background:var(--ds-surface); border-right:1px solid var(--ds-border); padding:12px; z-index:80; height:calc(100vh - 68px); overflow-y:auto; }
    .cy-filter { display:flex; align-items:center; gap:6px; padding:4px 0; font-size:0.75rem; color:var(--ds-muted); cursor:pointer; }
    .cy-filter input { accent-color:var(--ds-blue); }
    .cy-filter:hover { color:var(--ds-cream); }
    @media (max-width:767px) { .cy-sidebar { display:none; } .cy-container { height:calc(100vh - 68px); } }
  </style>
</head>
<body>
  ${pageHeader(model, 'constellation')}

  <aside class="cy-sidebar">
    <h3 style="font-family:var(--ds-font-display);font-size:1rem;letter-spacing:0.04em;margin-bottom:8px">THREADS</h3>
    ${THREAD_TYPES.map(t => `<label class="cy-filter">
      <input type="checkbox" checked data-thread="${t}" onchange="toggleThread('${t}', this.checked)">
      <span style="width:8px;height:8px;background:${threadColors[t] || '#5C5A56'};display:inline-block"></span>
      ${t.replace(/_/g, ' ')}
    </label>`).join('\n    ')}
  </aside>

  <div id="cy" class="cy-container" style="margin-left:200px"></div>

  ${signatureFooter(model)}
  <script src="shared.js"></script>
  <script>
    const elements = ${cyElements};
    const threadColors = ${JSON.stringify(threadColors)};

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: [...(elements.nodes || []), ...(elements.edges || [])],
      style: [
        { selector: 'node', style: {
          'label': 'data(label)',
          'background-color': function(ele) { return ele.data('color') || '#4A7BC8'; },
          'color': '#f5f1e8',
          'font-size': '10px',
          'font-family': 'Inter, sans-serif',
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'width': 24,
          'height': 24,
          'border-width': 1,
          'border-color': '#404040'
        }},
        { selector: 'edge', style: {
          'line-color': function(ele) { return threadColors[ele.data('type') || ele.data('label')] || '#5C5A56'; },
          'target-arrow-color': function(ele) { return threadColors[ele.data('type') || ele.data('label')] || '#5C5A56'; },
          'target-arrow-shape': 'triangle',
          'width': 1.5,
          'opacity': 0.7,
          'curve-style': 'bezier'
        }},
        { selector: 'edge[type="ANALOGOUS_TO"], edge[label="ANALOGOUS_TO"]', style: {
          'line-style': 'dashed',
          'line-dash-pattern': [6, 3]
        }}
      ],
      layout: { name: 'cose', animate: false, padding: 40 }
    });

    function toggleThread(type, visible) {
      cy.edges().forEach(edge => {
        const edgeType = edge.data('type') || edge.data('label');
        if (edgeType === type) {
          if (visible) edge.show(); else edge.hide();
        }
      });
    }
  </script>
</body>
</html>`;
}

function renderChat(model) {
  return `${pageHead('Chat', model, [CDN_URLS.marked])}
  <style>
    .chat-layout { display:flex; height:calc(100vh - 68px); }
    .chat-main { flex:1; display:flex; flex-direction:column; }
    .chat-messages { flex:1; overflow-y:auto; padding:24px; }
    .chat-input-area { padding:16px 24px; border-top:1px solid var(--ds-border); background:var(--ds-surface); display:flex; gap:8px; }
    .chat-input { flex:1; padding:10px 14px; background:var(--ds-bg); border:1px solid var(--ds-border); color:var(--ds-cream); font-family:var(--ds-font-body); font-size:0.875rem; resize:none; }
    .chat-send { background:var(--ds-blue); color:var(--ds-cream); border:none; padding:10px 20px; font-family:var(--ds-font-mono); font-size:0.75rem; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; }
    .chat-send:hover { filter:brightness(1.2); }
    .chat-msg { margin-bottom:16px; padding:12px 16px; max-width:80%; }
    .chat-msg-user { background:var(--ds-surface); border:1px solid var(--ds-border); margin-left:auto; }
    .chat-msg-ai { background:var(--ds-elevated); border:1px solid var(--ds-blue); border-left:3px solid var(--ds-blue); }
    .chat-msg p { font-size:0.875rem; color:var(--ds-cream); line-height:1.6; }
    .chat-api-notice { text-align:center; padding:48px; color:var(--ds-muted); }
    .chat-api-notice code { font-family:var(--ds-font-mono); color:var(--ds-teal-text); background:var(--ds-bg); padding:2px 6px; }
    .chat-settings { position:fixed; top:80px; right:12px; z-index:91; }
    .chat-settings button { background:var(--ds-surface); border:1px solid var(--ds-border); color:var(--ds-muted); font-family:var(--ds-font-mono); font-size:0.6875rem; padding:6px 10px; cursor:pointer; letter-spacing:0.08em; text-transform:uppercase; }
    .chat-settings button:hover { color:var(--ds-cream); border-color:var(--ds-blue); }
    .modal-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:200; justify-content:center; align-items:center; }
    .modal-overlay.open { display:flex; }
    .modal { background:var(--ds-surface); border:1px solid var(--ds-border); padding:32px; max-width:480px; width:90%; }
    .modal h3 { font-family:var(--ds-font-display); font-size:1.25rem; margin-bottom:16px; }
    .modal input { width:100%; padding:10px; background:var(--ds-bg); border:1px solid var(--ds-border); color:var(--ds-cream); font-family:var(--ds-font-mono); font-size:0.875rem; margin-bottom:12px; }
    .modal button { background:var(--ds-blue); color:var(--ds-cream); border:none; padding:8px 20px; cursor:pointer; font-family:var(--ds-font-mono); font-size:0.75rem; }
    @media (max-width:767px) { .chat-msg { max-width:95%; } .chat-input-area { padding:12px; } }
  </style>
</head>
<body>
  ${pageHeader(model, 'chat')}

  <div class="chat-settings">
    <button onclick="document.getElementById('apiModal').classList.add('open')">API Key</button>
  </div>

  <div id="apiModal" class="modal-overlay">
    <div class="modal">
      <h3>CLAUDE API KEY</h3>
      <p style="font-size:0.8125rem;color:var(--ds-muted);margin-bottom:12px">Your key is stored in localStorage only. Never transmitted to any server.</p>
      <input type="password" id="apiKeyInput" placeholder="sk-ant-..." value="">
      <button onclick="saveApiKey()">Save</button>
      <button onclick="document.getElementById('apiModal').classList.remove('open')" style="background:var(--ds-surface);border:1px solid var(--ds-border);margin-left:8px">Cancel</button>
    </div>
  </div>

  <div class="chat-layout">
    <div class="chat-main">
      <div class="chat-messages" id="chatMessages">
        <div class="chat-api-notice" id="apiNotice">
          <p style="font-size:1rem;margin-bottom:8px">Fabric Chat requires a Claude API key</p>
          <p>Click <code>API Key</code> above to configure. Your key stays in your browser - never leaves this page.</p>
          <p style="margin-top:16px;font-size:0.8125rem">Room data: ${model.stats.entry_count} entries, ${model.stats.thread_count} threads across ${model.stats.section_count} sections.</p>
        </div>
      </div>
      <div class="chat-input-area">
        <textarea class="chat-input" id="chatInput" rows="1" placeholder="Ask about your Room..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>
        <button class="chat-send" onclick="sendMessage()">Send</button>
      </div>
    </div>
  </div>

  ${signatureFooter(model)}
  <script src="shared.js"></script>
  <script>
    // Room context for chat
    const roomContext = ${JSON.stringify({
      name: model.name,
      type: model.roomType,
      stats: model.stats,
      sections: model.sections.map(s => ({ id: s.id, label: s.label, entries: s.articleCount, thesis: s.thesis })),
      spectral: model.spectral
    })};

    function getApiKey() { return localStorage.getItem('mos_claude_api_key') || ''; }
    function saveApiKey() {
      const key = document.getElementById('apiKeyInput').value.trim();
      if (key) { localStorage.setItem('mos_claude_api_key', key); }
      document.getElementById('apiModal').classList.remove('open');
      if (key) document.getElementById('apiNotice').style.display = 'none';
    }

    // Load saved key
    (function() {
      const saved = getApiKey();
      if (saved) {
        document.getElementById('apiKeyInput').value = saved;
        document.getElementById('apiNotice').style.display = 'none';
      }
    })();

    function addMessage(text, isUser) {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (isUser ? 'chat-msg-user' : 'chat-msg-ai');
      div.innerHTML = '<p>' + (isUser ? escapeHtmlChat(text) : text) + '</p>';
      document.getElementById('chatMessages').appendChild(div);
      div.scrollIntoView({ behavior: 'smooth' });
    }

    function escapeHtmlChat(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    async function sendMessage() {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      const key = getApiKey();
      if (!key) {
        document.getElementById('apiModal').classList.add('open');
        return;
      }

      addMessage(text, true);

      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: 'You are Larry, the MindrianOS AI co-founder. You are answering questions about a Room called "' + roomContext.name + '" (type: ' + roomContext.type + '). Room stats: ' + JSON.stringify(roomContext.stats) + '. Sections: ' + JSON.stringify(roomContext.sections) + '. Be concise, insightful, and grounded in the Room data.',
            messages: [{ role: 'user', content: text }]
          })
        });
        const data = await resp.json();
        if (data.content && data.content[0]) {
          addMessage(data.content[0].text, false);
        } else if (data.error) {
          addMessage('Error: ' + (data.error.message || JSON.stringify(data.error)), false);
        }
      } catch (err) {
        addMessage('Connection error: ' + err.message, false);
      }
    }
  </script>
</body>
</html>`;
}

// -- Shared JS --

function generateSharedJs() {
  return `/* MindrianOS SnapshotHub - Shared JavaScript */
(function() {
  'use strict';

  // Highlight active nav link based on current filename
  var currentFile = window.location.pathname.split('/').pop() || 'index.html';
  var links = document.querySelectorAll('.snap-header-nav a');
  links.forEach(function(a) {
    var href = a.getAttribute('href');
    if (href === currentFile) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });

  // Keyboard shortcut: press 'v' to toggle version sidebar
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'v') {
      var sidebar = document.getElementById('versionSidebar');
      if (sidebar) sidebar.classList.toggle('open');
    }
  });
})();
`;
}

// -- Write Snapshot --

function writeSnapshot(roomDir, model, offline) {
  const exportsDir = path.join(roomDir, 'exports');
  const snapshotDir = path.join(exportsDir, model.timestamp);

  fs.mkdirSync(snapshotDir, { recursive: true });

  // 1. Write shared.css
  const sharedCssSource = path.join(__dirname, '..', 'templates', 'shared.css');
  if (fs.existsSync(sharedCssSource)) {
    fs.copyFileSync(sharedCssSource, path.join(snapshotDir, 'shared.css'));
  } else {
    // Fallback: generate minimal shared.css inline
    fs.writeFileSync(path.join(snapshotDir, 'shared.css'), '/* shared.css - see templates/shared.css */\n', 'utf-8');
  }

  // 2. Write shared.js
  fs.writeFileSync(path.join(snapshotDir, 'shared.js'), generateSharedJs(), 'utf-8');

  // 3. Write all 7 views
  const views = {
    'index.html': renderOverview(model),
    'library.html': renderLibrary(model),
    'narrative.html': renderNarrative(model),
    'synthesis.html': renderSynthesis(model),
    'blueprint.html': renderBlueprint(model),
    'constellation.html': renderConstellation(model),
    'chat.html': renderChat(model)
  };

  for (const [filename, html] of Object.entries(views)) {
    let content = html;
    if (offline) {
      content = inlineOfflineDeps(content);
    }
    fs.writeFileSync(path.join(snapshotDir, filename), content, 'utf-8');
  }

  // 4. Write manifest.json (SNAP-03)
  const manifest = {
    version: 2,
    room_type: model.roomType,
    generated_at: model.exportDate,
    room_path: roomDir,
    room_name: model.name,
    stage: model.stage,
    metrics: {
      entry_count: model.stats.entry_count,
      thread_count: model.stats.thread_count,
      surprise_count: model.stats.surprise_count,
      bottleneck_count: model.stats.bottleneck_count,
      signal_count: model.stats.signal_count,
      lens_count: model.stats.lens_count,
      conversation_count: model.stats.conversation_count,
      section_count: model.stats.section_count,
      gap_count: model.stats.gap_count
    },
    section_completeness: model.sectionCompleteness,
    spectral: model.spectral,
    thread_counts: model.threadCounts,
    files: Object.keys(views).concat(['shared.css', 'shared.js', 'manifest.json']),
    version_history: model.versionHistory
  };

  fs.writeFileSync(
    path.join(snapshotDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  // 5. Also update/create the exports-level manifest for history tracking
  const exportManifestPath = path.join(exportsDir, 'manifest.json');
  let exportManifest;
  if (fs.existsSync(exportManifestPath)) {
    try {
      exportManifest = JSON.parse(fs.readFileSync(exportManifestPath, 'utf-8'));
      if (!Array.isArray(exportManifest.snapshots)) exportManifest.snapshots = [];
    } catch (_) {
      exportManifest = { version: 2, snapshots: [] };
    }
  } else {
    exportManifest = { version: 2, snapshots: [] };
  }

  exportManifest.snapshots.push({
    timestamp: model.timestamp,
    date: model.exportDate,
    room_name: model.name,
    metrics: manifest.metrics,
    files: manifest.files
  });

  fs.writeFileSync(exportManifestPath, JSON.stringify(exportManifest, null, 2), 'utf-8');

  return snapshotDir;
}

// -- Offline Inlining (POLISH-02) --

function inlineOfflineDeps(html) {
  // Replace CDN script tags with inline scripts
  // This is a best-effort approach using Node.js https/http
  // In practice, the user would need network at build time for --offline
  for (const [name, url] of Object.entries(CDN_URLS)) {
    const scriptTag = `<script src="${url}"></script>`;
    if (!html.includes(scriptTag)) continue;

    try {
      // Use execSync to fetch the CDN content
      const content = execSync(`node -e "
        const https = require('https');
        const http = require('http');
        const mod = '${url}'.startsWith('https') ? https : http;
        mod.get('${url}', res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => process.stdout.write(data));
        }).on('error', () => process.exit(1));
      "`, { timeout: 15000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

      if (content && content.length > 100) {
        html = html.replace(scriptTag, `<script>/* ${name} - inlined for offline */\n${content}</script>`);
      }
    } catch (_) {
      // If fetch fails, keep CDN reference
      console.warn(`  Warning: Could not inline ${name} for offline mode`);
    }
  }

  return html;
}

// -- Main --

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/generate-snapshot.cjs [ROOM_PATH] [--offline] [--open]');
    console.log('');
    console.log('  ROOM_PATH   Path to room directory (default: ./room)');
    console.log('  --offline   Inline all CDN dependencies for offline use');
    console.log('  --open      Open snapshot in browser after generation');
    console.log('');
    console.log('Produces a timestamped SnapshotHub folder in ROOM_PATH/exports/');
    console.log('containing 7 co-located HTML views + shared CSS/JS + manifest.json.');
    process.exit(0);
  }

  const offline = args.includes('--offline');
  const openAfter = args.includes('--open');
  const roomDir = path.resolve(args.filter(a => !a.startsWith('--'))[0] || './room');

  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    process.stderr.write(`Error: Room directory not found: ${roomDir}\n`);
    process.exit(1);
  }

  console.log(`Scanning room: ${roomDir}`);
  if (offline) console.log('  Mode: offline (inlining CDN deps)');

  const model = scanRoom(roomDir);
  const snapshotDir = writeSnapshot(roomDir, model, offline);

  // Summary output
  const s = model.stats;
  console.log('');
  console.log(`SnapshotHub generated: 7 views, ${s.entry_count} entries, ${s.thread_count} threads`);
  console.log(`  Location: ${snapshotDir}`);
  console.log(`  Room: ${model.name} (${model.roomType})`);
  console.log(`  Stage: ${model.stage}`);
  console.log(`  Sections: ${s.section_count} | Entries: ${s.entry_count} | Threads: ${s.thread_count}`);
  console.log(`  Surprises: ${s.surprise_count} | Bottlenecks: ${s.bottleneck_count} | Signals: ${s.signal_count}`);
  console.log(`  Lenses: ${s.lens_count} | Conversations: ${s.conversation_count}`);
  if (model.versionHistory.length > 0) {
    console.log(`  Version history: ${model.versionHistory.length} snapshots`);
  }
  console.log(`  Open: file://${snapshotDir}/index.html`);

  // --open flag
  if (openAfter) {
    try {
      const url = `file://${snapshotDir}/index.html`;
      const platform = process.platform;
      if (platform === 'darwin') execSync(`open "${url}"`);
      else if (platform === 'win32') execSync(`start "${url}"`);
      else execSync(`xdg-open "${url}" 2>/dev/null || echo "Open: ${url}"`);
    } catch (_) {
      console.log('  (Could not auto-open browser)');
    }
  }
}

main();
