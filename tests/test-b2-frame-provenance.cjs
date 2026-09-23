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
const first = navigation.writeFrameNode(d, {
  frameKey: 'camera-question', versionKey: 'camera-question:v1', sessionId: 'b2',
  members: ['section:camera'], origin: 'chosen', governingThoughtHash: 'h1',
});
const second = navigation.writeFrameNode(d, {
  frameKey: 'camera-question', versionKey: 'camera-question:v2', sessionId: 'b2',
  members: ['section:camera', 'section:market'], origin: 'prompt',
  governingThoughtHash: 'h2', predecessorHash: 'h1', changeKind: 'refines',
  refinementHandle: 'artifact:why-old-question-was-wrong',
});
assert.equal(first.ok, true);
assert.equal(second.ok, true);
const frames = navigation.readFrameProvenance(d, { sessionId: 'b2' });
assert.equal(frames.length, 2);
assert.equal(frames[0].origin, 'chosen');
assert.equal(frames[1].origin, 'prompt');
assert.equal(frames[1].refinement_handle, 'artifact:why-old-question-was-wrong');
// Phase 358-07 hardening: readFrameProvenance now also carries a numeric
// created_at and an ISO set_at on every returned frame (additive).
assert.equal(typeof frames[0].created_at, 'number');
assert.equal(typeof frames[1].created_at, 'number');
assert.equal(typeof frames[0].set_at, 'string');
assert.ok(!Number.isNaN(new Date(frames[0].set_at).getTime()));
assert.equal(navigation.classifyFrameChange(frames[0], frames[1]), 'refines');
assert.equal(navigation.classifyFrameChange(frames[0], { governing_thought_hash: 'h3' }), 'relocates');
assert.equal(navigation.FRAME_ORIGINS.has('tasking'), true);

// Phase 358-07: one role write for the governing-question record, and the two
// readers (readFrameProvenance + readGoverningQuestionVersions) both see it.
const roleWrite = navigation.writeFrameNode(d, {
  frameRole: navigation.GOVERNING_QUESTION_ROLE,
  version: 1,
  origin: 'chosen',
  governingThoughtHash: 'sha256:' + 'a'.repeat(64),
  questionHandle: '.mindrian/frames/q-v1-aaaaaaaa-bbbbbb.md',
});
assert.equal(roleWrite.ok, true, JSON.stringify(roleWrite));
const roleProvenance = navigation.readFrameProvenance(d).find((f) => f.node_id === roleWrite.node_id);
assert.ok(roleProvenance, 'the role write must be readable via readFrameProvenance');
assert.equal(roleProvenance.version, 1);
const roleVersions = navigation.readGoverningQuestionVersions(d);
assert.equal(roleVersions.length, 1);
assert.equal(roleVersions[0].node_id, roleWrite.node_id);
assert.equal(roleVersions[0].version, 1);

d.close();
console.log('test-b2-frame-provenance: PASS');
