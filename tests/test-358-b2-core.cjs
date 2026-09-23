'use strict';

// Phase 358-07, Task 1 (RED). B2-01/B2-02/B2-03/B2-07 core legs: the
// hardened frame substrate (S legs, lib/core/navigation/typed-frame.cjs
// through navigation.cjs) and the one write door (D legs,
// lib/core/frame-provenance.cjs) for the room's ONE governing-question
// record.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic env, set BEFORE any lib require (same seam as test-358-b1-core.cjs).
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-core-home-'));
process.env.MINDRIAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-core-mhome-'));
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-core-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_BRAIN_KEY;

const navigation = require('../lib/core/navigation.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

// frame-provenance.cjs required inside a try so a missing module produces
// one FAIL line per D leg, not a crash of the whole file.
let frameProvenance = null;
let frameProvenanceLoadError = null;
try {
  frameProvenance = require('../lib/core/frame-provenance.cjs');
} catch (e) {
  frameProvenanceLoadError = e;
}
function requireDoor() {
  if (!frameProvenance) {
    throw new Error(
      'lib/core/frame-provenance.cjs not landed yet: '
      + (frameProvenanceLoadError && frameProvenanceLoadError.message)
    );
  }
  return frameProvenance;
}

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

const Q1 = 'Which camera solves the delay?';
const Q2 = 'Which camera works with sunglasses?';
const Q3 = 'Should the checkpoint move north?';
const A2 = 'It assumed the delay was the camera, but the officers wear sunglasses.';

function baseRoleParams(overrides) {
  return Object.assign({
    frameRole: navigation.GOVERNING_QUESTION_ROLE,
    version: 1,
    origin: 'chosen',
    governingThoughtHash: 'sha256:' + 'a'.repeat(64),
    questionHandle: '.mindrian/frames/q-v1-aaaaaaaa-bbbbbb.md',
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// S legs: substrate (typed-frame.cjs through navigation.cjs)
// ---------------------------------------------------------------------------

check('S1: FRAME_ORIGINS_ORDERED ids in order with labels; FRAME_ORIGINS matches; frameOriginInfo position and null', () => {
  const ids = navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id);
  assert.deepEqual(ids, ['chosen', 'tasking', 'prompt', 'inherited']);
  for (const o of navigation.FRAME_ORIGINS_ORDERED) {
    assert.equal(typeof o.label, 'string');
    assert.ok(o.label.length > 0, 'label must be non-empty for ' + o.id);
  }
  assert.equal(navigation.FRAME_ORIGINS instanceof Set, true);
  assert.deepEqual(Array.from(navigation.FRAME_ORIGINS).sort(), ids.slice().sort());
  assert.equal(navigation.frameOriginInfo('tasking').position, 2);
  assert.equal(navigation.frameOriginInfo('bogus'), null);
});

check('S2: role write refuses missing/invalid origin, taxonomy, version, and change-kind shapes, writing no row', () => {
  withRoom('mindrian-358-b2-core-s2-', (db) => {
    let r = navigation.writeFrameNode(db, baseRoleParams({ origin: undefined }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_origin');

    r = navigation.writeFrameNode(db, baseRoleParams({ origin: 'bogus' }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_origin');

    let cnt = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).get();
    assert.equal(cnt.n, 0, 'no row must have been written by the invalid_origin refusals');

    r = navigation.writeFrameNode(db, baseRoleParams({ taxonomy: true }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'taxonomy_not_allowed');

    r = navigation.writeFrameNode(db, baseRoleParams({ version: 0 }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_version');

    r = navigation.writeFrameNode(db, baseRoleParams({ version: 1.5 }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_version');

    r = navigation.writeFrameNode(db, baseRoleParams({
      version: 2,
      changeKind: 'refines',
      predecessorHash: 'sha256:' + 'b'.repeat(64),
      predecessorNodeId: navigation.GOVERNING_QUESTION_NODE_ID(1),
    }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'refines_needs_account_handle');

    r = navigation.writeFrameNode(db, baseRoleParams({
      version: 2,
      predecessorHash: 'sha256:' + 'b'.repeat(64),
      predecessorNodeId: navigation.GOVERNING_QUESTION_NODE_ID(1),
    }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_change_kind');

    r = navigation.writeFrameNode(db, baseRoleParams({ changeKind: 'refines' }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_change_kind');

    cnt = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).get();
    assert.equal(cnt.n, 0, 'no row must have landed from any of the refusals above');
  });
});

check('S3: a valid v1 role write lands the correct node; re-writing v1 is refused version_exists, row byte-identical', () => {
  withRoom('mindrian-358-b2-core-s3-', (db) => {
    const r = navigation.writeFrameNode(db, baseRoleParams({}));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.node_id, navigation.GOVERNING_QUESTION_NODE_ID(1));
    assert.equal(r.type, 'frame');
    assert.equal(r.version, 1);

    const before = db.prepare(
      'SELECT properties, created_at, review_status, source_path FROM nodes WHERE id = ?'
    ).get(r.node_id);
    assert.ok(before, 'the role node must be queryable');
    assert.equal(before.review_status, 'proposed');
    assert.equal(before.source_path, 'frame:room:governing-question');
    const props = JSON.parse(before.properties);
    assert.equal(props.frame_role, 'governing_question');
    assert.equal(props.version, 1);
    assert.equal(props.origin, 'chosen');

    const r2 = navigation.writeFrameNode(db, baseRoleParams({ origin: 'tasking' }));
    assert.equal(r2.ok, false);
    assert.equal(r2.reason, 'version_exists');

    const after = db.prepare(
      'SELECT properties, created_at, review_status, source_path FROM nodes WHERE id = ?'
    ).get(r.node_id);
    assert.deepEqual(after, before, 'the v1 row must stay byte-identical after a refused re-write');
  });
});

check('S4: readGoverningQuestionVersions is ordered oldest-first with set_at/created_at; readFrameProvenance carries the new fields', () => {
  withRoom('mindrian-358-b2-core-s4-', (db) => {
    const w1 = navigation.writeFrameNode(db, baseRoleParams({ version: 1 }));
    const w2 = navigation.writeFrameNode(db, baseRoleParams({
      version: 2,
      changeKind: 'relocates',
      predecessorHash: 'sha256:' + 'b'.repeat(64),
      predecessorNodeId: w1.node_id,
      questionHandle: '.mindrian/frames/q-v2-cccccccc-dddddd.md',
    }));
    assert.equal(w1.ok, true);
    assert.equal(w2.ok, true);

    const versions = navigation.readGoverningQuestionVersions(db);
    assert.equal(versions.length, 2);
    assert.equal(versions[0].version, 1);
    assert.equal(versions[1].version, 2);
    for (const v of versions) {
      assert.equal(typeof v.created_at, 'number');
      assert.ok(!Number.isNaN(new Date(v.set_at).getTime()), 'set_at must be a valid ISO string');
    }

    const f1 = navigation.writeFrameNode(db, { frameKey: 'fusion-1', sessionId: 's1', members: ['section:a'] });
    const f2 = navigation.writeFrameNode(db, { frameKey: 'fusion-2', sessionId: 's1', members: ['section:b'] });
    assert.equal(f1.ok, true);
    assert.equal(f2.ok, true);

    const prov = navigation.readFrameProvenance(db);
    const roleProv = prov.filter((p) => p.node_id === w1.node_id || p.node_id === w2.node_id);
    assert.equal(roleProv.length, 2);
    for (const p of roleProv) {
      assert.equal(typeof p.version, 'number');
      assert.equal(typeof p.created_at, 'number');
      assert.ok(!Number.isNaN(new Date(p.set_at).getTime()));
      assert.equal(typeof p.question_handle, 'string');
    }

    const plainProv = prov.filter((p) => p.node_id === f1.node_id || p.node_id === f2.node_id);
    assert.equal(plainProv.length, 2);
    assert.equal(plainProv[0].node_id, f1.node_id, 'plain frames stay in insertion order');
    assert.equal(plainProv[1].node_id, f2.node_id, 'plain frames stay in insertion order');
  });
});

check('S5: readOpenFrames excludes governing_question role rows but returns a plain FUSION frame', () => {
  // eslint-disable-next-line global-require
  const typedFrame = require('../lib/core/navigation/typed-frame.cjs');
  withRoom('mindrian-358-b2-core-s5-', (db) => {
    navigation.writeFrameNode(db, baseRoleParams({ version: 1 }));
    const fusion = navigation.writeFrameNode(db, { frameKey: 'fusion-a', sessionId: 's1', members: ['section:a'] });
    assert.equal(fusion.ok, true);

    const open = typedFrame.readOpenFrames(db, { sessionId: '' });
    const hasRole = open.some((f) => f.frameKey === 'governing-question');
    assert.equal(hasRole, false, 'readOpenFrames must never return a governing-question version');
    const hasFusion = open.some((f) => f.node_id === fusion.node_id);
    assert.equal(hasFusion, true, 'a plain FUSION frame must still come back');
  });
});

// ---------------------------------------------------------------------------
// D legs: the door (lib/core/frame-provenance.cjs setGoverningQuestion)
// ---------------------------------------------------------------------------

check('D1: the first question lands version 1 and writes the question artifact', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d1-', (db, dir) => {
    const r = door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.result, 'first');
    assert.equal(r.version, 1);
    assert.match(r.question_handle, /^\.mindrian\/frames\/q-v1-[0-9a-f]{8}-[0-9a-f]{6}\.md$/);
    const filePath = path.join(dir, r.question_handle);
    assert.ok(fs.existsSync(filePath), 'the question artifact must exist');
    const content = fs.readFileSync(filePath, 'utf8').trim();
    assert.equal(content, door.normalizeQuestion(Q1));
  });
});

check('D2: a normalized re-submission of the same question is unchanged; questionHash matches for both spellings', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d2-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    const r = door.setGoverningQuestion(db, dir, { text: '  Which  camera\tsolves the delay? ', origin: 'tasking' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.result, 'unchanged');
    const cnt = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).get();
    assert.equal(cnt.n, 1);
    const h1 = door.questionHash(Q1);
    const h2 = door.questionHash('  Which  camera\tsolves the delay? ');
    assert.equal(h1, h2);
    assert.match(h1, /^sha256:[0-9a-f]{64}$/);
  });
});

check('D3: an invalid origin refuses with the allowed ids, writing no new row or file', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d3-', (db, dir) => {
    let r = door.setGoverningQuestion(db, dir, { text: Q1 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_origin');
    assert.deepEqual(r.allowed, navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id));

    r = door.setGoverningQuestion(db, dir, { text: Q1, origin: 'bogus' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_origin');

    const cnt = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).get();
    assert.equal(cnt.n, 0);
    const framesDir = path.join(dir, '.mindrian', 'frames');
    const files = fs.existsSync(framesDir) ? fs.readdirSync(framesDir) : [];
    assert.equal(files.length, 0);
  });
});

check('D4: a changed question with no account and no relocate is refused change_needs_account with the ask and pending files', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d4-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    const r = door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'change_needs_account');
    assert.equal(r.ask, 'What did the old question get wrong?');
    assert.equal(r.previous.version, 1);
    assert.equal(r.previous.text, Q1);
    assert.equal(r.previous.origin, 'tasking');
    assert.equal(r.proposed.text, Q2);
    assert.equal(r.pending, true);
    assert.equal(r.card.shape, 'F.1');

    const cnt = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).get();
    assert.equal(cnt.n, 1, 'the refusal must not write a new version');

    const pendingPath = path.join(dir, '.mindrian', 'frames', 'pending.json');
    assert.ok(fs.existsSync(pendingPath));
    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    assert.equal(pending.based_on_version, 1);
    const pendingText = fs.readFileSync(
      path.join(dir, '.mindrian', 'frames', 'pending-question.md'), 'utf8'
    ).trim();
    assert.equal(pendingText, door.normalizeQuestion(Q2));
  });
});

check('D5: a whitespace-only account is absent; account plus relocate is ambiguous; oversize account/text is refused', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d5-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });

    let r = door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: '   ' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'change_needs_account');

    r = door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2, relocate: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ambiguous_change');

    const cnt = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).get();
    assert.equal(cnt.n, 1, 'nothing must land from the ambiguous or absent-account refusals');

    r = door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: 'x'.repeat(4001) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_account');

    r = door.setGoverningQuestion(db, dir, { text: 'y'.repeat(1001), origin: 'chosen' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_text');
  });
});

