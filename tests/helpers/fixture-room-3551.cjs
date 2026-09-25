'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 01 Task 2 -- the delta fixture-room helper every later
 * 355.1 test builds on. Seeds only through the navigation write door
 * (lib/core/navigation.cjs); never a raw direct-database write of its own.
 * Every planted fact carries the MARKER_PREFIX so Part 8 sweep legs can grep
 * argv, logs and files for it. Hyphens only, no em-dashes (CLAUDE.md HARD
 * RULE).
 *
 * buildDeltaRoom(label, opts) -> { root, roomsHome, roomDir, slug,
 *   addClaims, addContradicts, setStage, addChildRoom, addArtifact,
 *   bindSession, writeRoomMd, cleanup }
 *
 * Mints a mkdtemp roomsHome, one room directory under it, a room.db opened
 * through the same write door tests/helpers/fixture-room-219.cjs and
 * tests/helpers/fixture-room-355.cjs use, and a `.rooms/registry.json`
 * shaped the way lib/core/resolve-active-room.cjs's registryRoomPath reads
 * it (an object keyed by slug, each entry carrying `path` relative to
 * roomsHome and an optional `parent`). Every planting helper below opens
 * and closes its own short-lived handle (never holds the db open across
 * calls) so a test can interleave calls freely.
 *
 * copy355FixtureRoom(name) -> mkdtemp copy of tests/fixtures/355-rooms/<name>
 * when that fixture exists on disk, else null. Read-only against the 355
 * fixture; the copy is this call's own to mutate and clean up.
 *
 * cleanup() removes ONLY the mkdtemp root this call created (the
 * fixture-room-354.cjs / fixture-room-355.cjs precedent: never a
 * caller-supplied path).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../../lib/core/room-db.cjs');
const navigation = require('../../lib/core/navigation.cjs');
const sessionBinding = require('../../lib/core/session-binding.cjs');

const SKIP_EXIT_CODE = 77;
const MARKER_PREFIX = 'SECRET-3551-';

function must(result, what) {
  if (!result || result.ok !== true) {
    throw new Error('fixture-room-3551: ' + what + ' failed: ' + JSON.stringify(result));
  }
  return result;
}

function writeFileUnder(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
  return abs;
}

function readRegistry(roomsHome) {
  try {
    const raw = fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : { rooms: {} };
  } catch (_e) {
    return { rooms: {} };
  }
}

