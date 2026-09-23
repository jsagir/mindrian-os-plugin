'use strict';

// Phase 358-01, Task 1 (RED). B1-01 / B1-04 core legs: rung constant, single
// source, invalid_rung, legacy rung unknown, checked_by_id, sticky disputed,
// resolution rules, claim view, claim list, transaction hygiene.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic room resolution (same seam as tests/test-276-claim-write-primitive.cjs):
// point MINDRIAN_ROOMS_HOME at a fresh, registry-less scratch dir so a real dev
// machine's own room registry never redirects this test's writes.
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-core-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;

const navigation = require('../lib/core/navigation.cjs');
const verification = require('../lib/core/navigation/verification.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

const REPO_ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    const detail = e && e.message ? e.message : String(e);
    failMessages.push(label + ' :: ' + detail);
    process.stdout.write('FAIL - ' + label + '\n');
    process.stdout.write('  ' + detail + '\n');
  }
}

function makeTempRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function withRoom(prefix, fn) {
  const dir = makeTempRoom(prefix);
  const db = navigation.openRoomDbForCaller(dir);
  try {
    return fn(db, dir);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function seed(db, text, seg) {
  const r = navigation.writeClaimNode(db, {
    knowledge_type: 'fact', text: text, sessionId: 's358', sourceSegment: seg,
  });
  assert.equal(r.ok, true, 'seed claim write failed: ' + JSON.stringify(r));
  return r.node_id;
}

function walkFiles(dir, exts, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// VERIFICATION_RUNGS shape (B1-01)
// ---------------------------------------------------------------------------

check('VERIFICATION_RUNGS is a frozen array', () => {
  assert.ok(Array.isArray(verification.VERIFICATION_RUNGS));
  assert.equal(Object.isFrozen(verification.VERIFICATION_RUNGS), true);
});

check('every rung entry is frozen with a non-empty string id and label, ids unique', () => {
  const ids = [];
  for (const rung of verification.VERIFICATION_RUNGS) {
    assert.equal(Object.isFrozen(rung), true);
    assert.equal(typeof rung.id, 'string');
    assert.ok(rung.id.length > 0);
    assert.equal(typeof rung.label, 'string');
    assert.ok(rung.label.length > 0);
    ids.push(rung.id);
  }
  assert.equal(new Set(ids).size, ids.length);
});

check('navigation.VERIFICATION_RUNGS is the same array object as verification.VERIFICATION_RUNGS', () => {
  assert.equal(navigation.VERIFICATION_RUNGS, verification.VERIFICATION_RUNGS);
});

check('rungInfo(1).label equals VERIFICATION_RUNGS[0].label; out-of-range and non-integer return null', () => {
  assert.equal(verification.rungInfo(1).label, verification.VERIFICATION_RUNGS[0].label);
  assert.equal(verification.rungInfo(0), null);
  assert.equal(verification.rungInfo(verification.VERIFICATION_RUNGS.length + 1), null);
  assert.equal(verification.rungInfo(2.5), null);
  assert.equal(verification.rungInfo('3'), null);
});

check('verification.cjs source contains the exact TODO(358) marker', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/navigation/verification.cjs'), 'utf8');
  assert.ok(src.includes("TODO(358): replace with the paper author's verification hierarchy from The Orientation Problem"));
});

check('every rung label occurs in exactly one file under lib, scripts, commands, and that file is verification.cjs', () => {
  const files = [];
  for (const top of ['lib', 'scripts', 'commands']) {
    walkFiles(path.join(REPO_ROOT, top), ['.cjs', '.js', '.md'], files);
  }
  const verificationPath = path.join(REPO_ROOT, 'lib/core/navigation/verification.cjs');
  const contents = new Map();
  for (const file of files) {
    contents.set(file, fs.readFileSync(file, 'utf8'));
  }
  for (const rung of verification.VERIFICATION_RUNGS) {
    const hits = [];
    for (const [file, content] of contents) {
      if (content.includes(rung.label)) hits.push(file);
    }
    assert.equal(hits.length, 1, 'label "' + rung.label + '" found in: ' + hits.join(', '));
    assert.equal(hits[0], verificationPath);
  }
});

// ---------------------------------------------------------------------------
// rung storage, validation and unknown fallback
// ---------------------------------------------------------------------------

check('a record with rung 3 stores rung 3 and rung_label matching rungInfo(3); filtering rung >= 3 finds it', () => {
  withRoom('mindrian-358-b1-core-rung3-', (db) => {
    const id = seed(db, 'The bridge at grid 42 is passable.', 'seg-rung3');
    const res = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'artifact:doc-1', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user', rung: 3,
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    const highRung = res.verification.records.filter((r) => r.rung >= 3);
    assert.equal(highRung.length, 1);
    assert.equal(highRung[0].rung, 3);
    assert.equal(highRung[0].rung_label, verification.rungInfo(3).label);
  });
});

check('rung 0, length+1, 2.5 and \'3\' each return invalid_rung and write nothing', () => {
  withRoom('mindrian-358-b1-core-invrung-', (db) => {
    const id = seed(db, 'Invalid rung claim.', 'seg-invrung');
    const bad = [0, verification.VERIFICATION_RUNGS.length + 1, 2.5, '3'];
    for (const rung of bad) {
      const res = verification.recordClaimVerification(db, {
        claim_id: id, against_id: 'artifact:doc-x', against_kind: 'artifact',
        method: 'compare', result: 'supports', checked_by: 'user', rung: rung,
      });
      assert.equal(res.ok, false, 'rung ' + JSON.stringify(rung) + ' should be refused');
      assert.equal(res.reason, 'invalid_rung');
    }
    const read = verification.readClaimVerification(db, id);
    assert.equal(read.claim.checking_record.records.length, 0);
  });
});

check('a record with no rung is accepted and reads back rung unknown', () => {
  withRoom('mindrian-358-b1-core-norung-', (db) => {
    const id = seed(db, 'No rung claim.', 'seg-norung');
    const res = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'artifact:doc-2', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user',
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    const read = verification.readClaimVerification(db, id);
    assert.equal(read.claim.checking_record.records[0].rung_display, 'rung unknown');
  });
});

// ---------------------------------------------------------------------------
// checked_by_id (Who checked ruling)
// ---------------------------------------------------------------------------

check('checked_by_id is stored when given, absent when omitted, refused when malformed', () => {
  withRoom('mindrian-358-b1-core-cbid-', (db) => {
    const id = seed(db, 'checked by id claim one.', 'seg-cbid-1');
    const withId = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'artifact:doc-3', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user', checked_by_id: 'officer-7',
    });
    assert.equal(withId.ok, true, JSON.stringify(withId));
    assert.equal(withId.verification.records[0].checked_by_id, 'officer-7');

    const id2 = seed(db, 'checked by id claim two.', 'seg-cbid-2');
    const noId = verification.recordClaimVerification(db, {
      claim_id: id2, against_id: 'artifact:doc-4', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user',
    });
    assert.equal(noId.ok, true, JSON.stringify(noId));
    assert.equal(Object.prototype.hasOwnProperty.call(noId.verification.records[0], 'checked_by_id'), false);

    const longId = 'x'.repeat(129);
    const bad1 = verification.recordClaimVerification(db, {
      claim_id: id2, against_id: 'artifact:doc-5', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user', checked_by_id: longId,
    });
    assert.equal(bad1.ok, false);
    assert.equal(bad1.reason, 'invalid_checked_by_id');

    const bad2 = verification.recordClaimVerification(db, {
      claim_id: id2, against_id: 'artifact:doc-6', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user', checked_by_id: 42,
    });
    assert.equal(bad2.ok, false);
    assert.equal(bad2.reason, 'invalid_checked_by_id');
  });
});

