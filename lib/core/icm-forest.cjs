'use strict';
/*
 * Phase 270-07 -- lib/core/icm-forest.cjs: the ICM forest ROOT.
 *
 * WHAT THIS MODULE IS. RESEARCH.md 3.1.1 tested the grounding claim that "no
 * recursive whole-hierarchy ROOM.md walker exists anywhere in this repo" and
 * found it literally true and materially misleading: the capability exists
 * TWICE under different names, plus a third detection mechanism, and nothing
 * composed them into a forest root.
 *
 *   Walker A (filesystem, marker-driven, depth-capped):
 *     discoverMemoryFiles / walkFractalMemory,
 *     lib/core/memory/reconcile-memory-runner.cjs:174-222. Its own header
 *     states the discipline this module reuses verbatim: "NO hand-rolled
 *     walker - Part 7 reuse". Capped at the ONE frozen DEPTH_CAP
 *     (lib/core/coverage-rollup.cjs:41) -- this module imports it, never
 *     redeclares it.
 *   Walker B (graph-native, arbitrary depth, cross-room):
 *     rollupSubRooms(parentRoomDir), lib/core/graph-derivation.cjs. A
 *     recursive, transitive, read-only ATTACH across room.db boundaries,
 *     cycle-guarded. This module delegates cross-room descent to it and
 *     NEVER opens a child's room.db directly.
 *   Mechanism C (detection of unregistered folders):
 *     detectUnsentineledArtifactFolder(roomDir),
 *     lib/core/graph-self-heal.cjs. Surfaces a folder as "found,
 *     unregistered". This module NEVER promotes one -- promotion
 *     (healRoom's approvedBy gate) is a Part 3 Decision Gate and a Part 9
 *     role-5 moment a human owns. The refusal shape without approval is
 *     {ok:false, reason:'no_approval'} (graph-self-heal.cjs:21-23); this
 *     module never calls healRoom, birthRoom or confirmNode at all.
 *
 * THE GENUINE GAP THIS MODULE FILLS. room_list (lib/mcp/tools/room.cjs,
 * listRooms()) does a single-level readdirSync of $MINDRIAN_ROOMS_HOME.
 * Walker A starts at one already-resolved roomDir. Walker B starts at one
 * already-resolved parentRoomDir. Nothing composed "enumerate top-level
 * rooms, then descend each one" -- that composition is the only new code in
 * this file. Everything else below is delegation, enforced structurally by
 * tests/test-270-no-second-walker.cjs (a source census that fails RED on any
 * self-recursive readdirSync, a second DEPTH_CAP, or a promotion call).
 *
 * THE ACTUAL SECTION-QUALIFICATION PREDICATE. discoverSections
 * (lib/core/section-registry.cjs:63-108) does NOT qualify a directory on
 * ROOM.md presence, despite a looser comment elsewhere in the repo. It
 * qualifies on STATE.md presence, OR any .md file, OR (Canon Decision 16) a
 * nested artifact one level down excluding .room-root-bearing sub-rooms.
 * This module documents the real predicate rather than repeating the
 * looser folklore.
 *
 * THE FOUR-CLASS RULE (RESEARCH.md 3.1.0, Pitfall P4c). A flat directory
 * list misrepresents a room: at least four classes exist with different
 * discovery semantics. DIRECTORY_CLASSES and classifyDirectory below are
 * the single, schema-driven home of that rule (RESEARCH.md 4.1a): every
 * membership set is IMPORTED from the frozen tables at runtime, never
 * restated as a literal, so a future 9th canonical section (OQ-7) costs
 * zero rewrite here.
 *
 * A ROOM ITSELF (a top-level entry under $MINDRIAN_ROOMS_HOME) is not one
 * of the three named sub-directory classes (canonical_section /
 * identity_directory / structural_directory) -- classifyDirectory's
 * fallback arm, 'discovered', is the correct bucket for it structurally
 * (a directory the four-class rule does not otherwise name). `registered`
 * is the field that actually distinguishes a legitimate room from a stray
 * top-level folder, not `class`.
 *
 * PATH SAFETY (threat T-270-05, ASVS V5). lib/mcp/tool-router.cjs exports a
 * safeResolveSection / SECTION_RE pair, but only via its `_test` surface
 * (explicitly "kept out of the registerRouterTools surface area" per that
 * file's own comment) -- not meant for another module's production import,
 * and lib/core/* must not depend on lib/mcp/* (the layering runs the other
 * way). safeJoin() below mirrors that idiom's exact containment check
 * (path.resolve plus a startsWith guard) as a local, dependency-free copy
 * rather than either misusing a test-only export or inverting the layer
 * dependency.
 *
 * STRUCTURE AND IDENTITY ONLY, NEVER FILE BODIES. Every returned node's key
 * set is restricted to an allow-list, and every returned string is capped
 * at 512 characters -- a cheap, honest proxy against a file-body leak.
 * Cites lib/core/navigation/room-context.cjs:14-18's must-not-cross-the-wire
 * discipline as the reason this rule exists at all.
 *
 * Canon Part 8: this module opens no Brain wire and makes no network call.
 * Filesystem plus local room.db reads only (via the delegates above).
 *
 * No em-dashes. CJS only. No new dependency.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { SECTION_NAMES, SECTION_METADATA, IDENTITY_DIRECTORIES } = require('./room-skeleton-scaffold.cjs');
const { STRUCTURAL_DIRS, discoverSections } = require('./section-registry.cjs');
const { DEPTH_CAP } = require('./coverage-rollup.cjs');
const { discoverMemoryFiles } = require('./memory/reconcile-memory-runner.cjs');
const { rollupSubRooms } = require('./graph-derivation.cjs');
const { detectUnsentineledArtifactFolder } = require('./graph-self-heal.cjs');

const MAX_NODE_STRING_LEN = 512;
const ALLOWED_NODE_KEYS = [
  'slug', 'path', 'relPath', 'depth', 'class', 'hasRoomDb', 'registered', 'name', 'children', 'warnings',
];

// ---------------------------------------------------------------------------
// The pinned four-class contract (tests/test-270-tree-classification.cjs
// asserts a deep-equal against its own local copy of this exact array).
// ---------------------------------------------------------------------------
const DIRECTORY_CLASSES = Object.freeze(['canonical_section', 'identity_directory', 'structural_directory', 'discovered']);

/**
 * classifyDirectory(name) -> one of DIRECTORY_CLASSES.
 *
 * Precedence, in this order (each arm names its reason):
 *
 *   1. STRUCTURAL_DIRS -- the `team` precedence rule. `team` is in BOTH
 *      IDENTITY_DIRECTORIES and STRUCTURAL_DIRS. Structural wins because
 *      discoverSections SKIPPING it (section-registry.cjs:83) is the
 *      stronger, behaviour-visible fact: a caller who treated `team` as an
 *      identity directory would look for it in section-discovery output
 *      and never find it there.
 *   2. SECTION_NAMES -- the frozen canonical 8 (or fewer, under a
 *      blueprint-family subset -- resolveBlueprint returns a VALIDATED
 *      SUBSET, room-skeleton-scaffold.cjs:202-254; a room missing a
 *      canonical section is not a defect, Pitfall P4b).
 *   3. IDENTITY_DIRECTORIES -- the 5 non-ICM ROOM.md directories (Canon
 *      Decision 15), for any name not already claimed by rule 1.
 *   4. otherwise -- 'discovered': found beyond the frozen baseline, never
 *      auto-promoted (Pitfall P4; graph-self-heal.cjs's approvedBy gate).
 *
 * @param {string} name - a directory basename (never a path).
 * @returns {string} one of DIRECTORY_CLASSES.
 */