function writeRegistry(roomsHome, reg) {
  const regDir = path.join(roomsHome, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(path.join(regDir, 'registry.json'), JSON.stringify(reg, null, 2), 'utf8');
}

// registerRoom(roomsHome, slug, absPath, parentSlug) -- adds one entry to
// registry.json in the shape registryRoomPath(home, slug, reg) reads: a
// `rooms` object keyed by slug, `path` relative to roomsHome, an optional
// `parent` naming the owning room's own slug (room-map.cjs's own field
// name).
function registerRoom(roomsHome, slug, absPath, parentSlug) {
  const reg = readRegistry(roomsHome);
  if (!reg.rooms || typeof reg.rooms !== 'object') reg.rooms = {};
  const entry = { path: path.relative(roomsHome, absPath) };
  if (typeof parentSlug === 'string' && parentSlug.length > 0) entry.parent = parentSlug;
  reg.rooms[slug] = entry;
  writeRegistry(roomsHome, reg);
}

/*
 * buildDeltaRoom(label, opts) -> { root, roomsHome, roomDir, slug, ... }.
 * label is a short, filesystem-safe string identifying the caller (used
 * only in the mkdtemp prefix and in every planted marker text).
 */
function buildDeltaRoom(label, opts) {
  const safeLabel = (typeof label === 'string' && label.length > 0) ? label : 'anon';
  const options = (opts && typeof opts === 'object') ? opts : {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-' + safeLabel + '-'));
  const roomsHome = path.join(root, 'rooms-home');
  const slug = 'room-' + safeLabel;
  const roomDir = path.join(roomsHome, slug);
  fs.mkdirSync(roomDir, { recursive: true });

  writeFileUnder(roomDir, 'ROOM.md',
    '# Fixture Room 3551 (' + safeLabel + ')\n\nDelta fixture room (Phase 355.1 Plan 01 Task 2).\n');
  writeFileUnder(roomDir, 'STATE.md',
    '---\nventure_stage: ' + (typeof options.initialStage === 'string' ? options.initialStage : 'Discovery') + '\n---\n# State\n');

  // Create room.db through the SAME write door the 219/355 fixtures use
  // (never a raw file write of the sqlite bytes).
  const initDb = openRoomDb(roomDir, { allowExtension: true });
  closeRoomDb(initDb);

  registerRoom(roomsHome, slug, roomDir, null);

  const fixtureSession = 'fixture-3551-' + safeLabel;
  let claimCounter = 0;
  let artifactCounter = 0;

  function withDb(fn) {
    const db = openRoomDb(roomDir, { allowExtension: true });
    try {
      return fn(db);
    } finally {
      closeRoomDb(db);
    }
  }

  // addClaims(n) -- writes exactly n type='claim' nodes through
  // navigation.writeClaimNode, each text carrying MARKER_PREFIX plus a
  // running counter so every claim is a distinct UPSERT key.
  function addClaims(n) {
    const count = Number.isInteger(n) && n > 0 ? n : 1;
    const ids = [];
    withDb(function (db) {
      for (let i = 0; i < count; i += 1) {
        claimCounter += 1;
        const segment = 'seg-' + safeLabel + '-' + claimCounter;
        const r = must(navigation.writeClaimNode(db, {
          knowledge_type: 'fact',
          text: MARKER_PREFIX + safeLabel + '-claim-' + claimCounter,
          sessionId: fixtureSession,
          sourceSegment: segment,
        }), 'addClaims write ' + claimCounter);
        ids.push(r.node_id);
      }
    });
    return ids;
  }

  // addContradicts() -- writes two claim nodes and exactly one CONTRADICTS
  // edge between them through navigation.writeEdge.
  function addContradicts() {
    let idA = null;
    let idB = null;
    withDb(function (db) {
      claimCounter += 1;
      const a = must(navigation.writeClaimNode(db, {
        knowledge_type: 'fact',
        text: MARKER_PREFIX + safeLabel + '-contradict-a-' + claimCounter,
        sessionId: fixtureSession,
        sourceSegment: 'seg-contra-a-' + safeLabel + '-' + claimCounter,
      }), 'addContradicts claim A');
      claimCounter += 1;
      const b = must(navigation.writeClaimNode(db, {
        knowledge_type: 'fact',
        text: MARKER_PREFIX + safeLabel + '-contradict-b-' + claimCounter,
        sessionId: fixtureSession,
        sourceSegment: 'seg-contra-b-' + safeLabel + '-' + claimCounter,
      }), 'addContradicts claim B');
      idA = a.node_id;
      idB = b.node_id;
      must(navigation.writeEdge(db, {
        source_id: idA,
        target_id: idB,
        edge_type: 'CONTRADICTS',
        properties: { relation: 'contradicts', planted: MARKER_PREFIX + 'contradicts' },
      }), 'addContradicts edge');
    });
    return { idA: idA, idB: idB };
  }

  // setStage(stage) -- rewrites STATE.md frontmatter venture_stage. stage
  // === null writes an empty STATE.md (the unreadable case).
  function setStage(stage) {
    if (stage === null) {
      writeFileUnder(roomDir, 'STATE.md', '');
      return;
    }
    writeFileUnder(roomDir, 'STATE.md', '---\nventure_stage: ' + String(stage) + '\n---\n# State\n');
  }

  // addChildRoom(childLabel) -- adds a registry room whose parent is this
  // room's own slug, and creates its folder (with its own room.db through
  // the same write door).
  function addChildRoom(childLabel) {
    const safeChild = (typeof childLabel === 'string' && childLabel.length > 0) ? childLabel : 'child';
    const childSlug = slug + '-' + safeChild;
    const childDir = path.join(roomDir, 'sub-rooms', safeChild);
    fs.mkdirSync(childDir, { recursive: true });
    writeFileUnder(childDir, 'ROOM.md',
      '# Fixture Child Room 3551 (' + safeChild + ')\n\n' + MARKER_PREFIX + safeLabel + '-child-' + safeChild
        + '\n\nParent: ' + slug + '\n');
    const childDb = openRoomDb(childDir, { allowExtension: true });
    closeRoomDb(childDb);
    registerRoom(roomsHome, childSlug, childDir, slug);
    return { slug: childSlug, roomDir: childDir };
  }

  // addArtifact() -- writes one type='memory_artifact' node through
  // navigation.writeMemoryArtifactNode. Section varies per call (via the
  // running counter) so repeated calls mint distinct nodes rather than
  // UPSERTing the same one.
  function addArtifact() {
    let nodeId = null;
    withDb(function (db) {
      artifactCounter += 1;
      const section = 'delta-artifacts-' + safeLabel + '-' + artifactCounter;
      const r = must(navigation.writeMemoryArtifactNode(db, {
        section: section,
        kind: 'STATE',
        path: section + '/note.md',
        hash: MARKER_PREFIX + safeLabel + '-artifact-' + artifactCounter,
      }), 'addArtifact write');
      nodeId = r.node_id;
    });
    return nodeId;
  }

  // bindSession(sessionId) -- writes a session binding (the PSB-01 shape
  // lib/core/session-binding.cjs owns) so resolveSessionRoom({ sessionId,
  // home: roomsHome }) resolves this room as session.primary.
  function bindSession(sessionId) {
    sessionBinding.writeSessionBinding(sessionId, {
      bound: [slug],
      primary: slug,
      sticky: true,
    }, { home: roomsHome });
  }

  // writeRoomMd(frontmatterObject) -- rewrites ROOM.md with a caller-supplied
  // flat frontmatter object (string/number values only), for tests that need
  // to plant a specific ROOM.md field (e.g. pws_stage) without going through
  // the default constructor text.
  function writeRoomMd(frontmatterObject) {
    const fm = (frontmatterObject && typeof frontmatterObject === 'object') ? frontmatterObject : {};
    const lines = Object.keys(fm).map(function (k) { return k + ': ' + String(fm[k]); });
    const body = '---\n' + lines.join('\n') + '\n---\n# Fixture Room 3551 (' + safeLabel + ')\n';
    writeFileUnder(roomDir, 'ROOM.md', body);
  }

  function cleanup() {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  return {
    root: root,
    roomsHome: roomsHome,
    roomDir: roomDir,
    slug: slug,
    addClaims: addClaims,
    addContradicts: addContradicts,
    setStage: setStage,
    addChildRoom: addChildRoom,
    addArtifact: addArtifact,
    bindSession: bindSession,
    writeRoomMd: writeRoomMd,
    cleanup: cleanup,
  };
}

// copy355FixtureRoom(name) -> mkdtemp copy path when
// tests/fixtures/355-rooms/<name> exists, else null. The copy is read-write
// and this call's own to mutate; the source fixture is never touched.
function copy355FixtureRoom(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const src = path.join(__dirname, '..', 'fixtures', '355-rooms', name);
  if (!fs.existsSync(src)) return null;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-copy-' + name + '-'));
  const dest = path.join(root, name);
  fs.cpSync(src, dest, { recursive: true });
  return dest;
}

module.exports = {
  buildDeltaRoom: buildDeltaRoom,
  copy355FixtureRoom: copy355FixtureRoom,
  SKIP_EXIT_CODE: SKIP_EXIT_CODE,
  MARKER_PREFIX: MARKER_PREFIX,
};
