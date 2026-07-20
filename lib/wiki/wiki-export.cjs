'use strict';
/**
 * wiki-export.cjs -- static share-export generator (SPEC Req 9, Plan 06).
 *
 * Honest history: `/mos:wiki --export` was DOCUMENTED in commands/wiki.md but
 * never implemented -- scripts/serve-wiki treated its first argument as a port,
 * so `--export` errored out. This module is the real thing.
 *
 * exportStaticWiki(roomDir, outDir) walks the room over the READ-ONLY page
 * renderer path (page-renderer.cjs + room-home.cjs staticExport) -- never the
 * BlockNote editor bundle -- and writes a self-viewing static HTML bundle to
 * outDir (default export/wiki):
 *   - index.html                    Room Home (staticExport: no Generate Briefing)
 *   - graph.html                    Cytoscape graph, graphData baked inline
 *   - <section>/index.html          section-card list
 *   - <section>/<page>.html         renderPage read-only article + baked
 *                                   backlinks/see-also panels
 *
 * The bundle exposes NO save/edit affordance: no editor mount, no /editor
 * script, no Save button, no Generate Briefing, no live /api/* calls. Every
 * /wiki/* href is rewritten to a page-relative .html target so the pages
 * navigate each other from file:// with no server.
 *
 * CJS, no new dependencies. No em-dashes (CLAUDE.md HARD RULE). Nothing here
 * reaches the network or the Brain (Canon Part 8).
 */

const fs = require('fs');
const path = require('path');

const {
  scanRoom,
  renderPage,
  buildPageIndex,
  SECTION_COLORS,
} = require('./page-renderer.cjs');
const {
  wrapInLayout,
  renderInfobox,
  renderSidebar,
  renderBacklinks,
  renderSeeAlso,
} = require('./wiki-layout.cjs');
const { getBacklinks, getSeeAlso, getGraphData, EDGE_DISPLAY } = require('./graph-links.cjs');
const { getRoomHomeData, renderRoomHomeBody } = require('./room-home.cjs');

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Canonical M:OS edge hex (render-layer override, mirrors the served graph route;
// EDGE_DISPLAY in graph-links.cjs is NOT edited, D-10).
const CANONICAL_EDGE_HEX = {
  INFORMS: '#1E52E0',
  CONTRADICTS: '#E11D22',
  CONVERGES: '#FFC400',
  ENABLES: '#12A06A',
  INVALIDATES: '#B5602A',
};

/**
 * Rewrite server-absolute paths to page-relative static targets.
 *   href="/wiki"                    -> ${prefix}index.html
 *   href="/wiki/graph"              -> ${prefix}graph.html
 *   href="/wiki/<section>"          -> ${prefix}<section>/index.html
 *   href="/wiki/<section>/<page>"   -> ${prefix}<section>/<page>.html
 *   src="/room-assets/<x>"          -> ${prefix}assets/<x>  (only if present)
 * @param {string} html
 * @param {string} prefix '' at root depth, '../' inside a section dir
 * @returns {{html:string, hadAssets:boolean}}
 */
function rewriteStaticPaths(html, prefix) {
  let hadAssets = false;

  html = html.replace(/href="\/wiki(\/[^"]*)?"/g, (m, rest) => {
    const segs = rest ? rest.slice(1).split('/').filter(Boolean) : [];
    let target;
    if (segs.length === 0) {
      target = 'index.html';
    } else if (segs.length === 1) {
      target = segs[0] === 'graph' ? 'graph.html' : `${segs[0]}/index.html`;
    } else {
      const section = segs[0];
      const page = segs.slice(1).join('/');
      target = `${section}/${page}.html`;
    }
    return `href="${prefix}${target}"`;
  });

  html = html.replace(/src="\/room-assets\/([^"]*)"/g, (m, rest) => {
    hadAssets = true;
    return `src="${prefix}assets/${rest}"`;
  });

  return { html, hadAssets };
}

/**
 * Build the Cytoscape graph body (baked graphData, unpkg CDN). Click handlers
 * navigate to page-relative .html files (graph.html lives at root depth).
 */
