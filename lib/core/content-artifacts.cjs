'use strict';

/*
 * lib/core/content-artifacts.cjs -- Phase 367 design 5.1: one shared artifact
 * set of a room.
 *
 * Why this module exists: the catch-up runner (plan 367-05), the derive
 * backfill (lib/core/graph-backfill.cjs _artifactsToIndex) and the doctor
 * (plan 367-10) must agree on what a "content file of a room" is. Before
 * Phase 367 three enumerators disagreed (Goldfish R2 CD-M1, R3 ZO-M3). One
 * walker removes that drift.
 *
 * The set, stated exactly: the passes of lazygraph-ops rebuildGraph, in the
 * same order (each section of discoverSections(room).all: its flat files,
 * then one nested level; then the room root files), with an isFile check on
 * every candidate in every pass (a directory named x.md is never listed),
 * MINUS scaffold files (scaffold-predicate.cjs isScaffoldFile) and MINUS the
 * files of a top-level section folder that holds .room-root (a top-level
 * sub-room; its own trigger catches it up, a design non-goal). A nested child
 * folder that holds .room-root or starts with a dot is skipped, as in
 * rebuildGraph. rebuildGraph keeps its own scope in this phase.
 *
 * Why section-registry.cjs is not changed: a walker there would need the
 * scaffold predicate, and scaffold-predicate.cjs loads
 * semantic-index/scaffold-template-index.cjs, which reaches room-birth.cjs,
 * which requires section-registry.cjs: a load-time cycle (design section 11,
 * row "Walker in section-registry.cjs"). This module requires
 * section-registry.cjs at the top and scaffold-predicate.cjs lazily inside
 * listContentArtifacts (the graph-backfill.cjs lazy-require pattern).
 *
 * getArtifactId moved here from lazygraph-ops.cjs (pure path code);
 * lazygraph-ops.cjs re-exports the same function object.
 *
 * Canon Part 8: local file names and stat data only. No network, no Brain.
 */

const fs = require('fs');
const path = require('path');
const { discoverSections, isIndexableArtifactFile } = require('./section-registry.cjs');

// On an id collision the first extension of this list wins.
const EXTENSION_ORDER = ['.md', '.docx', '.html', '.htm'];

/**
 * Get artifact ID from file path relative to room dir.
 * @param {string} filePath - Absolute path to .md file
 * @param {string} roomDir - Absolute path to room directory
 * @returns {string} e.g. "problem-definition/market-trends"
 */
function getArtifactId(filePath, roomDir) {
  const rel = path.relative(path.resolve(roomDir), path.resolve(filePath));
  // Phase 169 GDH-04: strip the non-.md artifact extensions too (.docx/.html/.htm)
  // so a flat-root .docx artifact gets a clean id, not one carrying the extension.
  return rel.replace(/\.(md|docx|html|htm)$/i, '').replace(/\\/g, '/');
}

function _isFile(abs) {
  try { return fs.statSync(abs).isFile(); } catch (_e) { return false; }
}

function _hasRoomRoot(dir) {
  try { return fs.existsSync(path.join(dir, '.room-root')); } catch (_e) { return false; }
}

function _readNames(dir) {
  try { return fs.readdirSync(dir); } catch (_e) { return []; }
}

function _childDirs(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return []; }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

function _extRank(rel) {
  const i = EXTENSION_ORDER.indexOf(path.extname(rel).toLowerCase());
  return i < 0 ? EXTENSION_ORDER.length : i;
}

function _byRel(a, b) {
  return a.rel < b.rel ? -1 : (a.rel > b.rel ? 1 : 0);
}

/**
 * The content files of a room (design 5.1). Never throws: an unreadable
 * folder is skipped and the walker returns what it found.
 * @param {string} roomDir - Path to the room directory
 * @returns {{files: Array<{rel: string, abs: string, id: string}>, collisions: Array<{rel: string, id: string}>}}
 */
function listContentArtifacts(roomDir) {
  const empty = { files: [], collisions: [] };
  let resolved;
  try { resolved = path.resolve(String(roomDir)); } catch (_e) { return empty; }

  // Lazy require (no load-time cycle, see the header). A load failure means
  // no scaffold filter, never a throw.
  let scaffold = null;
  try { scaffold = require('./scaffold-predicate.cjs'); } catch (_e) { scaffold = null; }
  const isScaffold = (abs) => {
    try { return scaffold ? scaffold.isScaffoldFile(abs) === true : false; } catch (_e) { return false; }
  };

  const candidates = [];
  const seen = new Set();
  const take = (dir) => {
    for (const name of _readNames(dir)) {
      if (!isIndexableArtifactFile(name)) continue;
      const abs = path.join(dir, name);
      if (seen.has(abs) || !_isFile(abs) || isScaffold(abs)) continue;
      seen.add(abs);
      candidates.push(abs);
    }
  };

  let sectionNames = [];
  try { sectionNames = discoverSections(resolved).all || []; } catch (_e) { sectionNames = []; }

  // Section passes, the rebuildGraph order: flat files, then one nested level.
  for (const sectionName of sectionNames) {
    const sectionDir = path.join(resolved, sectionName);
    if (_hasRoomRoot(sectionDir)) continue; // a top-level sub-room: its own trigger catches it up
    take(sectionDir);
    for (const childName of _childDirs(sectionDir)) {
      const childDir = path.join(sectionDir, childName);
      if (_hasRoomRoot(childDir)) continue; // a nested sub-room: its own db
      take(childDir);
    }
  }

  // Root pass (Phase 169 D-169-07): the files in the room root.
  take(resolved);

  // Group by id; the winner is the first by EXTENSION_ORDER, then by rel.
  const groups = new Map();
  for (const abs of candidates) {
    const rel = path.relative(resolved, abs).split(path.sep).join('/');
    const id = getArtifactId(abs, resolved);
    const entry = { rel, abs, id };
    const g = groups.get(id);
    if (g) g.push(entry); else groups.set(id, [entry]);
  }

  const files = [];
  const collisions = [];
  for (const [id, members] of groups) {
    members.sort((a, b) => (_extRank(a.rel) - _extRank(b.rel)) || _byRel(a, b));
    files.push(members[0]);
    for (let i = 1; i < members.length; i += 1) collisions.push({ rel: members[i].rel, id });
  }
  files.sort(_byRel);
  collisions.sort(_byRel);
  return { files, collisions };
}

module.exports = {
  listContentArtifacts,
  getArtifactId,
};