check('D6: an account files the change as refines with the account artifact and one REFINES edge', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d6-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    const r = door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.result, 'refines');
    assert.equal(r.version, 2);
    assert.equal(r.account_text, A2);

    const versions = navigation.readGoverningQuestionVersions(db);
    const v1 = versions.find((v) => v.version === 1);
    const v2 = versions.find((v) => v.version === 2);
    assert.equal(v2.change_kind, 'refines');
    assert.match(v2.refinement_handle, /^\.mindrian\/frames\/a-v2-[0-9a-f]{8}-[0-9a-f]{6}\.md$/);
    const accountText = fs.readFileSync(path.join(dir, v2.refinement_handle), 'utf8').trim();
    assert.equal(accountText, A2);
    assert.match(v2.account_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(v2.predecessor_hash, v1.question_hash);
    assert.equal(v2.predecessor_node_id, v1.node_id);

    const edges = db.prepare(
      "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'REFINES'"
    ).all(v2.node_id, v1.node_id);
    assert.equal(edges.length, 1);
    assert.deepEqual(JSON.parse(edges[0].properties), { change_kind: 'refines', origin: 'chosen' });

    assert.equal(fs.existsSync(path.join(dir, '.mindrian', 'frames', 'pending.json')), false);
  });
});

check('D7: relocate:true files the change as relocates with a FOLLOWS_FROM edge and no account', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d7-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    const r = door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.result, 'relocates');
    assert.equal(r.version, 3);

    const versions = navigation.readGoverningQuestionVersions(db);
    const v2 = versions.find((v) => v.version === 2);
    const v3 = versions.find((v) => v.version === 3);
    assert.equal(v3.change_kind, 'relocates');
    assert.equal(v3.refinement_handle, null);

    const edges = db.prepare(
      "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'FOLLOWS_FROM'"
    ).all(v3.node_id, v2.node_id);
    assert.equal(edges.length, 1);
    assert.deepEqual(JSON.parse(edges[0].properties), { change_kind: 'relocates', origin: 'prompt' });
  });
});

