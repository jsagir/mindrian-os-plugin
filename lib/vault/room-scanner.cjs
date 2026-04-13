/**
 * MindrianOS Plugin -- Shared Room Scanner
 *
 * Walks a Data Room and returns a structured snapshot of its anatomy:
 * top-level sections, sub-rooms, team profiles, meetings + filed-to stubs,
 * and all non-system content files. Zero npm dependencies (fs + path only).
 *
 * Consumed by the vault wikilink injector, branded footer injector, and any
 * other vault-layer script that needs a consistent view of the room.
 *
 *   const { scanRoom } = require('./lib/vault/room-scanner.cjs');
 *   const room = scanRoom('/path/to/room');
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Files that are "system" (identity/state/navigation), not content artifacts.
// Matches the skip-set used by build-ecosystem-graph.cjs.
const SYSTEM_FILES = new Set([
  'STATE.md',
  'ROOM.md',
  'CLAUDE.md',
  'COWORK-INSTRUCTIONS.md',
  'TODOS.md',
  'WHATS-NEXT.md',
  'INDEX.md',
  'MILESTONES.md',
  'TEAM-STATE.md',
  'MEETINGS-INTELLIGENCE.md',
  'action-items.md',
  // Phase 81-02: MINTO.md is generator OUTPUT, not user content. Excluding
  // it from the content scan is required for --write determinism: without
  // this, a second --write run sees the previously written MINTO.md as a
  // new artifact and injects it into the sources list and MECE tree.
  'MINTO.md',
]);

const SKIP_DIRS = new Set([
  '.mindrian',
  '.git',
  'node_modules',
  '.lazygraph',
  '.context',
  'exports',
  'export',
  'diagrams',
  '.obsidian',
]);

// Canonical Data Room section names (top level + sub-room level).
const KNOWN_SECTIONS = new Set([
  'business-model',
  'competitive-analysis',
  'financial-model',
  'legal-ip',
  'market-analysis',
  'meetings',
  'opportunity-bank',
  'problem-definition',
  'solution-design',
  'team',
  'team-execution',
]);

/** Safe readdir that returns [] on error. */
function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
}

/** Safe readFile. Returns string or null. */
function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch (_) {
    return null;
  }
}

/** Parse YAML frontmatter into a flat string->string map. Returns {} if none. */
function parseFrontmatter(content) {
  if (!content || !content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = content.slice(3, end);
  const out = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (m) {
      let v = m[2].trim();
      // Strip surrounding quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  }
  return out;
}

/** Title-case a kebab slug: "avital-leibovich" -> "Avital Leibovich". */
function slugToTitle(slug) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Extract a display name from a PROFILE.md file.
 * Priority: frontmatter.name -> first H1 heading (stripped of parenthetical) -> title-cased folder name.
 */
function extractDisplayName(profilePath, folderName) {
  const content = safeRead(profilePath);
  if (!content) return slugToTitle(folderName);
  const fm = parseFrontmatter(content);
  if (fm.name) return fm.name;
  // Scan post-frontmatter body for first H1
  let body = content;
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) body = content.slice(end + 4);
  }
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) {
    // Strip trailing parenthetical like "(Diplomatic Communications ...)"
    return h1[1].replace(/\s*\(.*\)\s*$/, '').trim();
  }
  return slugToTitle(folderName);
}

/**
 * Walk team/ directory recursively to find all PROFILE.md files.
 * Returns array of { name, displayName, path, relPath, category }.
 */
function findTeamProfiles(roomDir) {
  const profiles = [];
  const teamDir = path.join(roomDir, 'team');
  if (!fs.existsSync(teamDir)) return profiles;

  // Walk one level of categories (founders, advisors, partners, ...)
  for (const catEntry of safeReaddir(teamDir)) {
    if (!catEntry.isDirectory()) continue;
    if (SKIP_DIRS.has(catEntry.name)) continue;
    const category = catEntry.name;
    const catDir = path.join(teamDir, category);

    // Inside a category, each subfolder is a profile folder with PROFILE.md
    for (const personEntry of safeReaddir(catDir)) {
      if (!personEntry.isDirectory()) continue;
      const personDir = path.join(catDir, personEntry.name);
      const profilePath = path.join(personDir, 'PROFILE.md');
      if (!fs.existsSync(profilePath)) continue;
      const displayName = extractDisplayName(profilePath, personEntry.name);
      profiles.push({
        name: personEntry.name,
        displayName,
        path: profilePath,
        relPath: path.relative(roomDir, profilePath).split(path.sep).join('/'),
        category,
      });
    }
  }
  return profiles;
}

/**
 * Detect top-level section directories. A section is a top-level child directory
 * whose name appears in KNOWN_SECTIONS.
 */
function findSections(roomDir) {
  const sections = [];
  for (const entry of safeReaddir(roomDir)) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (!KNOWN_SECTIONS.has(entry.name)) continue;
    const secPath = path.join(roomDir, entry.name);
    sections.push({
      name: entry.name,
      path: secPath,
      hasRoom: fs.existsSync(path.join(secPath, 'ROOM.md')),
    });
  }
  return sections;
}

