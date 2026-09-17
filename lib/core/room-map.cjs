'use strict';
/*
 * lib/core/room-map.cjs -- Phase 353 Plan 01 (D-353-2, R-353-B, R-353-E).
 *
 * AUTHORITY RULE (icm-architect invariant 9): `.mindrian/room-map.json` is
 * the SINGLE HOME of a folder's self-knowledge. Every ROOM.md's `icm_self`
 * block is a DERIVED, fingerprinted VIEW of that home, never a second
 * store. A block that disagrees with a fresh rebuild is a doctor finding,
 * never a preference to reconcile toward the block. The map is rebuildable
 * from disk at any time; two rebuilds of an unchanged tree produce the same
 * fingerprint (mapFingerprint below).
 *
 * R-353-B EXCLUSION RULE: blocks are written only for the four map kinds
 * `root | section | structural | sub-room` (SELF_BLOCK_KINDS below). An
 * `artifact` folder (Key Decision 16: an artifact sits in its own
 * subfolder, `section/name/name.md`) is MAPPED (kind: 'artifact') and NEVER
 * carries a block. The doctor module (lib/core/doctor/room-map-module.cjs)
 * treats an artifact folder that DOES carry one as drift, not as extra
 * information.
 *
 * SYNC-ONLY RULE, and why: the doctor engine at scripts/doctor.cjs calls a
 * module's `check()`/`fix()` with no deferred-callback resolution anywhere
 * in its dispatch (runAccumulativeEngine's ALWAYS pass). A Promise-returning
 * export would be misreported as a plain object with no `status` and no
 * `detail`. Every export in this module is therefore synchronous:
 * `fs.readdirSync`, `fs.existsSync`, `crypto.createHash('sha256')`,
 * `gray-matter`'s sync parse. Nothing here is a coroutine, nothing is
 * deferred, and no return value is ever chained off a settled promise.
 *
 * CENSUS REASON for the four kinds (measured 2026-09-17, 353-RESEARCH.md
 * "Measured Fleet Census"): 401 depth-1 directories (sections + structural)
 * across 31 fleet rooms, versus 2,024 non-dot directories at maxdepth 8.
 * Blocking every directory would create ~5x the write surface for no
 * addressing benefit past the section/structural/sub-room boundary; an
 * artifact folder's identity is already carried by its parent section's
 * block plus its own filename (Key Decision 16).
 *
 * Canon Part 7 (reuse): consumes `discoverSections`, `STRUCTURAL_DIRS`,
 * `isIndexableArtifactFile` from `./section-registry.cjs`; reuses
 * `escapeYamlDoubleQuoted` and `renderTemplate` from
 * `./room-skeleton-scaffold.cjs` rather than a new YAML-escape or
 * substitution helper. Parses frontmatter through `gray-matter` (already a
 * shipped dependency, WR-02 ruling at tests/test-275-section-schema.cjs)
 * rather than a thirteenth hand-rolled `parseFrontmatter`.
 *
 * Canon Part 8: zero network, zero Brain, zero fetch. Pure local fs walk.
 * This module never opens the SQL substrate or the graph-write surfaces
 * directly (no direct SQLite driver require, no room-database require, no
 * graph-ops require) -- scripts/check-substrate.cjs refuses those chokepoint
 * bypasses in --diff mode at pre-commit.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const {
  discoverSections,
  STRUCTURAL_DIRS,
  isIndexableArtifactFile,
} = require('./section-registry.cjs');

const {
  escapeYamlDoubleQuoted,
  renderTemplate,
} = require('./room-skeleton-scaffold.cjs');

// Same walker-skip set room-md-module.cjs already uses (Canon Part 7 reuse).
const SKIP_DIRS = new Set([
  '.git', '.mindrian', '.context', '.lazygraph', '.rooms',
  'node_modules', '.next', 'dist', 'build', '.cache',
]);

const MAX_DEPTH = 8;

// R-353-B: only these four kinds ever carry an `icm_self` block.
const SELF_BLOCK_KINDS = Object.freeze(new Set(['root', 'section', 'structural', 'sub-room']));

// Root identity template, resolved the same way room-skeleton-scaffold.cjs
// resolves TEMPLATES_DIR (this file lives at lib/core/, two levels below repo
// root, identical to room-skeleton-scaffold.cjs's own position).
const ROOT_IDENTITY_TEMPLATE_PATH = path.resolve(
  __dirname, '..', '..', 'templates', 'room-skeleton', 'ROOM.md.identity.tmpl'
);

// ---------------------------------------------------------------------------
// Small internal helpers (no export beyond the six named in the plan).
// ---------------------------------------------------------------------------

// tmp + rename atomic write, verbatim idiom copied from
// room-skeleton-scaffold.cjs::atomicWrite (not exported there, so this is a
// deliberate, named, byte-identical copy per Phase 124-02 precedent -- a
// torn ROOM.md is worse than a missing one).
function atomicWriteFile(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o755 });
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
}

// Bare child directory names, dot-skip + SKIP_DIRS applied, sorted so
// mapFingerprint is deterministic across two builds. withFileTypes'
// isDirectory() is false for a symlink (Dirent uses lstat semantics), which
// is what keeps this walk from ever following a symlinked directory
// (T-353-01).
function listChildDirNames(dir) {
  const entries = safeReaddir(dir);
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    names.push(entry.name);
  }
  names.sort();
  return names;
}

function countArtifactFiles(dir) {
  const entries = safeReaddir(dir);
  let n = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (isIndexableArtifactFile(entry.name)) n += 1;
  }
  return n;
}

// Key Decision 16: a section's artifact_count also folds in the one-level-
// down nested artifact files inside each non-sub-room child directory.
function countNestedArtifactFiles(sectionAbsDir) {
  const entries = safeReaddir(sectionAbsDir);
  let n = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const childAbs = path.join(sectionAbsDir, entry.name);
    if (fs.existsSync(path.join(childAbs, '.room-root'))) continue; // sub-room, not artifact
    n += countArtifactFiles(childAbs);
  }
  return n;
}

// Read a directory's ROOM.md frontmatter through gray-matter. Never throws;
// a missing or unparsable ROOM.md yields has_room_md:false, job_id:null.
function readRoomMdFrontmatter(dirAbs) {
  const roomMdPath = path.join(dirAbs, 'ROOM.md');
  if (!fs.existsSync(roomMdPath)) {
    return { exists: false, job: null, job_id: null, data: {} };
  }
  try {
    const raw = fs.readFileSync(roomMdPath, 'utf8');
    const parsed = matter(raw);
    const data = (parsed && parsed.data) || {};
    const job = (typeof data.section === 'string' && data.section)
      || (typeof data.directory_type === 'string' && data.directory_type)
      || null;
    const job_id = (typeof data.job_id === 'string' && data.job_id) ? data.job_id : null;
    return { exists: true, job, job_id, data };
  } catch (_e) {
    return { exists: false, job: null, job_id: null, data: {} };
  }
}

// Best-effort registry cross-check (Canon Part 7 reuse of shared.cjs's
// readRegistry; never a raw parse of registry.json here). Disk always wins;
// a registry disagreement is recorded, never used to overwrite a
// disk-derived field. A missing registry is not an error.
function crossCheckRegistry(node, childAbsResolved, parentSlug) {
  try {
    // eslint-disable-next-line global-require
    const { readRegistry } = require('./doctor/shared.cjs');
    const reg = readRegistry();
    if (!reg || !reg.registry || !reg.registry.rooms) return;
    const slug = path.basename(node.path);
    const entry = reg.registry.rooms[slug];
    if (!entry) return;
    const registryParent = entry.parent || null;
    let registryPathResolved = null;
    if (entry.path) {
      registryPathResolved = path.isAbsolute(entry.path)
        ? path.resolve(entry.path)
        : path.resolve(reg.roomsHome, entry.path);
    }
    const parentDisagrees = registryParent !== null && parentSlug !== null && registryParent !== parentSlug;
    const pathDisagrees = registryPathResolved !== null && registryPathResolved !== childAbsResolved;
    if (parentDisagrees || pathDisagrees) {
      node.registry_drift = { registry_parent: registryParent, registry_path: entry.path || null };
    }
  } catch (_e) {
    // Never let a registry read failure affect the disk-derived map.
  }
}

// ---------------------------------------------------------------------------
// buildRoomMap
// ---------------------------------------------------------------------------

/**
 * buildRoomMap(roomDir) -> { room, built_at, fingerprint, nodes[] }
 *
 * Synchronous. Never follows a symlinked directory, never walks above
 * roomDir (T-353-01 traversal guard), and drops a path that resolves
 * outside roomDir with no throw.
 */