check('D8: returning to an earlier question text after later versions is still a change', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d8-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    let r = door.setGoverningQuestion(db, dir, { text: Q1, origin: 'chosen' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'change_needs_account');

    r = door.setGoverningQuestion(db, dir, { text: Q1, origin: 'chosen', relocate: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.version, 4);
  });
});

check('D9: the v1 row stays byte-identical through D1-D8; every role row proposed; no SUPERSEDES anywhere', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d9-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    const v1Id = navigation.GOVERNING_QUESTION_NODE_ID(1);
    const snapshot = db.prepare(
      'SELECT properties, created_at, review_status FROM nodes WHERE id = ?'
    ).get(v1Id);

    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'chosen', relocate: true });

    const after = db.prepare(
      'SELECT properties, created_at, review_status FROM nodes WHERE id = ?'
    ).get(v1Id);
    assert.deepEqual(after, snapshot);

    const roleRows = db.prepare(
      "SELECT review_status FROM nodes WHERE json_extract(properties,'$.frame_role') = 'governing_question'"
    ).all();
    assert.ok(roleRows.length >= 4);
    for (const row of roleRows) assert.equal(row.review_status, 'proposed');

    const superEdges = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'SUPERSEDES'").get();
    assert.equal(superEdges.n, 0);
    const superRows = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE review_status = 'superseded'").get();
    assert.equal(superRows.n, 0);
  });
});

