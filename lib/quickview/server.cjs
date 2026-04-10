#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Quick-View Server
 * Lightweight Node.js http server that serves an interactive project dashboard
 * on localhost. Designed to make the filesystem INVISIBLE to users.
 *
 * Users see: "Blueprint Phase: 7 entries, biggest gap is Business Model"
 * Users never see: room/business-model/ -- 0 entries
 *
 * Usage: node lib/quickview/server.cjs [ROOM_DIR] [PORT]
 * Or: require('./server.cjs').start(roomDir, port)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');

// ── Config ──

const SECTION_META = {
  'problem-definition':    { label: 'Problem',        color: '#A63D2F', icon: '?' },
  'market-analysis':       { label: 'Market',         color: '#C8A43C', icon: '~' },
  'solution-design':       { label: 'Solution',       color: '#5C5A56', icon: '*' },
  'business-model':        { label: 'Business Model', color: '#2D6B4A', icon: '#' },
  'competitive-analysis':  { label: 'Competition',    color: '#B5602A', icon: '!' },
  'team-execution':        { label: 'Team',           color: '#1E3A6E', icon: '+' },
  'legal-ip':              { label: 'Legal & IP',     color: '#6B4E8B', icon: '&' },
  'financial-model':       { label: 'Financials',     color: '#2A6B5E', icon: '$' },
  'opportunity-bank':      { label: 'Opportunities',  color: '#C87137', icon: '@' },
  'funding':               { label: 'Funding',        color: '#3A7B5E', icon: '%' },
};

const SKIP_DIRS = new Set(['.mindrian', 'meetings', 'team', 'exports', '.context', '.planning', 'personas']);
const SKIP_FILES = new Set(['ROOM.md', 'STATE.md', 'MINTO.md', 'USER.md', 'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md']);

// ── Room Data Collection ──