function buildRoomMap(roomDir) {
  const resolvedRoot = path.resolve(roomDir);
  const roomSlug = path.basename(resolvedRoot);
  const nodes = [];

  let sectionSet;
  try {
    const discovered = discoverSections(resolvedRoot);
    sectionSet = new Set((discovered && discovered.all) || []);
  } catch (_e) {
    sectionSet = new Set();
  }

  function isWithinRoot(absPath) {
    const resolved = path.resolve(absPath);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
  }

  // Root node.
  const rootFm = readRoomMdFrontmatter(resolvedRoot);
  nodes.push({
    room: roomSlug,
    path: '.',
    kind: 'root',
    job: rootFm.job,
    job_id: rootFm.job_id,
    parent: null,
    depth: 0,
    children: listChildDirNames(resolvedRoot),
    artifact_count: countArtifactFiles(resolvedRoot),
    has_room_md: rootFm.exists,
  });

  // One level under a section: sub-room (has .room-root) or artifact
  // (everything else). Artifacts are leaves; Key Decision 16 does not nest
  // an artifact folder inside another artifact folder.
  function walkUnderSection(sectionAbs, sectionRel, depth) {
    if (depth > MAX_DEPTH) return;
    const entries = safeReaddir(sectionAbs);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const childAbs = path.join(sectionAbs, entry.name);
      if (!isWithinRoot(childAbs)) continue;
      const childRel = sectionRel + '/' + entry.name;
      const isSubRoom = fs.existsSync(path.join(childAbs, '.room-root'));
      const fm = readRoomMdFrontmatter(childAbs);
      const node = {
        room: isSubRoom ? entry.name : roomSlug,
        path: childRel,
        kind: isSubRoom ? 'sub-room' : 'artifact',
        job: isSubRoom ? fm.job : null,
        job_id: isSubRoom ? fm.job_id : null,
        parent: sectionRel,
        depth: depth,
        children: listChildDirNames(childAbs),
        artifact_count: countArtifactFiles(childAbs),
        has_room_md: fm.exists,
      };
      if (isSubRoom) {
        crossCheckRegistry(node, path.resolve(childAbs), roomSlug);
      }
      nodes.push(node);
      // Sub-room boundary: never descend into a sub-room's own tree
      // (it owns its own map). Artifacts are leaves by rule.
    }
  }

  // Generic walk: classifies depth-1 dirs as sub-room / structural / section,
  // and keeps descending through any UNCLASSIFIED container directory (e.g.
  // a `sub-rooms/` grouping folder) purely to find nested `.room-root`
  // boundaries deeper in the tree, without emitting a node for the
  // container itself.
  function walk(absDir, relDir, depth, parentRel) {
    if (depth > MAX_DEPTH) return;
    const entries = safeReaddir(absDir);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const childAbs = path.join(absDir, entry.name);
      if (!isWithinRoot(childAbs)) continue;
      const childRel = relDir === '.' ? entry.name : relDir + '/' + entry.name;
      const isSubRoom = fs.existsSync(path.join(childAbs, '.room-root'));

      if (isSubRoom) {
        const fm = readRoomMdFrontmatter(childAbs);
        const node = {
          room: entry.name,
          path: childRel,
          kind: 'sub-room',
          job: fm.job,
          job_id: fm.job_id,
          parent: parentRel,
          depth: depth,
          children: listChildDirNames(childAbs),
          artifact_count: countArtifactFiles(childAbs),
          has_room_md: fm.exists,
        };
        crossCheckRegistry(node, path.resolve(childAbs), roomSlug);
        nodes.push(node);
        continue; // sub-room boundary: do not descend further
      }

      if (depth === 1 && STRUCTURAL_DIRS.includes(entry.name)) {
        const fm = readRoomMdFrontmatter(childAbs);
        nodes.push({
          room: roomSlug,
          path: childRel,
          kind: 'structural',
          job: fm.job,
          job_id: fm.job_id,
          parent: parentRel,
          depth: depth,
          children: listChildDirNames(childAbs),
          artifact_count: countArtifactFiles(childAbs),
          has_room_md: fm.exists,
        });
        continue;
      }

      if (depth === 1 && sectionSet.has(entry.name)) {
        const fm = readRoomMdFrontmatter(childAbs);
        nodes.push({
          room: roomSlug,
          path: childRel,
          kind: 'section',
          job: fm.job,
          job_id: fm.job_id,
          parent: parentRel,
          depth: depth,
          children: listChildDirNames(childAbs),
          artifact_count: countArtifactFiles(childAbs) + countNestedArtifactFiles(childAbs),
          has_room_md: fm.exists,
        });
        walkUnderSection(childAbs, childRel, depth + 1);
        continue;
      }

      // Unclassified container (e.g. `sub-rooms/`): keep descending, no node.
      walk(childAbs, childRel, depth + 1, relDir);
    }
  }

  walk(resolvedRoot, '.', 1, '.');

  return {
    room: roomSlug,
    built_at: new Date().toISOString(),
    fingerprint: mapFingerprint(nodes),
    nodes: nodes,
  };
}

