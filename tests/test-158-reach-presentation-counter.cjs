'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-02 -- presentation counter suite (SC-06 / RJP-06 / RJP-07).
 * ============================================================================
 * Proves presentationsCount is reach_id-isolated and honors the db-free
 * injection seam, with NO RNG and NO live Brain. Mirrors the
 * test-158-reach-id-keying.cjs check()/PASS-line/non-zero-exit idiom and the
 * lib/memory/selector-decisions.test temp-room.db fixture (opened through the
 * shipped room-db opener; read back through the navigation chokepoint).
 *
 * Behaviors (158-02-PLAN <behavior> presentation rows):
 *   Test 1: injection seam -> presentationsCount returns the injected number db-free.
 *   Test 2: write 3 reach_presented for 'deep_research' + 1 for 'hats' via the
 *           chokepoint -> presentationsCount(db,'deep_research')===3,
 *           ('hats')===1 (reach_id isolation).
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
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Fresh temp room.db opened through the shipped opener (mirrors
// test-158-reach-id-keying.cjs freshDb + selector-decisions.test.cjs).
function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p158-02-presentation-counter-'));
  return openRoomDb(dir);
}

// Write one reach_presented memory_event via the chokepoint (the SAME write the
// live engine arm performs in scripts/intent-classifier.cjs runNavigationEngine).
function presentReach(db, reach_id) {
  const r = navigation.logMemoryEvent(db, 'reach_presented', {
    reach_id: reach_id,
    source_path: 'dial:presented:' + reach_id,
    created_by: 'system',
  });
  assert.ok(r && r.ok, 'logMemoryEvent(reach_presented) ok; got reason=' + (r && r.reason));
}

console.log('test-158-reach-presentation-counter.cjs (SC-06): reach_id-isolated presentation counter');

// ---------------------------------------------------------------------------
// Test 1: the injection seam returns the injected number db-free.
// ---------------------------------------------------------------------------
check('injection seam -> presentationsCount returns injected number db-free', () => {
  const out = reader.presentationsCount(null, 'deep_research', {
    presentationsCount: { deep_research: 5 },
  });
  assert.strictEqual(out, 5, 'injected presentationsCount must win db-free');
  // A reach_id not in the injected map falls through to the db path; with db
  // null that path returns 0.
  const miss = reader.presentationsCount(null, 'hats', {
    presentationsCount: { deep_research: 5 },
  });
  assert.strictEqual(miss, 0, 'absent injected key + null db -> 0');
});

// ---------------------------------------------------------------------------
// Test 2: db-backed count is reach_id-isolated.
// ---------------------------------------------------------------------------
check('db-backed presentationsCount is reach_id-isolated (3 deep_research, 1 hats)', () => {
  const db = freshDb();
  presentReach(db, 'deep_research');
  presentReach(db, 'deep_research');
  presentReach(db, 'deep_research');
  presentReach(db, 'hats');

  const dr = reader.presentationsCount(db, 'deep_research');
  const ht = reader.presentationsCount(db, 'hats');
  const none = reader.presentationsCount(db, 'contradiction');

  assert.strictEqual(dr, 3, "deep_research presentations counted independently; got " + dr);
  assert.strictEqual(ht, 1, "hats presentations counted independently; got " + ht);
  assert.strictEqual(none, 0, 'a never-presented reach reads 0');
});

// ---------------------------------------------------------------------------
// Test 3: null db with no injected counter -> 0 (cold path; byte-stable-at-zero).
// ---------------------------------------------------------------------------
check('null db + no injected counter -> 0 (cold path)', () => {
  assert.strictEqual(reader.presentationsCount(null, 'deep_research', {}), 0);
  assert.strictEqual(reader.presentationsCount(null, 'deep_research'), 0);
});

console.log('');
console.log('PASS test-158-reach-presentation-counter.cjs (' + passed + ' checks)');
process.exit(0);
