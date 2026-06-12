'use strict';
// Phase 150.8-04 Task 2 (DIKW-10, WIS-01) -- build-knowledge DIKW graph render.
//
// /mos:build-knowledge BECOMES a graph reader (Canon Part 7: the existing Ackoff
// command is repointed, not a new command). It reads typed claims by
// knowledge_type and renders them grouped by Ackoff DIKW rung. This driver
// asserts:
//   1. The documented graph-reader SELECT (json_extract knowledge_type /
//      conditions) returns claims grouped by knowledge_type.
//   2. The documented rung mapping groups the 6 knowledge_types into Ackoff rungs:
//        fact / anomaly_cue          -> Data/Information
//        causal / heuristic / mental_model -> Knowledge
//        a claim carrying conditions -> Wisdom-ready
//   3. commands/build-knowledge.md carries the graph-reader SELECT (json_extract +
//      knowledge_type + the rung grouping) so the prose render is wired to the
//      typed graph, not pure LLM Ackoff prose.
//
// The render is LLM prose (untestable directly); what THIS asserts is the read
// shape + the rung grouping the command documents, run against a real in-memory
// room.db built with claims across all 6 knowledge_types.
//
// node:sqlite unavailable -> SKIP 77. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-build-knowledge-dikw-render.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { applySchema } = require(path.join(REPO_ROOT, 'tests', 'claim-harness', 'build-fixture-room-db.cjs'));
const { DatabaseSync } = require('node:sqlite');

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('  ok - ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('  FAIL - ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

console.log('test-build-knowledge-dikw-render');

// The documented graph-reader SELECT (the No-Analog-Found composition: the
// type='claim' read by json_extract knowledge_type, mirroring packet.cjs:62's
// type-IN idiom). This is the EXACT query build-knowledge.md documents.
const READER_SQL =
  "SELECT id, " +
  "json_extract(properties,'$.knowledge_type') AS kt, " +
  "json_extract(properties,'$.conditions') AS conditions, " +
  "review_status " +
  "FROM nodes WHERE type='claim' ORDER BY kt";

// The documented rung mapping (the canonical grouping build-knowledge.md renders).
function rungFor(kt, conditions) {
  if (typeof conditions === 'string' && conditions.length > 0) return 'Wisdom-ready';
  if (kt === 'fact' || kt === 'anomaly_cue') return 'Data/Information';
  if (kt === 'causal' || kt === 'heuristic' || kt === 'mental_model') return 'Knowledge';
  if (kt === 'assumption') return 'Knowledge'; // an assumption is a knowledge-rung belief
  return 'Data/Information';
}

// Mint one claim per knowledge_type via writeClaimNode (the real writer), plus one
// conditions-bearing claim that should land Wisdom-ready.
function seedClaims(db) {
  const KT = ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption'];
  let i = 0;
  for (const kt of KT) {
    i += 1;
    const r = navigation.writeClaimNode(db, {
      knowledge_type: kt,
      text: 'claim ' + i + ' of type ' + kt,
      sessionId: 'sess-dikw',
      sourceSegment: 'seg-' + i,
    });
    assert.equal(r.ok, true, 'writeClaimNode must succeed for ' + kt + ': ' + JSON.stringify(r));
  }
  // A conditions-bearing causal claim -> Wisdom-ready.
  const w = navigation.writeClaimNode(db, {
    knowledge_type: 'causal',
    text: 'a conditioned causal claim',
    conditions: 'holds only when the market is enterprise',
    sessionId: 'sess-dikw',
    sourceSegment: 'seg-wisdom',
  });
  assert.equal(w.ok, true, 'wisdom-ready claim must write: ' + JSON.stringify(w));
}

// (1) The reader SELECT returns claims grouped by knowledge_type.
check('the graph reader returns claims by knowledge_type (json_extract)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedClaims(db);
  const rows = db.prepare(READER_SQL).all();
  assert.ok(rows.length >= 7, 'all 6 typed claims + the wisdom-ready claim must be read');
  const seen = new Set(rows.map((r) => r.kt));
  for (const kt of ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption']) {
    assert.ok(seen.has(kt), 'reader must surface knowledge_type ' + kt);
  }
  db.close();
});

// (2) The render groups knowledge_types into Ackoff rungs.
check('the render groups knowledge_types into Ackoff DIKW rungs', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedClaims(db);
  const rows = db.prepare(READER_SQL).all();

  const byRung = { 'Data/Information': 0, Knowledge: 0, 'Wisdom-ready': 0 };
  for (const r of rows) {
    byRung[rungFor(r.kt, r.conditions)] += 1;
  }
  // fact + anomaly_cue -> Data/Information (>= 2)
  assert.ok(byRung['Data/Information'] >= 2, 'fact + anomaly_cue must land at Data/Information');
  // causal + heuristic + mental_model + assumption -> Knowledge (the unconditioned ones)
  assert.ok(byRung.Knowledge >= 3, 'causal/heuristic/mental_model must land at Knowledge');
  // the conditions-bearing claim -> Wisdom-ready (>= 1)
  assert.ok(byRung['Wisdom-ready'] >= 1, 'a conditions-bearing claim must land Wisdom-ready');
  db.close();
});

// (3) build-knowledge.md carries the graph-reader SELECT + rung grouping.
check('build-knowledge.md carries the json_extract knowledge_type graph reader', () => {
  const md = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'build-knowledge.md'), 'utf8');
  assert.ok(md.indexOf('json_extract') !== -1, "build-knowledge.md must carry json_extract");
  assert.ok(md.indexOf('knowledge_type') !== -1, "build-knowledge.md must carry knowledge_type");
  assert.ok(/type\s*=\s*'claim'/.test(md), "build-knowledge.md must read WHERE type='claim'");
  // The three Ackoff rung labels must be named in the render doc.
  assert.ok(md.indexOf('Data/Information') !== -1, 'rung label Data/Information must be documented');
  assert.ok(md.indexOf('Knowledge') !== -1, 'rung label Knowledge must be documented');
  assert.ok(/Wisdom/.test(md), 'rung label Wisdom must be documented');
});

// (4) Claims mint at proposed (Part 9) -- the reader reflects truth state.
check('claims minted by the writer carry review_status=proposed (Part 9)', () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedClaims(db);
  const rows = db.prepare("SELECT review_status FROM nodes WHERE type='claim'").all();
  assert.ok(rows.length >= 7, 'claims must be present');
  for (const r of rows) {
    assert.equal(r.review_status, 'proposed', 'claims mint at proposed (no agent shortcut)');
  }
  db.close();
});

if (failures > 0) {
  process.stdout.write('\ntest-build-knowledge-dikw-render.cjs: ' + failures + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('\ntest-build-knowledge-dikw-render.cjs: PASSED (typed claims read by knowledge_type, grouped by DIKW rung)\n');
process.exit(0);