/**
 * Detect sub-rooms under sub-rooms/. Each sub-room has its own sections array.
 */
function findSubRooms(roomDir) {
  const subRooms = [];
  const subRoomsDir = path.join(roomDir, 'sub-rooms');
  if (!fs.existsSync(subRoomsDir)) return subRooms;

  for (const entry of safeReaddir(subRoomsDir)) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const srPath = path.join(subRoomsDir, entry.name);
    // Recurse to find sections inside
    const innerSections = [];
    for (const inner of safeReaddir(srPath)) {
      if (!inner.isDirectory()) continue;
      if (SKIP_DIRS.has(inner.name)) continue;
      if (!KNOWN_SECTIONS.has(inner.name)) continue;
      innerSections.push({
        name: inner.name,
        path: path.join(srPath, inner.name),
        hasRoom: fs.existsSync(path.join(srPath, inner.name, 'ROOM.md')),
      });
    }
    subRooms.push({ name: entry.name, path: srPath, sections: innerSections });
  }
  return subRooms;
}

/**
 * Find meetings under meetings/YYYY-MM-DD-*. For each, detect summary/transcript
 * and parse filed-to/ stubs to resolve their target artifact paths.
 */
function findMeetings(roomDir) {
  const meetings = [];
  const meetingsDir = path.join(roomDir, 'meetings');
  if (!fs.existsSync(meetingsDir)) return meetings;

  for (const entry of safeReaddir(meetingsDir)) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    // Require YYYY-MM-DD prefix to filter noise
    if (!/^\d{4}-\d{2}-\d{2}/.test(entry.name)) continue;

    const mtgPath = path.join(meetingsDir, entry.name);
    const hasSummary = fs.existsSync(path.join(mtgPath, 'summary.md'));
    const hasTranscript =
      fs.existsSync(path.join(mtgPath, 'transcript.md')) ||
      fs.existsSync(path.join(mtgPath, 'transcript.txt'));

    // Parse filed-to/ stubs
    const filedTo = [];
    const filedDir = path.join(mtgPath, 'filed-to');
    if (fs.existsSync(filedDir)) {
      for (const stub of safeReaddir(filedDir)) {
        if (!stub.isFile()) continue;
        if (!stub.name.endsWith('.md')) continue;
        const stubPath = path.join(filedDir, stub.name);
        const content = safeRead(stubPath);
        const fm = parseFrontmatter(content);
        const stubName = stub.name.replace(/\.md$/, '');
        filedTo.push({
          name: stubName,
          path: stubPath,
          relPath: path
            .relative(roomDir, stubPath)
            .split(path.sep)
            .join('/'),
          targetPath: fm.filed_to || null,
        });
      }
    }

    meetings.push({
      slug: entry.name,
      path: mtgPath,
      relPath: path
        .relative(roomDir, mtgPath)
        .split(path.sep)
        .join('/'),
      hasSummary,
      hasTranscript,
      filedTo,
    });
  }
  return meetings;
}

/**
 * Walk the room and collect every non-system .md content file.
 * Marks each with its top-level section and whether it is a filed-to stub
 * or an xref (based on filename heuristics).
 */
function findContentFiles(roomDir) {
  const files = [];

  function walk(dir, topSection) {
    for (const entry of safeReaddir(dir)) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Only recurse into relevant dirs -- skip the team/ PROFILE tree here
        // (it's cataloged separately) and sub-rooms/ (scanned via findSubRooms).
        walk(p, topSection || (KNOWN_SECTIONS.has(entry.name) ? entry.name : null));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (SYSTEM_FILES.has(entry.name)) continue;
        const rel = path.relative(roomDir, p).split(path.sep).join('/');
        const isFiledTo = rel.includes('/filed-to/');
        const isXref = /(^|\/)xref-|cross-ref/.test(rel);
        files.push({
          path: p,
          relPath: rel,
          section: topSection || null,
          isXref,
          isFiledTo,
        });
      }
    }
  }

  walk(roomDir, null);
  return files;
}

/**
 * Main entry point. Scan a Data Room and return a structured snapshot.
 */
function scanRoom(roomDir) {
  if (!roomDir || typeof roomDir !== 'string') {
    throw new Error('scanRoom: roomDir must be a string');
  }
  const absRoom = path.resolve(roomDir);
  if (!fs.existsSync(absRoom)) {
    throw new Error('scanRoom: room directory does not exist: ' + absRoom);
  }
  if (!fs.statSync(absRoom).isDirectory()) {
    throw new Error('scanRoom: room path is not a directory: ' + absRoom);
  }

  return {
    roomName: path.basename(absRoom),
    roomDir: absRoom,
    sections: findSections(absRoom),
    subRooms: findSubRooms(absRoom),
    teamProfiles: findTeamProfiles(absRoom),
    meetings: findMeetings(absRoom),
    contentFiles: findContentFiles(absRoom),
    systemFiles: Array.from(SYSTEM_FILES),
  };
}

module.exports = {
  scanRoom,
  parseFrontmatter,
  slugToTitle,
  SYSTEM_FILES,
  SKIP_DIRS,
  KNOWN_SECTIONS,
};
