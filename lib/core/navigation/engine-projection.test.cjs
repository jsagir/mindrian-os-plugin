'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const projection = require('./engine-projection.cjs');

function makeDb(withReviewStatus) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\'' +
    (withReviewStatus ? ', review_status TEXT' : '') + ')');
  db.exec('CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
  return db;
}

function run() {
  for (const withReviewStatus of [false, true]) {
    const db = makeDb(withReviewStatus);
    try {
      const insert = db.prepare('INSERT INTO nodes (id, type, properties' + (withReviewStatus ? ', review_status' : '') + ') VALUES (?, ?, ?' + (withReviewStatus ? ', ?' : '') + ')');
      const values = (id, type, properties, status) => insert.run(...[id, type, JSON.stringify(properties), ...(withReviewStatus ? [status || null] : [])]);
      values('claim:one', 'claim', { title: 'Selected claim', body: 'Only the requested text reaches Eureka.', domain: 'health', source_path: '/private/room/file.md', secret: 'do not export' }, 'proposed');
      values('claim:two', 'claim', { name: 'Second claim', text: 'Second body.' }, 'accepted');
      values('memory_event:private', 'memory_event', { text: 'Excluded system data.' });
      db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run('claim:one', 'claim:two', 'CONTRADICTS', JSON.stringify({ confidence: 0.7, effectiveness: 0.4, transform: 'keep this bounded', created_at: '2024-01-02T00:00:00Z', secret: 'do not export' }));
      db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run('claim:one', 'outside:node', 'INFORMS', '{}');

      const result = projection.projectEngineSnapshot(db, { node_ids: ['claim:two', 'claim:one', 'memory_event:private', 'missing:id'], scope_id: 'room-123' });
      assert.equal(result.ok, true);
      assert.equal(result.scope_id, 'room-123');
      assert.equal(result.snapshot.meta.complete, false);
      assert.equal(result.partial, true, 'incomplete explicit selections are disclosed at top level');
      assert.equal(result.projection_complete, false);
      assert.equal(result.projection_omissions.missing_nodes, 1);
      assert.equal(result.snapshot.nodes.length, 2);
      assert.equal(result.snapshot.edges.length, 1);
      assert.deepEqual(result.snapshot.edges[0], { s: 'claim:one', t: 'claim:two', type: 'CONTRADICTS', attrs: { effectiveness: 0.4, confidence: 0.7, transform: 'keep this bounded', created_at: '2024-01-02T00:00:00Z' } });
      assert.equal(JSON.stringify(result).includes('do not export'), false, 'unlisted edge properties stay private');
      assert.equal(result.snapshot.nodes[0].id, 'claim:one');
      assert.equal(result.snapshot.nodes[0].text, 'Only the requested text reaches Eureka.');
      assert.equal(result.snapshot.nodes[0].source_ref, 'mindrian-graph://node/claim%3Aone');
      assert.equal(result.snapshot.nodes[0].attrs.review_status, withReviewStatus ? 'proposed' : undefined);
      assert.equal(Object.hasOwn(result.snapshot.nodes[0].attrs, 'source_path'), false);
      assert.equal(JSON.stringify(result).includes('do not export'), false);
      assert.deepEqual(result.snapshot.meta.omissions, {
        requested_nodes: 4,
        missing_nodes: 1,
        excluded_system_nodes: 1,
        empty_text_nodes: 0,
        text_truncated_nodes: 0,
        edges_truncated: false,
      });

      const same = projection.projectEngineSnapshot(db, { node_ids: ['claim:one', 'claim:two', 'memory_event:private', 'missing:id'], scope_id: 'room-123' });
      assert.equal(same.snapshot_id, result.snapshot_id, 'snapshot identity is independent of caller ID order');
      assert.throws(() => projection.projectEngineSnapshot(db, { node_ids: ['claim:one', 'claim:one'], scope_id: 'room-123' }), /unique/);
      assert.throws(() => projection.projectEngineSnapshot(db, { node_ids: ['claim:one'], scope_id: '' }), /scope_id/);
    } finally {
      db.close();
    }
  }
  process.stdout.write('engine-projection: PASS\n');
}

run();
