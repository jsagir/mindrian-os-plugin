'use strict';
/**
 * page-renderer.cjs - Markdown rendering pipeline for the wiki
 *
 * Scans room/ directory for .md files, parses frontmatter,
 * renders markdown with wikilinks, and generates TOC.
 */

const fs = require('fs');
const path = require('path');
const markdownIt = require('markdown-it');
const matter = require('gray-matter');

// Directories to skip when scanning room/
const SKIP_DIRS = new Set(['.lazygraph', '.reasoning', 'meetings', 'node_modules', '.git']);
const SKIP_FILES = new Set(['STATE.md']);

// Root-level identity files that never become pages (quick 260923-lu5,
// SEED-006 Q0.1 / F1). Mirrors scripts/generate-snapshot.cjs SKIP_FILES'
// .md entries -- one list, kept in sync by hand until a shared constants
// module exists (Canon Part 7: reuse before build, no new module for one set).
const PRIVATE_ROOT_FILES = new Set([
  'STATE.md',
  'USER.md',
  'ROOM.md',
  'MINTO.md',
  'JTBD.md',
  'ROOM-INTELLIGENCE.md',
  'MEETINGS-INTELLIGENCE.md',
  'action-items.md',
  'ASSET_MANIFEST.md',
]);

// SQLite main files and their write-ahead-log / shared-memory / journal
// sidecars, case-insensitive (quick 260923-lu5, SEED-006 Q0.1 / F1).
const DB_FILE_RE = /\.(db|sqlite|sqlite3|db3)(-wal|-shm|-journal)?$/i;

/**
 * isPrivateRoomPath(relPath) -> true when relPath is room-private memory that
 * must never reach a published surface (static export, live wiki, view_compile).
 * Pure, no fs access (fail-closed on a bad input). A path is private when:
 *   - any segment starts with a dot (.context, .mindrian, .snapshots,
 *     .intelligence, or any future dot-directory / dotfile), or
 *   - the last segment matches a db/sqlite file or one of its sidecars, or
 *   - the path is a single segment that names a root identity file.
 * Splits on both / and \\ so a Windows-form path (or a value copied from a
 * Windows client) is classified the same as a POSIX one.
 * @param {string} relPath
 * @returns {boolean}
 */
function isPrivateRoomPath(relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return true; // fail closed
  const segments = relPath
    .split(/[\\/]/)
    .filter((seg) => seg.length > 0 && seg !== '.');
  if (segments.length === 0) return true; // fail closed
  if (segments.some((seg) => seg.startsWith('.'))) return true;
  const last = segments[segments.length - 1];
  if (DB_FILE_RE.test(last)) return true;
  if (segments.length === 1 && PRIVATE_ROOT_FILES.has(segments[0])) return true;
  return false;
}

// Section color mapping (matches build-graph)
const SECTION_COLORS = {
  'problem-definition': '#A63D2F',
  'market-analysis': '#C8A43C',
  'solution-design': '#5C5A56',
  'business-model': '#2D6B4A',
  'competitive-analysis': '#B5602A',
  'team-execution': '#1E3A6E',
  'team': '#1E3A6E',
  'legal-ip': '#6B4E8B',
  'financial-model': '#2A6B5E',
  'opportunity-bank': '#C8A43C',
  'funding': '#2D6B4A',
  'personas': '#6B4E8B'
};

/**
 * Scan room/ directory, one level deep, for .md files (NOT recursive: a
 * section's own subdirectories are never walked). Returns { pages: Map,
 * sections: Map }.
 */
function scanRoom(roomDir) {
  const absRoom = path.resolve(roomDir);
  const pages = new Map();   // id -> { path, section, title, frontmatter, content }
  const sections = new Map(); // section-name -> { label, color, pages: [] }

  if (!fs.existsSync(absRoom)) {
    return { pages, sections };
  }

  const entries = fs.readdirSync(absRoom, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      // Top-level .md files (e.g., README.md at room root). Only real files
      // (symlinks skipped, same as the section loop below); never a
      // dot-file or a root identity file (quick 260923-lu5, SEED-006 Q0.1).
      if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('.') &&
        !SKIP_FILES.has(entry.name) &&
        !PRIVATE_ROOT_FILES.has(entry.name)
      ) {
        const filePath = path.join(absRoom, entry.name);
        const page = parsePage(filePath, '_root', absRoom);
        pages.set(page.id, page);
      }
      continue;
    }

    const sectionName = entry.name;
    // Skip the existing SKIP_DIRS, any dot-directory, export/exports (the
    // share-bundle output area is never inlined as a section), and any
    // sub-room (a directory holding its own .room-root sentinel is another
    // room, never absorbed into its parent -- the pack's BUD boundary rule).
    if (SKIP_DIRS.has(sectionName)) continue;
    if (sectionName.startsWith('.')) continue;
    if (sectionName === 'export' || sectionName === 'exports') continue;

    const sectionDir = path.join(absRoom, sectionName);
    if (fs.existsSync(path.join(sectionDir, '.room-root'))) continue;

    const label = sectionName
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const color = SECTION_COLORS[sectionName] || '#5C5A56';

    const sectionPages = [];

    // Read .md files in section directory (one level deep)
    const sectionEntries = fs.readdirSync(sectionDir, { withFileTypes: true });
    for (const se of sectionEntries) {
      if (!se.isFile() || !se.name.endsWith('.md')) continue;
      if (se.name.startsWith('.')) continue;
      if (SKIP_FILES.has(se.name)) continue;

      const filePath = path.join(sectionDir, se.name);
      const page = parsePage(filePath, sectionName, absRoom);
      pages.set(page.id, page);
      sectionPages.push(page.id);
    }

    sections.set(sectionName, { label, color, pages: sectionPages });
  }

  return { pages, sections };
}

