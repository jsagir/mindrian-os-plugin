'use strict';
// Phase 150-01 (MEM-01) -- memory-cortex node-write contract.
// ========================================================================
// Asserts:
//   (1) writeMemoryArtifactNode lands exactly one 'memory_artifact' row per
//       kind for each of the 7 kinds (ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER +
//       DRIFT, the Phase 195 FCM-07 addition), with properties {section, kind,
//       path, hash} correct.
//   (2) memory_artifact nodes are SYSTEM-BOOKKEEPING (created_by='system',
//       review_status='confirmed') under the Canon Part 9 v1.5 audit-node
//       carve-out -- they record WHICH memory files exist, not a truth claim.
//   (3) writeGoverningThoughtNode + writeNavigatorPersonaNode each land one
//       system-bookkeeping node (created_by='system' review_status='confirmed').
//   (4) A SECOND write of the same memory_artifact does NOT duplicate
//       (stable-id upsert on ON CONFLICT(id)).
//   (5) The writer source carries NO direct room.db open and NO require of
//       node:sqlite -- the substrate-guard floor (MEM-01; threat T-150-05).
//   (6) NO em-dash / en-dash codepoints anywhere in the writer source. The
//       em-dash (0x2014) and en-dash (0x2013) are referenced via
//       String.fromCharCode so THIS file stays greppably clean.
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) and the
// applySchema(db) in-memory fixture from tests/test-149-lineage-edges.cjs.
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-150-memory-nodes.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const WRITER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-artifacts.cjs');

function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, source_section TEXT, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL" +
    ");"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS edges (" +
    "  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)" +
    ");"
  );
}

const writer = require(WRITER_PATH);

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n');
  }
}

// --- Test 1: one memory_artifact node per kind, properties correct ---
check('writeMemoryArtifactNode lands one node per kind with correct properties', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const kinds = writer.MEMORY_KINDS;
  // Phase 195 FCM-07: DRIFT is the 7th memory kind, registered in code now
  // (canon 6->7 amendment is gated, FCM-08, Wave 5). The writer's accepted-kind
  // set grows by one so a discovered DRIFT.md projects born-wired (Part 11).
  assert.equal(kinds.length, 7, 'MEMORY_KINDS must have 7 members (6 + DRIFT)');
  for (const kind of kinds) {
    const res = writer.writeMemoryArtifactNode(db, {
      section: 'problem-definition',
      kind: kind,
      path: 'problem-definition/' + kind + '.md',
      hash: 'sha256:' + kind.toLowerCase(),
    });
    assert.equal(res.ok, true, kind + ' should write: ' + JSON.stringify(res));
  }
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'memory_artifact'").all();
  assert.equal(rows.length, 7, 'exactly 7 memory_artifact nodes (one per kind, incl DRIFT)');
  for (const row of rows) {
    const props = JSON.parse(row.properties);
    assert.ok(writer.MEMORY_KINDS.indexOf(props.kind) !== -1, 'props.kind in the closed set');
    assert.equal(props.section, 'problem-definition', 'props.section preserved');
    assert.equal(props.path, 'problem-definition/' + props.kind + '.md', 'props.path preserved');
    assert.equal(props.hash, 'sha256:' + props.kind.toLowerCase(), 'props.hash preserved');
  }
  db.close();
});

// --- Test 2: memory_artifact is a system-bookkeeping node ---
check('memory_artifact nodes are system-bookkeeping (created_by=system confirmed)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  writer.writeMemoryArtifactNode(db, {
    section: 'market-analysis', kind: 'ROOM', path: 'market-analysis/ROOM.md', hash: 'sha256:abc',
  });
  const row = db.prepare("SELECT * FROM nodes WHERE type = 'memory_artifact'").get();
  assert.equal(row.created_by, 'system', 'audit-node carve-out: created_by=system');
  assert.equal(row.review_status, 'confirmed', 'audit-node carve-out: review_status=confirmed');
  db.close();
});

