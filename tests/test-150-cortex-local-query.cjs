'use strict';
// Phase 150-04 (MEM-03) -- getRoomContext legD: the projected cortex surfaced
// LOCAL-raw as a new cortexNodes field.
// ========================================================================
// Asserts:
//   (1) After projecting a fixture room's cortex (via the Plan 150-03
//       reconcileMemoryArtifacts, which calls the 150-01 writers), getRoomContext
//       returns a NEW cortexNodes field that is a non-empty array of the projected
//       cortex node types (memory_artifact / governing_thought / navigator_persona
//       / decision). The dial + decide() can now see the cortex from the graph,
//       not from a folder scan (loop link L2).
//   (2) cortexNodes is RAW-LOCAL: the projected node ids/types are present
//       verbatim (no sha256 hashing of the ids, no egress projection). This is the
//       Part-8 LOCAL invariant getRoomContext already holds for legA/legB/legC --
//       legD inherits it.
//   (3) On an EMPTY room (no cortex projected), cortexNodes is [] (graceful, never
//       throws, no partial-leg crash).
//   (4) The EXISTING return fields (summary, recentMessages, relevantNodes, _meta)
//       are all still present -- cortexNodes is purely ADDITIVE.
//   (5) legD adds a legD timing entry to _meta.legTimingsMs for parity.
//
// RED-by-design until Task 2 lands the legD leg in
// lib/core/navigation/room-context.cjs.
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) + the temp-FILE
// DatabaseSync fixture + applySchema shape from tests/test-150-reconcile.cjs.
//
// Any asserted forbidden dash codepoint is referenced via String.fromCharCode so
// THIS file stays greppably clean. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-150-cortex-local-query.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOM_CONTEXT_REL = 'lib/core/navigation/room-context.cjs';

// ---------- Schema fixture (full production nodes + edges column set) ----------

function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, " +
    "  type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, " +
    "  last_seen_at INTEGER NOT NULL, " +
    "  source_section TEXT, " +
    "  confirmed_by TEXT, " +
    "  confirmed_at INTEGER" +
    ");"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS edges (" +
    "  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', created_by TEXT, confidence REAL, " +
    "  review_status TEXT, created_at INTEGER, last_seen_at INTEGER, " +
    "  PRIMARY KEY (source, target, type)" +
    ");"
  );
}

// ---------- Fixture room with cortex-worthy memory files ----------

function buildFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-cortex-room-'));

  const pd = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(path.join(pd, 'ROOM.md'), '# Problem Definition\n\nIdentity prose.\n', 'utf8');
  fs.writeFileSync(
    path.join(pd, 'MINTO.md'),
    '---\ngoverning_thought: "The wicked navigator needs a map not a solver"\n---\n\n## Decisions\n\n- DEC-001: pursue the enterprise wedge first\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(pd, 'USER.md'),
    '---\ncanonical_role: founder\njourney_stage: crossing-the-threshold\nrole_blend:\n  founder: 0.6\n  researcher: 0.4\n  operator: 0\n---\n\nPersona prose.\n',
    'utf8'
  );

  return roomDir;
}

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-cortexdb-')), 'room.db');
}

// ---------- Modules under test ----------

let roomContextMod = null;
try {
  roomContextMod = require(path.join(REPO_ROOT, ROOM_CONTEXT_REL));
} catch (_e) {
  roomContextMod = null;
}

let reconcileMod = null;
try {
  reconcileMod = require(path.join(REPO_ROOT, 'lib/core/memory/reconcile-memory-runner.cjs'));
} catch (_e) {
  reconcileMod = null;
}

// ---------- Async test runner (awaits each check; non-zero exit on failure) ----------

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n');
  }
}