/**
 * Parse a single .md file into a page object.
 */
function parsePage(filePath, section, roomDir) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);
  const basename = path.basename(filePath, '.md');
  const id = section === '_root' ? basename : `${section}/${basename}`;
  const title = frontmatter.title || basename
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { id, path: filePath, section, title, frontmatter, content };
}

/**
 * Build lookup index for wikilink resolution.
 * Maps lowercase title / id variants to wiki URLs.
 */
function buildPageIndex(pages) {
  const index = new Map();
  for (const [id, page] of pages) {
    const url = `/wiki/${id}`;
    index.set(id.toLowerCase(), url);
    index.set(page.title.toLowerCase(), url);
    // Also map just the basename
    const base = id.includes('/') ? id.split('/').pop() : id;
    if (!index.has(base.toLowerCase())) {
      index.set(base.toLowerCase(), url);
    }
  }
  return index;
}

/**
 * Create configured markdown-it instance with wikilinks.
 */
function createMarkdownRenderer(pageIndex) {
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true
  });

  // Wikilinks plugin - resolve [[page-name]] to wiki URLs
  try {
    const wikilinks = require('@ig3/markdown-it-wikilinks');
    md.use(wikilinks({
      baseURL: '/wiki/',
      uriSuffix: '',
      makeAllLinksAbsolute: true,
      postProcessPageName: (pageName) => {
        // Try exact lookup first
        const lower = pageName.toLowerCase().replace(/\s+/g, '-');
        if (pageIndex && pageIndex.has(lower)) {
          // Return just the path part after /wiki/
          return pageIndex.get(lower).replace('/wiki/', '');
        }
        return lower;
      }
    }));
  } catch (e) {
    // Wikilinks plugin not installed - render as plain text
    // This is non-fatal; links just won't resolve
  }

  return md;
}

/**
 * Render a page object to HTML with TOC and wikilink extraction.
 * @param {object} pageData - Page object from scanRoom
 * @param {Map} pageIndex - Wikilink resolution index
 * @param {Set} [contradictsTargets] - Set of artifact IDs that have CONTRADICTS relationship from this page
 * @returns {{html, toc, frontmatter, wikilinks}}
 */
function renderPage(pageData, pageIndex, contradictsTargets) {
  const md = createMarkdownRenderer(pageIndex);
  let html = md.render(pageData.content);

  // Post-process: mark CONTRADICTS wikilinks with special class
  if (contradictsTargets && contradictsTargets.size > 0) {
    // Match rendered wikilinks (from markdown-it-wikilinks) and add contradicts class
    html = html.replace(/<a href="\/wiki\/([^"]+)"([^>]*)class="wikilink"([^>]*)>/g, (match, href, before, after) => {
      const normalizedHref = href.toLowerCase();
      for (const target of contradictsTargets) {
        // Check if the link resolves to a contradicts target (by section or full id)
        if (normalizedHref === target.toLowerCase() ||
            normalizedHref.startsWith(target.toLowerCase().split('/')[0])) {
          return `<a href="/wiki/${href}"${before}class="wikilink wikilink-contradicts"${after}>`;
        }
      }
      return match;
    });
  }

  // Extract TOC from rendered HTML (h2/h3)
  const toc = extractTOC(html);

  // Extract wikilinks from source content
  const wikilinks = [];
  const wlRegex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = wlRegex.exec(pageData.content)) !== null) {
    wikilinks.push(match[1]);
  }

  return {
    html,
    toc,
    frontmatter: pageData.frontmatter,
    wikilinks
  };
}

/**
 * Extract TOC entries from rendered HTML.
 * Returns array of { level, text, id }.
 */
function extractTOC(html) {
  const toc = [];
  const headingRegex = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[23]>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[3].replace(/<[^>]+>/g, '').trim();
    const id = match[2] || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    toc.push({ level, text, id });
  }
  return toc;
}

module.exports = {
  scanRoom,
  renderPage,
  buildPageIndex,
  extractTOC,
  SECTION_COLORS,
  isPrivateRoomPath,
  PRIVATE_ROOT_FILES
};