function renderGraphBody(graphData, roomData) {
  const sectionColorMap = {};
  for (const [name, sec] of roomData.sections) {
    sectionColorMap[name] = sec.color;
  }

  const legendItems = Object.entries(EDGE_DISPLAY)
    .map(
      ([type, d]) =>
        `<span class="graph-legend-item"><span class="graph-legend-dot" style="background:${
          CANONICAL_EDGE_HEX[type] || d.color
        }"></span>${d.symbol} ${d.label}</span>`
    )
    .join('\n');

  return `
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
          if (typeof cytoscape === 'undefined') return;

          var elements = [];
          graphData.nodes.forEach(function(n) {
            elements.push({ data: {
              id: n.id, label: n.title, section: n.section,
              color: sectionColors[n.section] || '#5C5A56'
            }});
          });
          graphData.edges.forEach(function(e, i) {
            elements.push({ data: {
              id: 'e' + i, source: e.source, target: e.target, type: e.type,
              color: edgeColors[e.type] || '#5C5A56'
            }});
          });

          var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          var cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            style: [
              { selector: 'node', style: {
                'label': 'data(label)', 'background-color': 'data(color)',
                'color': isDark ? '#F3F2EE' : '#0C0C0D', 'font-size': '11px',
                'font-family': 'Inter, sans-serif', 'text-valign': 'bottom',
                'text-margin-y': 6, 'width': 24, 'height': 24, 'border-width': 2,
                'border-color': isDark ? '#F3F2EE' : '#0C0C0D',
                'text-max-width': '120px', 'text-wrap': 'ellipsis', 'cursor': 'pointer'
              }},
              { selector: 'edge', style: {
                'line-color': 'data(color)', 'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
                'width': 2, 'opacity': 0.7
              }},
              { selector: 'edge[type="CONTRADICTS"]', style: { 'line-style': 'dashed', 'width': 3, 'opacity': 1 } },
              { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#FFC400' } }
            ],
            layout: { name: 'cose', animate: true, padding: 40 }
          });

          // Click node -> navigate to the static article page (relative to root).
          cy.on('tap', 'node', function(evt) {
            window.location.href = evt.target.data('id') + '.html';
          });
        })();
      </script>
  `;
}

/**
 * Build the section-card overview body (mirrors the /wiki/:section route shape).
 */
function renderSectionBody(section, roomData) {
  const cards = section.pages
    .map((pid) => {
      const p = roomData.pages.get(pid);
      const excerpt = p.content.replace(/^---[\s\S]*?---/, '').trim().slice(0, 150);
      return `<div class="section-card">
        <h3><a href="/wiki/${pid}">${escHtml(p.title)}</a></h3>
        <p style="font-size:13px;color:var(--text-muted)">${escHtml(excerpt)}${
        excerpt.length >= 150 ? '...' : ''
      }</p>
      </div>`;
    })
    .join('\n');

  return `
      <h1>${escHtml(section.label)}</h1>
      <p style="color:var(--text-muted);margin-bottom:24px">${section.pages.length} artifact${
    section.pages.length !== 1 ? 's' : ''
  }</p>
      ${cards || '<p style="color:var(--text-muted)">No artifacts in this section yet.</p>'}
  `;
}

/**
 * Generate a static, read-only, M:OS-styled wiki bundle for a room.
 * Idempotent: the output dir is cleared and rewritten on every run.
 *
 * @param {string} roomDir
 * @param {string} [outDir='export/wiki']
 * @returns {Promise<{outDir:string, pageCount:number}>}
 */