function classifyDirectory(name) {
  if (STRUCTURAL_DIRS.includes(name)) return 'structural_directory';
  if (SECTION_NAMES.includes(name)) return 'canonical_section';
  if (Object.prototype.hasOwnProperty.call(IDENTITY_DIRECTORIES, name)) return 'identity_directory';
  return 'discovered';
}

/**
 * sectionVocabulary() -- the frozen VOCABULARY (what the tables define),
 * distinct from what any one room's sectionList actually has PRESENT
 * (RESEARCH.md 3.1.0). A single named home so a caller does not need to
 * import three modules to present the vocabulary.
 */
function sectionVocabulary() {
  return {
    canonical: SECTION_NAMES.slice(),
    identity: Object.keys(IDENTITY_DIRECTORIES),
    structural: STRUCTURAL_DIRS.slice(),
    metadataKeys: Object.keys(SECTION_METADATA),
  };
}

// ---------------------------------------------------------------------------
// Filesystem helpers -- single-purpose, no recursion of their own.
// ---------------------------------------------------------------------------

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (_e) {
    return false;
  }
}

// safeJoin(base, name) -- mirrors lib/mcp/tool-router.cjs's safeResolveSection
// containment check (see the header note above for why this is a local copy,
// not an import). Never joins a raw string without verifying the result
// stays inside `base`.
function safeJoin(base, name) {
  const resolvedBase = path.resolve(base);
  if (name === null || name === undefined || name === '') return resolvedBase;
  const resolved = path.resolve(resolvedBase, name);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error('path traversal rejected: ' + name);
  }
  return resolved;
}

