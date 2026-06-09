'use strict';
// Phase 150-01 (MEM-07) -- decision-projection contract (the EXTEND debt).
// ========================================================================
// writeDecisionNode is the ONE truth-claim writer in this module. A decision
// is a TRUTH-CLAIM node {claim, CausalClaim, assumption, decision, opportunity}
// per the Canon Part 9 audit-node carve-out, so it must be minted at
// review_status='proposed', NEVER 'confirmed'. Only the human confirmNode path
// promotes a truth-claim to confirmed.
//
// Asserts:
//   (1) writeDecisionNode lands exactly one 'decision' row.
//   (2) The decision node carries review_status='proposed' (NOT 'confirmed')
//       and created_by='system' (T-150-02).
//   (3) A second projection of the same decision id does NOT duplicate
//       (stable-id upsert).
//   (4) After projection, a SELECT for type='decision' returns >= 1 row -- the
//       silent-empty-set fix (find_stale_decisions / room-home stop returning
//       an empty set).
//   (5) The ON CONFLICT update never DOWNGRADES a human-confirmed decision: a
//       re-projection of a decision the human already confirmed leaves
//       review_status='confirmed' intact (the DO UPDATE excludes review_status).
//   (6) The writer source carries NO write of review_status='confirmed' on the
//       decision path (grep the source for the absence of a confirmed mint).
//   (7) NO em-dash / en-dash codepoints in the writer source.
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
  process.stdout.write('SKIP test-150-decision-projection.cjs (node:sqlite unavailable)\n');
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

const DECISION_ARGS = {
  decisionId: 'd-001',
  section: 'problem-definition',
  summaryHash: 'sha256:summary',
  source: 'decisions_index',
};

// --- Test 1: exactly one decision node lands ---
check('writeDecisionNode lands exactly one decision node', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writeDecisionNode(db, DECISION_ARGS);
  assert.equal(res.ok, true, 'decision should write: ' + JSON.stringify(res));
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'decision'").all();
  assert.equal(rows.length, 1, 'exactly one decision node');
  const props = JSON.parse(rows[0].properties);
  assert.equal(props.section, 'problem-definition', 'section preserved');
  assert.equal(props.summary_hash, 'sha256:summary', 'summary_hash handle preserved');
  assert.equal(props.source, 'decisions_index', 'source ledger enum preserved');
  db.close();
});

// --- Test 2: minted at proposed, created_by system (NEVER auto-confirmed) ---
check('decision is minted at review_status=proposed created_by=system (truth-claim, never auto-confirmed)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  writer.writeDecisionNode(db, DECISION_ARGS);
  const row = db.prepare("SELECT * FROM nodes WHERE type = 'decision'").get();
  assert.equal(row.review_status, 'proposed', 'TRUTH-CLAIM: decision must mint at proposed, never confirmed');
  assert.equal(row.created_by, 'system', 'created_by=system (the projector is the system)');
  db.close();
});

// --- Test 3: idempotent (second projection does not duplicate) ---
check('second projection of the same decision id does not duplicate', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  writer.writeDecisionNode(db, DECISION_ARGS);
  writer.writeDecisionNode(db, Object.assign({}, DECISION_ARGS, { summaryHash: 'sha256:summary-v2' }));
  const rows = db.prepare("SELECT * FROM nodes WHERE type = 'decision'").all();
  assert.equal(rows.length, 1, 'still exactly one decision node after re-projection');
  const props = JSON.parse(rows[0].properties);
  assert.equal(props.summary_hash, 'sha256:summary-v2', 'properties updated on conflict');
  db.close();
});

// --- Test 4: the silent-empty-set fix (type='decision' read returns >= 1) ---
check('after projection a SELECT for type=decision returns at least one row (silent-empty-set fix)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  // Before: the read returns empty.
  const before = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'decision'").get();
  assert.equal(before.n, 0, 'no decision nodes before projection (the silent empty set)');
  writer.writeDecisionNode(db, DECISION_ARGS);
  const after = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'decision'").get();
  assert.ok(after.n >= 1, 'at least one decision node after projection');
  db.close();
});

// --- Test 5: ON CONFLICT update never downgrades a human-confirmed decision ---
check('re-projection does not downgrade a human-confirmed decision back to proposed', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const res = writer.writeDecisionNode(db, DECISION_ARGS);
  // Simulate the human confirmNode path promoting the decision to confirmed.
  db.prepare("UPDATE nodes SET review_status = 'confirmed' WHERE id = ?").run(res.node_id);
  // The system re-projects the same decision from the ledger.
  writer.writeDecisionNode(db, Object.assign({}, DECISION_ARGS, { summaryHash: 'sha256:re' }));
  const row = db.prepare("SELECT * FROM nodes WHERE id = ?").get(res.node_id);
  assert.equal(row.review_status, 'confirmed', 'a human-confirmed decision stays confirmed across re-projection');
  const props = JSON.parse(row.properties);
  assert.equal(props.summary_hash, 'sha256:re', 'properties still update on conflict');
  db.close();
});

// --- Test 6: writer source carries no confirmed mint on the decision path ---
check('writer source never mints a decision at review_status=confirmed', () => {
  const src = fs.readFileSync(WRITER_PATH, 'utf8');
  // The decision INSERT must mint 'proposed'. Assert the literal 'decision'
  // VALUES tuple does not pair with a 'confirmed' literal: there must be at
  // least one "'decision'" + "'proposed'" co-occurrence, and the decision
  // writer body must not contain a "'decision'" + "'confirmed'" mint.
  assert.ok(src.indexOf("'proposed'") !== -1, 'writer must mint proposed somewhere (the decision path)');
  // Narrow check: no INSERT that pairs the decision type literal with confirmed
  // on the same VALUES line.
  const lines = src.split('\n');
  for (const line of lines) {
    if (line.indexOf("'decision'") !== -1 && line.indexOf("'confirmed'") !== -1) {
      throw new Error('found a decision INSERT line that mints confirmed: ' + line.trim());
    }
  }
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
  process.stdout.write('\ntest-150-decision-projection.cjs: ' + failures + ' failure(s)\n');
  process.exit(1);
}
process.stdout.write('\ntest-150-decision-projection.cjs: all assertions passed\n');
process.exit(0);
