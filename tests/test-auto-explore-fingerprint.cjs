'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-02 (first-material fingerprint).
// Production assertions in Wave 1 (117-01) when scripts/preflight-auto-explore.cjs
// + lib/memory/explored-materials-store.cjs land:
//   - material_id determinism (sha256 of canonical path + mtime + size)
//   - mtime sensitivity (re-uploaded modified file fingerprints differently)
//   - room-section walker (PostToolUse event resolves material to room-section)
//   - rate-limit-by-record (per-material idempotent)
//   - rate-limit-by-day (per-room daily cap)
//   - three-surface ledger path (CLI + Desktop + Cowork share JSONL)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: auto_explore_fired event registered for fingerprint -> spawn', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});

test('117-00 substrate: auto_explore_skipped registered for rate-limit suppression path', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_skipped'), true);
});