function hasRoomRootSentinel(dir) {
  try {
    return fs.existsSync(path.join(dir, '.room-root'));
  } catch (_e) {
    return false;
  }
}

// readSentinelSlug(dir) -- reads a `.room-root` sentinel's own `slug` field.
// This is NOT a second session-room resolver (it never resolves a SESSION to
// a room; it reads one already-known directory's own identity marker), so it
// does not trip tests/test-248-resolver-census.cjs.
function readSentinelSlug(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, '.room-root'), 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed.slug === 'string') ? parsed.slug : null;
  } catch (_e) {
    return null;
  }
}

function hasRoomDbFile(dir) {
  try {
    return fs.existsSync(path.join(dir, '.mindrian', 'room.db'));
  } catch (_e) {
    return false;
  }
}

/**
 * listRoomRoots(home) -- single-level enumeration of room directories under
 * `home` (default $MINDRIAN_ROOMS_HOME, then ~/MindrianRooms), matching
 * lib/mcp/tools/room.cjs:41-45's listRooms() logic exactly: ONE readdirSync,
 * no recursion, hidden entries skipped, sorted for determinism.
 *
 * tests/test-270-no-second-walker.cjs rule walker.2 forbids a SELF-RECURSIVE
 * descent (a function calling itself while also calling readdirSync); a
 * single-level enumeration with no self-call is the deliberate exception
 * that rule allows.
 *
 * KNOWN, RECORDED DUPLICATION (not silently introduced): this logic is
 * temporarily duplicated with lib/mcp/tools/room.cjs's own listRooms().
 * Editing room.cjs is plan 270-12's scope in a later wave (it owns that
 * file's retirement work); lifting this into lib/core/ without touching
 * room.cjs avoids a cross-plan file conflict now. Plan 270-12 should
 * collapse room.cjs's listRooms() to delegate to this function instead of
 * carrying its own copy -- see this plan's SUMMARY.md.
 */
