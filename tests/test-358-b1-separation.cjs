'use strict';

// Phase 358-01, Task 1 (RED). B1-06 legs: review_status and confidence
// byte-identical across every result for proposed and confirmed claims,
// a record survives confirmNode, and a static no-promote / no-Brain guard.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-separation-roomshome-'));
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

function readCore(db, id) {
  const row = db.prepare('SELECT review_status, confidence FROM nodes WHERE id = ?').get(id);
  return { review_status: row.review_status, confidence: row.confidence };
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Byte-identical review_status and confidence (AT4)
// ---------------------------------------------------------------------------

check('recording every result, including a refused resolution and a sticky dispute, never changes review_status or confidence for a proposed claim', () => {
  withRoom('mindrian-358-b1-separation-proposed-', (db) => {
    const id = seed(db, 'separation proposed claim.', 'seg-sep-proposed');
    const before = readCore(db, id);

    const refused = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 's0', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true,
    });
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.reason, 'no_dispute_to_resolve');

    verification.recordClaimVerification(db, {
      claim_id: id, against_id: 's1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', rung: 4,
    });
    const contradictRes = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 's2', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user', rung: 3,
    });
    assert.equal(contradictRes.verification.status, 'disputed');

    const inconclusiveRes = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 's3', against_kind: 'artifact', method: 'compare',
      result: 'inconclusive', checked_by: 'user',
    });
    assert.equal(inconclusiveRes.verification.status, 'disputed');

    const resolvedRes = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 's4', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true, checked_by_id: 'officer-1',
    });
    assert.equal(resolvedRes.ok, true, JSON.stringify(resolvedRes));
    assert.equal(resolvedRes.verification.status, 'checked');

    const after = readCore(db, id);
    assert.deepEqual(after, before);
  });
});

check('recording every result, including a refused resolution and a sticky dispute, never changes review_status or confidence for a confirmed claim', () => {
  withRoom('mindrian-358-b1-separation-confirmed-', (db) => {
    const id = seed(db, 'separation confirmed claim.', 'seg-sep-confirmed');
    const confirmResult = navigation.confirmNode(db, id, 'navigator', 'test-confirm');
    assert.equal(confirmResult.ok, true, JSON.stringify(confirmResult));
    const before = readCore(db, id);
    assert.equal(before.review_status, 'confirmed');

    const refused = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 't0', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true,
    });
    assert.equal(refused.ok, false, JSON.stringify(refused));
    assert.equal(refused.reason, 'no_dispute_to_resolve');

    verification.recordClaimVerification(db, {
      claim_id: id, against_id: 't1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', rung: 4,
    });
    const contradictRes = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 't2', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user', rung: 3,
    });
    assert.equal(contradictRes.verification.status, 'disputed');

    const inconclusiveRes = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 't3', against_kind: 'artifact', method: 'compare',
      result: 'inconclusive', checked_by: 'user',
    });
    assert.equal(inconclusiveRes.verification.status, 'disputed');

    const resolvedRes = verification.recordClaimVerification(db, {
      claim_id: id, against_id: 't4', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user', resolves_dispute: true, checked_by_id: 'officer-1',
    });
    assert.equal(resolvedRes.ok, true, JSON.stringify(resolvedRes));
    assert.equal(resolvedRes.verification.status, 'checked');

    const after = readCore(db, id);
    assert.deepEqual(after, before);
  });
});

check('confirmNode called after two records leaves props.verification.records length 2', () => {
  withRoom('mindrian-358-b1-separation-survives-confirm-', (db) => {
    const id = seed(db, 'survives confirm claim.', 'seg-sep-survives');
    verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'u1', against_kind: 'artifact', method: 'compare',
      result: 'supports', checked_by: 'user',
    });
    verification.recordClaimVerification(db, {
      claim_id: id, against_id: 'u2', against_kind: 'artifact', method: 'compare',
      result: 'contradicts', checked_by: 'user',
    });
    const confirmResult = navigation.confirmNode(db, id, 'navigator', 'test-confirm');
    assert.equal(confirmResult.ok, true, JSON.stringify(confirmResult));
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
    const props = JSON.parse(row.properties);
    assert.equal(props.verification.records.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Static no-promote / no-Brain guard (T-358-02, T-358-05)
// ---------------------------------------------------------------------------

check('verification.cjs, claim-verify.cjs and claim-checks.cjs never call confirmNode or promoteNodeStatus and never touch the Brain client; claim-verify.cjs and claim-checks.cjs never require node:sqlite or DatabaseSync directly', () => {
  const targets = [
    path.join(REPO_ROOT, 'lib/core/navigation/verification.cjs'),
    path.join(REPO_ROOT, 'lib/mcp/tools/claim-verify.cjs'),
    path.join(REPO_ROOT, 'scripts/claim-checks.cjs'),
  ];
  const forbidden = ['confirmNode(', 'promoteNodeStatus(', 'brain-client', 'brainClient', 'brain_'];
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    const stripped = stripComments(fs.readFileSync(file, 'utf8'));
    for (const token of forbidden) {
      assert.ok(!stripped.includes(token), file + ' contains forbidden token ' + token);
    }
    if (file.endsWith('claim-verify.cjs') || file.endsWith('claim-checks.cjs')) {
      assert.ok(!stripped.includes('node:sqlite'), file + ' requires node:sqlite directly');
      assert.ok(!stripped.includes('DatabaseSync'), file + ' references DatabaseSync directly');
    }
  }
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
