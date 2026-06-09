'use strict';
// Phase 150-01 (MEM-01) -- cortex lineage-edge contract.
// ========================================================================
// Asserts:
//   (1) writeCortexLineageEdge writes a governing_thought STATES section edge.
//   (2) writeCortexLineageEdge writes a MECE-claim SUPPORTS governing_thought edge.
//   (3) writeCortexLineageEdge writes a decision INFORMS section edge (INFORMS
//       was already a member of ALLOWED_EDGE_TYPES; the cortex writer reuses it).
//   (4) writeCortexLineageEdge writes a persona DESCRIBES room edge.
//   (5) writeCortexLineageEdge rejects a non-taxonomy edge_type ('BOGUS_LINK')
//       with ok:false -- no bespoke edge type can bypass the taxonomy gate
//       (T-150-01).
//   (6) writeCortexLineageEdge rejects a real-but-non-cortex edge type (e.g.
//       'DEFERRED') -- the cortex writer constrains to its CORTEX subset
//       {STATES, SUPPORTS, INFORMS, DESCRIBES}, it does not widen the taxonomy.
//   (7) A second write of the same triple does not duplicate.
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
  process.stdout.write('SKIP test-150-lineage-edges.cjs (node:sqlite unavailable)\n');
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

// Seed the four endpoint node kinds the cortex edges connect.
function seedEndpoints(db) {
  const gt = writer.writeGoverningThoughtNode(db, { section: 'problem-definition', hash: 'sha256:gt' });
  const art = writer.writeMemoryArtifactNode(db, {
    section: 'problem-definition', kind: 'MINTO', path: 'problem-definition/MINTO.md', hash: 'sha256:art',
  });
  const persona = writer.writeNavigatorPersonaNode(db, { roleBlend: 'founder', journeyStage: 'ordeal' });
  // A room node and a MECE-claim node and a decision node as plain seeds.
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES ('room:root', 'room', '{}', 'room:root', 'system', 1.0, 'confirmed', ?, ?)"
  ).run(nowMs, nowMs);
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES ('claim:mece-1', 'claim', '{}', 'claim:mece-1', 'system', 1.0, 'proposed', ?, ?)"
  ).run(nowMs, nowMs);
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES ('decision:d-1', 'decision', '{}', 'decision:d-1', 'system', 1.0, 'proposed', ?, ?)"
  ).run(nowMs, nowMs);
  return {
    gt: gt.node_id,
    art: art.node_id,
    persona: persona.node_id,
    room: 'room:root',
    claim: 'claim:mece-1',
    decision: 'decision:d-1',
  };
}

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

// --- Test 1: governing_thought STATES section ---
check('writeCortexLineageEdge writes a STATES edge (governing_thought STATES section)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  const res = writer.writeCortexLineageEdge(db, {
    source_id: ids.gt, target_id: ids.art, edge_type: 'STATES',
  });
  assert.equal(res.ok, true, 'STATES should write: ' + JSON.stringify(res));
  const row = db.prepare("SELECT * FROM edges WHERE source = ? AND target = ? AND type = 'STATES'").get(ids.gt, ids.art);
  assert.ok(row, 'STATES edge row should exist');
  db.close();
});

// --- Test 2: MECE-claim SUPPORTS governing_thought ---
check('writeCortexLineageEdge writes a SUPPORTS edge (claim SUPPORTS governing_thought)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  const res = writer.writeCortexLineageEdge(db, {
    source_id: ids.claim, target_id: ids.gt, edge_type: 'SUPPORTS',
  });
  assert.equal(res.ok, true, 'SUPPORTS should write: ' + JSON.stringify(res));
  db.close();
});

// --- Test 3: decision INFORMS section (INFORMS already a member; reused) ---
check('writeCortexLineageEdge writes an INFORMS edge (decision INFORMS section)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  const res = writer.writeCortexLineageEdge(db, {
    source_id: ids.decision, target_id: ids.art, edge_type: 'INFORMS',
  });
  assert.equal(res.ok, true, 'INFORMS should write: ' + JSON.stringify(res));
  db.close();
});

// --- Test 4: persona DESCRIBES room ---
check('writeCortexLineageEdge writes a DESCRIBES edge (persona DESCRIBES room)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  const res = writer.writeCortexLineageEdge(db, {
    source_id: ids.persona, target_id: ids.room, edge_type: 'DESCRIBES',
  });
  assert.equal(res.ok, true, 'DESCRIBES should write: ' + JSON.stringify(res));
  db.close();
});

// --- Test 5: a non-taxonomy edge_type is rejected ---
check('writeCortexLineageEdge rejects a non-taxonomy edge_type (BOGUS_LINK)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  const res = writer.writeCortexLineageEdge(db, {
    source_id: ids.gt, target_id: ids.art, edge_type: 'BOGUS_LINK',
  });
  assert.equal(res.ok, false, 'BOGUS_LINK must be rejected');
  const rows = db.prepare("SELECT * FROM edges WHERE type = 'BOGUS_LINK'").all();
  assert.equal(rows.length, 0, 'no BOGUS_LINK edge written');
  db.close();
});

// --- Test 6: a real-but-non-cortex edge type is rejected ---
check('writeCortexLineageEdge rejects a real-but-non-cortex edge type (DEFERRED)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  const res = writer.writeCortexLineageEdge(db, {
    source_id: ids.gt, target_id: ids.art, edge_type: 'DEFERRED',
  });
  assert.equal(res.ok, false, 'DEFERRED is a real edge type but NOT a cortex lineage type');
  db.close();
});

// --- Test 7: second write of the same triple does not duplicate ---
check('second write of the same STATES triple does not duplicate', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const ids = seedEndpoints(db);
  writer.writeCortexLineageEdge(db, { source_id: ids.gt, target_id: ids.art, edge_type: 'STATES' });
  writer.writeCortexLineageEdge(db, { source_id: ids.gt, target_id: ids.art, edge_type: 'STATES' });
  const rows = db.prepare("SELECT * FROM edges WHERE source = ? AND target = ? AND type = 'STATES'").all(ids.gt, ids.art);
  assert.equal(rows.length, 1, 'still exactly one STATES edge after re-write');
  db.close();
});

// --- Test 8: no em-dash / en-dash codepoints in the writer source ---
check('writer source contains zero em-dash / en-dash codepoints', () => {
  const src = fs.readFileSync(WRITER_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  assert.ok(src.indexOf(EM_DASH) === -1, 'writer must contain no em-dash (0x2014)');
  assert.ok(src.indexOf(EN_DASH) === -1, 'writer must contain no en-dash (0x2013)');
});

if (failures > 0) {
  process.stdout.write('\ntest-150-lineage-edges.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-150-lineage-edges.cjs: all assertions passed\n');
process.exit(0);
