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
  isPrivateRoomPath,
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
const { isRealpathContained, realRoomRoot } = require('../core/room-path-containment.cjs');

// Extensions the share bundle is allowed to copy (quick 260923-lu5, SEED-006
// Algorithm 4 allowlist). Anything else is skipped with a 'not_allowed' reason.
const ASSET_ALLOW_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf', '.csv']);

// Per-file size cap for a copied asset, 20 MiB (SEED-006 Algorithm 4 PER_FILE).
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

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
 *
 * Additive (quick 260923-lu5, SEED-006 Q0.2 / F2): every captured
 * /room-assets/ remainder is also collected into assetRefs, so the caller can
 * copy ONLY the referenced files rather than the whole room. The href
 * rewriting itself is unchanged -- a reference later refused by
 * copyReferencedAssets simply points at an assets/ file that never gets
 * written (a broken image in the bundle, never a privacy leak).
 * @param {string} html
 * @param {string} prefix '' at root depth, '../' inside a section dir
 * @returns {{html:string, hadAssets:boolean, assetRefs:string[]}}
 */
function rewriteStaticPaths(html, prefix) {
  let hadAssets = false;
  const assetRefs = [];

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
    assetRefs.push(rest);
    return `src="${prefix}assets/${rest}"`;
  });

  return { html, hadAssets, assetRefs };
}

/**
 * copyReferencedAssets(absRoom, absOut, refs) -> copy ONLY the referenced,
 * allowlisted room assets into absOut/assets/<rel> (quick 260923-lu5,
 * SEED-006 Q0.2 / F2, Algorithm 4). Replaces the prior whole-room fs.cpSync,
 * which copied every private file (room.db included) as soon as any page
 * referenced /room-assets/, and crashed with ERR_FS_CP_EINVAL whenever absOut
 * sat inside absRoom.
 *
 * Each ref is checked, in order, and skipped (with a reason) the first time
 * it fails a gate; only a ref that clears every gate is actually copied.
 *
 * @param {string} absRoom
 * @param {string} absOut
 * @param {string[]} refs - raw /room-assets/<rest> captures from rewriteStaticPaths
 * @returns {{copied: string[], warnings: Array<{ref: string, reason: string}>}}
 */
function copyReferencedAssets(absRoom, absOut, refs) {
  const copied = [];
  const warnings = [];
  const seen = new Set();

  for (const rawRef of refs) {
    if (seen.has(rawRef)) continue;
    seen.add(rawRef);

    // Strip ?query or #hash.
    const stripped = rawRef.split('#')[0].split('?')[0];

    let decoded;
    try {
      decoded = decodeURIComponent(stripped);
    } catch (_e) {
      warnings.push({ ref: rawRef, reason: 'bad_uri' });
      continue;
    }

    const normalized = path.posix.normalize(decoded);
    if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
      warnings.push({ ref: rawRef, reason: 'outside_room' });
      continue;
    }

    if (isPrivateRoomPath(normalized)) {
      warnings.push({ ref: rawRef, reason: 'private_path' });
      continue;
    }

    const ext = path.extname(normalized).toLowerCase();
    if (!ASSET_ALLOW_EXT.has(ext)) {
      warnings.push({ ref: rawRef, reason: 'not_allowed' });
      continue;
    }

    const src = path.join(absRoom, normalized);

    if (!fs.existsSync(src)) {
      warnings.push({ ref: rawRef, reason: 'missing' });
      continue;
    }

    if (!isRealpathContained(absRoom, src)) {
      warnings.push({ ref: rawRef, reason: 'outside_room' });
      continue;
    }

    let real;
    try {
      real = fs.realpathSync(src);
    } catch (_e) {
      warnings.push({ ref: rawRef, reason: 'missing' });
      continue;
    }

    // A symlink can land inside a dot-dir even though its lexical path did
    // not -- re-check the REAL room-relative path (defense in depth).
    const root = realRoomRoot(absRoom);
    const realRel = path.relative(root, real).split(path.sep).join('/');
    if (isPrivateRoomPath(realRel)) {
      warnings.push({ ref: rawRef, reason: 'private_path' });
      continue;
    }

    const realOut = fs.existsSync(absOut) ? fs.realpathSync(absOut) : path.resolve(absOut);
    if (real === realOut || real.startsWith(realOut + path.sep)) {
      warnings.push({ ref: rawRef, reason: 'inside_output' });
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(real);
    } catch (_e) {
      warnings.push({ ref: rawRef, reason: 'missing' });
      continue;
    }
    if (!stat.isFile()) {
      warnings.push({ ref: rawRef, reason: 'not_file' });
      continue;
    }
    if (stat.size > MAX_ASSET_BYTES) {
      warnings.push({ ref: rawRef, reason: 'oversize' });
      continue;
    }

    const dest = path.join(absOut, 'assets', normalized);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(real, dest);
    copied.push(normalized);
  }

  return { copied, warnings };
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

  // Refuse BEFORE the rmSync below when absOut is the room root or an
  // ancestor of it (quick 260923-lu5, SEED-006 Q0.2 / F2): today's code would
  // otherwise rm -rf the room itself. An outDir INSIDE the room (the default
  // export/wiki run from a room cwd) is fine and handled below.
  if (absOut === absRoom || absRoom.startsWith(absOut + path.sep)) {
    throw new Error('exportStaticWiki: outDir must not be the room root or an ancestor of it');
  }

  const roomData = scanRoom(absRoom);
  const pageIndex = buildPageIndex(roomData.pages);

  // Idempotent: clear stale output then recreate.
  fs.rmSync(absOut, { recursive: true, force: true });
  fs.mkdirSync(absOut, { recursive: true });

  let pageCount = 0;
  let needAssets = false;
  const assetRefSet = new Set();
  const collectAssetRefs = (refs) => {
    for (const r of refs) assetRefSet.add(r);
  };

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
    const { html, hadAssets, assetRefs } = rewriteStaticPaths(wrapped, '');
    if (hadAssets) collectAssetRefs(assetRefs);
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
    const { html, hadAssets, assetRefs } = rewriteStaticPaths(wrapped, '');
    if (hadAssets) collectAssetRefs(assetRefs);
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
      const { html, hadAssets, assetRefs } = rewriteStaticPaths(wrapped, '../');
      if (hadAssets) collectAssetRefs(assetRefs);
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
      const { html, hadAssets, assetRefs } = rewriteStaticPaths(wrapped, '../');
      if (hadAssets) collectAssetRefs(assetRefs);
      if (hadAssets) needAssets = true;

      const base = pid.includes('/') ? pid.split('/').pop() : pid;
      write(secDir, `${base}.html`, html);
    }
  }

  // ── Assets: copy ONLY the referenced, allowlisted room assets, never the
  // whole room (quick 260923-lu5, SEED-006 Q0.2 / F2). ──
  let assetCount = 0;
  let assetWarnings = [];
  if (needAssets && fs.existsSync(absRoom)) {
    const { copied, warnings } = copyReferencedAssets(absRoom, absOut, Array.from(assetRefSet));
    assetCount = copied.length;
    assetWarnings = warnings;
  }

  console.log(`Exported ${pageCount} page(s) to ${absOut}`);
  for (const w of assetWarnings) {
    console.log(`asset skipped (${w.reason}): ${w.ref}`);
  }
  return { outDir: absOut, pageCount, assetCount, assetWarnings };
}

module.exports = { exportStaticWiki, rewriteStaticPaths, copyReferencedAssets };

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
