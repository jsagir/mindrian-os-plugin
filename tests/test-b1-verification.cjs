'use strict';

const assert = require('node:assert/strict');
const navigation = require('../lib/core/navigation.cjs');

function db() {
  const { DatabaseSync } = require('node:sqlite');
  const d = new DatabaseSync(':memory:');
  d.exec("CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', source_path TEXT NOT NULL, created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), confidence REAL, review_status TEXT NOT NULL DEFAULT 'proposed', created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)");
  return d;
}

const d = db();
const claim = navigation.writeClaimNode(d, {
  knowledge_type: 'fact', text: 'The room has a verification gap.', sessionId: 'b1', sourceSegment: 'c1',
});
assert.equal(claim.ok, true);
const record = navigation.recordClaimVerification(d, {
  claim_id: claim.node_id,
  against_id: 'artifact:source-1',
  against_kind: 'artifact', method: 'compare', result: 'supports', checked_by: 'user',
  checked_at: '2026-09-23T00:00:00Z', note_handle: 'artifact:note-1',
});
assert.equal(record.ok, true);
const row = d.prepare('SELECT properties, review_status FROM nodes WHERE id = ?').get(claim.node_id);
const props = JSON.parse(row.properties);
assert.equal(row.review_status, 'proposed');
assert.equal(props.verification.status, 'checked');
assert.equal(props.verification.records[0].against_id, 'artifact:source-1');
assert.equal(props.verification.records[0].note_handle, 'artifact:note-1');
const portrait = navigation.readVerificationPortrait(d);
assert.deepEqual(portrait, {
  claims_total: 1, claims_unchecked: 0, claims_checked: 1, claims_disputed: 0,
  claims_inconclusive: 0, records_total: 1,
  records_by_result: { supports: 1, contradicts: 0, inconclusive: 0 },
});
assert.equal(navigation.recordClaimVerification(d, {
  claim_id: claim.node_id, against_id: 'source:x', against_kind: 'source',
  method: 'bad', result: 'supports',
}).reason, 'invalid_method');
d.close();
console.log('test-b1-verification: PASS');
