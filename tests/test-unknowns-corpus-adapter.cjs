'use strict';
/*
 * Phase 165-03 Wave-2 GREEN test -- test-unknowns-corpus-adapter (D-165-03).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 3):
 *   findConfidentClaims(db, opts) over the seeded fixture room.db returns EXACTLY
 *   the graded-confirmed Academic/Operational set (the 5 corpus claims) -- the
 *   UNION over (EvidenceClaim, claim, CausalClaim) WHERE review_status='confirmed'
 *   AND json_extract(properties,'$.evidence_tier') IN ('Academic','Operational').
 *   It MUST EXCLUDE the None/Practitioner-tier confirmed rows, the
 *   ungraded-confirmed claims (no evidence_tier), and the proposed Academic row.
 *   Each returned instance carries the INSTANCE_FEATURES recast { claimId, section,
 *   domain, evidenceTier, confidence, governingHash, ageDays } plus the documented
 *   corpus fields { id, type, knowledgeType, lastModifiedAt } (enum handles only,
 *   Part 8). section/domain are derived enum handles; ageDays derives from
 *   last_modified_at via the opts.now seam (the stale row is ~90 days old).
 *
 * The fixture (tests/fixtures/unknowns/build-fixture-room.cjs) seeds both sides of
 * the D-165-03 filter, so the GREEN test has its data. Room-local (D-165-04): the
 * adapter reads ONLY the active room.db (no rollupSubRooms).
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const { buildFixtureRoom } = require('./fixtures/unknowns/build-fixture-room.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const corpusAdapter = require('../lib/core/unknowns/corpus-adapter.cjs');
const { INSTANCE_FEATURES } = require('../lib/core/unknowns/iface.cjs');

const NOW = 1750000000000; // the fixture's fixed epoch-ms anchor (NOT Date.now).

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

// Build a single deterministic fixture room reused across checks.
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-165-corpus-'));
const fx = buildFixtureRoom(roomDir, { now: NOW });
const db = openRoomDb(roomDir);
const corpus = corpusAdapter.findConfidentClaims(db, { now: () => NOW });

check('findConfidentClaims returns EXACTLY the 5 graded-confirmed corpus rows', () => {
  assert(Array.isArray(corpus), 'findConfidentClaims did not return an array');
  assert.strictEqual(corpus.length, 5, 'expected 5 corpus rows, got ' + corpus.length);
  const got = new Set(corpus.map((c) => c.claimId));
  for (const id of fx.corpusIds) {
    assert(got.has(id), 'corpus row missing expected graded-confirmed id ' + id);
  }
});

check('the corpus EXCLUDES the None/Practitioner/ungraded/proposed rows', () => {
  const got = new Set(corpus.map((c) => c.claimId));
  for (const id of fx.nonCorpusIds) {
    assert(!got.has(id), 'corpus wrongly included an excluded row ' + id);
  }
});

check('every returned row is Academic or Operational (the tier filter)', () => {
  for (const c of corpus) {
    assert(
      c.evidenceTier === 'Academic' || c.evidenceTier === 'Operational',
      'corpus row ' + c.claimId + ' has off-corpus tier ' + c.evidenceTier
    );
  }
});

check('each instance carries the INSTANCE_FEATURES recast schema', () => {
  const featureNames = INSTANCE_FEATURES.map((f) => f.name);
  for (const c of corpus) {
    for (const name of featureNames) {
      assert(name in c, 'recast instance ' + c.claimId + ' missing feature ' + name);
    }
    assert(typeof c.section === 'string' && c.section.length > 0, 'section not a non-empty enum handle');
    assert(typeof c.domain === 'string' && c.domain.length > 0, 'domain not a non-empty enum handle');
    assert(typeof c.confidence === 'number', 'confidence not numeric');
    assert(typeof c.ageDays === 'number' && c.ageDays >= 0, 'ageDays not a non-negative number');
    // Documented corpus fields (165-RESEARCH 3.2).
    assert('id' in c && 'type' in c && 'knowledgeType' in c && 'lastModifiedAt' in c, 'missing documented corpus field');
  }
});

check('the stale corpus row carries the ~90-day ageDays from the opts.now seam', () => {
  const staleRow = corpus.find((c) => c.claimId === fx.staleId);
  assert(staleRow, 'the stale corpus row was not returned');
  assert(Math.abs(staleRow.ageDays - 90) < 0.01, 'stale row ageDays expected ~90, got ' + staleRow.ageDays);
  // A fresh corpus row (not the stale one) has ageDays ~0 under the seam.
  const freshRow = corpus.find((c) => c.claimId !== fx.staleId);
  assert(freshRow.ageDays < 0.01, 'a fresh corpus row should have ageDays ~0, got ' + freshRow.ageDays);
});

check('section and domain vary across the corpus (DSP feature variance)', () => {
  const sections = new Set(corpus.map((c) => c.section));
  const domains = new Set(corpus.map((c) => c.domain));
  assert(sections.size >= 2, 'section enum handles do not vary across the corpus');
  assert(domains.size >= 2, 'domain enum handles do not vary across the corpus');
});

check('an empty / claimless room yields an empty corpus (the graded-confirmed reading)', () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-165-empty-'));
  const edb = openRoomDb(emptyDir);
  const emptyCorpus = corpusAdapter.findConfidentClaims(edb, { now: () => NOW });
  assert(Array.isArray(emptyCorpus) && emptyCorpus.length === 0, 'empty room should yield an empty corpus');
  closeRoomDb(edb);
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

closeRoomDb(db);
fs.rmSync(roomDir, { recursive: true, force: true });

if (failures > 0) {
  console.error('test-unknowns-corpus-adapter: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-corpus-adapter: GREEN (D-165-03 graded-confirmed UNION corpus + INSTANCE_FEATURES recast)');
process.exit(0);
