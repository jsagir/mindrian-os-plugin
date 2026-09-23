'use strict';

// Phase 358-01, Task 1 (RED). B1-05 legs: empty room, mixed room, all-checked
// room still shows unchecked 0, no-score guard, legacy latest-wins status
// re-derived under the sticky rule.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-portrait-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;

const navigation = require('../lib/core/navigation.cjs');
const verification = require('../lib/core/navigation/verification.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

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

function rungKeys() {
  const keys = [];
  for (let i = 1; i <= verification.VERIFICATION_RUNGS.length; i += 1) keys.push(String(i));
  keys.push('unknown');
  return keys;
}

function deepWalkNoScoreKeys(value, prefix, hits) {
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/score|percent|pct|ratio|grade|coverage|%/i.test(key)) hits.push(prefix + '.' + key);
    deepWalkNoScoreKeys(value[key], prefix + '.' + key, hits);
  }
}

// ---------------------------------------------------------------------------
// Empty room
// ---------------------------------------------------------------------------

check('empty room: all counts 0, records_by_rung has every rung key plus unknown at 0', () => {
  withRoom('mindrian-358-b1-portrait-empty-', (db) => {
    const portrait = verification.readVerificationPortrait(db);
    assert.equal(portrait.claims_total, 0);
    assert.equal(portrait.claims_checked, 0);
    assert.equal(portrait.claims_disputed, 0);
    assert.equal(portrait.claims_inconclusive, 0);
    assert.equal(portrait.claims_unchecked, 0);
    for (const key of rungKeys()) {
      assert.equal(portrait.records_by_rung[key], 0, 'rung key ' + key);
    }
  });
});

check('renderPortraitLines always prints all four state lines, including unchecked at 0', () => {
  withRoom('mindrian-358-b1-portrait-empty-render-', (db) => {
    const portrait = verification.readVerificationPortrait(db);
    const lines = verification.renderPortraitLines(portrait).join('\n');
    assert.ok(lines.includes('checked: 0'));
    assert.ok(lines.includes('disputed: 0'));
    assert.ok(lines.includes('inconclusive: 0'));
    assert.ok(lines.includes('unchecked (no checking record yet): 0'));
  });
});

// ---------------------------------------------------------------------------
// Mixed room
// ---------------------------------------------------------------------------

check('four claims across states and rungs count correctly in the portrait', () => {
  withRoom('mindrian-358-b1-portrait-mixed-', (db) => {
    const checkedId = seed(db, 'checked claim.', 'seg-mixed-checked');
    verification.recordClaimVerification(db, {
      claim_id: checkedId, against_id: 'm1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', rung: 4,
    });

    const disputedId = seed(db, 'disputed claim.', 'seg-mixed-disputed');
    verification.recordClaimVerification(db, {
      claim_id: disputedId, against_id: 'm2', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user', rung: 3,
    });
    verification.recordClaimVerification(db, {
      claim_id: disputedId, against_id: 'm3', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', rung: 5,
    });

    const inconclusiveId = seed(db, 'inconclusive claim.', 'seg-mixed-inconclusive');
    verification.recordClaimVerification(db, {
      claim_id: inconclusiveId, against_id: 'm4', against_kind: 'artifact', method: 'compare',
      result: 'inconclusive', checked_by: 'user',
    });

    seed(db, 'unchecked claim.', 'seg-mixed-unchecked');

    const portrait = verification.readVerificationPortrait(db);
    assert.equal(portrait.claims_total, 4);
    assert.equal(portrait.claims_checked, 1);
    assert.equal(portrait.claims_disputed, 1);
    assert.equal(portrait.claims_inconclusive, 1);
    assert.equal(portrait.claims_unchecked, 1);
    assert.equal(portrait.records_total, 4);
    assert.equal(portrait.records_by_result.supports, 2);
    assert.equal(portrait.records_by_result.contradicts, 1);
    assert.equal(portrait.records_by_result.inconclusive, 1);
    assert.equal(portrait.records_by_rung['3'], 1);
    assert.equal(portrait.records_by_rung['4'], 1);
    assert.equal(portrait.records_by_rung['5'], 1);
    assert.equal(portrait.records_by_rung.unknown, 1);
    for (const key of rungKeys()) {
      if (key === '3' || key === '4' || key === '5' || key === 'unknown') continue;
      assert.equal(portrait.records_by_rung[key], 0, 'rung key ' + key);
    }
  });
});

// ---------------------------------------------------------------------------
// All-checked room still shows unchecked
// ---------------------------------------------------------------------------

check('a room where every claim is checked still renders the unchecked line at 0', () => {
  withRoom('mindrian-358-b1-portrait-allchecked-', (db) => {
    const id = seed(db, 'all checked claim.', 'seg-allchecked');
    verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'n1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', rung: 1,
    });
    const portrait = verification.readVerificationPortrait(db);
    assert.equal(portrait.claims_unchecked, 0);
    const lines = verification.renderPortraitLines(portrait).join('\n');
    assert.ok(lines.includes('unchecked (no checking record yet): 0'));
  });
});

// ---------------------------------------------------------------------------
// No-score guard (Canon Part 12)
// ---------------------------------------------------------------------------

check('no key anywhere in the portrait object and no rendered line looks like a score, percent, ratio, grade or coverage figure', () => {
  withRoom('mindrian-358-b1-portrait-noscore-', (db) => {
    seed(db, 'no score claim.', 'seg-noscore');
    const portrait = verification.readVerificationPortrait(db);
    const hits = [];
    deepWalkNoScoreKeys(portrait, 'portrait', hits);
    assert.equal(hits.length, 0, hits.join(', '));
    const lines = verification.renderPortraitLines(portrait);
    for (const line of lines) {
      assert.ok(!/score|percent|pct|ratio|grade|coverage|%/i.test(line), 'line: ' + line);
    }
  });
});

// ---------------------------------------------------------------------------
// Legacy latest-wins data re-derived under the sticky rule
// ---------------------------------------------------------------------------

check('a legacy latest-wins checked record with an earlier contradicts is counted as disputed; a non-claim node is not counted', () => {
  withRoom('mindrian-358-b1-portrait-legacy-', (db) => {
    const id = seed(db, 'legacy claim.', 'seg-legacy');
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
    const props = JSON.parse(row.properties);
    props.verification = {
      status: 'checked',
      records: [
        { against_id: 'l1', against_kind: 'artifact', method: 'compare', result: 'contradicts', checked_by: 'user', checked_at: '2020-01-01T00:00:00Z' },
        { against_id: 'l2', against_kind: 'artifact', method: 'compare', result: 'supports', checked_by: 'user', checked_at: '2020-01-02T00:00:00Z' },
      ],
    };
    db.prepare('UPDATE nodes SET properties = ? WHERE id = ?').run(JSON.stringify(props), id);

    db.exec(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) " +
      "VALUES ('nonclaim:legacy', 'decision', '{}', 'test:legacy', 'system', 0, 0)"
    );

    const portrait = verification.readVerificationPortrait(db);
    assert.equal(portrait.claims_total, 1);
    assert.equal(portrait.claims_disputed, 1);
    assert.equal(portrait.claims_checked, 0);
  });
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
