'use strict';
/**
 * page-renderer.cjs - Markdown rendering pipeline for the wiki
 *
 * Scans room/ directory for .md files at every depth, parses frontmatter,
 * renders markdown with wikilinks, and generates TOC.
 *
 * Walk (quick 261012-ri7): the root level lists root files and section
 * folders. Inside a section, folders at every depth come from the shared
 * discoverSections helper (Canon Part 7), and one non-recursive helper lists
 * the .md files of a single folder. No function here both reads a directory
 * and calls itself. Known limits: a folder named in STRUCTURAL_DIRS (meetings,
 * team, references) below the root is not walked, and only .md files become
 * pages.
 *
 * Page id rule: the id is the room-relative path without .md, with forward
 * slashes (research/name, research/name/name, research/other/name). A root
 * file keeps its basename as id.
 */

const fs = require('fs');
const path = require('path');
const markdownIt = require('markdown-it');
const matter = require('gray-matter');
const { discoverSections } = require('../core/section-registry.cjs');
const { isRealpathContained } = require('../core/room-path-containment.cjs');

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
 * True when a folder never becomes a section or part of one: a SKIP_DIRS
 * name, any dot-directory, export/exports (the share-bundle output area), or a
 * sub-room (a directory holding its own .room-root sentinel is another room,
 * never absorbed into its parent -- the pack's BUD boundary rule). Applied at
 * every depth.
 * @param {string} name - folder basename
 * @param {string} absDir - absolute folder path
 * @returns {boolean}
 */
function isSkippedDir(name, absDir) {
  if (SKIP_DIRS.has(name)) return true;
  if (name.startsWith('.')) return true;
  if (name === 'export' || name === 'exports') return true;
  return fs.existsSync(path.join(absDir, '.room-root'));
}

/**
 * List the .md files of ONE folder (never recurses). Real files only (a
 * symlink is never a Dirent file), no dotfile, no STATE.md. Absolute paths in
 * codepoint order of the file name. An unreadable folder gives an empty list.
 * @param {string} dir
 * @returns {string[]}
 */
function listMarkdownFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  const names = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name.startsWith('.')) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    names.push(entry.name);
  }
  names.sort(byCodepoint);
  return names.map((name) => path.join(dir, name));
}

function byCodepoint(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toRel(absRoom, filePath) {
  return path.relative(absRoom, filePath).split(path.sep).join('/');
}

/**
 * Add the pages of one folder, then descend into the child folders that
 * discoverSections lists. The walk itself reads no directory: the files come
 * from listMarkdownFiles and the child folders from discoverSections. No
 * symlinked folder is ever entered (discoverSections lists real directories
 * only), so the recursion ends.
 */
function walkSectionTree(dir, sectionName, absRoom, pages, sectionPages, scanWarnings) {
  for (const file of listMarkdownFiles(dir)) {
    const rel = toRel(absRoom, file);
    if (isPrivateRoomPath(rel)) continue;
    if (!isRealpathContained(absRoom, file)) continue;
    const page = parsePage(file, sectionName, absRoom, scanWarnings);
    if (!page) continue;
    pages.set(page.id, page);
    sectionPages.push(page.id);
  }

  let children = [];
  try {
    children = discoverSections(dir).all.slice().sort(byCodepoint);
  } catch (_e) {
    children = [];
  }
  for (const child of children) {
    const childDir = path.join(dir, child);
    if (isSkippedDir(child, childDir)) continue;
    walkSectionTree(childDir, sectionName, absRoom, pages, sectionPages, scanWarnings);
  }
}

/**
 * Scan room/ for .md files at every depth. Root files become pages in the
 * '_root' section. Every root folder is a section; inside it the walk goes
 * through discoverSections to any depth (decision-16 nested artifacts
 * section/name/name.md, their sibling files and deeper files). Returns
 * { pages: Map, sections: Map, scanWarnings: Array<{ path, reason }> }.
 * A file whose frontmatter fails to parse still becomes a page (empty
 * properties, body kept) and is listed in scanWarnings.
 */
function scanRoom(roomDir) {
  const absRoom = path.resolve(roomDir);
  const pages = new Map();   // id -> { path, section, title, frontmatter, content }
  const sections = new Map(); // section-name -> { label, color, pages: [] }
  const scanWarnings = [];

  if (!fs.existsSync(absRoom)) {
    return { pages, sections, scanWarnings };
  }

  const entries = fs.readdirSync(absRoom, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      // Top-level .md files (e.g., README.md at room root). Only real files
      // (symlinks skipped, same as the section walk); never a dot-file or a
      // root identity file (quick 260923-lu5, SEED-006 Q0.1).
      if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('.') &&
        !SKIP_FILES.has(entry.name) &&
        !PRIVATE_ROOT_FILES.has(entry.name)
      ) {
        const filePath = path.join(absRoom, entry.name);
        const page = parsePage(filePath, '_root', absRoom, scanWarnings);
        if (page) pages.set(page.id, page);
      }
      continue;
    }

    const sectionName = entry.name;
    const sectionDir = path.join(absRoom, sectionName);
    if (isSkippedDir(sectionName, sectionDir)) continue;

    const label = sectionName
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const color = SECTION_COLORS[sectionName] || '#5C5A56';

    const sectionPages = [];
    walkSectionTree(sectionDir, sectionName, absRoom, pages, sectionPages, scanWarnings);
    sectionPages.sort(byCodepoint);

    sections.set(sectionName, { label, color, pages: sectionPages });
  }

  return { pages, sections, scanWarnings };
}

