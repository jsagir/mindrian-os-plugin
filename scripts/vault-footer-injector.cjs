#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Branded Footer Injector
 *
 * Appends a MindrianOS branded footer to every content artifact in a room
 * folder. Footer format varies by file type (content, team, meeting,
 * filed-to, xref, persona). System files are never touched. Idempotent:
 * running twice produces identical output.
 *
 * Usage:
 *   node scripts/vault-footer-injector.cjs <roomDir> [--dry-run] [--enrich-frontmatter]
 *
 * Flags:
 *   --dry-run              Report what would change, write nothing.
 *   --enrich-frontmatter   Also call enrichFrontmatter() on each file.
 *
 * Stats output (JSON on stdout):
 *   { footers_added, skipped_system, skipped_existing,
 *     frontmatter_enriched, files: [{path, type, action}] }
 *
 * Exits 0 on success. Zero npm dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  detectFileType,
  enrichFrontmatter,
  parseFrontmatter,
  SYSTEM_FILES,
  extractSection,
  extractDate,
} = require('../lib/vault/frontmatter-schema.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FOOTER_MARKER = '> MindrianOS |';
const FOOTER_BRAND = '> ■ MindrianOS |';

const SKIP_DIRS = new Set([
  '.git',
  '.obsidian',
  '.presentation',
  '.lazygraph',
  '.cache',
  'node_modules',
]);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { roomDir: null, dryRun: false, enrichFm: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--enrich-frontmatter') args.enrichFm = true;
    else if (!a.startsWith('--') && !args.roomDir) args.roomDir = a;
  }
  return args;
}

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

function* walkMarkdown(rootDir) {
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && SKIP_DIRS.has(e.name)) continue;
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        yield full;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function getTeamCategory(relPath) {
  // team/<category>/<person>/PROFILE.md
  const parts = relPath.split('/');
  const idx = parts.indexOf('team');
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return 'member';
}

function getMeetingSlug(relPath) {
  // meetings/<slug>/summary.md  OR  meetings/<slug>/filed-to/stub.md
  const parts = relPath.split('/');
  const idx = parts.indexOf('meetings');
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return 'meeting';
}

function getPersonaHatColor(frontmatter, basename) {
  if (frontmatter && frontmatter.hat) return String(frontmatter.hat);
  if (frontmatter && frontmatter['hat-color']) return String(frontmatter['hat-color']);
  const m = basename.match(/(white|red|black|yellow|green|blue)-hat/i);
  if (m) return m[1].toLowerCase();
  return basename.replace(/\.md$/, '');
}

function getDisplayName(frontmatter, body) {
  if (frontmatter && frontmatter.name) return String(frontmatter.name);
  const m = String(body || '').match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return '';
}

// ---------------------------------------------------------------------------
// Footer templates (BRAND-02)
// ---------------------------------------------------------------------------

