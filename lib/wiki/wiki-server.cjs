'use strict';
/**
 * wiki-server.cjs — Express server for the Data Room wiki
 *
 * Scans room/ directory, renders .md files as Wikipedia-style pages
 * with De Stijl design, dark/light mode, infobox, TOC, sidebar.
 */

const express = require('express');
const path = require('path');
const { scanRoom, renderPage, buildPageIndex, SECTION_COLORS } = require('./page-renderer.cjs');
const { wrapInLayout, renderInfobox, renderSidebar } = require('./wiki-layout.cjs');

/**
 * Start the wiki Express server.
 * @param {string} roomDir - Path to room/ directory
 * @param {number} port - Port to listen on (default 8421)
 * @returns {Promise<{app, server, port}>}
 */
function startWikiServer(roomDir, port) {
  port = port || 8421;
  const absRoom = path.resolve(roomDir);
  const app = express();

  // Scan room on startup
  let roomData = scanRoom(absRoom);
  let pageIndex = buildPageIndex(roomData.pages);

  // ── Helper: rebuild room index ──
  function rebuild() {
    roomData = scanRoom(absRoom);
    pageIndex = buildPageIndex(roomData.pages);
  }

  // ── Route: Wiki Home (Room Overview) ──
  app.get('/wiki', (req, res) => {
    rebuild(); // Fresh scan on each overview visit

    const sectionCards = [];
    for (const [name, sec] of roomData.sections) {
      const pageLinks = sec.pages.map(pid => {
        const p = roomData.pages.get(pid);
        return `<li><a href="/wiki/${pid}">${escHtml(p.title)}</a></li>`;
      }).join('\n');

      sectionCards.push(`<div class="section-card">
        <div class="section-card-bar" style="background:${sec.color}"></div>
        <h3><a href="/wiki/${name}">${escHtml(sec.label)}</a></h3>
        <div class="section-card-meta">${sec.pages.length} artifact${sec.pages.length !== 1 ? 's' : ''}</div>
        ${pageLinks ? `<ul class="page-list">${pageLinks}</ul>` : ''}
      </div>`);
    }

    const totalPages = roomData.pages.size;
    const totalSections = roomData.sections.size;

    const bodyHtml = `
      <h1>Data Room Wiki</h1>
      <p style="color:var(--text-muted);margin-bottom:24px">${totalSections} section${totalSections !== 1 ? 's' : ''}, ${totalPages} page${totalPages !== 1 ? 's' : ''}</p>
      ${sectionCards.length > 0 ? sectionCards.join('\n') : '<p style="color:var(--text-muted)">No room sections found. Create a room with <code>/mos:new-project</code> to get started.</p>'}
    `;

    const sidebar = renderSidebar(roomData.sections, null);
    const html = wrapInLayout({
      title: 'Data Room Wiki',
      bodyHtml,
      toc: [],
      sidebar,
      infobox: '',
      sectionColor: null,
      currentPath: '/wiki',
      isHomePage: true
    });

    res.type('html').send(html);
  });

  // ── Route: API - Page Index (JSON) ──
  app.get('/api/pages', (req, res) => {
    rebuild();
    const result = {};
    for (const [id, page] of roomData.pages) {
      result[id] = {
        title: page.title,
        section: page.section,
        frontmatter: page.frontmatter,
        url: `/wiki/${id}`
      };
    }
    res.json(result);
  });

  // ── Route: API - SSE endpoint stub ──
  app.get('/api/sse', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"type":"connected"}\n\n');
    // Plan 03 will activate real SSE events via chokidar
    req.on('close', () => res.end());
  });

  // ── Route: Section Overview ──
  app.get('/wiki/:section', (req, res) => {
    rebuild();
    const sectionName = req.params.section;
    const section = roomData.sections.get(sectionName);

    if (!section) {
      return render404(res, roomData, `Section "${sectionName}" not found`);
    }

    const pageLinks = section.pages.map(pid => {
      const p = roomData.pages.get(pid);
      const excerpt = p.content.replace(/^---[\s\S]*?---/, '').trim().slice(0, 150);
      return `<div class="section-card">
        <h3><a href="/wiki/${pid}">${escHtml(p.title)}</a></h3>
        <p style="font-size:13px;color:var(--text-muted)">${escHtml(excerpt)}${excerpt.length >= 150 ? '...' : ''}</p>
      </div>`;
    }).join('\n');

    const bodyHtml = `
      <h1>${escHtml(section.label)}</h1>
      <p style="color:var(--text-muted);margin-bottom:24px">${section.pages.length} artifact${section.pages.length !== 1 ? 's' : ''}</p>
      ${pageLinks || '<p style="color:var(--text-muted)">No artifacts in this section yet.</p>'}
    `;

    const sidebar = renderSidebar(roomData.sections, sectionName);
    const html = wrapInLayout({
      title: section.label,
      bodyHtml,
      toc: [],
      sidebar,
      infobox: '',
      sectionColor: section.color,
      currentPath: `/wiki/${sectionName}`,
      isHomePage: false
    });

    res.type('html').send(html);
  });

  // ── Route: Artifact Page ──
  app.get('/wiki/:section/:page', (req, res) => {
    rebuild();
    const pageId = `${req.params.section}/${req.params.page}`;
    const page = roomData.pages.get(pageId);

    if (!page) {
      return render404(res, roomData, `Page "${pageId}" not found`);
    }

    const rendered = renderPage(page, pageIndex);
    const section = roomData.sections.get(page.section);
    const sectionColor = section ? section.color : SECTION_COLORS[page.section] || '#5C5A56';

    const infobox = renderInfobox(rendered.frontmatter, sectionColor);
    const sidebar = renderSidebar(roomData.sections, page.section);

    // Add heading IDs for TOC anchoring
    let bodyHtml = `<h1>${escHtml(page.title)}</h1>\n${rendered.html}`;
    bodyHtml = addHeadingIds(bodyHtml);

    const html = wrapInLayout({
      title: page.title,
      bodyHtml,
      toc: rendered.toc,
      sidebar,
      infobox,
      sectionColor,
      currentPath: `/wiki/${pageId}`,
      isHomePage: false
    });

    res.type('html').send(html);
  });

  // ── 404 handler ──
  app.use((req, res) => {
    render404(res, roomData, `Page not found: ${req.path}`);
  });

  // ── Start server ──
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Wiki running at http://localhost:${port}`);
      resolve({ app, server, port });
    });
  });
}