(async function main() {
  process.stdout.write('test-150-cortex-local-query.cjs\n');

  await check('room-context.cjs exports getRoomContext', async () => {
    assert.ok(roomContextMod, ROOM_CONTEXT_REL + ' must be requireable');
    assert.equal(typeof roomContextMod.getRoomContext, 'function', 'getRoomContext must be a function');
  });

  await check('getRoomContext returns a non-empty cortexNodes array when the cortex is projected', async () => {
    assert.ok(roomContextMod && typeof roomContextMod.getRoomContext === 'function', 'getRoomContext required');
    assert.ok(reconcileMod && typeof reconcileMod.reconcileMemoryArtifacts === 'function', 'reconcile required to seed cortex');

    const roomDir = buildFixtureRoom();
    const dbPath = tempDbPath();
    const db = new DatabaseSync(dbPath);
    applySchema(db);

    const report = reconcileMod.reconcileMemoryArtifacts(roomDir, { db, roomRoot: roomDir });
    assert.ok(report.upserted > 0, 'reconcile must have projected at least one memory_artifact node');

    const ctx = await roomContextMod.getRoomContext(db, 'phase-150-cortex-room', {});
    db.close();

    assert.ok(ctx && typeof ctx === 'object', 'getRoomContext returns an object');
    assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'cortexNodes'), 'the return must carry a cortexNodes field (legD)');
    assert.ok(Array.isArray(ctx.cortexNodes), 'cortexNodes must be an array');
    assert.ok(ctx.cortexNodes.length > 0, 'cortexNodes must be non-empty when the cortex is projected');
  });

  await check('cortexNodes surfaces the 150-01 projected node types verbatim (RAW-local, no hashing)', async () => {
    assert.ok(roomContextMod && reconcileMod, 'modules required');

    const roomDir = buildFixtureRoom();
    const dbPath = tempDbPath();
    const db = new DatabaseSync(dbPath);
    applySchema(db);
    reconcileMod.reconcileMemoryArtifacts(roomDir, { db, roomRoot: roomDir });

    const ctx = await roomContextMod.getRoomContext(db, 'phase-150-cortex-room', {});
    db.close();

    const types = new Set(ctx.cortexNodes.map((n) => n && n.type));
    assert.ok(types.has('memory_artifact'), 'cortexNodes must surface memory_artifact nodes');
    assert.ok(
      types.has('governing_thought') || types.has('navigator_persona') || types.has('decision'),
      'cortexNodes must surface at least one richer projection node (governing_thought / navigator_persona / decision)'
    );

    const ids = ctx.cortexNodes.map((n) => n && n.id).filter(Boolean);
    const sawMemoryArtifactId = ids.some((id) => typeof id === 'string' && id.indexOf('memory_artifact:') === 0);
    assert.ok(sawMemoryArtifactId, 'a memory_artifact: node id must be present verbatim (RAW-local, not hashed)');
    const looksHashed = ids.some((id) => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id));
    assert.equal(looksHashed, false, 'no cortexNode id may be a bare sha256 hex digest (Part-8 LOCAL-raw invariant)');
  });

  await check('getRoomContext returns cortexNodes [] on an empty room (graceful)', async () => {
    assert.ok(roomContextMod, 'getRoomContext required');

    const dbPath = tempDbPath();
    const db = new DatabaseSync(dbPath);
    applySchema(db);

    const ctx = await roomContextMod.getRoomContext(db, 'empty-room', {});
    db.close();

    assert.ok(Array.isArray(ctx.cortexNodes), 'cortexNodes must still be an array on an empty room');
    assert.equal(ctx.cortexNodes.length, 0, 'cortexNodes must be [] when no cortex is projected');
  });

  await check('cortexNodes is purely additive: summary / recentMessages / relevantNodes / _meta still present', async () => {
    assert.ok(roomContextMod, 'getRoomContext required');

    const dbPath = tempDbPath();
    const db = new DatabaseSync(dbPath);
    applySchema(db);

    const ctx = await roomContextMod.getRoomContext(db, 'shape-room', {});
    db.close();

    assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'summary'), 'summary field preserved');
    assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'recentMessages'), 'recentMessages field preserved');
    assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'relevantNodes'), 'relevantNodes field preserved');
    assert.ok(ctx._meta && typeof ctx._meta === 'object', '_meta field preserved');
    assert.ok(ctx._meta.legTimingsMs && typeof ctx._meta.legTimingsMs === 'object', '_meta.legTimingsMs preserved');
    assert.ok(
      Object.prototype.hasOwnProperty.call(ctx._meta.legTimingsMs, 'legD'),
      '_meta.legTimingsMs must carry a legD timing entry for parity'
    );
  });

  if (failures > 0) {
    process.stdout.write('\n  ' + failures + ' check(s) FAILED\n');
    process.exit(1);
  }
  process.stdout.write('\n  all checks passed\n');
  process.exit(0);
})();