// ---------------------------------------------------------------------------
// Disputed sticks (navigator ruling 2026-09-23)
// ---------------------------------------------------------------------------

check('contradicts then supports gives disputed with 2 records, contradicts stays at index 0', () => {
  withRoom('mindrian-358-b1-core-sticky-', (db) => {
    const id = seed(db, 'sticky disputed claim.', 'seg-sticky');
    const r1 = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'artifact:doc-7', against_kind: 'artifact',
      method: 'compare', result: 'contradicts', checked_by: 'user',
    });
    assert.equal(r1.ok, true, JSON.stringify(r1));
    const r2 = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'artifact:doc-8', against_kind: 'artifact',
      method: 'compare', result: 'supports', checked_by: 'user',
    });
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.verification.status, 'disputed');
    assert.equal(r2.verification.records.length, 2);
    assert.equal(r2.verification.records[0].result, 'contradicts');
  });
});

check('resolves_dispute: requires a person, forbids contradicts as the resolving result, requires an existing dispute, requires a boolean; a valid resolution clears it and a later contradicts re-disputes', () => {
  withRoom('mindrian-358-b1-core-resolve-', (db) => {
    const freshId = seed(db, 'never disputed claim.', 'seg-resolve-fresh');
    const nd = verification.recordClaimVerification(db, {
      claim_id: freshId, against_id: 'a0', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true,
    });
    assert.equal(nd.ok, false);
    assert.equal(nd.reason, 'no_dispute_to_resolve');

    const id = seed(db, 'resolve claim.', 'seg-resolve');
    const contradict = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a1', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user',
    });
    assert.equal(contradict.ok, true, JSON.stringify(contradict));
    assert.equal(contradict.verification.status, 'disputed');

    const plainSupports = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a2', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user',
    });
    assert.equal(plainSupports.ok, true, JSON.stringify(plainSupports));
    assert.equal(plainSupports.verification.status, 'disputed');
    assert.equal(plainSupports.verification.records.length, 2);

    const sysResolve = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a3', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'system', resolves_dispute: true,
    });
    assert.equal(sysResolve.ok, false);
    assert.equal(sysResolve.reason, 'resolution_requires_person');

    const badResult = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a4', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user', resolves_dispute: true,
    });
    assert.equal(badResult.ok, false);
    assert.equal(badResult.reason, 'invalid_resolution');

    const nonBool = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a5', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: 'yes',
    });
    assert.equal(nonBool.ok, false);
    assert.equal(nonBool.reason, 'invalid_resolves_dispute');

    const resolved = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a6', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true,
    });
    assert.equal(resolved.ok, true, JSON.stringify(resolved));
    assert.equal(resolved.verification.status, 'checked');
    assert.equal(resolved.verification.records.length, 3);
    const last = resolved.verification.records[2];
    assert.equal(last.resolves_dispute, true);

    const reDispute = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'a7', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user',
    });
    assert.equal(reDispute.ok, true, JSON.stringify(reDispute));
    assert.equal(reDispute.verification.status, 'disputed');
  });
});

