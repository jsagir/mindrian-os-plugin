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
assert.equal(navigation.classifyFrameChange(frames[0], frames[1]), 'refines');
assert.equal(navigation.classifyFrameChange(frames[0], { governing_thought_hash: 'h3' }), 'relocates');
assert.equal(navigation.FRAME_ORIGINS.has('tasking'), true);
d.close();
console.log('test-b2-frame-provenance: PASS');
