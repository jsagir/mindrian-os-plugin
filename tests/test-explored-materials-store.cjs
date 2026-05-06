'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-03 (JSONL ledger).
// Production assertions in Wave 1 (117-01) when lib/memory/explored-materials-store.cjs lands:
//   - append, read, computeMaterialId
//   - findLatest, validateEntryShape
//   - USER_CONTENT_KEY_DENYLIST honored (Canon Part 8)
//   - JSONL last-write-wins replay
//   - idempotency on re-append
//   - workspace-guard (refuses to append outside ~/.mindrian/)
//   - atomic write (rename-after-tmp)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: auto_explore_fired event registered for ledger append on fire', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});

test('117-00 substrate: auto_explore_skipped registered for ledger append on skip', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_skipped'), true);
});