async function exportStaticWiki(roomDir, outDir) {
  const absRoom = path.resolve(roomDir);
  const absOut = path.resolve(outDir || 'export/wiki');

  const roomData = scanRoom(absRoom);
  const pageIndex = buildPageIndex(roomData.pages);

  // Idempotent: clear stale output then recreate.
  fs.rmSync(absOut, { recursive: true, force: true });
  fs.mkdirSync(absOut, { recursive: true });

  let pageCount = 0;
  let needAssets = false;

  const write = (dir, name, html) => {
    fs.writeFileSync(path.join(dir, name), html, 'utf8');
    pageCount += 1;
  };

  // ── index.html: Room Home (staticExport -> no Generate Briefing/edit) ──
  {
    const data = getRoomHomeData(absRoom);
    const body = renderRoomHomeBody(data, { staticExport: true });
    const sidebar = renderSidebar(roomData.sections, null);
    const wrapped = wrapInLayout({
      title: 'Room Home',
      bodyHtml: body,
      toc: [],
      sidebar,
      infobox: '',
      sectionColor: null,
      currentPath: '/wiki',
      isHomePage: true,
      exportMode: true,
      hrefPrefix: '',
    });
    const { html, hadAssets } = rewriteStaticPaths(wrapped, '');
    if (hadAssets) needAssets = true;
    write(absOut, 'index.html', html);
  }

  // ── graph.html: Cytoscape graph, baked inline ──
  {
    const graphData = await getGraphData(absRoom);
    const body = renderGraphBody(graphData, roomData);
    const sidebar = renderSidebar(roomData.sections, null);
    const wrapped = wrapInLayout({
      title: 'Knowledge Graph',
      bodyHtml: body,
      toc: [],
      sidebar,
      infobox: '',
      sectionColor: null,
      currentPath: '/wiki/graph',
      isHomePage: false,
      exportMode: true,
      hrefPrefix: '',
    });
    const { html, hadAssets } = rewriteStaticPaths(wrapped, '');
    if (hadAssets) needAssets = true;
    write(absOut, 'graph.html', html);
  }

  // ── Per section: index + articles ──
  for (const [name, section] of roomData.sections) {
    const secDir = path.join(absOut, name);
    fs.mkdirSync(secDir, { recursive: true });

    const sidebar = renderSidebar(roomData.sections, name);

    // section index
    {
      const wrapped = wrapInLayout({
        title: section.label,
        bodyHtml: renderSectionBody(section, roomData),
        toc: [],
        sidebar,
        infobox: '',
        sectionColor: section.color,
        currentPath: `/wiki/${name}`,
        isHomePage: false,
        exportMode: true,
        hrefPrefix: '../',
      });
      const { html, hadAssets } = rewriteStaticPaths(wrapped, '../');
      if (hadAssets) needAssets = true;
      write(secDir, 'index.html', html);
    }

    // articles
    for (const pid of section.pages) {
      const page = roomData.pages.get(pid);
      const rendered = renderPage(page, pageIndex);
      const [backlinks, seeAlso] = await Promise.all([
        getBacklinks(absRoom, pid),
        getSeeAlso(absRoom, pid),
      ]);
      const sectionColor = section.color || SECTION_COLORS[name] || '#5C5A56';

      // Body = the READ-ONLY rendered markdown (never the editor bundle).
      const body = rendered.html;
      // Info rail: properties + See also + backlinks, baked at export time.
      const infobox =
        renderInfobox(rendered.frontmatter, sectionColor) +
        renderSeeAlso(seeAlso) +
        renderBacklinks(backlinks);

      const wrapped = wrapInLayout({
        title: page.title,
        bodyHtml: body,
        toc: rendered.toc,
        sidebar,
        infobox,
        sectionColor,
        currentPath: `/wiki/${pid}`,
        isHomePage: false,
        exportMode: true,
        hrefPrefix: '../',
      });
      const { html, hadAssets } = rewriteStaticPaths(wrapped, '../');
      if (hadAssets) needAssets = true;

      const base = pid.includes('/') ? pid.split('/').pop() : pid;
      write(secDir, `${base}.html`, html);
    }
  }

  // ── Assets: copy the room tree only when a page referenced /room-assets/ ──
  if (needAssets && fs.existsSync(absRoom)) {
    const assetsDir = path.join(absOut, 'assets');
    fs.cpSync(absRoom, assetsDir, { recursive: true });
  }

  console.log(`Exported ${pageCount} page(s) to ${absOut}`);
  return { outDir: absOut, pageCount };
}

module.exports = { exportStaticWiki, rewriteStaticPaths };

// ── CLI entry: node wiki-export.cjs <roomDir> [outDir] ──
if (require.main === module) {
  const roomDir = process.argv[2] || './room';
  const outDir = process.argv[3];
  exportStaticWiki(roomDir, outDir)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Export failed:', e && e.message ? e.message : e);
      process.exit(1);
    });
}