check('supports then inconclusive gives inconclusive; inconclusive then supports gives checked; deriveCheckStatus edge cases', () => {
  withRoom('mindrian-358-b1-core-derive-', (db) => {
    const id = seed(db, 'derive status claim.', 'seg-derive');
    verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'b1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user',
    });
    const r2 = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'b2', against_kind: 'artifact', method: 'compare',
      result: 'inconclusive', checked_by: 'user',
    });
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.verification.status, 'inconclusive');
    const r3 = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'b3', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user',
    });
    assert.equal(r3.ok, true, JSON.stringify(r3));
    assert.equal(r3.verification.status, 'checked');
  });
  assert.equal(verification.deriveCheckStatus([]), 'unchecked');
  assert.equal(verification.deriveCheckStatus([null, 'x', { result: 'no-such-result' }]), 'unchecked');
});

// ---------------------------------------------------------------------------
// Separation from approval, read side
// ---------------------------------------------------------------------------

check('recordClaimVerification success return carries review_status proposed', () => {
  withRoom('mindrian-358-b1-core-reviewstatus-', (db) => {
    const id = seed(db, 'review status claim.', 'seg-reviewstatus');
    const res = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'c1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user',
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.review_status, 'proposed');
  });
});

check('readClaimVerification returns the claim shape; unknown id and a non-claim node both return claim_not_found', () => {
  withRoom('mindrian-358-b1-core-readclaim-', (db) => {
    const id = seed(db, 'The bridge at grid 42 is passable.', 'seg-readclaim');
    const read = verification.readClaimVerification(db, id);
    assert.equal(read.ok, true, JSON.stringify(read));
    assert.equal(read.claim.claim_id, id);
    assert.equal(read.claim.text, 'The bridge at grid 42 is passable.');
    assert.equal(read.claim.confirmation.review_status, 'proposed');
    assert.ok(read.claim.confirmation.note.includes('Only a person can confirm'));
    assert.ok('status' in read.claim.checking_record);
    assert.ok(Array.isArray(read.claim.checking_record.records));

    const unknown = verification.readClaimVerification(db, 'claim:does-not-exist');
    assert.equal(unknown.ok, false);
    assert.equal(unknown.reason, 'claim_not_found');

    db.exec(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) " +
      "VALUES ('nonclaim:1', 'decision', '{}', 'test:x', 'system', 0, 0)"
    );
    const nonClaim = verification.readClaimVerification(db, 'nonclaim:1');
    assert.equal(nonClaim.ok, false);
    assert.equal(nonClaim.reason, 'claim_not_found');
  });
});