function collectRoomData(roomDir) {
  const data = {
    name: 'Untitled Project',
    stage: 'Pre-opportunity',
    sections: [],
    totalEntries: 0,
    meetings: 0,
    intelligence: { gaps: [], convergence: [], contradictions: [] },
    recentArtifacts: [],
    generatedAt: new Date().toISOString(),
  };

  // Read STATE.md for venture name and stage
  const statePath = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(statePath)) {
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    const nameMatch = stateContent.match(/venture_name:\s*["']?(.+?)["']?\s*$/m);
    const stageMatch = stateContent.match(/venture_stage:\s*["']?(.+?)["']?\s*$/m);
    if (nameMatch) data.name = nameMatch[1].trim();
    if (stageMatch) data.stage = stageMatch[1].trim();
  }

  // Scan sections
  const entries = fs.readdirSync(roomDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const sectionDir = path.join(roomDir, entry.name);
    const meta = SECTION_META[entry.name] || { label: entry.name, color: '#5C5A56', icon: '-' };

    const artifacts = [];
    try {
      const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));
      for (const file of files) {
        const filePath = path.join(sectionDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const titleMatch = content.match(/^# (.+)$/m);
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        artifacts.push({
          title: titleMatch ? titleMatch[1].trim() : file.replace('.md', ''),
          date: dateMatch ? dateMatch[1] : null,
          file: file,
          size: content.length,
        });
        data.recentArtifacts.push({
          title: titleMatch ? titleMatch[1].trim() : file.replace('.md', ''),
          section: meta.label,
          sectionColor: meta.color,
          date: dateMatch ? dateMatch[1] : null,
        });
      }
    } catch (e) { /* empty section */ }

    data.sections.push({
      id: entry.name,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      entryCount: artifacts.length,
      artifacts: artifacts,
    });
    data.totalEntries += artifacts.length;
  }

  // Sort recent artifacts by date (newest first)
  data.recentArtifacts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  data.recentArtifacts = data.recentArtifacts.slice(0, 8);

  // Count meetings
  const meetingsDir = path.join(roomDir, 'meetings');
  if (fs.existsSync(meetingsDir)) {
    data.meetings = fs.readdirSync(meetingsDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).length;
  }

  // Simple intelligence
  const activeSections = data.sections.filter(s => s.entryCount > 0).length;
  const emptySections = data.sections.filter(s => s.entryCount === 0);
  const singleEntrySections = data.sections.filter(s => s.entryCount === 1);

  for (const s of emptySections) {
    data.intelligence.gaps.push({ section: s.label, color: s.color, type: 'empty', message: `${s.label} has no entries` });
  }
  for (const s of singleEntrySections) {
    data.intelligence.gaps.push({ section: s.label, color: s.color, type: 'thin', message: `${s.label} has only 1 entry -- single lens` });
  }

  return data;
}

// ── HTML Template ──

function buildDashboardHTML(data) {
  const sectionsHTML = data.sections.map(s => {
    const pct = data.totalEntries > 0 ? Math.round((s.entryCount / Math.max(...data.sections.map(x => x.entryCount), 1)) * 100) : 0;
    const artifactListHTML = s.artifacts.map(a =>
      `<div class="artifact-item"><span class="artifact-dot" style="background:${s.color}"></span><span class="artifact-title">${a.title}</span>${a.date ? `<span class="artifact-date">${a.date}</span>` : ''}</div>`
    ).join('');

    return `
      <div class="section-card" style="border-left: 4px solid ${s.color}">
        <div class="section-header">
          <div class="section-name">${s.label}</div>
          <div class="section-count" style="color:${s.color}">${s.entryCount}</div>
        </div>
        <div class="section-bar-track">
          <div class="section-bar-fill" style="width:${pct}%;background:${s.color}"></div>
        </div>
        ${s.entryCount > 0 ? `<div class="artifact-list">${artifactListHTML}</div>` : '<div class="empty-label">No entries yet</div>'}
      </div>`;
  }).join('');

  const gapsHTML = data.intelligence.gaps.map(g =>
    `<div class="signal-item signal-gap"><span class="signal-dot" style="background:${g.color}"></span>${g.message}</div>`
  ).join('');

  const recentHTML = data.recentArtifacts.map(a =>
    `<div class="recent-item"><span class="recent-dot" style="background:${a.sectionColor}"></span><span class="recent-title">${a.title}</span><span class="recent-section">${a.section}</span></div>`
  ).join('');

  const activeSections = data.sections.filter(s => s.entryCount > 0).length;
  const totalSections = data.sections.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.name} -- MindrianOS Quick View</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
:root {
  --ds-bg: #0D0D0D;
  --ds-surface: #1A1A1A;
  --ds-elevated: #242424;
  --ds-cream: #F5F1E8;
  --ds-muted: #A8A39F;
  --ds-text: #D4CFC7;
  --ds-border: #2A2A2A;
  --ds-red: #A63D2F;
  --ds-blue: #1E3A6E;
  --ds-yellow: #C8A43C;
  --ds-green: #2D6B4A;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
* { border-radius: 0 !important; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--ds-bg);
  color: var(--ds-cream);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* ── Header ── */
.header {
  background: var(--ds-surface);
  border-bottom: 3px solid var(--ds-yellow);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.header-left { display: flex; align-items: baseline; gap: 16px; }
.project-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  letter-spacing: 0.04em;
  color: var(--ds-cream);
}
.stage-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ds-yellow);
  border: 1px solid var(--ds-yellow);
  padding: 4px 12px;
}
.header-stats {
  display: flex;
  gap: 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: var(--ds-muted);
}
.stat-value { color: var(--ds-cream); font-weight: 600; }
.brand-mark {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--ds-muted);
  opacity: 0.5;
}

/* ── Layout ── */
.main { display: grid; grid-template-columns: 1fr 340px; gap: 0; min-height: calc(100vh - 80px); }
@media (max-width: 900px) { .main { grid-template-columns: 1fr; } }

/* ── Sections Grid ── */
.sections-panel { padding: 24px; }
.panel-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  color: var(--ds-muted);
  margin-bottom: 16px;
  text-transform: uppercase;
}
.sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.section-card {
  background: var(--ds-surface);
  padding: 16px;
  transition: background 150ms ease;
  cursor: default;
}
.section-card:hover { background: var(--ds-elevated); }
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.section-name {
  font-weight: 600;
  font-size: 0.9rem;
}
.section-count {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.5rem;
}
.section-bar-track {
  height: 3px;
  background: var(--ds-border);
  margin-bottom: 10px;
}
.section-bar-fill {
  height: 100%;
  transition: width 600ms ease;
}
.artifact-list { margin-top: 6px; }
.artifact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.8rem;
  color: var(--ds-text);
}
.artifact-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
}
.artifact-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.artifact-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: var(--ds-muted);
}
.empty-label {
  font-size: 0.8rem;
  color: var(--ds-muted);
  font-style: normal;
  opacity: 0.6;
  margin-top: 4px;
}

