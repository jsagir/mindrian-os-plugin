'use strict';

/**
 * Deterministic vault scanner for Phase 80 Stage 01 (ingest).
 *
 * Walks a directory of .md/.markdown files and returns the files[] array
 * consumed by Stage 02. No AI. No file moves. Safe to re-run.
 *
 * Skips .obsidian/, .git/, node_modules/, .trash/, hidden dirs, and any
 * folder in SKIP_DIRS. Parses YAML frontmatter via gray-matter with a
 * try/catch that swallows malformed YAML (sets source_frontmatter = {}).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const SKIP_DIRS = new Set([
  '.obsidian',
  '.git',
  'node_modules',
  '.trash',
  '.context',
  '.lazygraph',
  '.mindrian'
]);
const MD_EXT = new Set(['.md', '.markdown']);
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

function scanVault(sourcePath, opts) {
  opts = opts || {};
  if (!fs.existsSync(sourcePath)) {
    throw new Error('source path not found: ' + sourcePath);
  }
  const files = [];
  const skipped = [];
  let counter = 0;

  function walk(dir, rel) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    // Stable ordering for deterministic output
    entries.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    for (const entry of entries) {
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.')) {
          skipped.push(relPath);
          continue;
        }
        walk(path.join(dir, entry.name), relPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!MD_EXT.has(ext)) continue;

      const abs = path.join(dir, entry.name);
      let content;
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch (e) {
        skipped.push(relPath);
        continue;
      }
      let parsed = { data: {}, content: content };
      try {
        parsed = matter(content);
      } catch (e) {
        parsed = { data: {}, content: content };
      }
      const wikilinks = [];
      let m;
      const body = parsed.content || '';
      WIKILINK_RE.lastIndex = 0;
      while ((m = WIKILINK_RE.exec(body)) !== null) {
        const target = m[1].split('|')[0].trim();
        if (target) wikilinks.push(target);
      }
      const stat = fs.statSync(abs);
      counter += 1;
      files.push({
        id: 'f_' + String(counter).padStart(3, '0'),
        source_path: relPath,
        source_abs_path: abs,
        source_size: stat.size,
        source_mtime: stat.mtime.toISOString(),
        source_hash: 'sha1:' + crypto.createHash('sha1').update(content).digest('hex'),
        source_frontmatter: parsed.data || {},
        source_wikilinks: wikilinks,
        parent_folder: rel ? path.basename(rel) : null
      });
    }
  }

  walk(sourcePath, '');
  return { files: files, skipped: skipped };
}

module.exports = { scanVault: scanVault, SKIP_DIRS: SKIP_DIRS };