function buildFooter(type, relPath, frontmatter, body, roomName) {
  const basename = path.basename(relPath);
  const section = extractSection(relPath);
  const date = extractDate(frontmatter || {}, relPath);

  switch (type) {
    case 'content': {
      return [
        `${FOOTER_BRAND} ${section} | ${date}`,
        `> Room: ${roomName} | Type: ${type}`,
      ].join('\n');
    }
    case 'team': {
      const category = getTeamCategory(relPath);
      const displayName = getDisplayName(frontmatter, body) || basename.replace(/\.md$/, '');
      return [
        `${FOOTER_BRAND} team profile | ${category}`,
        `> Room: ${roomName} | ${displayName}`,
      ].join('\n');
    }
    case 'meeting': {
      const slug = getMeetingSlug(relPath);
      return [
        `${FOOTER_BRAND} meeting | ${slug}`,
        `> Room: ${roomName} | ${date}`,
      ].join('\n');
    }
    case 'filed-to': {
      const stubName = basename.replace(/\.md$/, '');
      return [
        `${FOOTER_BRAND} meeting extract | filed-to ${stubName}`,
        `> Room: ${roomName}`,
      ].join('\n');
    }
    case 'xref': {
      return [
        `${FOOTER_BRAND} cross-reference | ${section}`,
        `> Room: ${roomName} | ${date}`,
      ].join('\n');
    }
    case 'persona': {
      const hat = getPersonaHatColor(frontmatter, basename);
      return [
        `${FOOTER_BRAND} ai persona | ${hat}`,
        `> Room: ${roomName}`,
      ].join('\n');
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Footer placement
// ---------------------------------------------------------------------------

function appendFooter(content, footer) {
  let trimmed = content.replace(/\s+$/, '');
  // Avoid doubling the horizontal rule if content already ends with one
  const endsWithHr = /(^|\n)---\s*$/.test(trimmed);
  const sep = endsWithHr ? '\n\n' : '\n\n---\n\n';
  return trimmed + sep + footer + '\n';
}

function hasExistingFooter(content) {
  // Match either the plain marker or the branded (with ■) marker
  return /^>\s*(?:■\s*)?MindrianOS\s*\|/m.test(content);
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

function processFile(absPath, roomDir, roomName, opts, stats) {
  const relPath = path.relative(roomDir, absPath).replace(/\\/g, '/');
  const basename = path.basename(relPath);

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    stats.files.push({ path: relPath, type: 'unknown', action: 'read-error' });
    return;
  }

  const parsed = parseFrontmatter(content);
  const type = detectFileType(relPath, parsed.frontmatter);

  // System skip
  if (type === 'system' || SYSTEM_FILES.has(basename)) {
    stats.skipped_system++;
    stats.files.push({ path: relPath, type: 'system', action: 'skip-system' });
    return;
  }

  let working = content;
  let modified = false;

  // Optional frontmatter enrichment
  if (opts.enrichFm) {
    const enriched = enrichFrontmatter(working, relPath, roomName);
    if (enriched !== working) {
      working = enriched;
      stats.frontmatter_enriched++;
      modified = true;
    }
  }

  // Idempotency check
  if (hasExistingFooter(working)) {
    stats.skipped_existing++;
    stats.files.push({ path: relPath, type, action: 'skip-existing-footer' });
    // Still flush enrichment-only changes if any were made
    if (modified && !opts.dryRun) {
      try {
        fs.writeFileSync(absPath, working);
      } catch (err) {
        stats.files.push({ path: relPath, type, action: 'write-error' });
      }
    }
    return;
  }

  // Re-parse after enrichment so template uses enriched fm
  const reparsed = parseFrontmatter(working);
  const footer = buildFooter(type, relPath, reparsed.frontmatter, reparsed.body, roomName);
  if (!footer) {
    stats.files.push({ path: relPath, type, action: 'no-template' });
    return;
  }

  const updated = appendFooter(working, footer);
  stats.footers_added++;
  stats.files.push({ path: relPath, type, action: 'add-footer' });

  if (!opts.dryRun) {
    try {
      fs.writeFileSync(absPath, updated);
    } catch (err) {
      stats.files.push({ path: relPath, type, action: 'write-error' });
    }
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.roomDir) {
    console.error('Usage: vault-footer-injector.cjs <roomDir> [--dry-run] [--enrich-frontmatter]');
    process.exit(1);
  }

  const roomDir = path.resolve(args.roomDir);
  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    console.error(`Room directory not found: ${roomDir}`);
    process.exit(1);
  }

  const roomName = path.basename(roomDir);
  const stats = {
    footers_added: 0,
    skipped_system: 0,
    skipped_existing: 0,
    frontmatter_enriched: 0,
    files: [],
  };

  for (const abs of walkMarkdown(roomDir)) {
    processFile(abs, roomDir, roomName, args, stats);
  }

  process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  buildFooter,
  hasExistingFooter,
  appendFooter,
  processFile,
};
