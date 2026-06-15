'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-04 -- Part 8 no-reason adversarial scan (RJP-06).
 * ============================================================================
 * A behavioral + source proof that the reach-penalty + counter path reads
 * decision / edge_semantic / reach_id ENUMS only, NEVER the rejection reason
 * string (Canon Part 8: counts/enums only). Mirrors the Phase 90 / 110
 * forbidden-substring tripwire idiom (seed a secret, assert ZERO in any value
 * the path reads or emits):
 *
 *   Behavioral: write a REJECTED f_selector_decision row carrying
 *     reason:'SECRETREASON123' for a reach_id, then run rejectCountInWindow +
 *     countPenalty + computeReachPenalties and assert 'SECRETREASON123' never
 *     appears in ANY returned value (JSON.stringify of every output) AND the
 *     reject count is still correct (the path is reason-blind, not reason-empty).
 *
 *   Source: the reach-reject-reader.cjs executable source (comment lines
 *     stripped) never references properties.reason / .reason in a read position
 *     (grep-gate hygiene: a comment documenting the absence does not trip it).
 *
 * Deterministic. Uses the shipped room-db opener + the Plan 01 reach_id keying on
 * recordSelectorDecision + the navigation chokepoint. NO RNG, NO live Brain.
 * NO em-dashes (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const selectorDecisions = require(path.join(REPO_ROOT, 'lib', 'workflow', 'selector-decisions.cjs'));
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));

const READER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs');
const SECRET = 'SECRETREASON123';
const REACH = 'deep_research';
const CMD = 'mos:deep-research';
const FW = 'Deep Research';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p158-04-part8-'));
  return openRoomDb(dir);
}

// Seed the cmd + framework anchor nodes so the REJECTED cascade edge FK succeeds.
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p158-04-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

function presentReach(db, reach_id, times) {
  for (let i = 0; i < times; i += 1) {
    const r = navigation.logMemoryEvent(db, 'reach_presented', {
      reach_id: reach_id,
      source_path: 'dial:presented:' + reach_id,
      created_by: 'system',
    });
    assert.ok(r && r.ok, 'logMemoryEvent(reach_presented) ok');
  }
}

function recordReject(db, reason) {
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'reject',
    command: CMD,
    framework: FW,
    reach_id: REACH,
    reason: reason,
    roomState: { db: db },
  });
  assert.ok(r && r.ok, 'recordSelectorDecision ok; got reason=' + (r && r.reason));
}

// Strip comment lines so header prose mentioning "reason" never trips the gate.
function executableSource(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

console.log('test-158-reach-part8-no-reason.cjs (RJP-06): seeded secret never leaks; no reason read');

// ---------------------------------------------------------------------------
// Test 1: behavioral -- the seeded SECRETREASON123 never appears in any value
// the penalty/counter path reads or emits, AND the reject count is correct.
// ---------------------------------------------------------------------------
check('seeded SECRETREASON123 never appears in countPenalty / rejectCountInWindow / computeReachPenalties output', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  // Present >= M times so the count path is fully exercised (not short-circuited
  // by the M fence), then seed two reject rows both carrying the secret reason.
  presentReach(db, REACH, 5);
  recordReject(db, SECRET);
  recordReject(db, SECRET);

  // Sanity: the secret DID land in storage (so the test is meaningful -- the path
  // chooses not to read it, it is not merely absent from the db).
  const stored = navigation.findRecentChanges(db, 0, {
    eventType: 'f_selector_decision',
    limit: 10,
  });
  const anySecret = stored.some((r) => r && r.properties && r.properties.reason === SECRET);
  assert.ok(anySecret, 'the secret reason is present in storage (the path simply never reads it)');

  // Run the whole reach-penalty path and capture every output.
  const n = reader.rejectCountInWindow(db, REACH);
  const cp = reader.countPenalty(db, REACH);
  const pen = reader.computeReachPenalties(db, {
    reachScores: { deep_research: 0.9, hats: 0.8 },
  });

  // The count is correct (reason-blind, not reason-empty): 2 reject rows -> 2.
  assert.strictEqual(n, 2, 'rejectCountInWindow must be correct despite the secret reason; got ' + n);

  // The seeded secret appears in NONE of the values the path reads or emits.
  const blob = JSON.stringify(n) + JSON.stringify(cp) + JSON.stringify(pen);
  assert.strictEqual(
    blob.indexOf(SECRET), -1,
    'SECRETREASON123 must NEVER appear in any value the penalty path reads or emits'
  );
});

// ---------------------------------------------------------------------------
// Test 2: source -- the reader's executable source never reads .reason.
// ---------------------------------------------------------------------------
check('reach-reject-reader executable source never reads .reason / properties.reason', () => {
  const src = executableSource(READER_PATH);
  assert.ok(
    !/properties\.reason/.test(src),
    'the reader must never reference properties.reason in executable code'
  );
  assert.ok(
    !/\.reason\b/.test(src),
    'the reader must never read a .reason field in executable code'
  );

  // Hygiene proof: the RAW source DOES mention "reason" in a comment (documenting
  // the absence), so the comment-strip is genuinely load-bearing.
  const raw = fs.readFileSync(READER_PATH, 'utf8');
  assert.ok(/reason/.test(raw), 'the raw source documents the reason-blind contract in a comment');
});

console.log('');
console.log('PASS test-158-reach-part8-no-reason.cjs (' + passed + ' checks)');
process.exit(0);
