'use strict';
/**
 * wiki-server.cjs — Express server for the Data Room wiki
 *
 * Scans room/ directory, renders .md files as Wikipedia-style pages
 * with De Stijl design, dark/light mode, infobox, TOC, sidebar.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const { scanRoom, renderPage, buildPageIndex, SECTION_COLORS } = require('./page-renderer.cjs');
const { wrapInLayout, renderInfobox, renderSidebar, renderBacklinks, renderSeeAlso, renderGraphLinks } = require('./wiki-layout.cjs');
const { getPageLinks, getBacklinks, getSeeAlso, getGraphData, EDGE_DISPLAY } = require('./graph-links.cjs');
const { buildSearchIndex, search, rebuildIndex } = require('./wiki-search.cjs');
const { buildPageContext, handleChatMessage } = require('./wiki-chat.cjs');
const { startWatcher, addSSEClient } = require('./wiki-watcher.cjs');
const { getRoomHomeData, renderRoomHomeBody } = require('./room-home.cjs');
const { generateBriefing } = require('./briefing.cjs');

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

  // Build search index from initial scan
  buildSearchIndex(roomData.pages);

  // ── Helper: rebuild room index ──
  function rebuild() {
    roomData = scanRoom(absRoom);
    pageIndex = buildPageIndex(roomData.pages);
    rebuildIndex(roomData.pages);
  }

  // JSON body parsing for chat endpoint
  app.use(express.json());

  // Serve room files as static assets (images, etc.)
  app.use('/room-assets', express.static(absRoom));

  // Serve the walled BlockNote editor bundle (D-03), mirroring /room-assets.
  app.use('/editor', express.static(path.join(__dirname, 'editor-dist')));

  // ── Route: Bare root -> Room Home ──
  // The browser opening the bare port lands on the wiki Room Home, not a 404.
  app.get('/', (req, res) => res.redirect(302, '/wiki'));

  // ── Route: Wiki Home (Room Home dashboard, SPEC Req 4) ──
  // Room Home replaces the old section-card overview as the landing route
  // (deliberately overturning the Phase 19 graph-as-homepage mandate). The body
  // is sourced from the room's REAL state via room-home.cjs (D-05), never the
  // graph and never hardcoded. Sections remain reachable via the sidebar and the
  // /wiki/:section route.
  app.get('/wiki', (req, res) => {
    rebuild(); // Fresh scan on each home visit

    const data = getRoomHomeData(absRoom);
    const bodyHtml = renderRoomHomeBody(data);

    const sidebar = renderSidebar(roomData.sections, null);
    const html = wrapInLayout({
      title: 'Room Home',
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

  // ── Route: API - Search ──
  app.get('/api/search', (req, res) => {
    const q = req.query.q || '';
    const limit = parseInt(req.query.limit || '20', 10);
    const results = search(q, limit);
    res.json(results);
  });

  // ── Route: API - Larry's Briefing (D-06, SPEC Req 4) ──
  // On-demand "Larry's read of the room". Registered BEFORE the /api/chat routes
  // (which are deferred v2 stubs, left untouched). The route never throws: any
  // unexpected failure degrades to a 502 api_error. The user's own ANTHROPIC key
  // is resolved and used server-side in briefing.cjs only (T-232-04-04) and never
  // enters a response body.
  app.post('/api/briefing', async (req, res) => {
    try {
      const result = await generateBriefing(absRoom);
      if (result && result.ok) return res.json(result);
      if (result && result.error === 'no_api_key') return res.status(503).json(result);
      return res.status(502).json(result || { ok: false, error: 'api_error' });
    } catch (_e) {
      return res.status(502).json({ ok: false, error: 'api_error' });
    }
  });

  // ── Route: API - Chat (stub) ──
  app.post('/api/chat', async (req, res) => {
    const { pageId, message } = req.body || {};
    if (!pageId || !message) {
      return res.status(400).json({ error: 'pageId and message required' });
    }

    const page = roomData.pages.get(pageId);
    if (!page) {
      return res.status(404).json({ error: `Page "${pageId}" not found` });
    }

    // Build context from page data + graph links
    let graphLinks = [];
    let backlinks = [];
    try {
      graphLinks = await getPageLinks(absRoom, pageId);
      backlinks = await getBacklinks(absRoom, pageId);
    } catch (e) { /* graceful degradation */ }

    const context = buildPageContext(page, graphLinks, backlinks);
    const result = await handleChatMessage(absRoom, pageId, message, context);
    res.json(result);
  });

  // ── Route: API - SSE (live via chokidar watcher) ──
  app.get('/api/sse', (req, res) => {
    addSSEClient(res);
  });

  // ── Route: Server-rendered search page (no-JS fallback) ──
  app.get('/wiki/search', (req, res) => {
    const q = req.query.q || '';
    const results = q ? search(q, 50) : [];

    const resultItems = results.map(r =>
      `<div class="section-card">
        <h3><a href="/wiki/${escHtml(r.id)}">${escHtml(r.title)}</a></h3>
        <span class="edge-type-label" style="margin-left:0">${escHtml(r.section)}</span>
        <p style="font-size:13px;color:var(--text-muted);margin-top:4px">${r.excerpt}</p>
      </div>`
    ).join('\n');

    const bodyHtml = `
      <h1>Search</h1>
      <form action="/wiki/search" method="get" style="margin-bottom:24px">
        <input type="search" name="q" value="${escHtml(q)}" placeholder="Search room..." style="width:100%;padding:8px 12px;background:var(--surface);color:var(--text);border:1px solid var(--border);font-family:Inter,sans-serif;font-size:15px">
      </form>
      ${q ? `<p style="color:var(--text-muted);margin-bottom:16px">${results.length} result${results.length !== 1 ? 's' : ''} for "${escHtml(q)}"</p>` : ''}
      ${resultItems || (q ? '<p style="color:var(--text-muted)">No results found.</p>' : '')}
    `;

    const sidebar = renderSidebar(roomData.sections, null);
    const html = wrapInLayout({
      title: q ? `Search: ${q}` : 'Search',
      bodyHtml,
      toc: [],
      sidebar,
      infobox: '',
      sectionColor: null,
      currentPath: '/wiki/search',
      isHomePage: false
    });
    res.type('html').send(html);
  });

  // ── Route: Graph View ──
  app.get('/wiki/graph', async (req, res) => {
    rebuild();
    const graphData = await getGraphData(absRoom);

    const sectionColorMap = {};
    for (const [name, sec] of roomData.sections) {
      sectionColorMap[name] = sec.color;
    }

    // Graph retune (render layer ONLY, DV-8 + UI-SPEC semantic mapping): canonical
    // M:OS hex overrides EDGE_DISPLAY's legacy palette for edge lines + legend dots.
    // EDGE_DISPLAY (in graph-links.cjs) is NOT edited (D-10); only the render uses
    // this local override. Cytoscape itself stays (SPEC Req 5 locks the reuse).
    const CANONICAL_EDGE_HEX = {
      INFORMS: '#1E52E0',
      CONTRADICTS: '#E11D22',
      CONVERGES: '#FFC400',
      ENABLES: '#12A06A',
      INVALIDATES: '#B5602A'
    };

    const legendItems = Object.entries(EDGE_DISPLAY).map(([type, d]) =>
      `<span class="graph-legend-item"><span class="graph-legend-dot" style="background:${CANONICAL_EDGE_HEX[type] || d.color}"></span>${d.symbol} ${d.label}</span>`
    ).join('\n');

    const bodyHtml = `
      <h1>Knowledge Graph</h1>
      <p style="color:var(--text-muted);margin-bottom:12px">${graphData.nodes.length} artifacts, ${graphData.edges.length} relationships</p>
      <div class="graph-legend">${legendItems}</div>
      <div id="cy" class="graph-container"></div>
      <script src="https://unpkg.com/cytoscape@3.30.4/dist/cytoscape.min.js"></script>
      <script>
        (function() {
          var graphData = ${JSON.stringify(graphData)};
          var sectionColors = ${JSON.stringify(sectionColorMap)};
          var edgeColors = ${JSON.stringify(CANONICAL_EDGE_HEX)};

          var elements = [];

          // Nodes
          graphData.nodes.forEach(function(n) {
            elements.push({
              data: {
                id: n.id,
                label: n.title,
                section: n.section,
                color: sectionColors[n.section] || '#5C5A56'
              }
            });
          });

          // Edges
          graphData.edges.forEach(function(e, i) {
            elements.push({
              data: {
                id: 'e' + i,
                source: e.source,
                target: e.target,
                type: e.type,
                color: edgeColors[e.type] || '#5C5A56'
              }
            });
          });

          var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

          var cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            style: [
              {
                selector: 'node',
                style: {
                  'label': 'data(label)',
                  'background-color': 'data(color)',
                  'color': isDark ? '#F3F2EE' : '#0C0C0D',
                  'font-size': '11px',
                  'font-family': 'Inter, sans-serif',
                  'text-valign': 'bottom',
                  'text-margin-y': 6,
                  'width': 24,
                  'height': 24,
                  'border-width': 2,
                  'border-color': isDark ? '#F3F2EE' : '#0C0C0D',
                  'text-max-width': '120px',
                  'text-wrap': 'ellipsis',
                  'cursor': 'pointer'
                }
              },
              {
                selector: 'edge',
                style: {
                  'line-color': 'data(color)',
                  'target-arrow-color': 'data(color)',
                  'target-arrow-shape': 'triangle',
                  'curve-style': 'bezier',
                  'width': 2,
                  'opacity': 0.7,
                  'cursor': 'pointer'
                }
              },
              {
                selector: 'edge[type="CONTRADICTS"]',
                style: {
                  'line-style': 'dashed',
                  'width': 3,
                  'opacity': 1
                }
              },
              {
                selector: 'edge[type="INFORMS"]',
                style: {
                  'line-style': 'solid'
                }
              },
              {
                selector: 'node:selected',
                style: {
                  'border-width': 4,
                  'border-color': '#FFC400'
                }
              }
            ],
            layout: {
              name: 'cose',
              animate: true,
              animationDuration: 800,
              nodeRepulsion: function() { return 8000; },
              idealEdgeLength: function() { return 120; },
              padding: 40
            }
          });

          // Click node -> navigate to page
          cy.on('tap', 'node', function(evt) {
            var id = evt.target.data('id');
            window.location.href = '/wiki/' + id;
          });

          // Click edge -> navigate to source page
          cy.on('tap', 'edge', function(evt) {
            var source = evt.target.data('source');
            var target = evt.target.data('target');
            var type = evt.target.data('type');
            // Navigate to source, which shows the connection to target
            window.location.href = '/wiki/' + source;
          });

          // Animated edges: INFORMS flows, CONTRADICTS pulses red
          function animateEdges() {
            cy.edges('[type="CONTRADICTS"]').animate({
              style: { 'opacity': 0.3 }
            }, {
              duration: 800,
              complete: function() {
                this.animate({
                  style: { 'opacity': 1 }
                }, { duration: 800, complete: animateContradicts });
              }
            });

            cy.edges('[type="INFORMS"]').animate({
              style: { 'line-color': '#6D9BFF', 'target-arrow-color': '#6D9BFF' }
            }, {
              duration: 1200,
              complete: function() {
                this.animate({
                  style: { 'line-color': '#1E52E0', 'target-arrow-color': '#1E52E0' }
                }, { duration: 1200 });
              }
            });

            cy.edges('[type="CONVERGES"]').animate({
              style: { 'opacity': 1, 'width': 3 }
            }, {
              duration: 1500,
              complete: function() {
                this.animate({
                  style: { 'opacity': 0.7, 'width': 2 }
                }, { duration: 1500 });
              }
            });
          }

          function animateContradicts() {
            cy.edges('[type="CONTRADICTS"]').animate({
              style: { 'opacity': 0.3 }
            }, {
              duration: 800,
              complete: function() {
                this.animate({
                  style: { 'opacity': 1 }
                }, { duration: 800, complete: animateContradicts });
              }
            });
          }

          // Start animations after layout settles
          cy.on('layoutstop', function() {
            setTimeout(animateEdges, 500);
          });
        })();
      </script>
    `;

    const sidebar = renderSidebar(roomData.sections, null);
    const html = wrapInLayout({
      title: 'Knowledge Graph',
      bodyHtml,
      toc: [],
      sidebar,
      infobox: '',
      sectionColor: null,
      currentPath: '/wiki/graph',
      isHomePage: false
    });

    res.type('html').send(html);
  });

  // ── Route: API - Backlinks (JSON) ──
  app.get('/api/backlinks/:section/:page', async (req, res) => {
    const artifactId = `${req.params.section}/${req.params.page}`;
    const backlinks = await getBacklinks(absRoom, artifactId);
    res.json(backlinks);
  });

  // ── Route: API - Raw article markdown (editor load) ──
  // Returns the frontmatter-STRIPPED body only (the editor edits the body, never
  // the frontmatter). pageId selects a Map key; nothing here touches the FS.
  app.get('/api/raw/:section/:page', (req, res) => {
    const pageId = `${req.params.section}/${req.params.page}`;
    const page = roomData.pages.get(pageId);
    if (!page) return res.status(404).json({ error: `Page "${pageId}" not found` });
    res.json({ id: pageId, title: page.title, markdown: page.content });
  });

  // ── Route: API - Save article markdown (SPEC Req 2, editor save) ──
  // Direct unguarded overwrite by locked decision 4: no staleness guard and no
  // confirmation semantics (T-232-04-03, explicitly accepted risk).
  // Path-safety (T-232-04-01): the write target is page.path from the scanned
  // index ONLY. Request params never enter a filesystem path -- they select a Map
  // key, and a missing key is a 404. Frontmatter is preserved by re-reading the
  // source and restringifying the new body under the existing data block.
  app.post('/api/save/:section/:page', (req, res) => {
    const pageId = `${req.params.section}/${req.params.page}`;
    const page = roomData.pages.get(pageId);
    if (!page) return res.status(404).json({ error: `Page "${pageId}" not found` });

    const markdown = req.body && req.body.markdown;
    if (typeof markdown !== 'string') {
      return res.status(400).json({ error: 'markdown required' });
    }

    const targetPath = page.path; // scanned index path only -- never from params
    try {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const parsed = matter(raw);
      const data = parsed && parsed.data ? parsed.data : {};
      const out = Object.keys(data).length > 0
        ? matter.stringify(markdown, data)
        : markdown;
      fs.writeFileSync(targetPath, out, 'utf8');
      // The chokidar watcher rebuilds the index on this write; do not rebuild here.
      return res.json({ ok: true });
    } catch (_e) {
      return res.status(500).json({ ok: false, error: 'write_failed', file: targetPath });
    }
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
  app.get('/wiki/:section/:page', async (req, res) => {
    rebuild();
    const pageId = `${req.params.section}/${req.params.page}`;
    const page = roomData.pages.get(pageId);

    if (!page) {
      return render404(res, roomData, `Page "${pageId}" not found`);
    }

    // Render markdown and fetch graph data in parallel
    const rendered = renderPage(page, pageIndex);
    const [links, backlinks, seeAlso] = await Promise.all([
      getPageLinks(absRoom, pageId),
      getBacklinks(absRoom, pageId),
      getSeeAlso(absRoom, pageId)
    ]);

    const section = roomData.sections.get(page.section);
    const sectionColor = section ? section.color : SECTION_COLORS[page.section] || '#5C5A56';

    // Info rail (UI-SPEC component 6): infobox + connections + See also + What
    // links here, all in the right rail. See also / backlinks move OUT of the body
    // so the article body is the editor mount alone. renderSeeAlso/renderBacklinks
    // are reused verbatim (D-10: getBacklinks/getSeeAlso + graph-links.cjs unchanged).
    const infoboxHtml = renderInfobox(rendered.frontmatter, sectionColor);
    const combinedInfobox = infoboxHtml
      + renderGraphLinks(links)
      + renderSeeAlso(seeAlso)
      + renderBacklinks(backlinks);

    const sidebar = renderSidebar(roomData.sections, page.section);

    // Body = the BlockNote editor mount (SPEC Req 6). The bundle at /editor
    // hydrates #mos-editor-root, loading the body via GET /api/raw and saving via
    // POST /api/save. rendered.toc still feeds the right rail.
    const bodyHtml = `<h1>${escHtml(page.title)}</h1>
<div id="mos-editor-root" data-page-id="${escHtml(pageId)}"></div>
<link rel="stylesheet" href="/editor/wiki-editor.css">
<script defer src="/editor/wiki-editor.js"></script>`;

    const html = wrapInLayout({
      title: page.title,
      bodyHtml,
      toc: rendered.toc,
      sidebar,
      infobox: combinedInfobox,
      sectionColor,
      currentPath: `/wiki/${pageId}`,
      isHomePage: false
    });

    res.type('html').send(html);
  });

  // ── Per-page PDF download ──
  app.get('/wiki/:section/pdf', (req, res) => {
    rebuild();
    const sectionName = req.params.section;
    const section = roomData.sections.get(sectionName);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    // Collect all pages in this section
    const pages = [];
    for (const [id, page] of roomData.pages) {
      if (page.section === sectionName) pages.push(page);
    }

    // Generate printable HTML (De Stijl styled)
    const rendered = pages.map(p => {
      const r = renderPage(p, pageIndex);
      return `<div class="pdf-page"><h2>${escHtml(p.title)}</h2>${r.html}</div>`;
    }).join('<hr style="border:2px solid #2160C4;margin:24px 0;">');

    const pdfHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${escHtml(section.label)} - MindrianOS Data Room</title>
  <meta name="generator" content="MindrianOS">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
    h1 { font-family: 'Bebas Neue', sans-serif; font-size: 32px; border-bottom: 3px solid #2160C4; padding-bottom: 8px; }
    h2 { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #2160C4; }
    h3, h4 { font-family: 'Bebas Neue', sans-serif; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #f5f5f5; }
    code { background: #f0f0f0; padding: 2px 6px; font-size: 12px; }
    pre { background: #f5f5f5; padding: 12px; overflow-x: auto; }
    blockquote { border-left: 4px solid #C8A43C; padding-left: 16px; color: #555; }
    a { color: #2160C4; }
    .pdf-footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #1a1a1a; font-size: 10px; color: #999; }
    @media print { body { padding: 0; } }
  </style>
</head><body>
  <h1>${escHtml(section.label)}</h1>
  <p style="color:#666;font-size:13px;">MindrianOS Data Room — ${new Date().toISOString().split('T')[0]}</p>
  ${rendered}
  <div class="pdf-footer">
    Generated by MindrianOS — <a href="https://mindrianos-jsagirs-projects.vercel.app">mindrianos-jsagirs-projects.vercel.app</a>
    | Created by Jonathan Sagir | PWS methodology by Prof. Lawrence Aronhime
  </div>
</body></html>`;

    // Set headers for print/download
    res.type('html').send(pdfHtml);
  });

  // ── BYOAPI Chat endpoint ──
  app.post('/api/chat', express.json(), async (req, res) => {
    const { message, section, apiKey, apiProvider } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Build page context for scoped chat
    const context = buildPageContext(absRoom, roomData, section || null);

    // If user provides their own API key, proxy to their LLM
    if (apiKey && apiProvider) {
      try {
        let apiUrl, headers, body;

        if (apiProvider === 'anthropic') {
          apiUrl = 'https://api.anthropic.com/v1/messages';
          headers = { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
          body = JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: context,
            messages: [{ role: 'user', content: message }]
          });
        } else if (apiProvider === 'openai') {
          apiUrl = 'https://api.openai.com/v1/chat/completions';
          headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
          body = JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: context }, { role: 'user', content: message }]
          });
        } else {
          return res.json({ reply: 'Unsupported API provider. Use "anthropic" or "openai".', source: 'error' });
        }

        const apiRes = await fetch(apiUrl, { method: 'POST', headers, body });
        const data = await apiRes.json();

        let reply = '';
        if (apiProvider === 'anthropic' && data.content) {
          reply = data.content[0]?.text || 'No response';
        } else if (apiProvider === 'openai' && data.choices) {
          reply = data.choices[0]?.message?.content || 'No response';
        } else {
          reply = JSON.stringify(data);
        }

        return res.json({ reply, source: apiProvider, section });
      } catch (err) {
        return res.json({ reply: 'API call failed: ' + err.message, source: 'error' });
      }
    }

    // No API key — return context-aware stub response
    return res.json({
      reply: 'Chat is ready but needs an API key. Click the settings icon in the chat panel to add your Anthropic or OpenAI key. Your key stays in your browser (localStorage) — never sent to MindrianOS servers.',
      source: 'stub',
      context_summary: `Scoped to: ${section || 'entire room'} (${context.length} chars of context available)`
    });
  });

  // ── 404 handler ──
  app.use((req, res) => {
    render404(res, roomData, `Page not found: ${req.path}`);
  });

  // ── Start file watcher for auto-refresh ──
  const watcher = startWatcher(absRoom, (change) => {
    console.log(`[wiki] ${change.event}: ${change.path}`);
    rebuild();
  });

  // ── Start server ──
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Wiki running at http://localhost:${port}`);
      resolve({ app, server, port, watcher });
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