/**
 * Remove a leading frontmatter block (first line ---, up to and including the
 * next line that is ---) from raw text. Used only when gray-matter throws.
 */
function stripFrontmatterBlock(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') return raw;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(i + 1).join('\n');
  }
  return raw;
}

/**
 * Parse a single .md file into a page object. Returns null (and records an
 * 'unreadable' warning) when the file cannot be read. A frontmatter parse
 * failure keeps the body, uses empty properties and records a
 * 'frontmatter_parse_failed' warning.
 */
function parsePage(filePath, section, roomDir, scanWarnings) {
  const rel = toRel(roomDir, filePath);
  const warn = (reason) => {
    if (Array.isArray(scanWarnings)) scanWarnings.push({ path: rel, reason });
  };

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    warn('unreadable');
    return null;
  }

  let frontmatter;
  let content;
  try {
    // The empty options object bypasses gray-matter's content cache. That cache
    // stores the file BEFORE it parses it, so after one throw the next call with
    // the same text returns the half-parsed entry without throwing and without
    // a scan warning. The server rescans on every view, so it must not use it.
    const parsed = matter(raw, {});
    frontmatter = parsed.data;
    content = parsed.content;
  } catch (_e) {
    frontmatter = {};
    content = stripFrontmatterBlock(raw);
    warn('frontmatter_parse_failed');
  }

  const basename = path.basename(filePath, '.md');
  const id = section === '_root' ? basename : rel.replace(/\.md$/, '');
  // A frontmatter title can parse as a number or a date; buildPageIndex and the
  // search index call string methods on it, so coerce to a string here.
  const title = frontmatter.title ? String(frontmatter.title) : basename
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { id, path: filePath, section, title, frontmatter, content };
}

/**
 * Build lookup index for wikilink resolution.
 * Maps lowercase id / title / basename / artifact-folder keys to wiki URLs.
 *
 * Deterministic (D4, quick 261012-ri7): pages are ordered by number of id
 * segments (fewer first), then by id in codepoint order. Pass 1 sets every
 * full id key; the first page in that order wins a case-insensitive tie.
 * Pass 2, in the same order, sets the lowercased title, the lowercased
 * basename and, for a decision-16 artifact (3 or more segments whose last 2
 * segments are equal), the lowercased folder path, each only when the key is
 * not set yet. So [[name]] resolves to the page whose full id is name; if
 * none, to the first page whose title, basename or folder path is name.
 */
function buildPageIndex(pages) {
  const index = new Map();
  const ordered = Array.from(pages.entries()).sort((a, b) => {
    const sa = a[0].split('/').length;
    const sb = b[0].split('/').length;
    if (sa !== sb) return sa - sb;
    return byCodepoint(a[0], b[0]);
  });

  for (const [id] of ordered) {
    const key = id.toLowerCase();
    if (!index.has(key)) index.set(key, `/wiki/${id}`);
  }

  for (const [id, page] of ordered) {
    const url = `/wiki/${id}`;
    const setOnce = (key) => {
      if (!index.has(key)) index.set(key, url);
    };
    setOnce(page.title.toLowerCase());
    const segs = id.split('/');
    setOnce(segs[segs.length - 1].toLowerCase());
    if (segs.length >= 3 && segs[segs.length - 1] === segs[segs.length - 2]) {
      setOnce(segs.slice(0, -1).join('/').toLowerCase());
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
