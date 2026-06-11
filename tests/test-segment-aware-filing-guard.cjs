'use strict';
// Phase 150.8-01 Task 2 -- segment-aware filing guard driver (DIKW-02).
//
// Proves the GATE-0 consequence is honored: extraction is the SEGMENTATION
// AUTHORITY. A fixture transcript that decomposes into K atomic claims, filed by
// calling navigation.writeClaimNode per claim, produces K claim nodes -- claim
// count tracks SEGMENT count (K), NOT file count (1). The GATE-0 warning sign
// (claim count == file count for a multi-segment transcript) is the FAILING
// condition; assertSegmentAuthority returns ok:false on it.
//
// It also asserts the cascade's file-level seam stays additive: the
// SEGMENT_AUTHORITY contract declares the cascade does NOT mint per-segment, so
// the file-level cascade behavior for non-meeting artifacts is untouched (the
// run-all-150.sh regression separately proves the cascade run path is unchanged).
//
// SKIP 77 if node:sqlite is unavailable. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-segment-aware-filing-guard.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const { DatabaseSync } = require('node:sqlite');
const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const cascade = require(path.join(REPO_ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));

const { writeClaimNode } = navigation;
const { SEGMENT_AUTHORITY, assertSegmentAuthority } = cascade;

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshDb() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  return db;
}

// A fixture transcript that decomposes into K=4 atomic claims (standing in for
// the LLM 4-pass extraction output). One filed FILE, FOUR segments.
const FIXTURE_SESSION = 'meeting-2026-06-12';
const FIXTURE_CLAIMS = [
  { knowledge_type: 'fact', text: 'The TAM is 190M USD', sourceSegment: 'seg-1', sourceSpeaker: 'Lawrence' },
  { knowledge_type: 'causal', text: 'Churn drops when onboarding NPS exceeds 50', sourceSegment: 'seg-2', sourceSpeaker: 'Sarah', conditions: 'onboarding NPS > 50' },
  { knowledge_type: 'assumption', text: 'Enterprise buyers will pay annually', sourceSegment: 'seg-3', sourceSpeaker: 'Lawrence' },
  { knowledge_type: 'heuristic', text: 'Ship the smallest testable slice on Monday', sourceSegment: 'seg-4', sourceSpeaker: 'Sarah' },
];

console.log('test-segment-aware-filing-guard');

// (1) Filing a K-segment transcript mints K claim nodes (segment count, not 1).
check('K atomic claims -> K claim nodes (claim count tracks segment count)', () => {
  const db = freshDb();
  const K = FIXTURE_CLAIMS.length;
  for (const c of FIXTURE_CLAIMS) {
    const r = writeClaimNode(db, Object.assign({ sessionId: FIXTURE_SESSION }, c));
    assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  }
  const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'claim'").get();
  assert.equal(row.n, K, `expected ${K} claim nodes (segment count), got ${row.n}`);
  // The decisive assertion: claim count is the segment count (4), NOT the file
  // count (1). This is the GATE-0 consequence honored.
  assert.notEqual(row.n, 1, 'claim count must NOT collapse to the file count (1)');
  db.close();
});

// (2) assertSegmentAuthority proves the contract on the observed counts.
check('assertSegmentAuthority ok when claim count tracks segment count', () => {
  const v = assertSegmentAuthority({ claimCount: 4, segmentCount: 4, fileCount: 1 });
  assert.equal(v.ok, true, JSON.stringify(v));
});

// (3) The GATE-0 warning sign (claim count == file count) is the FAILING case.
check('assertSegmentAuthority rejects the GATE-0 warning sign (claim==file count)', () => {
  const v = assertSegmentAuthority({ claimCount: 1, segmentCount: 4, fileCount: 1 });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'claim_count_equals_file_count');
});

// (4) The cascade declares it does NOT mint per-segment (file-level only seam).
check('SEGMENT_AUTHORITY contract: cascade is file-grain, extraction mints segments', () => {
  assert.equal(Object.isFrozen(SEGMENT_AUTHORITY), true);
  assert.equal(SEGMENT_AUTHORITY.cascadeGrain, 'file');
  assert.equal(SEGMENT_AUTHORITY.cascadeMintsPerSegment, false);
  assert.equal(SEGMENT_AUTHORITY.meetingSegmentMinter, 'extraction');
  assert.equal(SEGMENT_AUTHORITY.meetingSegmentWriter, 'navigation.writeClaimNode');
});

// (5) Re-filing the SAME transcript is idempotent: still K nodes, not 2K.
check('re-filing the same transcript stays K nodes (idempotent segments)', () => {
  const db = freshDb();
  for (let pass2 = 0; pass2 < 2; pass2 += 1) {
    for (const c of FIXTURE_CLAIMS) {
      writeClaimNode(db, Object.assign({ sessionId: FIXTURE_SESSION }, c));
    }
  }
  const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'claim'").get();
  assert.equal(row.n, FIXTURE_CLAIMS.length, 're-filing must UPSERT, not duplicate');
  db.close();
});

// (6) Malformed observation is rejected defensively.
check('assertSegmentAuthority rejects a non-object / non-finite observation', () => {
  assert.equal(assertSegmentAuthority(null).reason, 'invalid_observation');
  assert.equal(assertSegmentAuthority({ claimCount: 'x', segmentCount: 1, fileCount: 1 }).reason, 'invalid_observation');
});

console.log(`\ntest-segment-aware-filing-guard: ${pass} checks passed`);
