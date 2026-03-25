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
const { wrapInLayout, renderInfobox, renderSidebar, renderBacklinks, renderSeeAlso, renderGraphLinks } = require('./wiki-layout.cjs');
const { getPageLinks, getBacklinks, getSeeAlso, getGraphData, EDGE_DISPLAY } = require('./graph-links.cjs');

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

  // ── Route: Graph View ──
  app.get('/wiki/graph', async (req, res) => {
    rebuild();
    const graphData = await getGraphData(absRoom);

    const sectionColorMap = {};
    for (const [name, sec] of roomData.sections) {
      sectionColorMap[name] = sec.color;
    }

    const legendItems = Object.entries(EDGE_DISPLAY).map(([type, d]) =>
      `<span class="graph-legend-item"><span class="graph-legend-dot" style="background:${d.color}"></span>${d.symbol} ${d.label}</span>`
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
          var edgeColors = ${JSON.stringify(Object.fromEntries(
            Object.entries(EDGE_DISPLAY).map(([k, v]) => [k, v.color])
          ))};

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
                  'color': isDark ? '#F5F0E8' : '#1A1A1A',
                  'font-size': '11px',
                  'font-family': 'Inter, sans-serif',
                  'text-valign': 'bottom',
                  'text-margin-y': 6,
                  'width': 24,
                  'height': 24,
                  'border-width': 2,
                  'border-color': isDark ? '#2A2A2A' : '#E0DCD4',
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
                  'border-color': '#C8A43C'
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
              style: { 'line-color': '#3A5A9E', 'target-arrow-color': '#3A5A9E' }
            }, {
              duration: 1200,
              complete: function() {
                this.animate({
                  style: { 'line-color': '#1E3A6E', 'target-arrow-color': '#1E3A6E' }
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

    // Build infobox + connections panel for right rail
    const infoboxHtml = renderInfobox(rendered.frontmatter, sectionColor);
    const connectionsHtml = renderGraphLinks(links);
    const combinedInfobox = infoboxHtml + connectionsHtml;

    const sidebar = renderSidebar(roomData.sections, page.section);

    // Add heading IDs for TOC anchoring
    let bodyHtml = `<h1>${escHtml(page.title)}</h1>\n${rendered.html}`;
    bodyHtml = addHeadingIds(bodyHtml);

    // Append "See also" and "What links here" sections to body
    bodyHtml += renderSeeAlso(seeAlso);
    bodyHtml += renderBacklinks(backlinks);

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