function listRoomRoots(home) {
  const resolvedHome = home
    || process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
  let rooms = [];
  try {
    rooms = fs.readdirSync(resolvedHome, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch (_e) {
    rooms = [];
  }
  return { home: resolvedHome, rooms };
}

// truncateNodeStrings(node) -- the 512-char ceiling on every string value, a
// cheap, honest proxy against a file-body leak (tests/test-270-tree-
// classification.cjs leg 6). Applied once per node at build time so no
// delegate's output can silently smuggle a body through.
function truncateNodeStrings(node) {
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (typeof v === 'string' && v.length > MAX_NODE_STRING_LEN) {
      node[key] = v.slice(0, MAX_NODE_STRING_LEN);
    }
  }
  return node;
}

/**
 * enumerateChildBasenames(dir) -- the union of every source this module is
 * allowed to consult, deduplicated by basename. Never a recursive walk of
 * its own; every source is a single-level, already-shipped reader:
 *
 *   - discoverSections(dir): the canonical section layer, PLUS any
 *     .md-bearing folder its own predicate happens to qualify (a
 *     'discovered' folder that looks like a section; classifyDirectory
 *     resolves the class by NAME LOOKUP regardless of which source found
 *     it, so this never mis-classifies a real section).
 *   - IDENTITY_DIRECTORIES keys, checked by direct existence (three of the
 *     five are dot-prefixed -- '.intelligence', '.snapshots', '.context' --
 *     and discoverSections structurally cannot see them, since it skips
 *     every hidden directory).
 *   - STRUCTURAL_DIRS, checked by direct existence (discoverSections
 *     explicitly SKIPS these; they would otherwise never surface at all).
 *   - detectUnsentineledArtifactFolder(dir): every non-hidden,
 *     non-sentineled, artifact-bearing folder -- this includes ordinary
 *     canonical sections too (they legitimately have no .room-root either),
 *     which is fine: classifyDirectory still resolves them correctly by
 *     name, and `registered` (not `class`) is the field that actually says
 *     "this is a first-class room", not "this is a canonical section".
 */
function enumerateChildBasenames(dir) {
  const names = new Set();

  let sections = { all: [] };
  try {
    sections = discoverSections(dir);
  } catch (_e) {
    sections = { all: [] };
  }
  for (const n of (sections && Array.isArray(sections.all)) ? sections.all : []) {
    names.add(n);
  }

  for (const n of Object.keys(IDENTITY_DIRECTORIES)) {
    if (isDir(path.join(dir, n))) names.add(n);
  }

  for (const n of STRUCTURAL_DIRS) {
    if (isDir(path.join(dir, n))) names.add(n);
  }

  let unsentineled = [];
  try {
    unsentineled = detectUnsentineledArtifactFolder(dir);
  } catch (_e) {
    unsentineled = [];
  }
  for (const u of unsentineled) {
    if (u && typeof u.folder === 'string') names.add(path.basename(u.folder));
  }

  return Array.from(names).sort();
}

/**
 * buildChildNode(parentDir, name, depth, parentRelPath) -- one node for one
 * basename. Recurses ONLY when the child is itself a REGISTERED sub-room
 * (carries its own .room-root) -- a genuine room boundary. An ordinary
 * section / identity / structural / discovered folder is a leaf at this
 * level; Walker B (rollupSubRooms, called informationally by
 * discoverIcmForest below) owns arbitrary-depth descent ACROSS a room
 * boundary, not this per-folder enumeration.
 */
function buildChildNode(parentDir, name, depth, parentRelPath) {
  const nodeDir = safeJoin(parentDir, name);
  const cls = classifyDirectory(name);
  const registered = hasRoomRootSentinel(nodeDir);
  const relPath = parentRelPath === '.' ? name : parentRelPath + '/' + name;

  const node = {
    path: nodeDir,
    relPath: relPath,
    depth: depth,
    class: cls,
    hasRoomDb: hasRoomDbFile(nodeDir),
    registered: registered,
    name: name,
    children: registered ? buildRoomChildren(nodeDir, depth + 1, relPath) : [],
  };
  if (registered) {
    const slug = readSentinelSlug(nodeDir);
    if (slug) node.slug = slug;
  }
  return truncateNodeStrings(node);
}

function buildRoomChildren(roomDir, depth, relPath) {
  const names = enumerateChildBasenames(roomDir);
  return names.map((name) => buildChildNode(roomDir, name, depth, relPath));
}

function flattenNodes(nodes, out) {
  for (const n of nodes || []) {
    out.push(n);
    flattenNodes(n.children, out);
  }
  return out;
}

/**
 * discoverIcmForest(opts) -> { ok, home, rooms, counts, depthCap, warnings? }
 *
 * opts: { home?: string, maxDepth?: number }
 *
 * The forest-root composition: enumerate top-level rooms (listRoomRoots),
 * then for each one build its direct children by delegation
 * (enumerateChildBasenames / buildRoomChildren above), plus two additional
 * DELEGATED, informational passes per room:
 *
 *   - rollupSubRooms(roomDir): the graph-native NESTED_WITHIN layer. Called
 *     for its own side-effect-free read; this module does not re-derive
 *     child directories from its result (a room-db-less fixture room -- or
 *     any room with no NESTED_WITHIN edges -- simply contributes nothing
 *     here, which is correct, not a defect).
 *   - discoverMemoryFiles(roomDir): the depth-bounded memory-artifact layer
 *     (Walker A), capped at the ONE frozen DEPTH_CAP. Read-only, paths and
 *     kinds only, never file bodies; informational metadata only, never a
 *     control-flow input to classification.
 *
 * OQ-1 (270-DECISIONS.md): ratified oq1-a -- the frozen DEPTH_CAP is kept
 * exactly as is; `opts.maxDepth` is accepted but currently has no effect
 * on discoverMemoryFiles (which has no depth parameter of its own to pass
 * one through to); it is reserved for a future ZOOM re-rooting extension
 * point (reconcile-memory-runner.cjs:171-173), out of this phase's scope.
 * `depthCap` in the return value is always the imported constant, never a
 * caller-supplied override, so a caller can see the real boundary either way.
 *
 * A per-room failure never fails the whole forest: caught, recorded as a
 * scalar string in `warnings`, and the loop continues (the same
 * additive-degradation discipline lib/mcp/register-core-tools.cjs uses).
 */
function discoverIcmForest(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const { home: resolvedHome, rooms: roomSlugs } = listRoomRoots(o.home);

  const rooms = [];
  const warnings = [];

  for (const slug of roomSlugs) {
    try {
      const roomDir = safeJoin(resolvedHome, slug);
      const registered = hasRoomRootSentinel(roomDir);
      const actualSlug = (registered && readSentinelSlug(roomDir)) || slug;

      const roomNode = truncateNodeStrings({
        slug: actualSlug,
        path: roomDir,
        relPath: '.',
        depth: 0,
        class: classifyDirectory(slug),
        hasRoomDb: hasRoomDbFile(roomDir),
        registered: registered,
        name: slug,
        children: buildRoomChildren(roomDir, 1, '.'),
      });

      // Informational delegated passes (Walker B, Walker A). Best-effort:
      // a room with no room.db or no memory artifacts contributes nothing,
      // which is correct, not an error.
      try { rollupSubRooms(roomDir); } catch (_e) { /* informational only */ }
      try { discoverMemoryFiles(roomDir); } catch (_e) { /* informational only */ }

      rooms.push(roomNode);
    } catch (e) {
      warnings.push('room "' + slug + '" failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  const flat = flattenNodes(rooms, []);
  const byClass = {};
  for (const cls of DIRECTORY_CLASSES) byClass[cls] = 0;
  for (const n of flat) byClass[n.class] = (byClass[n.class] || 0) + 1;

  const result = {
    ok: true,
    home: resolvedHome,
    rooms: rooms,
    counts: { rooms: rooms.length, nodes: flat.length, byClass: byClass },
    depthCap: DEPTH_CAP,
  };
  if (warnings.length > 0) result.warnings = warnings;
  return result;
}

module.exports = {
  DIRECTORY_CLASSES,
  classifyDirectory,
  sectionVocabulary,
  listRoomRoots,
  discoverIcmForest,
  _internal: {
    safeJoin,
    enumerateChildBasenames,
    buildChildNode,
    buildRoomChildren,
    flattenNodes,
    readSentinelSlug,
    hasRoomDbFile,
    hasRoomRootSentinel,
  },
};