/**
 * Render a De Stijl 404 page.
 */
function render404(res, roomData, message) {
  const suggestions = [];
  for (const [name, sec] of roomData.sections) {
    suggestions.push(`<a href="/wiki/${name}">${escHtml(sec.label)}</a>`);
  }

  const sidebar = renderSidebar(roomData.sections, null);
  const bodyHtml = `<div class="error-page">
    <h1>404</h1>
    <p>${escHtml(message)}</p>
    ${suggestions.length > 0 ? `<p style="margin-top:16px">Try: ${suggestions.join(' | ')}</p>` : ''}
    <p style="margin-top:16px"><a href="/wiki">Back to home</a></p>
  </div>`;

  const html = wrapInLayout({
    title: '404 Not Found',
    bodyHtml,
    toc: [],
    sidebar,
    infobox: '',
    sectionColor: null,
    currentPath: '',
    isHomePage: false
  });

  res.status(404).type('html').send(html);
}

/**
 * Add id attributes to h2/h3 elements for TOC linking.
 */
function addHeadingIds(html) {
  return html.replace(/<(h[23])>([^<]+)<\/h[23]>/gi, (match, tag, text) => {
    const id = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `<${tag} id="${id}">${text}</${tag}>`;
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── CLI entry mode ──
if (require.main === module) {
  const roomDir = process.argv[2] || './room';
  const port = parseInt(process.argv[3] || '8421', 10);
  startWikiServer(roomDir, port);
}

module.exports = { startWikiServer };
