'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-02 -- REJECT-only reject-count suite (D-03 / RJP-06 / RJP-07).
 * ============================================================================
 * Proves rejectCountInWindow counts ONLY reject rows (DEFER excluded), keyed by
 * reach_id, and NEVER reads properties.reason -- with NO RNG and NO live Brain.
 * Mirrors the test-158-reach-id-keying.cjs check()/PASS-line/non-zero-exit idiom
 * and the lib/memory/selector-decisions.test temp-room.db fixture (opened through
 * the shipped room-db opener; written via the Plan 01 reach_id keying on
 * recordSelectorDecision; read back through the navigation chokepoint).
 *
 * Behaviors (158-02-PLAN <behavior> reject-only rows):
 *   Test 1: write 2 reject + 1 defer f_selector_decision for 'deep_research'
 *           -> rejectCountInWindow counts 2 (defer excluded).
 *   Test 2: a row carrying reason:'SECRETREASON123' never has its reason read by
 *           the reader (assert the count is correct; the count is reason-blind).
 *   Test 3: reach_id isolation -- a reject for 'hats' does not bleed into the
 *           'deep_research' count.
 *   Test 4: injection seam returns the injected count db-free; DEFER never counts.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
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

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p158-02-reject-only-'));
  return openRoomDb(dir);
}

// Seed the command + framework anchor nodes so the REJECTED/DEFERRED cascade
// edge inside recordSelectorDecision succeeds (FK (source, target) -> nodes(id);
// mirrors test-158-reach-id-keying.cjs seedAnchorsFor).
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p158-02-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

// Record a reject/defer decision keyed by reach_id (the Plan 01 keying).
function recordDecision(db, decision, command, framework, reach_id, reason) {
  const args = {
    decision: decision,
    command: command,
    framework: framework,
    reach_id: reach_id,
    roomState: { db: db },
  };
  if (typeof reason === 'string') args.reason = reason;
  const r = selectorDecisions.recordSelectorDecision(args);
  assert.ok(r && r.ok, 'recordSelectorDecision ok; got reason=' + (r && r.reason));
}

// Present a reach enough times to give the W window a well-defined floor.
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

const CMD = 'mos:deep-research';
const FW = 'Deep Research';

console.log('test-158-reach-reject-only.cjs (D-03): REJECT-only, reach_id-keyed, reason-blind count');

// ---------------------------------------------------------------------------
// Test 1: DEFER is excluded -- 2 reject + 1 defer for 'deep_research' -> count 2.
// ---------------------------------------------------------------------------
check('2 reject + 1 defer for deep_research -> rejectCountInWindow === 2 (DEFER excluded)', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  // A few presentations so the window floor is defined (well inside W=8 default).
  presentReach(db, 'deep_research', 3);
  recordDecision(db, 'reject', CMD, FW, 'deep_research', 'no');
  recordDecision(db, 'defer', CMD, FW, 'deep_research', 'later');
  recordDecision(db, 'reject', CMD, FW, 'deep_research', 'still no');

  const n = reader.rejectCountInWindow(db, 'deep_research');
  assert.strictEqual(n, 2, 'only the 2 reject rows count; the defer is excluded; got ' + n);
});

// ---------------------------------------------------------------------------
// Test 2: the reader is reason-blind (a secret reason is never read).
// ---------------------------------------------------------------------------
check('rejectCountInWindow is reason-blind (count correct despite a secret reason)', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  presentReach(db, 'deep_research', 2);
  recordDecision(db, 'reject', CMD, FW, 'deep_research', 'SECRETREASON123');
  recordDecision(db, 'reject', CMD, FW, 'deep_research', 'SECRETREASON123');

  // The count is correct WITHOUT the reader ever consulting properties.reason.
  // (The structural reason-leak source grep is enforced in Plan 04's
  // run-all-158.sh; here we prove the count is reason-independent.)
  const n = reader.rejectCountInWindow(db, 'deep_research');
  assert.strictEqual(n, 2, 'count is reason-independent; got ' + n);

  // Sanity: the secret reason DID land in the stored payload (so the test is
  // meaningful -- the reader chooses not to read it, it is not merely absent).
  const rows = navigation.findRecentChanges(db, 0, {
    eventType: 'f_selector_decision',
    limit: 10,
  });
  const anySecret = rows.some((r) => r && r.properties && r.properties.reason === 'SECRETREASON123');
  assert.ok(anySecret, 'the secret reason is present in storage (the reader simply never reads it)');
});

// ---------------------------------------------------------------------------
// Test 3: reach_id isolation -- a 'hats' reject does not bleed into deep_research.
// ---------------------------------------------------------------------------
check('reach_id isolation -- a hats reject does not count toward deep_research', () => {
  const db = freshDb();
  seedAnchorsFor(db, CMD, FW);
  seedAnchorsFor(db, 'mos:think-hats', 'Six Thinking Hats');
  presentReach(db, 'deep_research', 2);
  presentReach(db, 'hats', 2);
  recordDecision(db, 'reject', CMD, FW, 'deep_research', 'no');
  recordDecision(db, 'reject', 'mos:think-hats', 'Six Thinking Hats', 'hats', 'no');

  const dr = reader.rejectCountInWindow(db, 'deep_research');
  const ht = reader.rejectCountInWindow(db, 'hats');
  assert.strictEqual(dr, 1, 'deep_research counts only its own reject; got ' + dr);
  assert.strictEqual(ht, 1, 'hats counts only its own reject; got ' + ht);
});

// ---------------------------------------------------------------------------
// Test 4: injection seam db-free + cold path.
// ---------------------------------------------------------------------------
check('injection seam returns injected count db-free; null db -> 0', () => {
  const inj = reader.rejectCountInWindow(null, 'deep_research', {
    rejectCountInWindow: { deep_research: 4 },
  });
  assert.strictEqual(inj, 4, 'injected reject count wins db-free');
  assert.strictEqual(reader.rejectCountInWindow(null, 'deep_research', {}), 0, 'null db + no counter -> 0');
});

console.log('');
console.log('PASS test-158-reach-reject-only.cjs (' + passed + ' checks)');
process.exit(0);
