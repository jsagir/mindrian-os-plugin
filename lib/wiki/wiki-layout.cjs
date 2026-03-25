'use strict';
/**
 * wiki-layout.cjs — HTML template system for the wiki
 *
 * De Stijl design with dark/light mode toggle, sidebar,
 * infobox, TOC, and responsive 3-column layout.
 */

/**
 * Wrap rendered content in a full HTML page.
 */
function wrapInLayout({ title, bodyHtml, toc, sidebar, infobox, sectionColor, currentPath, isHomePage }) {
  const tocHtml = toc && toc.length > 0 ? renderTOC(toc) : '';
  const infoboxHtml = infobox || '';
  const rightRail = (tocHtml || infoboxHtml)
    ? `<aside class="right-rail">${infoboxHtml}${tocHtml}</aside>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)} - MindrianOS Wiki</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" id="hljs-theme">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
${CSS_STYLES}
  </style>
</head>
<body>
  <header class="header">
    <a href="/wiki" class="header-title">MindrianOS Data Room</a>
    <div class="header-right">
      <a href="/wiki" class="nav-link${isHomePage ? ' active' : ''}">Home</a>
      <button class="btn-theme" onclick="toggleTheme()" title="Toggle dark/light mode" aria-label="Toggle theme">
        <span class="theme-icon-dark">&#9789;</span>
        <span class="theme-icon-light">&#9788;</span>
      </button>
    </div>
  </header>

  <div class="layout">
    ${sidebar}
    <main class="content">
      <article class="article">
        ${bodyHtml}
      </article>
    </main>
    ${rightRail}
  </div>

  <script>
    // Dark/light mode toggle — stored in localStorage
    (function() {
      var saved = localStorage.getItem('mos-wiki-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', saved);
      updateHljsTheme(saved);
    })();

    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('mos-wiki-theme', next);
      updateHljsTheme(next);
    }

    function updateHljsTheme(theme) {
      var link = document.getElementById('hljs-theme');
      if (theme === 'light') {
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
      } else {
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
      }
    }

    // Highlight code blocks
    hljs.highlightAll();

    // Init Mermaid
    mermaid.initialize({
      startOnLoad: true,
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
      themeVariables: {
        primaryColor: '#1E3A6E',
        primaryTextColor: '#F5F0E8',
        lineColor: '#A09A90'
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Render YAML frontmatter as a De Stijl infobox card.
 */
function renderInfobox(frontmatter, sectionColor) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return '';

  const color = sectionColor || '#5C5A56';
  const rows = [];

  // Display order for known frontmatter fields
  const fieldOrder = ['methodology', 'pipeline', 'stage', 'created', 'updated', 'confidence', 'status', 'author'];
  const shown = new Set();

  for (const key of fieldOrder) {
    if (frontmatter[key] !== undefined) {
      rows.push(renderInfoboxRow(key, frontmatter[key]));
      shown.add(key);
    }
  }

  // Remaining fields (skip title — already in page heading)
  for (const [key, val] of Object.entries(frontmatter)) {
    if (shown.has(key) || key === 'title') continue;
    rows.push(renderInfoboxRow(key, val));
  }

  if (rows.length === 0) return '';

  return `<div class="infobox">
  <div class="infobox-bar" style="background:${color}"></div>
  <h3 class="infobox-title">Properties</h3>
  <table class="infobox-table">
    ${rows.join('\n    ')}
  </table>
</div>`;
}

function renderInfoboxRow(key, value) {
  const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ');
  let display = value;
  if (Array.isArray(value)) display = value.join(', ');
  else if (typeof value === 'object' && value !== null) display = JSON.stringify(value);
  return `<tr><td class="infobox-key">${escHtml(label)}</td><td class="infobox-val">${escHtml(String(display))}</td></tr>`;
}

/**
 * Render sticky TOC from heading entries.
 */
function renderTOC(tocEntries) {
  if (!tocEntries || tocEntries.length === 0) return '';

  const items = tocEntries.map(e => {
    const indent = e.level === 3 ? ' class="toc-indent"' : '';
    return `<li${indent}><a href="#${e.id}">${escHtml(e.text)}</a></li>`;
  }).join('\n      ');

  return `<nav class="toc">
    <h3 class="toc-title">Contents</h3>
    <ul>
      ${items}
    </ul>
  </nav>`;
}

/**
 * Render left sidebar with section list.
 */
function renderSidebar(sections, currentSection) {
  const items = [];
  for (const [name, sec] of sections) {
    const active = name === currentSection ? ' active' : '';
    items.push(`<a href="/wiki/${name}" class="sidebar-item${active}">
      <span class="sidebar-chip" style="background:${sec.color}"></span>
      <span class="sidebar-label">${escHtml(sec.label)}</span>
      <span class="sidebar-count">${sec.pages.length}</span>
    </a>`);
  }

  return `<aside class="sidebar">
    <nav class="sidebar-nav">
      <h3 class="sidebar-title">Sections</h3>
      ${items.join('\n      ')}
    </nav>
  </aside>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── CSS Styles (dark + light mode) ──
const CSS_STYLES = `
    /* ── De Stijl Design Tokens ── */
    :root {
      --ds-bg: #0D0D0D;
      --ds-surface: #1A1A1A;
      --ds-elevated: #2A2A2A;
      --ds-cream: #F5F0E8;
      --ds-muted: #A09A90;
      --ds-border: #2A2A2A;
      --ds-red: #A63D2F;
      --ds-blue: #1E3A6E;
      --ds-yellow: #C8A43C;
      --ds-green: #2D6B4A;
      --ds-sienna: #B5602A;
      --ds-gray: #5C5A56;
      --ds-amethyst: #6B4E8B;
      --ds-teal: #2A6B5E;
    }

    /* ── Dark theme (default) ── */
    [data-theme="dark"] {
      --bg: #0D0D0D;
      --surface: #1A1A1A;
      --elevated: #2A2A2A;
      --text: #F5F0E8;
      --text-muted: #A09A90;
      --border: #2A2A2A;
      --link: #6B9BD2;
      --link-hover: #8BB4E0;
      --code-bg: #1A1A1A;
    }

    /* ── Light theme ── */
    [data-theme="light"] {
      --bg: #FAFAFA;
      --surface: #FFFFFF;
      --elevated: #F0EDE6;
      --text: #1A1A1A;
      --text-muted: #6B6560;
      --border: #E0DCD4;
      --link: #1E3A6E;
      --link-hover: #2A4F8F;
      --code-bg: #F5F0E8;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      border-radius: 0;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      line-height: 1.65;
      transition: background 150ms ease, color 150ms ease;
    }

    a { color: var(--link); text-decoration: none; transition: color 150ms ease; }
    a:hover { color: var(--link-hover); text-decoration: underline; }

    /* ── Header ── */
    .header {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 48px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 100;
      transition: background 150ms ease, border-color 150ms ease;
    }

    .header-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20px;
      letter-spacing: 0.08em;
      color: var(--text);
      text-transform: uppercase;
      text-decoration: none;
    }
    .header-title:hover { text-decoration: none; color: var(--text); }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .nav-link {
      font-size: 13px;
      color: var(--text-muted);
      text-decoration: none;
      padding: 4px 8px;
      transition: color 150ms ease;
    }
    .nav-link:hover, .nav-link.active { color: var(--text); text-decoration: none; }

    .btn-theme {
      background: var(--elevated);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 4px 10px;
      font-size: 16px;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
      line-height: 1;
    }
    .btn-theme:hover { border-color: var(--text-muted); }

    [data-theme="dark"] .theme-icon-light { display: none; }
    [data-theme="dark"] .theme-icon-dark { display: inline; }
    [data-theme="light"] .theme-icon-dark { display: none; }
    [data-theme="light"] .theme-icon-light { display: inline; }

    /* ── Layout: 3-column ── */
    .layout {
      display: flex;
      margin-top: 48px;
      min-height: calc(100vh - 48px);
    }

    /* ── Left Sidebar ── */
    .sidebar {
      width: 220px;
      min-width: 220px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 16px 0;
      overflow-y: auto;
      height: calc(100vh - 48px);
      position: sticky;
      top: 48px;
      transition: background 150ms ease, border-color 150ms ease;
    }

    .sidebar-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      padding: 0 16px 8px;
    }

    .sidebar-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
      transition: background 150ms ease;
    }
    .sidebar-item:hover { background: var(--elevated); text-decoration: none; }
    .sidebar-item.active { background: var(--elevated); font-weight: 600; }

    .sidebar-chip {
      width: 8px;
      height: 8px;
      flex-shrink: 0;
    }

    .sidebar-count {
      margin-left: auto;
      font-size: 11px;
      color: var(--text-muted);
    }

    /* ── Content ── */
    .content {
      flex: 1;
      padding: 32px 40px;
      max-width: 860px;
      min-width: 0;
    }

    .article h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      letter-spacing: 0.04em;
      color: var(--text);
      margin-bottom: 16px;
      line-height: 1.1;
    }

    .article h2 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 24px;
      letter-spacing: 0.04em;
      color: var(--text);
      margin: 32px 0 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }

    .article h3 {
      font-family: 'Inter', sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      margin: 24px 0 8px;
    }

    .article p { margin-bottom: 12px; }

    .article ul, .article ol {
      margin: 0 0 12px 24px;
    }

    .article li { margin-bottom: 4px; }

    .article code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: var(--code-bg);
      padding: 2px 6px;
    }

    .article pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      padding: 16px;
      overflow-x: auto;
      margin-bottom: 16px;
    }

    .article pre code {
      padding: 0;
      background: none;
    }

    .article blockquote {
      border-left: 3px solid var(--ds-yellow);
      padding: 8px 16px;
      margin: 0 0 12px;
      color: var(--text-muted);
      background: var(--elevated);
    }

    .article table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .article th, .article td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
      font-size: 14px;
    }

    .article th {
      background: var(--elevated);
      font-weight: 600;
    }

    .article img {
      max-width: 100%;
      height: auto;
    }

    /* ── Right Rail (Infobox + TOC) ── */
    .right-rail {
      width: 260px;
      min-width: 260px;
      padding: 16px;
      height: calc(100vh - 48px);
      overflow-y: auto;
      position: sticky;
      top: 48px;
    }

    .infobox {
      background: var(--surface);
      border: 1px solid var(--border);
      margin-bottom: 20px;
      transition: background 150ms ease, border-color 150ms ease;
    }

    .infobox-bar { height: 4px; }
    .infobox-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      padding: 10px 12px 6px;
    }

    .infobox-table { width: 100%; border-collapse: collapse; }
    .infobox-table td {
      padding: 4px 12px;
      font-size: 12px;
      border: none;
      vertical-align: top;
    }
    .infobox-key {
      color: var(--text-muted);
      font-weight: 600;
      width: 40%;
      text-transform: capitalize;
    }
    .infobox-val { color: var(--text); }

    /* ── TOC ── */
    .toc {
      position: sticky;
      top: 16px;
    }

    .toc-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .toc ul { list-style: none; }
    .toc li {
      margin-bottom: 4px;
    }
    .toc li a {
      font-size: 12px;
      color: var(--text-muted);
      transition: color 150ms ease;
    }
    .toc li a:hover { color: var(--text); text-decoration: none; }
    .toc li.toc-indent { padding-left: 12px; }

    /* ── Section overview cards ── */
    .section-card {
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 16px;
      margin-bottom: 12px;
      transition: background 150ms ease, border-color 150ms ease;
    }
    .section-card:hover { border-color: var(--text-muted); }

    .section-card-bar { height: 3px; margin-bottom: 12px; }
    .section-card h3 { margin: 0 0 6px; }
    .section-card h3 a { color: var(--text); font-weight: 600; }
    .section-card .section-card-meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .page-list { list-style: none; margin-top: 8px; }
    .page-list li { margin-bottom: 4px; }
    .page-list li a { font-size: 13px; }

    /* ── 404 ── */
    .error-page {
      text-align: center;
      padding: 80px 20px;
    }
    .error-page h1 { font-size: 72px; color: var(--ds-red); margin-bottom: 8px; }
    .error-page p { color: var(--text-muted); }

    /* ── Responsive ── */
    @media (max-width: 960px) {
      .right-rail { display: none; }
      .content { max-width: 100%; }
    }
    @media (max-width: 720px) {
      .sidebar { display: none; }
      .content { padding: 20px 16px; }
    }
`;

module.exports = {
  wrapInLayout,
  renderInfobox,
  renderTOC,
  renderSidebar
};