check('D10: a stale based_on_version against the real latest is refused question_changed_meanwhile', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d10-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    const r = door.setGoverningQuestion(db, dir, {
      text: 'Something else entirely', origin: 'chosen', relocate: true, based_on_version: 2,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'question_changed_meanwhile');
    assert.equal(r.current.version, 3);
  });
});

check('D11: cancel clears a pending change; a second cancel returns nothing_pending', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d11-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen' });

    let r = door.setGoverningQuestion(db, dir, { cancel: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.result, 'cancelled');
    assert.equal(fs.existsSync(path.join(dir, '.mindrian', 'frames', 'pending.json')), false);
    assert.equal(fs.existsSync(path.join(dir, '.mindrian', 'frames', 'pending-question.md')), false);

    r = door.setGoverningQuestion(db, dir, { cancel: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'nothing_pending');
  });
});

check('D12: account or relocate on the very first set is refused no_previous_question; a null roomDir is refused no_room_dir', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d12-', (db, dir) => {
    let r = door.setGoverningQuestion(db, dir, { text: Q1, origin: 'chosen', account: A2 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_previous_question');

    r = door.setGoverningQuestion(db, dir, { text: Q1, origin: 'chosen', relocate: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_previous_question');

    r = door.setGoverningQuestion(db, null, { text: Q1, origin: 'chosen' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_room_dir');
  });
});

check('D13: every artifact file name is generated; no file name contains a question or account word', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-core-d13-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    const framesDir = path.join(dir, '.mindrian', 'frames');
    const files = fs.readdirSync(framesDir);
    assert.ok(files.length > 0);
    const forbiddenWords = [Q1, Q2, Q3, A2]
      .flatMap((t) => t.split(/\s+/))
      .map((w) => w.replace(/[^a-zA-Z]/g, ''))
      .filter((w) => w.length > 3);
    for (const f of files) {
      assert.ok(
        /^(q-|a-)/.test(f) || f === 'pending.json' || f === 'pending-question.md',
        'unexpected file name shape: ' + f
      );
      for (const w of forbiddenWords) {
        assert.equal(f.toLowerCase().includes(w.toLowerCase()), false, f + ' contains the word ' + w);
      }
    }
  });
});

process.stdout.write('passed=' + passed + ' failed=' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