// --- Test 3: governing_thought + navigator_persona land as system-bookkeeping ---
check('writeGoverningThoughtNode lands one system-bookkeeping node (hash handle only)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writeGoverningThoughtNode(db, { section: 'problem-definition', hash: 'sha256:gt' });
  assert.equal(res.ok, true, 'governing_thought should write: ' + JSON.stringify(res));
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'governing_thought'").all();
  assert.equal(rows.length, 1, 'exactly one governing_thought node');
  assert.equal(rows[0].created_by, 'system', 'created_by=system');
  assert.equal(rows[0].review_status, 'confirmed', 'review_status=confirmed');
  const props = JSON.parse(rows[0].properties);
  assert.equal(props.hash, 'sha256:gt', 'hash handle preserved');
  db.close();
});

check('writeNavigatorPersonaNode lands one system-bookkeeping node (enum handles only)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writeNavigatorPersonaNode(db, { roleBlend: 'founder_researcher', journeyStage: 'crossing_threshold' });
  assert.equal(res.ok, true, 'navigator_persona should write: ' + JSON.stringify(res));
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'navigator_persona'").all();
  assert.equal(rows.length, 1, 'exactly one navigator_persona node');
  assert.equal(rows[0].created_by, 'system', 'created_by=system');
  assert.equal(rows[0].review_status, 'confirmed', 'review_status=confirmed');
  const props = JSON.parse(rows[0].properties);
  assert.equal(props.role_blend, 'founder_researcher', 'role_blend enum preserved');
  assert.equal(props.journey_stage, 'crossing_threshold', 'journey_stage enum preserved');
  db.close();
});

// --- Test 4: invalid kind rejected ---
check('writeMemoryArtifactNode rejects a non-taxonomy kind', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writeMemoryArtifactNode(db, {
    section: 'x', kind: 'BOGUS', path: 'x/BOGUS.md', hash: 'sha256:x',
  });
  assert.equal(res.ok, false, 'BOGUS kind must be rejected');
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'memory_artifact'").all();
  assert.equal(rows.length, 0, 'no node written for an invalid kind');
  db.close();
});

// --- Test 5: idempotent upsert (second write does not duplicate) ---
check('second write of the same memory_artifact does not duplicate', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const args = { section: 'problem-definition', kind: 'MINTO', path: 'problem-definition/MINTO.md', hash: 'sha256:v1' };
  writer.writeMemoryArtifactNode(db, args);
  writer.writeMemoryArtifactNode(db, Object.assign({}, args, { hash: 'sha256:v2' }));
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'memory_artifact'").all();
  assert.equal(rows.length, 1, 'still exactly one node after re-write');
  const props = JSON.parse(rows[0].properties);
  assert.equal(props.hash, 'sha256:v2', 'properties updated on conflict');
  db.close();
});

// --- Test 6: substrate-guard floor (no room.db open, no node:sqlite require) ---
check('writer source opens no room.db and requires no node:sqlite', () => {
  const src = fs.readFileSync(WRITER_PATH, 'utf8');
  assert.ok(/require\s*\(\s*['"]node:sqlite['"]\s*\)/.test(src) === false, 'writer must not require node:sqlite');
  assert.ok(/require\s*\(\s*['"][^'"]*room-db[^'"]*['"]\s*\)/.test(src) === false, 'writer must not require room-db');
  assert.ok(/openRoomDb\s*\(/.test(src) === false, 'writer must not call openRoomDb');
  assert.ok(/new\s+DatabaseSync/.test(src) === false, 'writer must not open a DatabaseSync handle');
});

// --- Test 7: no em-dash / en-dash codepoints in the writer source ---
check('writer source contains zero em-dash / en-dash codepoints', () => {
  const src = fs.readFileSync(WRITER_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  assert.ok(src.indexOf(EM_DASH) === -1, 'writer must contain no em-dash (0x2014)');
  assert.ok(src.indexOf(EN_DASH) === -1, 'writer must contain no en-dash (0x2013)');
});

if (failures > 0) {
  process.stdout.write('\ntest-150-memory-nodes.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-150-memory-nodes.cjs: all assertions passed\n');
process.exit(0);