// ---------------------------------------------------------------------------
// mapFingerprint
// ---------------------------------------------------------------------------

/**
 * mapFingerprint(nodes) -> sha256 hex.
 *
 * Hashes ONLY the tracked tuple (path, kind, job_id, parent, children) per
 * node, sorted, so two builds of an unchanged tree return the same hex and
 * an untracked-file edit (e.g. an artifact body edit, or artifact_count
 * drift) never changes it. Calling with a single-node array yields a
 * reusable PER-NODE fingerprint (the same formula the doctor module and
 * renderSelfBlock both rely on for "this node's own fingerprint").
 */
function mapFingerprint(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const tuples = list.map((n) => JSON.stringify([
    n.path,
    n.kind,
    n.job_id || null,
    n.parent,
    (Array.isArray(n.children) ? n.children.slice().sort() : []),
  ]));
  tuples.sort();
  const hash = crypto.createHash('sha256');
  hash.update(tuples.join('\n'));
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// writeRoomMap / readRoomMap
// ---------------------------------------------------------------------------

/**
 * writeRoomMap(roomDir, map) -> { ok, path } | { ok:false, reason, detail }.
 * Never throws. tmp+rename atomic idiom.
 */
function writeRoomMap(roomDir, map) {
  try {
    const dir = path.join(path.resolve(roomDir), '.mindrian');
    const filePath = path.join(dir, 'room-map.json');
    const content = JSON.stringify(map, null, 2);
    if (!atomicWriteFile(filePath, content)) {
      return { ok: false, reason: 'write_failed', detail: 'atomic write returned false' };
    }
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, reason: 'write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }
}

/**
 * readRoomMap(roomDir) -> { ok:true, map } | { ok:false, reason:'no_map' }.
 */
function readRoomMap(roomDir) {
  try {
    const filePath = path.join(path.resolve(roomDir), '.mindrian', 'room-map.json');
    if (!fs.existsSync(filePath)) {
      return { ok: false, reason: 'no_map' };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return { ok: true, map: JSON.parse(raw) };
  } catch (_e) {
    return { ok: false, reason: 'no_map' };
  }
}

// ---------------------------------------------------------------------------
// renderSelfBlock / writeSelfBlocks (Task 3: the derived, fingerprinted view)
// ---------------------------------------------------------------------------

/**
 * renderSelfBlock(node) -> YAML fragment text for an `icm_self` mapping.
 *
 * Exactly the keys room, path, parent, depth, children, artifact_count,
 * fingerprint. Every string value passes through escapeYamlDoubleQuoted.
 * children are bare names. The per-node fingerprint is mapFingerprint([node])
 * -- the same formula as the whole-map fingerprint, applied to a
 * single-element array, so the doctor module can recompute and compare it
 * without a second hashing function.
 */
function renderSelfBlock(node) {
  const n = node || {};
  const room = escapeYamlDoubleQuoted(n.room != null ? n.room : '');
  const nodePath = escapeYamlDoubleQuoted(n.path != null ? n.path : '');
  const hasParent = n.parent !== null && n.parent !== undefined;
  const depth = Number.isInteger(n.depth) ? n.depth : 0;
  const children = Array.isArray(n.children) ? n.children : [];
  const artifactCount = Number.isInteger(n.artifact_count) ? n.artifact_count : 0;
  const fp = mapFingerprint([n]);

  const lines = [];
  lines.push('icm_self:');
  lines.push('  room: "' + room + '"');
  lines.push('  path: "' + nodePath + '"');
  lines.push('  parent: ' + (hasParent ? ('"' + escapeYamlDoubleQuoted(n.parent) + '"') : 'null'));
  lines.push('  depth: ' + depth);
  if (children.length === 0) {
    lines.push('  children: []');
  } else {
    lines.push('  children:');
    for (const c of children) {
      lines.push('    - "' + escapeYamlDoubleQuoted(c) + '"');
    }
  }
  lines.push('  artifact_count: ' + artifactCount);
  lines.push('  fingerprint: "' + fp + '"');
  return lines.join('\n');
}

// Create a root ROOM.md from the identity template when has_room_md is
// false. Never runs renderTemplate substitution over an EXISTING room file
// (T-275-13); this only ever fires on a file that does not exist yet.
function createRootIdentityFile(dirAbs, roomSlug) {
  let tpl;
  try {
    tpl = fs.readFileSync(ROOT_IDENTITY_TEMPLATE_PATH, 'utf8');
  } catch (_e) {
    return false;
  }
  const purpose = 'Auto-created ICM Layer 0 identity file for the "' + roomSlug
    + '" room root (Phase 353: room-map.cjs found no ROOM.md at map-build time).';
  const content = renderTemplate(tpl, {
    DIRECTORY_TYPE: 'root',
    DIRECTORY_PURPOSE: purpose,
    DIRECTORY_PURPOSE_YAML: escapeYamlDoubleQuoted(purpose),
  });
  return atomicWriteFile(path.join(dirAbs, 'ROOM.md'), content);
}

// Locate the extent of an existing `icm_self:` YAML block inside a
// frontmatter body (the text between the two `---` fences). Returns
// { start, end } character offsets into `body`, or null if absent. The
// block runs from the `icm_self:` line to the next non-indented line (a new
// top-level key) or the end of the body.
function findIcmSelfBlockRange(body) {
  const lines = body.split('\n');
  let startLine = -1;
  let endLine = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (startLine === -1) {
      if (/^icm_self:\s*$/.test(lines[i]) || /^icm_self:/.test(lines[i])) {
        startLine = i;
      }
      continue;
    }
    // First non-indented, non-empty line after the block start ends the block.
    if (lines[i].length > 0 && !/^\s/.test(lines[i])) {
      endLine = i;
      break;
    }
  }
  if (startLine === -1) return null;
  // Convert line indices back to character offsets.
  let start = 0;
  for (let i = 0; i < startLine; i += 1) start += lines[i].length + 1;
  let end = 0;
  for (let i = 0; i < endLine; i += 1) end += lines[i].length + 1;
  return { start: start, end: end };
}

// Splice a fresh `icm_self:` block into a frontmatter body, replacing an
// existing one if present, appending otherwise. Byte-preserves every other
// line.
function spliceIcmSelfIntoFrontmatter(frontmatterBody, blockText) {
  const range = findIcmSelfBlockRange(frontmatterBody);
  if (range) {
    return frontmatterBody.slice(0, range.start) + blockText + '\n' + frontmatterBody.slice(range.end);
  }
  const trimmed = frontmatterBody.replace(/\n+$/, '');
  if (trimmed.length === 0) return blockText;
  return trimmed + '\n' + blockText;
}

const FRONTMATTER_FENCE_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * writeSelfBlocks(roomDir, map) -> { written[], skipped[], errors[] }.
 *
 * Writes or replaces the `icm_self` key in the frontmatter of every node
 * whose kind is in SELF_BLOCK_KINDS, leaving every other frontmatter key and
 * the entire body byte-identical. A root node with has_room_md:false gets
 * its ROOM.md created from the identity template first. An artifact-kind
 * node is never written to. Never throws.
 */
function writeSelfBlocks(roomDir, map) {
  const resolvedRoom = path.resolve(roomDir);
  const written = [];
  const skipped = [];
  const errors = [];
  const nodes = (map && Array.isArray(map.nodes)) ? map.nodes : [];

  for (const node of nodes) {
    if (!SELF_BLOCK_KINDS.has(node.kind)) {
      skipped.push({ path: node.path, reason: 'artifact_kind_excluded' });
      continue;
    }

    const dirAbs = node.path === '.' ? resolvedRoom : path.join(resolvedRoom, node.path);
    const roomMdPath = path.join(dirAbs, 'ROOM.md');

    if (!fs.existsSync(roomMdPath)) {
      if (node.kind !== 'root') {
        errors.push({ path: node.path, reason: 'room_md_missing' });
        continue;
      }
      if (!createRootIdentityFile(dirAbs, map && map.room)) {
        errors.push({ path: node.path, reason: 'root_identity_write_failed' });
        continue;
      }
    }

    let raw;
    try {
      raw = fs.readFileSync(roomMdPath, 'utf8');
    } catch (_e) {
      errors.push({ path: node.path, reason: 'read_failed' });
      continue;
    }

    const fenceMatch = raw.match(FRONTMATTER_FENCE_RE);
    const blockText = renderSelfBlock(node);

    let newRaw;
    if (fenceMatch) {
      const frontmatterBody = fenceMatch[1];
      const rest = raw.slice(fenceMatch[0].length);
      const newBody = spliceIcmSelfIntoFrontmatter(frontmatterBody, blockText);
      newRaw = '---\n' + newBody + '\n---\n' + rest;
    } else {
      // No frontmatter fence at all: prepend one (rare; every scaffolded
      // ROOM.md carries frontmatter, but never throw on a hand-authored
      // file that lacks one).
      newRaw = '---\n' + blockText + '\n---\n\n' + raw;
    }

    // Validate round-trip before committing the write (T-353-02): the
    // resulting file must still parse as valid frontmatter.
    try {
      matter(newRaw);
    } catch (_e) {
      errors.push({ path: node.path, reason: 'round_trip_parse_failed' });
      continue;
    }

    if (atomicWriteFile(roomMdPath, newRaw)) {
      written.push(node.path);
    } else {
      errors.push({ path: node.path, reason: 'write_failed' });
    }
  }

  return { written: written, skipped: skipped, errors: errors };
}

module.exports = {
  buildRoomMap: buildRoomMap,
  writeRoomMap: writeRoomMap,
  readRoomMap: readRoomMap,
  renderSelfBlock: renderSelfBlock,
  writeSelfBlocks: writeSelfBlocks,
  mapFingerprint: mapFingerprint,
  SELF_BLOCK_KINDS: SELF_BLOCK_KINDS,
};