/* ── Sidebar ── */
.sidebar {
  background: var(--ds-surface);
  border-left: 3px solid var(--ds-border);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.signal-section { }
.signal-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  font-size: 0.8rem;
  color: var(--ds-text);
  border-bottom: 1px solid var(--ds-border);
}
.signal-item:last-child { border-bottom: none; }
.signal-dot {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  flex-shrink: 0;
}
.signal-gap .signal-dot { opacity: 0.4; }

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 0.8rem;
  border-bottom: 1px solid var(--ds-border);
}
.recent-item:last-child { border-bottom: none; }
.recent-dot { width: 6px; height: 6px; flex-shrink: 0; }
.recent-title { flex: 1; color: var(--ds-cream); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-section {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--ds-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Suggestions ── */
.suggestions { margin-top: auto; }
.suggest-item {
  display: block;
  background: var(--ds-elevated);
  border-left: 3px solid var(--ds-yellow);
  padding: 12px;
  margin-bottom: 8px;
  text-decoration: none;
  color: var(--ds-cream);
  font-size: 0.8rem;
  transition: background 150ms ease;
  cursor: pointer;
}
.suggest-item:hover { background: #2D2D2D; }
.suggest-label {
  font-size: 0.65rem;
  font-family: 'JetBrains Mono', monospace;
  color: var(--ds-yellow);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

/* ── Footer ── */
.footer {
  grid-column: 1 / -1;
  text-align: center;
  padding: 12px;
  font-size: 0.65rem;
  font-family: 'JetBrains Mono', monospace;
  color: var(--ds-muted);
  opacity: 0.4;
  border-top: 1px solid var(--ds-border);
}

/* ── Auto-refresh pulse ── */
@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
.live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--ds-green);
  margin-right: 6px;
  animation: pulse 2s ease infinite;
}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="project-name">${data.name}</div>
    <div class="stage-badge">${data.stage}</div>
  </div>
  <div class="header-stats">
    <div><span class="stat-value">${data.totalEntries}</span> entries</div>
    <div><span class="stat-value">${activeSections}/${totalSections}</span> sections</div>
    <div><span class="stat-value">${data.meetings}</span> meetings</div>
  </div>
  <div class="brand-mark">MINDRANOS</div>
</div>

<div class="main">
  <div class="sections-panel">
    <div class="panel-title">Your Project</div>
    <div class="sections-grid">
      ${sectionsHTML}
    </div>
  </div>

  <div class="sidebar">
    ${data.intelligence.gaps.length > 0 ? `
    <div class="signal-section">
      <div class="panel-title">Gaps to Fill</div>
      ${gapsHTML}
    </div>` : ''}

    ${data.recentArtifacts.length > 0 ? `
    <div class="signal-section">
      <div class="panel-title"><span class="live-dot"></span>Recent Work</div>
      ${recentHTML}
    </div>` : ''}

    <div class="suggestions">
      <div class="panel-title">Suggested Next</div>
      ${data.intelligence.gaps.length > 0 ? `
      <div class="suggest-item">
        <div class="suggest-label">Biggest Gap</div>
        Fill ${data.intelligence.gaps[0].section} -- ${data.intelligence.gaps[0].message}
      </div>` : ''}
      <div class="suggest-item">
        <div class="suggest-label">Quick Win</div>
        Grade your ${data.totalEntries} entries to see where you stand
      </div>
      ${data.meetings === 0 ? `
      <div class="suggest-item">
        <div class="suggest-label">Missing</div>
        No meetings filed yet -- file a transcript to unlock team intelligence
      </div>` : ''}
    </div>
  </div>

  <div class="footer">
    MindrianOS Quick View -- generated ${data.generatedAt.slice(0, 16).replace('T', ' ')} -- <span class="live-dot"></span>Auto-refreshes every 10s
  </div>
</div>

<script>
// Auto-refresh: full page reload when room data changes
(function() {
  var lastJson = '';
  setInterval(async function() {
    try {
      var res = await fetch('/api/state');
      if (res.ok) {
        var text = await res.text();
        if (lastJson && text !== lastJson) {
          window.location.reload();
        }
        lastJson = text;
      }
    } catch (e) { /* server may have stopped */ }
  }, 10000);
})();
</script>

</body>
</html>`;
}

// ── HTTP Server (zero dependencies) ──

function startServer(roomDir, port) {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(collectRoomData(roomDir)));
      return;
    }

    // Serve dashboard HTML for everything else
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildDashboardHTML(collectRoomData(roomDir)));
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    process.stderr.write(`MindrianOS Quick View: ${url}\n`);

    // Auto-open browser
    const { platform } = process;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    try { execSync(`${cmd} ${url}`, { stdio: 'ignore' }); } catch (e) { /* no browser */ }
  });

  return server;
}

// ── CLI Entry ──

if (require.main === module) {
  const roomDir = process.argv[2] || path.join(process.cwd(), 'room');
  const port = parseInt(process.argv[3] || '8450', 10);
  if (!fs.existsSync(roomDir)) {
    process.stderr.write(`Room not found: ${roomDir}\n`);
    process.exit(1);
  }
  startServer(roomDir, port);
}

module.exports = { startServer, collectRoomData, buildDashboardHTML };