check('renderClaimViewLines shows confirmation and checking record lines, rung/method/result/by/when, never the word verified; confirmed after confirmNode', () => {
  withRoom('mindrian-358-b1-core-renderview-', (db) => {
    const id = seed(db, 'The bridge at grid 42 is passable.', 'seg-renderview');
    const rec = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'field note, exercise 02', against_kind: 'observation',
      method: 'compare', result: 'contradicts', checked_by: 'user', rung: 3,
    });
    assert.equal(rec.ok, true, JSON.stringify(rec));
    const read = verification.readClaimVerification(db, id);
    assert.equal(read.ok, true, JSON.stringify(read));
    const lines = verification.renderClaimViewLines(read.claim);
    assert.ok(lines.some((l) => l.startsWith('Confirmation status: proposed')));
    assert.ok(lines.some((l) => l.startsWith('Checking record: ')));
    const joined = lines.join('\n');
    assert.ok(joined.includes('checked against: '));
    assert.ok(joined.includes('rung 3 ('));
    assert.ok(joined.includes('method: compare'));
    assert.ok(joined.includes('result: contradicts'));
    assert.ok(joined.includes('by: user'));
    assert.ok(joined.includes('when: '));
    assert.ok(!/\bverified\b/i.test(joined));

    const confirmResult = navigation.confirmNode(db, id, 'navigator', 'test-confirm');
    assert.equal(confirmResult.ok, true, JSON.stringify(confirmResult));
    const read2 = verification.readClaimVerification(db, id);
    const lines2 = verification.renderClaimViewLines(read2.claim);
    assert.ok(lines2.some((l) => l.startsWith('Confirmation status: confirmed')));
  });
});

check('listClaimsForChecking: query filters, limit clamps 0 to 1 and 500 to 100, total_matched and text_preview length', () => {
  withRoom('mindrian-358-b1-core-list-', (db) => {
    const bridgeId = seed(db, 'The bridge at grid 42 is passable.', 'seg-list-bridge');
    seed(db, 'The tunnel at grid 12 is flooded.', 'seg-list-tunnel');
    seed(db, 'The road at grid 8 is clear.', 'seg-list-road');

    const byQuery = verification.listClaimsForChecking(db, { query: 'BRIDGE' });
    assert.equal(byQuery.ok, true, JSON.stringify(byQuery));
    assert.equal(byQuery.claims.length, 1);
    assert.equal(byQuery.claims[0].claim_id, bridgeId);
    assert.ok('text_preview' in byQuery.claims[0]);
    assert.ok('review_status' in byQuery.claims[0]);
    assert.ok('checking_status' in byQuery.claims[0]);
    assert.ok('records_total' in byQuery.claims[0]);

    const limited = verification.listClaimsForChecking(db, { limit: 1 });
    assert.equal(limited.ok, true, JSON.stringify(limited));
    assert.equal(limited.claims.length, 1);
    assert.equal(limited.total_matched, 3);

    const zeroLimit = verification.listClaimsForChecking(db, { limit: 0 });
    assert.equal(zeroLimit.claims.length, 1);

    const bigLimit = verification.listClaimsForChecking(db, { limit: 500 });
    assert.equal(bigLimit.claims.length, 3);

    const all = verification.listClaimsForChecking(db, {});
    for (const c of all.claims) {
      assert.ok(c.text_preview.length <= 120);
    }
  });
});

// ---------------------------------------------------------------------------
// Transaction hygiene (T-358-04)
// ---------------------------------------------------------------------------

check('after a row-dependent refusal db.isTransaction is false; a caller-owned transaction stays open through a success', () => {
  withRoom('mindrian-358-b1-core-txn-', (db) => {
    const id = seed(db, 'txn hygiene claim.', 'seg-txn');
    const refused = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'z1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'no_dispute_to_resolve');
    assert.equal(db.isTransaction, false);

    db.exec('BEGIN');
    const owned = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'z2', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user',
    });
    assert.equal(owned.ok, true, JSON.stringify(owned));
    assert.equal(db.isTransaction, true);
    db.exec('COMMIT');
    assert.equal(db.isTransaction, false);
  });
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
