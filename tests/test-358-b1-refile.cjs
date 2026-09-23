'use strict';

// Phase 358-02, Task 1 (RED). B1-03: a checking record must survive a
// re-file of the same claim through every re-projection shape (claim_write,
// graph-derivation style, extraProps re-projection), and an extraProps bag
// must never be able to forge, replace or wipe it (T-358-08/09/10).
//
// Hermetic setup mirrors tests/test-276-claim-write-primitive.cjs and
// tests/test-358-b1-core.cjs: MINDRIAN_MCP_FIRST='all' for this process
// only, a fresh MINDRIAN_ROOMS_HOME so no real room registry redirects a
// write, CLAUDE_ACTIVE_ROOM deleted.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

process.env.MINDRIAN_MCP_FIRST = 'all';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b1-refile-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;

const REPO_ROOT = path.join(__dirname, '..');
const navigation = require('../lib/core/navigation.cjs');
const typedClaim = require('../lib/core/navigation/typed-claim.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { registerCoreTools } = require('../lib/mcp/register-core-tools.cjs');

let passed = 0;
let failed = 0;
const failMessages = [];

async function check(label, fn) {
  try {
    await fn();
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

function seed(db, params) {
  const r = navigation.writeClaimNode(db, params);
  assert.equal(r.ok, true, 'seed claim write failed: ' + JSON.stringify(r));
  return r.node_id;
}

function record(db, claimId, overrides) {
  const params = Object.assign({
    claim_id: claimId,
    against_id: 'field note, exercise 02',
    against_kind: 'observation',
    method: 'compare',
    result: 'contradicts',
    checked_by: 'user',
  }, overrides || {});
  const r = navigation.recordClaimVerification(db, params);
  assert.equal(r.ok, true, 'record write failed: ' + JSON.stringify(r));
  return r;
}

function registerAndCapture(roomDir) {
  const captured = new Map();
  const stubServer = {
    tool: (name, description, schema, handler) => {
      captured.set(name, { description, schema, handler });
    },
  };
  registerCoreTools(stubServer, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });
  return captured;
}

async function callTool(reg, params) {
  const raw = await reg.handler(params, { sessionId: 'test-358-refile' });
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  return { raw, result: text ? JSON.parse(text) : null };
}

async function main() {
  process.stdout.write('Phase 358-02, Task 1: RED-first re-file regression (B1-03)\n\n');

  // ---------------------------------------------------------------------
  // refile 1: writeClaimNode then recordClaimVerification (contradicts)
  // then the identical writeClaimNode again -- props.verification
  // deep-equals the value read before the re-file; portrait
  // claims_disputed 1, records_total 1.
  // ---------------------------------------------------------------------
  await check('refile 1: an identical writeClaimNode re-file keeps the checking record byte-for-byte', () => {
    withRoom('mindrian-358-refile-1-', (db) => {
      const params = {
        knowledge_type: 'fact', text: 'the bridge at grid 42 is passable.',
        sessionId: 's358r', sourceSegment: 'seg-1', sourceSpeaker: 'officer-a',
      };
      const id = seed(db, params);
      record(db, id);

      const before = navigation.readClaimVerification(db, id);
      assert.equal(before.ok, true);

      const refiled = navigation.writeClaimNode(db, params);
      assert.equal(refiled.ok, true, JSON.stringify(refiled));
      assert.equal(refiled.node_id, id, 're-file must upsert the same node id');

      const after = navigation.readClaimVerification(db, id);
      assert.equal(after.ok, true);
      assert.deepEqual(after.claim.checking_record, before.claim.checking_record,
        're-file must not alter the checking record');

      const portrait = navigation.readVerificationPortrait(db);
      assert.equal(portrait.claims_disputed, 1);
      assert.equal(portrait.records_total, 1);
    });
  });

  // ---------------------------------------------------------------------
  // refile 2 (graph-derivation style): the original write carries extra
  // fields (sourceSpeaker); the re-save passes ONLY knowledge_type, text,
  // sessionId and sourceSegment (the exact shape
  // lib/core/graph-derivation.cjs:330 uses) -- the record survives even
  // though the re-save's own shape is narrower.
  // ---------------------------------------------------------------------
  await check('refile 2: a graph-derivation style re-save (4 keys only) keeps the record', () => {
    withRoom('mindrian-358-refile-2-', (db) => {
      const full = {
        knowledge_type: 'fact', text: 'unit 7 crossed the river at dawn.',
        sessionId: 's358r', sourceSegment: 'seg-2', sourceSpeaker: 'officer-b',
        conditions: 'daylight',
      };
      const id = seed(db, full);
      record(db, id, { result: 'supports' });

      const minimal = {
        knowledge_type: 'fact', text: full.text, sessionId: full.sessionId, sourceSegment: full.sourceSegment,
      };
      const refiled = navigation.writeClaimNode(db, minimal);
      assert.equal(refiled.ok, true, JSON.stringify(refiled));
      assert.equal(refiled.node_id, id);

      const after = navigation.readClaimVerification(db, id);
      assert.equal(after.ok, true);
      assert.equal(after.claim.checking_record.records_total, 1);
      assert.equal(after.claim.checking_record.status, 'checked');
    });
  });

  // ---------------------------------------------------------------------
  // refile 3 (extraProps re-projection, domain-insight-sweep / close-loop
  // style): a re-save with extraProps {pipeline, run_id} keeps the record
  // AND stores pipeline and run_id.
  // ---------------------------------------------------------------------
  await check('refile 3: an extraProps re-projection keeps the record and stores pipeline/run_id', () => {
    withRoom('mindrian-358-refile-3-', (db) => {
      const id = seed(db, {
        knowledge_type: 'fact', text: 'the supply cache is at map ref 19.',
        sessionId: 's358r', sourceSegment: 'seg-3',
      });
      record(db, id, { result: 'supports' });

      const refiled = navigation.writeClaimNode(db, {
        knowledge_type: 'fact', text: 'the supply cache is at map ref 19.',
        sessionId: 's358r', sourceSegment: 'seg-3',
        extraProps: { pipeline: 'p358', run_id: 'r1' },
      });
      assert.equal(refiled.ok, true, JSON.stringify(refiled));

      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
      const props = JSON.parse(row.properties);
      assert.equal(props.pipeline, 'p358');
      assert.equal(props.run_id, 'r1');
      assert.ok(
        props.verification && Array.isArray(props.verification.records) && props.verification.records.length === 1,
        'the checking record must survive an extraProps re-projection'
      );
    });
  });

  // ---------------------------------------------------------------------
  // refile 4 (forgery): extraProps.verification on a claim holding a
  // contradicts record leaves the stored verification unchanged; the same
  // extraProps on a claim with no record leaves NO verification key.
  // PROTECTED_CLAIM_KEYS includes verification, valid_from and valid_until.
  // ---------------------------------------------------------------------
  await check('refile 4a: extraProps cannot forge a verification record over a real one', () => {
    withRoom('mindrian-358-refile-4a-', (db) => {
      const id = seed(db, {
        knowledge_type: 'fact', text: 'the perimeter held through the night.',
        sessionId: 's358r', sourceSegment: 'seg-4a',
      });
      record(db, id);
      const before = navigation.readClaimVerification(db, id);

      const forged = navigation.writeClaimNode(db, {
        knowledge_type: 'fact', text: 'the perimeter held through the night.',
        sessionId: 's358r', sourceSegment: 'seg-4a',
        extraProps: { verification: { status: 'checked', records: [] } },
      });
      assert.equal(forged.ok, true, JSON.stringify(forged));

      const after = navigation.readClaimVerification(db, id);
      assert.deepEqual(after.claim.checking_record, before.claim.checking_record,
        'a forged extraProps.verification must never overwrite the real record');
    });
  });

  await check('refile 4b: extraProps.verification on a claim with no prior record leaves no verification key', () => {
    withRoom('mindrian-358-refile-4b-', (db) => {
      const id = seed(db, {
        knowledge_type: 'fact', text: 'the radio checks failed twice.',
        sessionId: 's358r', sourceSegment: 'seg-4b',
      });
      const forged = navigation.writeClaimNode(db, {
        knowledge_type: 'fact', text: 'the radio checks failed twice.',
        sessionId: 's358r', sourceSegment: 'seg-4b',
        extraProps: {
          verification: {
            status: 'checked',
            records: [{
              against_id: 'x', against_kind: 'artifact', method: 'read',
              result: 'supports', checked_by: 'user', checked_at: 'now',
            }],
          },
        },
      });
      assert.equal(forged.ok, true, JSON.stringify(forged));
      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
      const props = JSON.parse(row.properties);
      assert.equal(Object.prototype.hasOwnProperty.call(props, 'verification'), false,
        'no prior record means no verification key, forged or not');
    });
  });

  await check('refile 4c: PROTECTED_CLAIM_KEYS includes verification, valid_from and valid_until', () => {
    assert.ok(typedClaim.PROTECTED_CLAIM_KEYS.indexOf('verification') !== -1);
    assert.ok(typedClaim.PROTECTED_CLAIM_KEYS.indexOf('valid_from') !== -1);
    assert.ok(typedClaim.PROTECTED_CLAIM_KEYS.indexOf('valid_until') !== -1);
  });

  // ---------------------------------------------------------------------
  // refile 5 (no record): re-filing a claim that never had a record
  // produces props with no verification key.
  // ---------------------------------------------------------------------
  await check('refile 5: re-filing a claim with no prior record never adds a verification key', () => {
    withRoom('mindrian-358-refile-5-', (db) => {
      const params = {
        knowledge_type: 'fact', text: 'no one has checked this yet.',
        sessionId: 's358r', sourceSegment: 'seg-5',
      };
      const id = seed(db, params);
      const refiled = navigation.writeClaimNode(db, params);
      assert.equal(refiled.ok, true, JSON.stringify(refiled));
      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
      const props = JSON.parse(row.properties);
      assert.equal(Object.prototype.hasOwnProperty.call(props, 'verification'), false);
    });
  });

  // ---------------------------------------------------------------------
  // refile 6 (claim_write, MCP surface): claim_write then a record through
  // navigation then the identical claim_write again -- the record is
  // still there. MINDRIAN_MCP_FIRST='all' is already set for this whole
  // process.
  // ---------------------------------------------------------------------
  await check('refile 6: claim_write re-file through the MCP tool keeps the record', async () => {
    const dir = makeTempRoom('mindrian-358-refile-6-');
    const captured = registerAndCapture(dir);
    const claimWrite = captured.get('claim_write');
    assert.ok(claimWrite, 'claim_write must be registered');

    const first = await callTool(claimWrite, {
      knowledge_type: 'fact', text: 'the checkpoint logged every vehicle.', source_segment: 'seg-mcp',
    });
    assert.equal(first.result.ok, true, JSON.stringify(first.result));
    const nodeId = first.result.node_id;
    assert.ok(typeof nodeId === 'string' && nodeId.length > 0);

    const db = navigation.openRoomDbForCaller(dir);
    try {
      record(db, nodeId, { result: 'contradicts' });
    } finally {
      navigation.closeRoomDbForCaller(db);
    }

    const second = await callTool(claimWrite, {
      knowledge_type: 'fact', text: 'the checkpoint logged every vehicle.', source_segment: 'seg-mcp',
    });
    assert.equal(second.result.ok, true, JSON.stringify(second.result));
    assert.equal(second.result.node_id, nodeId);

    const db2 = navigation.openRoomDbForCaller(dir);
    try {
      const view = navigation.readClaimVerification(db2, nodeId);
      assert.equal(view.ok, true);
      assert.equal(view.claim.checking_record.records_total, 1, 'the record must survive a claim_write re-file');
      assert.equal(view.claim.checking_record.status, 'disputed');
    } finally {
      navigation.closeRoomDbForCaller(db2);
    }
  });

  // ---------------------------------------------------------------------
  // refile 7 (review_status): a re-file keeps review_status 'proposed';
  // after navigation.confirmNode the re-file keeps 'confirmed' and keeps
  // the record.
  // ---------------------------------------------------------------------
  await check('refile 7: re-file never changes review_status, before or after confirmNode', () => {
    withRoom('mindrian-358-refile-7-', (db) => {
      const params = {
        knowledge_type: 'fact', text: 'the well at the crossroads is dry.',
        sessionId: 's358r', sourceSegment: 'seg-7',
      };
      const id = seed(db, params);
      record(db, id);

      const refiledProposed = navigation.writeClaimNode(db, params);
      assert.equal(refiledProposed.ok, true, JSON.stringify(refiledProposed));
      let row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
      assert.equal(row.review_status, 'proposed');

      const confirmed = navigation.confirmNode(db, id, 'test-navigator', 'confirmed for the refile test');
      assert.equal(confirmed.ok, true, JSON.stringify(confirmed));

      const refiledConfirmed = navigation.writeClaimNode(db, params);
      assert.equal(refiledConfirmed.ok, true, JSON.stringify(refiledConfirmed));
      row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
      assert.equal(row.review_status, 'confirmed', 're-file must never demote a confirmed claim');

      const view = navigation.readClaimVerification(db, id);
      assert.equal(view.ok, true);
      assert.equal(view.claim.checking_record.records_total, 1, 'the record must survive re-file after confirmation');
    });
  });

  // ---------------------------------------------------------------------
  // refile 8 (malformed prior): a claim row whose properties are the raw
  // string 'not json' re-files with ok true (a carry-forward read failure
  // must never block the write, T-358-10).
  // ---------------------------------------------------------------------
  await check('refile 8: a malformed prior properties blob never blocks a re-file', () => {
    withRoom('mindrian-358-refile-8-', (db) => {
      const params = {
        knowledge_type: 'fact', text: 'the prior row is deliberately corrupted.',
        sessionId: 's358r', sourceSegment: 'seg-8',
      };
      const id = seed(db, params);
      db.prepare('UPDATE nodes SET properties = ? WHERE id = ?').run('not json', id);

      const refiled = navigation.writeClaimNode(db, params);
      assert.equal(refiled.ok, true, JSON.stringify(refiled));
      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
      const props = JSON.parse(row.properties);
      assert.equal(props.text, params.text);
    });
  });

  // ---------------------------------------------------------------------
  // refile 9 (transactions): after writeClaimNode returns, db.isTransaction
  // is false; when the caller ran db.exec('BEGIN') first, writeClaimNode
  // succeeds and db.isTransaction is still true until the caller commits.
  // ---------------------------------------------------------------------
  await check('refile 9: writeClaimNode owns its own transaction unless the caller already began one', () => {
    withRoom('mindrian-358-refile-9-', (db) => {
      const params = {
        knowledge_type: 'fact', text: 'transaction hygiene claim.',
        sessionId: 's358r', sourceSegment: 'seg-9',
      };
      const owned = navigation.writeClaimNode(db, params);
      assert.equal(owned.ok, true, JSON.stringify(owned));
      assert.equal(db.isTransaction, false);

      db.exec('BEGIN');
      const inCallerTxn = navigation.writeClaimNode(db, params);
      assert.equal(inCallerTxn.ok, true, JSON.stringify(inCallerTxn));
      assert.equal(db.isTransaction, true, 'writeClaimNode must never commit a transaction it does not own');
      db.exec('COMMIT');
      assert.equal(db.isTransaction, false);
    });
  });

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main();
