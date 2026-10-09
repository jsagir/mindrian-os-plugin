'use strict';
// Offline tests: synthetic room.db built with node:sqlite in a temp dir. No network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { readRoomGraph } = require('../../lib/core/graph-doctor/reader.cjs');
const { runChecks } = require('../../lib/core/graph-doctor/checks.cjs');
const { runGraphDoctor } = require('../../lib/core/graph-doctor/index.cjs');
const { check } = require('../../lib/core/doctor/graph-doctor-module.cjs');

function makeRoom(rows) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-'));
  fs.mkdirSync(path.join(room, '.mindrian'));
  const db = new DatabaseSync(path.join(room, '.mindrian', 'room.db'));
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\');' +
          'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, PRIMARY KEY(source,target,type));');
  for (const n of rows.nodes) db.prepare('INSERT INTO nodes(id,type,properties) VALUES (?,?,?)').run(n.id, n.type || 'Framework', JSON.stringify({ name: n.name }));
  for (const e of rows.edges) db.prepare('INSERT INTO edges(source,target,type) VALUES (?,?,?)').run(e.source, e.target, e.type || 'RELATED_TO');
  db.close();
  return room;
}

const SAMPLE = {
  nodes: [
    { id: 'a', name: 'Reverse Salient' }, { id: 'b', name: 'Usher Synthesis' },
    { id: 'c', name: 'Four Lenses' }, { id: 'd', name: 'Hats' },
    { id: 'e', name: 'Hats' },             // duplicate name with d
    { id: 'z', name: 'Lonely' },            // isolated
  ],
  edges: [
    { source: 'a', target: 'c' }, { source: 'b', target: 'c' }, { source: 'a', target: 'd' },
    { source: 'b', target: 'd' }, { source: 'c', target: 'missing-node' }, // legal dangling edge
  ],
};

test('reader is read-only and returns nodes and edges', async () => {
  const room = makeRoom(SAMPLE);
  const r = await readRoomGraph(room);
  assert.equal(r.status, 'ok');
  assert.equal(r.nodes.length, 6);
  assert.equal(r.edges.length, 4); // the chokepoint drops the legal dangling edge
  assert.ok(r.dropped_edges >= 1);
});

test('reader skips a room with no room.db and never creates one', async () => {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-none-'));
  const r = await readRoomGraph(room);
  assert.equal(r.status, 'skip');
  assert.equal(fs.existsSync(path.join(room, '.mindrian', 'room.db')), false);
});

test('isolated, duplicate-name and open-triad checks find the planted structure', async () => {
  const room = makeRoom(SAMPLE);
  const snap = await readRoomGraph(room);
  const f = runChecks(snap);
  assert.deepEqual(f.isolated.sort(), ['e', 'z']); // e has no edge (its name twin d is linked)
  assert.equal(f.duplicate_names.length, 1);
  assert.deepEqual(f.duplicate_names[0].ids.sort(), ['d', 'e']);
  const pair = f.open_triads.find((t) => (t.a === 'a' && t.b === 'b') || (t.a === 'b' && t.b === 'a'));
  assert.ok(pair, 'a and b share neighbours c and d and are not linked');
});

test('dangling edge to a missing node is NOT reported as a defect', async () => {
  const room = makeRoom(SAMPLE);
  const r = await runGraphDoctor(room);
  assert.equal(r.status, 'warn');
  assert.equal(r.counts.edges, 4);
  const q = JSON.parse(fs.readFileSync(r.queue_file, 'utf8'));
  assert.ok(!JSON.stringify(q).includes('missing-node'), 'dangling edge must not appear in any proposal');
});

test('run writes a proposal queue, every proposal pending_gate, and never writes room.db', async () => {
  const room = makeRoom(SAMPLE);
  const before = fs.readFileSync(path.join(room, '.mindrian', 'room.db'));
  const r = await runGraphDoctor(room);
  const queue = JSON.parse(fs.readFileSync(r.queue_file, 'utf8'));
  assert.ok(queue.proposals.length > 0);
  assert.ok(queue.proposals.every((p) => p.status === 'pending_gate'));
  assert.ok(queue.proposals.every((p) => p.label === 'COMPUTED' || p.label === 'ESTIMATED'));
  const after = fs.readFileSync(path.join(room, '.mindrian', 'room.db'));
  assert.ok(before.equals(after), 'room.db must be byte-identical after the run');
});

test('doctor module: reports the last queue, skip when none, no fix export', async () => {
  const room = makeRoom(SAMPLE);
  assert.equal(check({ roomDir: room }).status, 'skip'); // no queue yet
  await runGraphDoctor(room);
  const r = check({ roomDir: room });
  assert.ok(['ok', 'warn'].includes(r.status));
  assert.match(r.detail, /pending gate/);
  assert.equal(check({ roomDir: fs.mkdtempSync(path.join(os.tmpdir(), 'gd-empty-')) }).status, 'skip');
  assert.equal(require('../../lib/core/doctor/graph-doctor-module.cjs').fix, undefined);
});
